import { router, authProcedure } from '../middleware';
import { z } from 'zod';
import { AiService } from '@server/aiServer';
import { prisma } from '../prisma';
import { TRPCError } from '@trpc/server';
import { CoreMessage } from '@mastra/core';
import { AiModelFactory } from '@server/aiServer/aiModelFactory';
// RebuildEmbeddingJob removed in simplified build (no embeddings/RAG)
import { getAllPathTags } from '@server/lib/helper';
import { ModelCapabilities } from '@server/aiServer/types';
import { aiProviders, aiModels } from '@shared/lib/prismaZodType';
import { fetchWithProxy } from '@server/lib/proxy';
import { inferModelCapabilities } from '@shared/lib/modelTemplates';
import { parseModelRow, parseProviderRow } from '../lib/jsonField';

export const aiRouter = router({
  embeddingUpsert: authProcedure
    .input(z.object({
      id: z.number(),
      content: z.string(),
      type: z.enum(['update', 'insert'])
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, content, type } = input
      const createTime = await prisma.notes.findUnique({ where: { id } }).then(i => i?.createdAt)
      const { ok, error } = await AiService.embeddingUpsert({ id, content, type, createTime: createTime! })
      if (!ok) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error
        })
      }
      return { ok }
    }),

  embeddingInsertAttachments: authProcedure
    .input(z.object({
      id: z.number(),
      filePath: z.string() //api/file/text.pdf
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, filePath } = input
      try {
        const res = await AiService.embeddingInsertAttachments({ id, filePath })
        return res
      } catch (error) {
        return { ok: false, msg: error?.message }
      }
    }),

  embeddingDelete: authProcedure
    .input(z.object({
      id: z.number()
    }))
    .mutation(async ({ input }) => {
      const { id } = input
      try {
        const res = await AiService.embeddingDelete({ id })
        return res
      } catch (error) {
        return { ok: false, msg: error?.message }
      }
    }),

  completions: authProcedure
    .input(z.object({
      question: z.string(),
      withTools: z.boolean().optional(),
      withOnline: z.boolean().optional(),
      withRAG: z.boolean().optional(),
      conversations: z.array(z.object({ role: z.string(), content: z.string() })),
      systemPrompt: z.string().optional()
    }))
    .mutation(async function* ({ input, ctx }) {
      try {
        const { question, conversations, withTools = false, withOnline = false, withRAG = true, systemPrompt } = input
        let _conversations = conversations as CoreMessage[]
        const { result: responseStream, notes } = await AiService.completions({
          question,
          conversations: _conversations,
          ctx,
          withTools,
          withOnline,
          withRAG,
          systemPrompt
        })
        yield { notes }
        for await (const chunk of responseStream.fullStream) {
          yield { chunk }
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message
        })
      }
    }),

  speechToText: authProcedure
    .input(z.object({
      filePath: z.string()
    }))
    .mutation(async function ({ input, ctx }) {
      // const { filePath } = input
      // try {
      //   const localFilePath = await FileService.getFile(filePath)
      //   const doc = await AiService.speechToText(localFilePath)
      //   return doc
      // } catch (error) {
      //   throw new Error(error)
      // }
    }),

  rebuildingEmbeddings: authProcedure
    .input(z.object({
      force: z.boolean().optional()
    }))
    .mutation(async function* ({ input, ctx }) {
      const { force } = input
      try {
        for await (const result of AiService.rebuildEmbeddingIndex({ force })) {
          yield result;
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message
        })
      }
    }),

  summarizeConversationTitle: authProcedure
    .input(z.object({
      conversations: z.array(z.object({ role: z.string(), content: z.string() })),
      conversationId: z.number()
    }))
    .mutation(async function ({ input, ctx }) {
      const { conversations, conversationId } = input
       const agent = await AiModelFactory.SummarizeAgent(undefined, Number(ctx.id))
      const conversationString = JSON.stringify(
        conversations.map(i => ({
          role: i.role,
          content: i.content.replace(/\n/g, '\\n')
        })),
        null, 2
      );
      const result = await agent.generate(conversationString)
      const conversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: { title: result?.text }
      })
      return conversation
    }),

  writing: authProcedure
    .input(z.object({
      question: z.string(),
      type: z.enum(['expand', 'polish', 'custom']).optional(),
      content: z.string().optional()
    }))
    .mutation(async function* ({ input, ctx }) {
      const { question, type = 'custom', content } = input
       const agent = await AiModelFactory.WritingAgent(type, Number(ctx.id))
      const result = await agent.stream([
        {
          role: 'user',
          content: `${question}\n\nThis is the user's note content: ${content || ''}`
        }
      ]);
      for await (const chunk of result.fullStream) {
        yield chunk
      }
    }),
  autoTag: authProcedure
    .input(z.object({
      content: z.string()
    }))
    .mutation(async function ({ input, ctx }) {
       const config = await AiModelFactory.globalConfig(Number(ctx.id));
      const { content } = input
       const tagAgent = await AiModelFactory.TagAgent(config.aiTagsPrompt || undefined, Number(ctx.id));
      const tags = await getAllPathTags();
      const result = await tagAgent.generate(
        `Existing tags list: [${tags.join(', ')}]\nNote content: ${content}\nPlease suggest appropriate tags for this content. Include full hierarchical paths for tags like #Parent/Child instead of just #Child.`
      )
      return result?.text?.trim().split(',').map(tag => tag.trim()).filter(Boolean) ?? []
    }),
  autoEmoji: authProcedure
    .input(z.object({
      content: z.string()
    }))
    .mutation(async function ({ input, ctx }) {
      const { content } = input
       const agent = await AiModelFactory.EmojiAgent(undefined, Number(ctx.id))
      const result = await agent.generate("Please select and suggest appropriate emojis for the above content" + content)
      console.log(result.text)
      return result?.text?.trim().split(',').map(tag => tag.trim()).filter(Boolean) ?? [];
    }),
  AIComment: authProcedure
    .input(z.object({
      content: z.string(),
      noteId: z.number()
    }))
    .mutation(async function ({ input, ctx }) {
      return await AiService.AIComment({ ...input, accountId: Number(ctx.id) })
    }),

  // Embedding procedures removed in simplified build (no RAG / no vector store)
  rebuildEmbeddingStart: authProcedure.mutation(async () => ({ success: false, message: 'Embeddings disabled in simplified build' })),
  rebuildEmbeddingResume: authProcedure.mutation(async () => ({ success: false, message: 'Embeddings disabled in simplified build' })),
  rebuildEmbeddingRetryFailed: authProcedure.mutation(async () => ({ success: false, message: 'Embeddings disabled in simplified build' })),
  rebuildEmbeddingStop: authProcedure.mutation(async () => ({ success: false, message: 'Embeddings disabled in simplified build' })),
  rebuildEmbeddingProgress: authProcedure.query(async () => ({
    current: 0, total: 0, percentage: 0, isRunning: false, results: [], lastUpdate: new Date().toISOString()
  })),

  testConnect: authProcedure
    .input(z.object({
      providerId: z.number(),
      modelKey: z.string(),
      capabilities: z.object({
        inference: z.boolean().optional(),
        tools: z.boolean().optional(),
        image: z.boolean().optional(),
        imageGeneration: z.boolean().optional(),
        video: z.boolean().optional(),
        audio: z.boolean().optional(),
        embedding: z.boolean().optional(),
        rerank: z.boolean().optional()
      })
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { providerId, modelKey, capabilities } = input;

        // Get provider information
        const provider = await prisma.aiProviders.findFirst({
          where: { id: providerId, accountId: Number(ctx.id) }
        });

        if (!provider) {
          throw new Error('Provider not found');
        }

        // Create temporary model configuration for testing
        const tempModelConfig = {
          provider: provider.provider,
          baseURL: provider.baseURL,
          apiKey: provider.apiKey,
          config: provider.config,
          modelKey,
          capabilities
        };

        // Test based on model capabilities
        let testResults: any = {};

        // Test inference capability (chat)
        if (capabilities.inference) {
          try {
            const { LLMProvider } = await import('@server/aiServer/providers');
            const llmProvider = new LLMProvider();
            const languageModel = await llmProvider.getLanguageModel({
              provider: provider.provider,
              apiKey: provider.apiKey,
              baseURL: provider.baseURL,
              modelKey,
              apiVersion: (provider.config as any)?.apiVersion
            });

            // Test simple generation
            const { generateText } = await import('ai');
            const result = await generateText({
              model: languageModel,
              prompt: 'Say "Hello" to test connection'
            });
            testResults.inference = { success: true, response: result.text };
          } catch (error) {
            testResults.inference = { success: false, error: error.message };
          }
        }

        // Embedding test disabled in simplified build
        if (capabilities.embedding) {
          testResults.embedding = { success: false, error: 'Embeddings disabled in simplified build' };
        }

        // Test audio capability (speech recognition)
        if (capabilities.audio) {
          throw new Error("audio cannot test")
        }

        const overallSuccess = Object.values(testResults).some((result: any) => result.success);

        return {
          success: overallSuccess,
          capabilities: testResults,
          provider: provider.title,
          model: modelKey
        };
      } catch (error) {
        console.error("Connection test failed:", error);
        throw new Error(`Connection test failed: ${error?.message || "Unknown error"}`);
      }
    }),

  getAllProviders: authProcedure
    .query(async ({ ctx }) => {
      const rows = await prisma.aiProviders.findMany({
        where: { accountId: Number(ctx.id) },
        include: { models: true },
        orderBy: { sortOrder: 'asc' }
      });
      return rows.map((p) => ({ ...parseProviderRow(p), models: p.models.map((m) => parseModelRow(m)) }));
    }),

  createProvider: authProcedure
    .input(z.object({
      title: z.string(),
      provider: z.string(),
      baseURL: z.string().optional(),
      apiKey: z.string().optional(),
      config: z.any().optional(),
      sortOrder: z.number().default(0)
    }))
    .mutation(async ({ input, ctx }) => {
      return await prisma.aiProviders.create({
        data: { ...input, accountId: Number(ctx.id), config: input.config !== undefined ? JSON.stringify(input.config) : null },
        include: { models: true }
      }).then((p) => parseProviderRow(p));
    }),

  updateProvider: authProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      provider: z.string().optional(),
      baseURL: z.string().optional(),
      apiKey: z.string().optional(),
      config: z.any().optional(),
      sortOrder: z.number().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      // 仅本人 provider
      const target = await prisma.aiProviders.findFirst({ where: { id, accountId: Number(ctx.id) }, select: { id: true } });
      if (!target) throw new TRPCError({ code: 'FORBIDDEN', message: 'provider not found or not yours' });
      return await prisma.aiProviders.update({
        where: { id },
        data: {
          ...data,
          ...(data.config !== undefined ? { config: JSON.stringify(data.config) } : {}),
        },
        include: { models: true }
      }).then((p) => parseProviderRow(p));
    }),

  deleteProvider: authProcedure
    .input(z.object({
      id: z.number()
    }))
    .mutation(async ({ input, ctx }) => {
      const target = await prisma.aiProviders.findFirst({ where: { id: input.id, accountId: Number(ctx.id) }, select: { id: true } });
      if (!target) throw new TRPCError({ code: 'FORBIDDEN', message: 'provider not found or not yours' });
      return await prisma.aiProviders.delete({
        where: { id: input.id }
      });
    }),

  getAllModels: authProcedure
    .query(async ({ ctx }) => {
      const rows = await prisma.aiModels.findMany({
        where: { accountId: Number(ctx.id) },
        include: { provider: true },
        orderBy: [{ provider: { sortOrder: 'asc' } }, { sortOrder: 'asc' }]
      });
      return rows.map((m) => ({ ...parseModelRow(m), provider: m.provider ? parseProviderRow(m.provider) : m.provider }));
    }),

  getModelsByProvider: authProcedure
    .input(z.object({
      providerId: z.number()
    }))
    .query(async ({ input, ctx }) => {
      const rows = await prisma.aiModels.findMany({
        where: { providerId: input.providerId, accountId: Number(ctx.id) },
        include: { provider: true },
        orderBy: { sortOrder: 'asc' }
      });
      return rows.map((m) => ({ ...parseModelRow(m), provider: m.provider ? parseProviderRow(m.provider) : m.provider }));
    }),

  getModelsByCapability: authProcedure
    .input(z.object({
      capability: z.string()
    }))
    .query(async ({ input, ctx }) => {
      const rows = await prisma.aiModels.findMany({
        where: {
          accountId: Number(ctx.id),
          capabilities: { path: [input.capability], equals: true }
        },
        include: { provider: true },
        orderBy: { sortOrder: 'asc' }
      });
      return rows.map((m) => ({ ...parseModelRow(m), provider: m.provider ? parseProviderRow(m.provider) : m.provider }));
    }),

  createModel: authProcedure
    .input(z.object({
      providerId: z.number(),
      title: z.string(),
      modelKey: z.string(),
      capabilities: z.object({
        inference: z.boolean().default(true),
        tools: z.boolean().default(false),
        image: z.boolean().default(false),
        imageGeneration: z.boolean().default(false),
        video: z.boolean().default(false),
        audio: z.boolean().default(false),
        embedding: z.boolean().default(false),
        rerank: z.boolean().default(false)
      }),
      config: z.any().optional(),
      sortOrder: z.number().default(0)
    }))
    .mutation(async ({ input, ctx }) => {
      // 校验 provider 属于本人
      const p = await prisma.aiProviders.findFirst({ where: { id: input.providerId, accountId: Number(ctx.id) }, select: { id: true } });
      if (!p) throw new TRPCError({ code: 'FORBIDDEN', message: 'provider not found or not yours' });
      return await prisma.aiModels.create({
        data: {
          ...input,
          accountId: Number(ctx.id),
          capabilities: JSON.stringify(input.capabilities),
          config: input.config !== undefined ? JSON.stringify(input.config) : null,
        },
        include: { provider: true }
      }).then((m) => ({ ...parseModelRow(m), provider: m.provider ? parseProviderRow(m.provider) : m.provider }));
    }),

  updateModel: authProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      modelKey: z.string().optional(),
      capabilities: z.object({
        inference: z.boolean().optional(),
        tools: z.boolean().optional(),
        image: z.boolean().optional(),
        imageGeneration: z.boolean().optional(),
        video: z.boolean().optional(),
        audio: z.boolean().optional(),
        embedding: z.boolean().optional(),
        rerank: z.boolean().optional()
      }).optional(),
      config: z.any().optional(),
      sortOrder: z.number().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const target = await prisma.aiModels.findFirst({ where: { id, accountId: Number(ctx.id) }, select: { id: true } });
      if (!target) throw new TRPCError({ code: 'FORBIDDEN', message: 'model not found or not yours' });
      return await prisma.aiModels.update({
        where: { id },
        data: {
          ...data,
          ...(data.capabilities !== undefined ? { capabilities: JSON.stringify(data.capabilities) } : {}),
          ...(data.config !== undefined ? { config: JSON.stringify(data.config) } : {}),
        },
        include: { provider: true }
      }).then((m) => ({ ...parseModelRow(m), provider: m.provider ? parseProviderRow(m.provider) : m.provider }));
    }),

  deleteModel: authProcedure
    .input(z.object({
      id: z.number()
    }))
    .mutation(async ({ input, ctx }) => {
      const target = await prisma.aiModels.findFirst({ where: { id: input.id, accountId: Number(ctx.id) }, select: { id: true } });
      if (!target) throw new TRPCError({ code: 'FORBIDDEN', message: 'model not found or not yours' });
      return await prisma.aiModels.delete({
        where: { id: input.id }
      });
    }),


  createModelsFromProvider: authProcedure
    .input(z.object({
      providerId: z.number(),
      models: z.array(z.object({
        id: z.string(),
        name: z.string(),
        capabilities: z.object({
          inference: z.boolean().default(true),
          tools: z.boolean().default(false),
          image: z.boolean().default(false),
          imageGeneration: z.boolean().default(false),
          video: z.boolean().default(false),
          audio: z.boolean().default(false),
          embedding: z.boolean().default(false),
          rerank: z.boolean().default(false)
        })
      }))
    }))
    .mutation(async ({ input, ctx }) => {
      const { providerId, models } = input;

      const provider = await prisma.aiProviders.findFirst({
        where: { id: providerId, accountId: Number(ctx.id) },
        select: { id: true }
      });
      if (!provider) throw new TRPCError({ code: 'FORBIDDEN', message: 'provider not found or not yours' });

      const createdModels: aiModels[] = [];
      for (const model of models) {
        const created = await prisma.aiModels.create({
          data: {
            providerId,
            title: model.name,
            modelKey: model.id,
            capabilities: JSON.stringify(model.capabilities),
            sortOrder: 0,
            accountId: Number(ctx.id)
          },
          include: { provider: true }
        });
        createdModels.push(created);
      }

      return createdModels.map((m) => ({ ...parseModelRow(m), provider: m.provider ? parseProviderRow(m.provider) : m.provider }));
    }),

  batchCreateModelsFromProvider: authProcedure
    .input(z.object({
      providerId: z.number(),
      selectedModels: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        capabilities: z.object({
          inference: z.boolean().optional(),
          tools: z.boolean().optional(),
          image: z.boolean().optional(),
          imageGeneration: z.boolean().optional(),
          video: z.boolean().optional(),
          audio: z.boolean().optional(),
          embedding: z.boolean().optional(),
          rerank: z.boolean().optional()
        }).optional()
      }))
    }))
    .mutation(async ({ input, ctx }) => {
      const { providerId, selectedModels } = input;

      const provider = await prisma.aiProviders.findFirst({
        where: { id: providerId, accountId: Number(ctx.id) },
        select: { id: true }
      });
      if (!provider) throw new TRPCError({ code: 'FORBIDDEN', message: 'provider not found or not yours' });

      const createdModels: aiModels[] = [];
      for (const model of selectedModels) {
        const created = await prisma.aiModels.create({
          data: {
            providerId,
            title: model.name,
            modelKey: model.id,
            capabilities: JSON.stringify(model.capabilities || {
              inference: true,
              tools: false,
              image: false,
              imageGeneration: false,
              video: false,
              audio: false,
              embedding: false,
              rerank: false
            }),
            sortOrder: 0,
            accountId: Number(ctx.id)
          },
          include: { provider: true }
        });
        createdModels.push(created);
      }

      return createdModels;
    }),

  fetchProviderModels: authProcedure
    .input(z.object({
      providerId: z.number()
    }))
    .mutation(async ({ input, ctx }) => {
      const { providerId } = input;

      const provider = await prisma.aiProviders.findFirst({
        where: { id: providerId, accountId: Number(ctx.id) }
      });

      if (!provider) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Provider not found'
        });
      }

      const proxiedFetch = await fetchWithProxy();
      let modelList: any[] = [];

      try {
        switch (provider.provider.toLowerCase()) {
          case 'ollama': {
            const endpoint = provider.baseURL || 'http://127.0.0.1:11434';
            const response = await proxiedFetch(`${endpoint}/api/tags`);
            const data = await response.json() as any;
            modelList = data.models?.map((model: any) => ({
              id: model.name,
              name: model.name,
              description: model.description || '',
              capabilities: inferModelCapabilities(model.name)
            })) || [];
            break;
          }

          case 'openai': {
            const endpoint = provider.baseURL || 'https://api.openai.com/v1';
            const response = await proxiedFetch(`${endpoint}/models`, {
              headers: { 'Authorization': `Bearer ${provider.apiKey}` }
            });
            const data = await response.json() as any;
            modelList = data.data?.map((model: any) => ({
              id: model.id,
              name: model.id,
              description: '',
              capabilities: inferModelCapabilities(model.id)
            })) || [];
            break;
          }

          case 'anthropic': {
            // Static list - Anthropic doesn't provide a list models API
            modelList = [
              { id: 'claude-3-5-sonnet-20241022', name: 'claude-3-5-sonnet-20241022', capabilities: inferModelCapabilities('claude-3-5-sonnet-20241022') },
              { id: 'claude-3-5-sonnet-20240620', name: 'claude-3-5-sonnet-20240620', capabilities: inferModelCapabilities('claude-3-5-sonnet-20240620') },
              { id: 'claude-3-5-haiku-20241022', name: 'claude-3-5-haiku-20241022', capabilities: inferModelCapabilities('claude-3-5-haiku-20241022') },
              { id: 'claude-3-opus-20240229', name: 'claude-3-opus-20240229', capabilities: inferModelCapabilities('claude-3-opus-20240229') },
              { id: 'claude-3-sonnet-20240229', name: 'claude-3-sonnet-20240229', capabilities: inferModelCapabilities('claude-3-sonnet-20240229') },
              { id: 'claude-3-haiku-20240307', name: 'claude-3-haiku-20240307', capabilities: inferModelCapabilities('claude-3-haiku-20240307') }
            ];
            break;
          }

          case 'voyageai': {
            // Static list - VoyageAI doesn't provide a list models API
            modelList = [
              { id: 'voyage-3', name: 'voyage-3', capabilities: inferModelCapabilities('voyage-3') },
              { id: 'voyage-3-lite', name: 'voyage-3-lite', capabilities: inferModelCapabilities('voyage-3-lite') },
              { id: 'voyage-finance-2', name: 'voyage-finance-2', capabilities: inferModelCapabilities('voyage-finance-2') },
              { id: 'voyage-multilingual-2', name: 'voyage-multilingual-2', capabilities: inferModelCapabilities('voyage-multilingual-2') },
              { id: 'voyage-law-2', name: 'voyage-law-2', capabilities: inferModelCapabilities('voyage-law-2') },
              { id: 'voyage-code-2', name: 'voyage-code-2', capabilities: inferModelCapabilities('voyage-code-2') },
              { id: 'voyage-large-2-instruct', name: 'voyage-large-2-instruct', capabilities: inferModelCapabilities('voyage-large-2-instruct') },
              { id: 'voyage-large-2', name: 'voyage-large-2', capabilities: inferModelCapabilities('voyage-large-2') }
            ];
            break;
          }

          case 'google': {
            const endpoint = provider.baseURL || 'https://generativelanguage.googleapis.com/v1beta';
            const response = await proxiedFetch(`${endpoint}/models?key=${provider.apiKey}`);
            const data = await response.json() as any;
            modelList = data.models?.map((model: any) => ({
              id: model.name.replace('models/', ''),
              name: model.displayName || model.name.replace('models/', ''),
              description: model.description || '',
              capabilities: inferModelCapabilities(model.name)
            })) || [];
            break;
          }

          case 'azure': {
            const endpoint = provider.baseURL;
            const response = await proxiedFetch(`${endpoint}/openai/models?api-version=2024-02-01`, {
              headers: { 'api-key': provider.apiKey || '' }
            });
            const data = await response.json() as any;
            modelList = data.data?.map((model: any) => ({
              id: model.id,
              name: model.id,
              description: '',
              capabilities: inferModelCapabilities(model.id)
            })) || [];
            break;
          }

          case 'minimax': {
            // Static list - MiniMax models with known capabilities
            modelList = [
              { id: 'MiniMax-M3', name: 'MiniMax M3', capabilities: inferModelCapabilities('MiniMax-M3') },
              { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', capabilities: inferModelCapabilities('MiniMax-M2.7') }
            ];
            break;
          }

          default: {
            // Default: use OpenAI-compatible API format
            const endpoint = provider.baseURL;
            if (!endpoint) {
              throw new Error('Base URL is required for custom providers');
            }
            const response = await proxiedFetch(`${endpoint}/models`, {
              headers: { 'Authorization': `Bearer ${provider.apiKey}` }
            });
            const data = await response.json() as any;
            modelList = data.data?.map((model: any) => ({
              id: model.id,
              name: model.id,
              description: '',
              capabilities: inferModelCapabilities(model.id)
            })) || [];
            break;
          }
        }

        // Update provider config with fetched models
        const existingConfig = parseJsonField(provider.config) || {};
        await prisma.aiProviders.update({
          where: { id: providerId },
          data: {
            config: JSON.stringify({ ...existingConfig, models: modelList })
          }
        });

        return modelList;
      } catch (error: any) {
        console.error('Error fetching provider models:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch models: ${error?.message || 'Unknown error'}`
        });
      }
    }),
})

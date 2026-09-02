import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { getOpenAI, getModel, testConnection } from '../../lib/openai.js';
import { loadSettings, saveSettings, getSettingsFilePath } from '../../lib/settings.js';

/**
 * AI router - 阶段5 + 阶段6 设置
 *
 * 设置从 data/settings.json 实时加载,无需重启服务。
 * 修改后下次 AI 调用立即生效。
 */

export const aiRouter = router({
  /** ===== 对话(原 AI 模块) ===== */
  conversations: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.conversation.findMany({
      where: { accountId: ctx.account.id },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }),

  createConversation: protectedProcedure
    .input(z.object({ title: z.string().min(1).max(50).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.conversation.create({
        data: {
          accountId: ctx.account.id,
          title: input?.title?.trim() || '新对话',
        },
      });
    }),

  deleteConversation: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const c = await ctx.prisma.conversation.findFirst({
        where: { id: input.id, accountId: ctx.account.id },
        select: { id: true },
      });
      if (!c) throw new TRPCError({ code: 'NOT_FOUND', message: '对话不存在' });
      await ctx.prisma.conversation.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  messages: protectedProcedure
    .input(z.object({ conversationId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const c = await ctx.prisma.conversation.findFirst({
        where: { id: input.conversationId, accountId: ctx.account.id },
        select: { id: true },
      });
      if (!c) throw new TRPCError({ code: 'NOT_FOUND', message: '对话不存在' });
      return ctx.prisma.message.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: 'asc' },
      });
    }),

  chat: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        content: z.string().min(1).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const conv = await ctx.prisma.conversation.findFirst({
        where: { id: input.conversationId, accountId: ctx.account.id },
        select: { id: true },
      });
      if (!conv) throw new TRPCError({ code: 'NOT_FOUND', message: '对话不存在' });

      await ctx.prisma.message.create({
        data: {
          role: 'user',
          content: input.content,
          conversationId: input.conversationId,
        },
      });

      const history = await ctx.prisma.message.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      history.reverse();

      const settings = loadSettings();

      let aiContent: string;
      try {
        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
          model: getModel(),
          messages: [
            { role: 'system', content: settings.prompts.chat },
            ...history.map((m) => ({
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
            })),
          ],
        });
        aiContent = completion.choices[0]?.message?.content?.trim() || '(空回复)';
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `AI 调用失败: ${msg}`,
        });
      }

      const assistantMsg = await ctx.prisma.message.create({
        data: {
          role: 'assistant',
          content: aiContent,
          conversationId: input.conversationId,
        },
      });

      await ctx.prisma.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      });

      return assistantMsg;
    }),

  commentNote: protectedProcedure
    .input(z.object({ noteId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const note = await ctx.prisma.note.findFirst({
        where: { id: input.noteId, accountId: ctx.account.id },
      });
      if (!note) throw new TRPCError({ code: 'NOT_FOUND', message: '笔记不存在' });

      const settings = loadSettings();

      let aiText: string;
      try {
        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
          model: getModel(),
          messages: [
            { role: 'system', content: settings.prompts.comment },
            { role: 'user', content: note.content.slice(0, 4000) },
          ],
        });
        const raw = completion.choices[0]?.message?.content?.trim() ?? '';
        if (!raw) throw new Error('AI 回复为空');
        aiText = raw;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `AI 评论失败: ${msg}`,
        });
      }

      return ctx.prisma.comment.create({
        data: {
          content: aiText,
          isAI: true,
          accountId: null,
          noteId: input.noteId,
        },
      });
    }),

  /** ===== AI 设置(新增) ===== */

  /** 读取当前 AI 设置(apiKey 仅返回前 4 位 + 长度) */
  getSettings: protectedProcedure.query(() => {
    const s = loadSettings();
    return {
      openai: {
        baseURL: s.openai.baseURL,
        defaultModel: s.openai.defaultModel,
        apiKeyMasked: s.openai.apiKey
          ? `${s.openai.apiKey.slice(0, 4)}…${s.openai.apiKey.slice(-4)} (长度 ${s.openai.apiKey.length})`
          : '',
        apiKeySet: !!s.openai.apiKey,
      },
      prompts: s.prompts,
      settingsFilePath: getSettingsFilePath(),
    };
  }),

  /** 更新 AI 设置(apiKey 留空表示不变) */
  updateSettings: protectedProcedure
    .input(
      z.object({
        openai: z
          .object({
            apiKey: z.string().optional(),
            baseURL: z.string().url().or(z.literal('')).optional(),
            defaultModel: z.string().min(1).max(100).optional(),
          })
          .optional(),
        prompts: z
          .object({
            chat: z.string().min(1).max(4000).optional(),
            comment: z.string().min(1).max(4000).optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const current = loadSettings();
      // apiKey: 留空 → 不变;"null" 字符串 → 清空;其他 → 更新
      const openaiPatch = input.openai
        ? {
            ...input.openai,
            ...(input.openai.apiKey !== undefined && input.openai.apiKey === ''
              ? {} // 留空不变
              : {}),
          }
        : undefined;

      // 处理 apiKey:实际逻辑
      const newOpenai = {
        apiKey: current.openai.apiKey,
        baseURL: input.openai?.baseURL || current.openai.baseURL,
        defaultModel: input.openai?.defaultModel || current.openai.defaultModel,
      };
      if (input.openai?.apiKey !== undefined && input.openai.apiKey !== '') {
        newOpenai.apiKey = input.openai.apiKey;
      }
      // 显式清空
      if (input.openai?.apiKey === '__CLEAR__') {
        newOpenai.apiKey = '';
      }

      const newPrompts = {
        chat: input.prompts?.chat ?? current.prompts.chat,
        comment: input.prompts?.comment ?? current.prompts.comment,
      };

      saveSettings({ openai: newOpenai, prompts: newPrompts });
      return { ok: true };
    }),

  /** 测试当前 OpenAI 连接 */
  testConnection: protectedProcedure.mutation(async () => {
    return testConnection();
  }),
});
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';
import { getOpenAI, AI_MODEL } from '../../lib/openai.js';

const SYSTEM_PROMPT_CHAT =
  '你是 Blinko 笔记助手，一个简洁、友好、专业的 AI 伙伴。请用中文回答，控制在 200 字以内，除非用户明确要求长文。';

const SYSTEM_PROMPT_COMMENT =
  '你是一个笔记评论助手。对用户的笔记给出 1-2 句有建设性的反馈、补充或提问。不要重复笔记内容。语气温和,像朋友间的点评。';

/**
 * AI router - 阶段5
 *
 * 提供:
 * - conversations: 对话 CRUD
 * - messages: 消息历史
 * - chat: 发送一条用户消息,AI 完整回复,保存并返回
 * - commentNote: 触发 AI 自动评论笔记
 *
 * 注意: 简化版不做流式推送,等待完整响应后一次性返回。
 * 未配置 OPENAI_API_KEY 时,chat / commentNote 抛出清晰错误。
 */
export const aiRouter = router({
  /** 当前用户的对话列表 */
  conversations: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.conversation.findMany({
      where: { accountId: ctx.account.id },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }),

  /** 新建对话(可选标题,默认 "新对话") */
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

  /** 删除对话(级联删除消息) */
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

  /** 获取某对话的全部消息(按时间正序) */
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

  /**
   * 发送一条用户消息 → AI 完整回复 → 落库 → 返回 AI 消息
   * 历史上下文: 最近 20 条消息
   */
  chat: protectedProcedure
    .input(
      z.object({
        conversationId: z.number().int().positive(),
        content: z.string().min(1).max(4000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. 校验对话所有权
      const conv = await ctx.prisma.conversation.findFirst({
        where: { id: input.conversationId, accountId: ctx.account.id },
        select: { id: true },
      });
      if (!conv) throw new TRPCError({ code: 'NOT_FOUND', message: '对话不存在' });

      // 2. 保存用户消息
      await ctx.prisma.message.create({
        data: {
          role: 'user',
          content: input.content,
          conversationId: input.conversationId,
        },
      });

      // 3. 加载历史(最近 20 条)
      const history = await ctx.prisma.message.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      history.reverse();

      // 4. 调用 OpenAI
      let aiContent: string;
      try {
        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT_CHAT },
            ...history.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
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

      // 5. 保存 AI 回复
      const assistantMsg = await ctx.prisma.message.create({
        data: {
          role: 'assistant',
          content: aiContent,
          conversationId: input.conversationId,
        },
      });

      // 6. 更新对话 updatedAt(让列表按最近活跃排序)
      await ctx.prisma.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      });

      return assistantMsg;
    }),

  /**
   * AI 自动评论笔记:
   * - 读取笔记内容
   * - 调用 OpenAI 生成 1-2 句点评
   * - 作为 AI 评论(isAI=true, accountId=null)写入
   * - 返回新评论
   */
  commentNote: protectedProcedure
    .input(z.object({ noteId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const note = await ctx.prisma.note.findFirst({
        where: { id: input.noteId, accountId: ctx.account.id },
      });
      if (!note) throw new TRPCError({ code: 'NOT_FOUND', message: '笔记不存在' });

      let aiText: string;
      try {
        const openai = getOpenAI();
        const completion = await openai.chat.completions.create({
          model: AI_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT_COMMENT },
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
});
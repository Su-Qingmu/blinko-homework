import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';

/**
 * 评论 router - 阶段5
 * - 用户评论:add/list/delete
 * - AI 评论: 由 ai.commentNote 生成,这里仅做 list + delete
 *   (删除 AI 评论时不校验 accountId,因为 AI 评论 accountId=null)
 */
export const commentRouter = router({
  /** 列出某笔记的全部评论(用户 + AI),按时间正序 */
  list: protectedProcedure
    .input(z.object({ noteId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      // 先确认笔记属于当前用户
      const note = await ctx.prisma.note.findFirst({
        where: { id: input.noteId, accountId: ctx.account.id },
        select: { id: true },
      });
      if (!note) throw new TRPCError({ code: 'NOT_FOUND', message: '笔记不存在' });

      const comments = await ctx.prisma.comment.findMany({
        where: { noteId: input.noteId },
        orderBy: { createdAt: 'asc' },
      });
      // 关联 user 信息
      const userIds = comments.filter((c) => c.accountId).map((c) => c.accountId!);
      const users = userIds.length
        ? await ctx.prisma.account.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, nickname: true },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u]));
      return comments.map((c) => ({
        ...c,
        author: c.accountId ? userMap.get(c.accountId) ?? null : null,
      }));
    }),

  /** 添加用户评论 */
  add: protectedProcedure
    .input(
      z.object({
        noteId: z.number().int().positive(),
        content: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const note = await ctx.prisma.note.findFirst({
        where: { id: input.noteId, accountId: ctx.account.id },
        select: { id: true },
      });
      if (!note) throw new TRPCError({ code: 'NOT_FOUND', message: '笔记不存在' });

      return ctx.prisma.comment.create({
        data: {
          content: input.content,
          isAI: false,
          accountId: ctx.account.id,
          noteId: input.noteId,
        },
      });
    }),

  /** 删除评论:用户评论(accountId = 自己)可删;AI 评论(accountId = null)也可删 */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findUnique({ where: { id: input.id } });
      if (!comment) throw new TRPCError({ code: 'NOT_FOUND', message: '评论不存在' });
      // 必须是同一笔记的拥有者(防越权)
      const note = await ctx.prisma.note.findFirst({
        where: { id: comment.noteId, accountId: ctx.account.id },
        select: { id: true },
      });
      if (!note) throw new TRPCError({ code: 'NOT_FOUND', message: '评论不存在' });
      await ctx.prisma.comment.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
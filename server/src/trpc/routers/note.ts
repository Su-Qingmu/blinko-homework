import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc.js';

/**
 * 笔记 / 闪念 router - 阶段3+4
 *
 * 字段约定:
 *   type: 0=笔记 1=闪念(快捷输入)
 *   archived: true=归档(软删)  false=正常
 *   top: true=置顶
 *   tagNames: 创建/更新时传入，自动 upsert 并 set 关联
 */

const noteTypeSchema = z.union([z.literal(0), z.literal(1)]);

const tagNamesSchema = z.array(z.string().min(1).max(32)).max(20).default([]);

/** 把 tagNames upsert 成 Tag 记录(用户隔离) */
async function upsertTags(
  prisma: import('@prisma/client').PrismaClient,
  accountId: number,
  tagNames: string[],
) {
  const unique = Array.from(new Set(tagNames.map((n) => n.trim()).filter(Boolean)));
  return Promise.all(
    unique.map((name) =>
      prisma.tag.upsert({
        where: { accountId_name: { accountId, name } },
        create: { name, accountId },
        update: {},
      }),
    ),
  );
}

export const noteRouter = router({
  /** 列表:支持类型 / 标签 / 关键词筛选 + 置顶优先 + 按更新时间倒序 */
  list: protectedProcedure
    .input(
      z
        .object({
          type: z.enum(['note', 'quick']).optional(),
          tagId: z.number().int().positive().optional(),
          search: z.string().trim().max(100).optional(),
          includeArchived: z.boolean().default(false),
        })
        .default({ includeArchived: false }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        accountId: ctx.account.id,
        ...(input.includeArchived ? {} : { archived: false }),
        ...(input.type ? { type: input.type === 'note' ? 0 : 1 } : {}),
        ...(input.tagId ? { tags: { some: { id: input.tagId } } } : {}),
        ...(input.search
          ? { content: { contains: input.search } }
          : {}),
      };
      return ctx.prisma.note.findMany({
        where,
        include: { tags: true, _count: { select: { comments: true } } },
        orderBy: [{ top: 'desc' }, { updatedAt: 'desc' }],
        take: 200,
      });
    }),

  /** 单个笔记详情(含评论数 + 标签) */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const note = await ctx.prisma.note.findFirst({
        where: { id: input.id, accountId: ctx.account.id },
        include: { tags: true, _count: { select: { comments: true } } },
      });
      if (!note) throw new TRPCError({ code: 'NOT_FOUND', message: '笔记不存在' });
      return note;
    }),

  /** 新建笔记 / 闪念 */
  create: protectedProcedure
    .input(
      z.object({
        type: z.enum(['note', 'quick']).default('note'),
        content: z.string().min(1).max(20_000),
        tagNames: tagNamesSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tags = input.tagNames.length
        ? await upsertTags(ctx.prisma, ctx.account.id, input.tagNames)
        : [];
      return ctx.prisma.note.create({
        data: {
          type: input.type === 'note' ? 0 : 1,
          content: input.content,
          accountId: ctx.account.id,
          ...(tags.length ? { tags: { connect: tags.map((t) => ({ id: t.id })) } } : {}),
        },
        include: { tags: true, _count: { select: { comments: true } } },
      });
    }),

  /** 更新笔记:content / top / archived / tagNames */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        content: z.string().min(1).max(20_000).optional(),
        top: z.boolean().optional(),
        archived: z.boolean().optional(),
        tagNames: tagNamesSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, tagNames, ...rest } = input;
      // 权限校验:只能改自己的笔记
      const owned = await ctx.prisma.note.findFirst({
        where: { id, accountId: ctx.account.id },
        select: { id: true },
      });
      if (!owned) throw new TRPCError({ code: 'NOT_FOUND', message: '笔记不存在' });

      const data: Record<string, unknown> = { ...rest };
      if (tagNames !== undefined) {
        const tags = tagNames.length
          ? await upsertTags(ctx.prisma, ctx.account.id, tagNames)
          : [];
        data.tags = { set: tags.map((t) => ({ id: t.id })) };
      }

      return ctx.prisma.note.update({
        where: { id },
        data,
        include: { tags: true, _count: { select: { comments: true } } },
      });
    }),

  /** 删除笔记(硬删,关联评论和标签关联一并清理) */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const owned = await ctx.prisma.note.findFirst({
        where: { id: input.id, accountId: ctx.account.id },
        select: { id: true },
      });
      if (!owned) throw new TRPCError({ code: 'NOT_FOUND', message: '笔记不存在' });
      await ctx.prisma.note.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  /** 当前用户的所有标签(笔记列表侧栏用) */
  tags: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.tag.findMany({
      where: { accountId: ctx.account.id },
      include: { _count: { select: { notes: true } } },
      orderBy: { name: 'asc' },
    });
  }),
});
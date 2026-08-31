import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context.js';

const t = initTRPC.context<Context>().create({
  // 简化:不使用 superjson,直接传 JSON 即可(日期用 ISO string)
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** 需要登录的 procedure - 上下文保证 account 非空 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.account) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: '请先登录' });
  }
  return next({ ctx: { ...ctx, account: ctx.account } });
});

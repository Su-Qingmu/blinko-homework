import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  validateCredentials,
} from '../../lib/auth.js';

const SESSION_COOKIE = 'sid';
const SESSION_TTL_DAYS = 30;

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
};

export const userRouter = router({
  /** 注册 */
  register: publicProcedure
    .input(
      z.object({
        username: z.string().min(3).max(20),
        password: z.string().min(8).max(32),
        nickname: z.string().max(20).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const formatErr = validateCredentials(input.username, input.password);
      if (formatErr) throw new TRPCError({ code: 'BAD_REQUEST', message: formatErr });

      const exists = await ctx.prisma.account.findUnique({ where: { username: input.username } });
      if (exists) throw new TRPCError({ code: 'CONFLICT', message: '用户名已被占用' });

      const passwordHash = await hashPassword(input.password);
      const account = await ctx.prisma.account.create({
        data: {
          username: input.username,
          password: passwordHash,
          nickname: input.nickname || input.username,
        },
      });

      const { token } = await createSession(account.id);
      ctx.res?.cookie(SESSION_COOKIE, token, cookieOptions);

      return { id: account.id, username: account.username, nickname: account.nickname };
    }),

  /** 登录 */
  login: publicProcedure
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.prisma.account.findUnique({ where: { username: input.username } });
      if (!account) throw new TRPCError({ code: 'UNAUTHORIZED', message: '用户名或密码错误' });

      const ok = await verifyPassword(input.password, account.password);
      if (!ok) throw new TRPCError({ code: 'UNAUTHORIZED', message: '用户名或密码错误' });

      const { token } = await createSession(account.id);
      ctx.res?.cookie(SESSION_COOKIE, token, cookieOptions);

      return { id: account.id, username: account.username, nickname: account.nickname };
    }),

  /** 登出 */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.sessionToken) await destroySession(ctx.sessionToken);
    ctx.res?.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }),

  /** 获取当前登录账户 */
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.account) return null;
    const { password: _omit, ...safe } = ctx.account;
    return safe;
  }),
});

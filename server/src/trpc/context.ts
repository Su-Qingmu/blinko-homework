import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { loadSession } from '../lib/auth.js';

const SESSION_COOKIE = 'sid';

/**
 * 解析 Express 请求：注入 Prisma 客户端、当前登录账户和 Response（用于 setCookie）。
 * 失败时 account = null，由 protectedProcedure 统一拦截。
 */
export async function createContext({ req, res }: { req: Request; res: Response }) {
  const token = (req.cookies as Record<string, string | undefined> | undefined)?.[SESSION_COOKIE];
  const session = await loadSession(token);
  return {
    prisma,
    account: session?.account ?? null,
    sessionToken: session?.id ?? null,
    req,
    res,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

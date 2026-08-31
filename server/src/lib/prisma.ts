import { PrismaClient } from '@prisma/client';

// 单例 Prisma 客户端 - 避免热重载时连接泄漏
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

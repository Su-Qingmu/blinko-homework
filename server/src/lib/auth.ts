import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma } from './prisma.js';

const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

/** 密码哈希（bcrypt cost=10） */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/** 验证密码 */
export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

/** 生成随机 session token */
export function newSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** 为账户创建新 session 并写入数据库 */
export async function createSession(accountId: number) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: token, accountId, expiresAt } });
  return { token, expiresAt };
}

/** 通过 token 读取有效 session（过期则删除） */
export async function loadSession(token: string | undefined) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { account: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
    return null;
  }
  return session;
}

/** 删除 session（登出） */
export async function destroySession(token: string | undefined) {
  if (!token) return;
  await prisma.session.delete({ where: { id: token } }).catch(() => {});
}

/** 校验用户名 / 密码格式 */
export function validateCredentials(username: string, password: string): string | null {
  if (!username || username.length < 3 || username.length > 20) {
    return '用户名长度需在 3-20 之间';
  }
  if (!/^[A-Za-z0-9_-]+$/.test(username)) {
    return '用户名仅允许字母、数字、下划线、连字符';
  }
  if (!password || password.length < 8 || password.length > 32) {
    return '密码长度需在 8-32 之间';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return '密码必须同时包含字母和数字';
  }
  return null;
}

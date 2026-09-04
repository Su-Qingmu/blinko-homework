/**
 * 协作模块 · 鉴权 helper
 *
 * 所有 team 相关的 procedure 都要走这里校验:
 * 1. 当前用户必须是该 team 的成员
 * 2. (可选) 角色至少达到某个等级
 *
 * 角色等级:guest(0) < member(1) < admin(2) < owner(3)
 */
import { TRPCError } from '@trpc/server';
import { prisma } from '../prisma';
import { isRoleAtLeast, TeamRole } from '@shared/lib/prismaZodType';

/** ctx.id 是 accountId (string,因为 jwt sub 是 string) */
function getAccountId(ctx: any): number {
  const id = Number(ctx?.id ?? ctx?.sub);
  if (!Number.isFinite(id) || id <= 0) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not logged in' });
  }
  return id;
}

/**
 * 校验当前用户是 team 成员,可选地要求角色等级。
 * 返回 teamMember 行(包含 role / status),调用方据此决定能否继续操作。
 */
export async function requireTeamMember(
  ctx: any,
  teamId: number,
  requiredRole?: TeamRole,
) {
  const accountId = getAccountId(ctx);
  const member = await prisma.teamMembers.findUnique({
    where: { teamId_accountId: { teamId, accountId } },
  });
  if (!member) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You are not a member of this team',
    });
  }
  if (member.status === 'pending') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Your membership is pending approval',
    });
  }
  if (requiredRole && !isRoleAtLeast(member.role, requiredRole)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Requires ${requiredRole} permission`,
    });
  }
  return { member, accountId };
}

/** 仅校验是成员,不要求角色等级 */
export async function getTeamMemberOrThrow(ctx: any, teamId: number) {
  return requireTeamMember(ctx, teamId);
}

/** 写活动日志的统一入口 */
export async function logActivity(
  teamId: number,
  accountId: number | null,
  action: string,
  options?: {
    targetType?: string;
    targetId?: number;
    metadata?: any;
  },
) {
  return prisma.teamActivities.create({
    data: {
      teamId,
      accountId: accountId ?? undefined,
      action,
      targetType: options?.targetType,
      targetId: options?.targetId,
      metadata: options?.metadata ? JSON.stringify(options.metadata) : null,
    },
  });
}

/**
 * 根据 accountId 列表 (含 nickname/image) 渲染成员信息。
 * 避免每个 router 都重复写 select。
 */
export const memberAccountSelect = {
  id: true,
  name: true,
  nickname: true,
  image: true,
  description: true,
} as const;
/**
 * teamMember.ts · 团队成员管理 router
 *
 * 端点:
 *   - list       : 列成员(含 account 信息 + 角色 + 最后活跃)
 *   - updateRole : 改成员角色 (owner only;owner 角色不可降级 owner)
 *   - remove     : 踢人 (admin+;owner 不能被踢)
 *   - leave      : 自己退队(owner 不能退,需先转让或删除团队)
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '../prisma';
import { authProcedure, router } from '../middleware';
import { TEAM_ROLE, teamMembersSchema } from '@shared/lib/prismaZodType';
import { logActivity, requireTeamMember } from '@server/lib/teamAuth';

// accounts 表没有 email 字段,协作模块用 nickname 作为对外展示
const memberAccountSelect = {
  id: true,
  name: true,
  nickname: true,
  image: true,
  description: true,
};

const memberRowSchema = teamMembersSchema.extend({
  account: z.object({
    id: z.number().int(),
    name: z.string(),
    nickname: z.string(),
    image: z.string(),
    description: z.string(),
  }).nullable(),
});

export const teamMemberRouter = router({
  /** 列出团队成员(必须是成员) */
  list: authProcedure
    .input(z.object({
      teamId: z.number().int(),
      role: z.string().optional(),
      search: z.string().optional(),
    }))
    .output(z.array(memberRowSchema))
    .query(async ({ input, ctx }) => {
      await requireTeamMember(ctx, input.teamId);
      const where: any = { teamId: input.teamId };
      if (input.role) where.role = input.role;
      const rows = await prisma.teamMembers.findMany({
        where,
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      });
      // 查 account 信息
      const accountIds = rows.map((r) => r.accountId);
      const accounts = await prisma.accounts.findMany({
        where: { id: { in: accountIds } },
        select: memberAccountSelect,
      });
      const acctMap = new Map(accounts.map((a: any) => [a.id, a]));
      // 搜索过滤(在 nickname / name 上)
      const search = input.search?.toLowerCase().trim();
      return rows
        .filter((r) => {
          if (!search) return true;
          const a: any = acctMap.get(r.accountId);
          return (
            (a?.nickname ?? '').toLowerCase().includes(search) ||
            (a?.name ?? '').toLowerCase().includes(search)
          );
        })
        .map((r) => ({ ...r, account: acctMap.get(r.accountId) ?? null }));
    }),

  /** 改成员角色 (owner only) */
  updateRole: authProcedure
    .input(z.object({
      teamId: z.number().int(),
      accountId: z.number().int(),
      role: z.enum(['owner', 'admin', 'member', 'guest']),
    }))
    .output(z.boolean())
    .mutation(async ({ input, ctx }) => {
      await requireTeamMember(ctx, input.teamId, TEAM_ROLE.OWNER);
      const actor = Number(ctx.id);
      if (input.accountId === actor) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot change your own role',
        });
      }
      // 不能直接把 owner 降级(避免失去最后一个 owner)
      const target = await prisma.teamMembers.findUnique({
        where: { teamId_accountId: { teamId: input.teamId, accountId: input.accountId } },
      });
      if (!target) throw new TRPCError({ code: 'NOT_FOUND' });
      if (target.role === TEAM_ROLE.OWNER) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot demote another owner',
        });
      }
      await prisma.teamMembers.update({
        where: { teamId_accountId: { teamId: input.teamId, accountId: input.accountId } },
        data: { role: input.role },
      });
      await logActivity(input.teamId, actor, 'role.change', {
        targetType: 'member',
        targetId: input.accountId,
        metadata: { from: target.role, to: input.role },
      });
      return true;
    }),

  /** 踢人 (admin+) */
  remove: authProcedure
    .input(z.object({
      teamId: z.number().int(),
      accountId: z.number().int(),
    }))
    .output(z.boolean())
    .mutation(async ({ input, ctx }) => {
      const { member: actor } = await requireTeamMember(ctx, input.teamId, TEAM_ROLE.ADMIN);
      if (input.accountId === Number(ctx.id)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Use teamMember.leave to leave yourself',
        });
      }
      const target = await prisma.teamMembers.findUnique({
        where: { teamId_accountId: { teamId: input.teamId, accountId: input.accountId } },
      });
      if (!target) throw new TRPCError({ code: 'NOT_FOUND' });
      if (target.role === TEAM_ROLE.OWNER) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Cannot remove an owner',
        });
      }
      await prisma.teamMembers.delete({
        where: { teamId_accountId: { teamId: input.teamId, accountId: input.accountId } },
      });
      await logActivity(input.teamId, Number(ctx.id), 'member.remove', {
        targetType: 'member',
        targetId: input.accountId,
        metadata: { actorRole: actor.role },
      });
      return true;
    }),

  /** 自己退队 (owner 不能退,提示先删团队或转让) */
  leave: authProcedure
    .input(z.object({ teamId: z.number().int() }))
    .output(z.boolean())
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      const me = await prisma.teamMembers.findUnique({
        where: { teamId_accountId: { teamId: input.teamId, accountId } },
      });
      if (!me) throw new TRPCError({ code: 'NOT_FOUND' });
      if (me.role === TEAM_ROLE.OWNER) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Owner cannot leave. Transfer ownership or delete the team.',
        });
      }
      await prisma.teamMembers.delete({
        where: { teamId_accountId: { teamId: input.teamId, accountId } },
      });
      await logActivity(input.teamId, accountId, 'member.leave', {
        targetType: 'member',
        targetId: accountId,
      });
      return true;
    }),
});
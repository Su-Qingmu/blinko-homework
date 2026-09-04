/**
 * team.ts · 团队管理 router
 *
 * 端点:
 *   - list        : 当前用户所在的所有团队
 *   - get         : 获取单个团队详情(含 owner 头像 / 成员数 / 笔记数)
 *   - create      : 新建团队(自己成为 owner + admin)
 *   - update      : 修改名称/描述/icon (admin+)
 *   - delete      : 删除团队 (owner only)
 *   - getByToken  : 通过邀请 token 解析出 team (公开,接受邀请时用)
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '../prisma';
import { authProcedure, publicProcedure, router } from '../middleware';
import { TEAM_ROLE, teamsSchema } from '@shared/lib/prismaZodType';
import { logActivity, requireTeamMember } from '@server/lib/teamAuth';

// 输出:团队 + 当前用户的角色 + 成员数 + 笔记数
const teamWithMineSchema = teamsSchema.extend({
  myRole: z.string(),
  memberCount: z.number().int(),
  noteCount: z.number().int(),
  owner: z.object({
    id: z.number().int(),
    name: z.string(),
    nickname: z.string(),
    image: z.string(),
  }).nullable(),
});

async function buildTeamView(teamId: number, myAccountId: number) {
  const team = await prisma.teams.findUnique({
    where: { id: teamId },
    include: {
      owner: { select: { id: true, name: true, nickname: true, image: true } },
      _count: { select: { members: true, notes: true } },
    },
  });
  if (!team) return null;
  const me = await prisma.teamMembers.findUnique({
    where: { teamId_accountId: { teamId, accountId: myAccountId } },
  });
  if (!me) return null; // 不是成员就不返回
  return {
    ...team,
    myRole: me.role,
    memberCount: team._count.members,
    noteCount: team._count.notes,
  };
}

export const teamRouter = router({
  /** 当前用户所在的所有团队 */
  list: authProcedure
    .input(z.void().optional())
    .output(z.array(teamWithMineSchema))
    .query(async ({ ctx }) => {
      const accountId = Number(ctx.id);
      const myMemberships = await prisma.teamMembers.findMany({
        where: { accountId },
        select: { teamId: true },
      });
      const teamIds = myMemberships.map((m) => m.teamId);
      const teams = await prisma.teams.findMany({
        where: { id: { in: teamIds } },
        include: {
          owner: { select: { id: true, name: true, nickname: true, image: true } },
          _count: { select: { members: true, notes: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      // 给每个 team 补 myRole
      const memberRows = await prisma.teamMembers.findMany({
        where: { teamId: { in: teamIds }, accountId },
      });
      const roleMap = new Map(memberRows.map((m) => [m.teamId, m.role]));
      return teams.map((t) => ({
        id: t.id,
        name: t.name,
        icon: t.icon,
        description: t.description,
        ownerId: t.ownerId,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        myRole: roleMap.get(t.id) ?? 'guest',
        memberCount: t._count.members,
        noteCount: t._count.notes,
        owner: t.owner,
      }));
    }),

  /** 获取单个团队详情(必须是成员) */
  get: authProcedure
    .input(z.object({ teamId: z.number().int() }))
    .output(teamWithMineSchema.nullable())
    .query(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      const view = await buildTeamView(input.teamId, accountId);
      return view;
    }),

  /** 创建团队(自己成为 owner) */
  create: authProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      icon: z.string().optional().default(''),
      description: z.string().max(200).optional().default(''),
    }))
    .output(teamWithMineSchema)
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      const team = await prisma.teams.create({
        data: {
          name: input.name,
          icon: input.icon ?? '',
          description: input.description ?? '',
          ownerId: accountId,
          members: {
            create: {
              accountId,
              role: TEAM_ROLE.OWNER,
              status: 'active',
            },
          },
        },
        include: {
          owner: { select: { id: true, name: true, nickname: true, image: true } },
          _count: { select: { members: true, notes: true } },
        },
      });
      await logActivity(team.id, accountId, 'team.create', {
        targetType: 'team',
        targetId: team.id,
        metadata: { name: team.name },
      });
      return {
        id: team.id,
        name: team.name,
        icon: team.icon,
        description: team.description,
        ownerId: team.ownerId,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        myRole: TEAM_ROLE.OWNER,
        memberCount: team._count.members,
        noteCount: team._count.notes,
        owner: team.owner,
      };
    }),

  /** 修改团队信息 (admin+) */
  update: authProcedure
    .input(z.object({
      teamId: z.number().int(),
      name: z.string().min(1).max(50).optional(),
      icon: z.string().optional(),
      description: z.string().max(200).optional(),
    }))
    .output(teamsSchema)
    .mutation(async ({ input, ctx }) => {
      await requireTeamMember(ctx, input.teamId, TEAM_ROLE.ADMIN);
      const accountId = Number(ctx.id);
      const data: any = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.icon !== undefined) data.icon = input.icon;
      if (input.description !== undefined) data.description = input.description;
      const updated = await prisma.teams.update({
        where: { id: input.teamId },
        data,
      });
      await logActivity(input.teamId, accountId, 'team.update', {
        targetType: 'team',
        targetId: input.teamId,
        metadata: data,
      });
      return updated;
    }),

  /** 删除团队 (owner only,会级联删 members / invites / activities / teamNotes) */
  delete: authProcedure
    .input(z.object({ teamId: z.number().int() }))
    .output(z.boolean())
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      await requireTeamMember(ctx, input.teamId, TEAM_ROLE.OWNER);
      await prisma.teams.delete({ where: { id: input.teamId } });
      return true;
    }),

  /** 通过邀请 token 查 team (公开,接受邀请时预览用) */
  getByInviteToken: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .output(z.object({
      team: z.object({
        id: z.number().int(),
        name: z.string(),
        icon: z.string(),
        description: z.string(),
      }).nullable(),
      invite: z.object({
        name: z.string(),
        role: z.string(),
        expiresAt: z.date().nullable(),
        maxUses: z.number().nullable(),
        usedCount: z.number(),
        isActive: z.boolean(),
      }).nullable(),
    }).nullable())
    .query(async ({ input }) => {
      const invite = await prisma.inviteLinks.findUnique({
        where: { token: input.token },
        include: { team: true },
      });
      if (!invite) return null;
      // 过期 / 失效 / 用完
      const expired = invite.expiresAt && invite.expiresAt < new Date();
      const exhausted =
        invite.maxUses !== null && invite.usedCount >= invite.maxUses;
      const usable = invite.isActive && !expired && !exhausted;
      return {
        team: {
          id: invite.team.id,
          name: invite.team.name,
          icon: invite.team.icon,
          description: invite.team.description,
        },
        invite: {
          name: invite.name,
          role: invite.role,
          expiresAt: invite.expiresAt,
          maxUses: invite.maxUses,
          usedCount: invite.usedCount,
          isActive: usable,
        },
      };
    }),
});
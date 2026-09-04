/**
 * invite.ts · 邀请链接 router
 *
 * 端点:
 *   - create      : 创建邀请链接 (admin+)
 *   - list        : 列出团队的邀请链接 (admin+)
 *   - revoke      : 撤销(置 isActive=false) (admin+)
 *   - info        : 公开查询(给 accept 页面用,展示给被邀请者)
 *   - accept      : 当前用户接受邀请,加入团队
 *
 * token 生成:crypto.randomBytes(16).toString('hex')
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import * as crypto from 'crypto';
import { prisma } from '../prisma';
import { authProcedure, publicProcedure, router } from '../middleware';
import { TEAM_ROLE, inviteLinksSchema } from '@shared/lib/prismaZodType';
import { logActivity, requireTeamMember } from '@server/lib/teamAuth';

const inviteRowSchema = inviteLinksSchema.extend({
  createdBy: z.object({
    id: z.number().int(),
    nickname: z.string(),
    image: z.string(),
  }).nullable(),
});

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

export const inviteRouter = router({
  /** 创建邀请链接 (admin+) */
  create: authProcedure
    .input(z.object({
      teamId: z.number().int(),
      name: z.string().max(50).optional().default(''),
      role: z.enum(['admin', 'member', 'guest']).default('member'),
      expiresInDays: z.number().int().positive().nullable().optional(), // null = 永久
      maxUses: z.number().int().positive().nullable().optional(),       // null = 不限
    }))
    .output(inviteRowSchema)
    .mutation(async ({ input, ctx }) => {
      const { member } = await requireTeamMember(ctx, input.teamId, TEAM_ROLE.ADMIN);
      const accountId = Number(ctx.id);
      const token = generateToken();
      const expiresAt =
        input.expiresInDays && input.expiresInDays > 0
          ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
          : null;
      const invite = await prisma.inviteLinks.create({
        data: {
          teamId: input.teamId,
          token,
          name: input.name ?? '',
          role: input.role,
          expiresAt,
          maxUses: input.maxUses ?? null,
          createdById: accountId,
        },
        include: {
          createdBy: { select: { id: true, nickname: true, image: true } },
        },
      });
      await logActivity(input.teamId, accountId, 'invite.create', {
        targetType: 'invite',
        targetId: invite.id,
        metadata: { name: invite.name, role: invite.role, actorRole: member.role },
      });
      return invite;
    }),

  /** 列出团队邀请链接 (admin+) */
  list: authProcedure
    .input(z.object({ teamId: z.number().int() }))
    .output(z.array(inviteRowSchema))
    .query(async ({ input, ctx }) => {
      await requireTeamMember(ctx, input.teamId, TEAM_ROLE.ADMIN);
      const rows = await prisma.inviteLinks.findMany({
        where: { teamId: input.teamId },
        include: {
          createdBy: { select: { id: true, nickname: true, image: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return rows;
    }),

  /** 撤销 (admin+) */
  revoke: authProcedure
    .input(z.object({ inviteId: z.number().int() }))
    .output(z.boolean())
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      const invite = await prisma.inviteLinks.findUnique({
        where: { id: input.inviteId },
      });
      if (!invite) throw new TRPCError({ code: 'NOT_FOUND' });
      await requireTeamMember(ctx, invite.teamId, TEAM_ROLE.ADMIN);
      await prisma.inviteLinks.update({
        where: { id: input.inviteId },
        data: { isActive: false },
      });
      await logActivity(invite.teamId, accountId, 'invite.revoke', {
        targetType: 'invite',
        targetId: invite.id,
      });
      return true;
    }),

  /** 公开查询:被邀请者打开链接看到的信息 */
  info: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .output(z.object({
      invite: z.object({
        id: z.number().int(),
        name: z.string(),
        role: z.string(),
        expiresAt: z.date().nullable(),
        maxUses: z.number().nullable(),
        usedCount: z.number(),
        isActive: z.boolean(),
      }).nullable(),
      team: z.object({
        id: z.number().int(),
        name: z.string(),
        icon: z.string(),
        description: z.string(),
      }).nullable(),
    }).nullable())
    .query(async ({ input }) => {
      const invite = await prisma.inviteLinks.findUnique({
        where: { token: input.token },
        include: { team: true },
      });
      if (!invite) return null;
      const expired = invite.expiresAt ? invite.expiresAt < new Date() : false;
      const exhausted =
        invite.maxUses !== null && invite.usedCount >= invite.maxUses;
      return {
        invite: {
          id: invite.id,
          name: invite.name,
          role: invite.role,
          expiresAt: invite.expiresAt,
          maxUses: invite.maxUses,
          usedCount: invite.usedCount,
          isActive: invite.isActive && !expired && !exhausted,
        },
        team: {
          id: invite.team.id,
          name: invite.team.name,
          icon: invite.team.icon,
          description: invite.team.description,
        },
      };
    }),

  /** 当前用户接受邀请 (auth) */
  accept: authProcedure
    .input(z.object({ token: z.string().min(1) }))
    .output(z.object({
      teamId: z.number().int(),
      teamName: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      const invite = await prisma.inviteLinks.findUnique({
        where: { token: input.token },
        include: { team: true },
      });
      if (!invite) throw new TRPCError({ code: 'NOT_FOUND', message: 'Invite link not found' });
      if (!invite.isActive) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invite link is inactive' });
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invite link expired' });
      }
      if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invite link usage limit reached' });
      }
      // 已经是成员?直接返回
      const existing = await prisma.teamMembers.findUnique({
        where: { teamId_accountId: { teamId: invite.teamId, accountId } },
      });
      if (existing) {
        return { teamId: invite.teamId, teamName: invite.team.name };
      }
      // 事务:加成员 + 计数 +1
      await prisma.$transaction([
        prisma.teamMembers.create({
          data: {
            teamId: invite.teamId,
            accountId,
            role: invite.role,
            status: 'active',
          },
        }),
        prisma.inviteLinks.update({
          where: { id: invite.id },
          data: { usedCount: { increment: 1 } },
        }),
      ]);
      await logActivity(invite.teamId, accountId, 'invite.use', {
        targetType: 'invite',
        targetId: invite.id,
        metadata: { role: invite.role },
      });
      return { teamId: invite.teamId, teamName: invite.team.name };
    }),
});
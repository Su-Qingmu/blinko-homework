/**
 * activity.ts · 团队活动日志 router
 *
 * 端点:
 *   - list  : 列出团队活动(带筛选 / 分页)
 *
 * 设计参考:设计稿右下屏
 *   "最近 7 天 · 所有成员 · 所有操作 · 共 28 条记录"
 */
import { z } from 'zod';
import { prisma } from '../prisma';
import { authProcedure, router } from '../middleware';
import { TEAM_ROLE, teamActivitiesSchema } from '@shared/lib/prismaZodType';
import { requireTeamMember } from '@server/lib/teamAuth';

const actionLabels: Record<string, string> = {
  'team.create': '创建了团队',
  'team.update': '更新了团队信息',
  'team.delete': '删除了团队',
  'member.add': '添加了成员',
  'member.remove': '移除了成员',
  'member.leave': '退出了团队',
  'role.change': '更新了成员角色',
  'invite.create': '创建了邀请链接',
  'invite.use': '通过邀请链接加入了团队',
  'invite.revoke': '撤销了邀请链接',
  'note.share': '分享了笔记到团队',
  'note.unshare': '从团队移除笔记',
};

export const activityRouter = router({
  list: authProcedure
    .input(z.object({
      teamId: z.number().int(),
      days: z.number().int().positive().max(365).default(7),
      accountId: z.number().int().nullable().optional(),
      action: z.string().nullable().optional(),
      page: z.number().int().positive().default(1),
      size: z.number().int().positive().max(100).default(20),
    }))
    .output(z.object({
      items: z.array(teamActivitiesSchema.extend({
        account: z.object({
          id: z.number().int(),
          nickname: z.string(),
          image: z.string(),
        }).nullable(),
        actionLabel: z.string(),
      })),
      total: z.number().int(),
    }))
    .query(async ({ input, ctx }) => {
      await requireTeamMember(ctx, input.teamId);
      const since = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      const where: any = {
        teamId: input.teamId,
        createdAt: { gte: since },
      };
      if (input.accountId !== null && input.accountId !== undefined) {
        where.accountId = input.accountId;
      }
      if (input.action) where.action = input.action;

      const [rows, total] = await Promise.all([
        prisma.teamActivities.findMany({
          where,
          include: {
            account: { select: { id: true, nickname: true, image: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.size,
          take: input.size,
        }),
        prisma.teamActivities.count({ where }),
      ]);

      return {
        items: rows.map((r) => ({
          ...r,
          account: r.account,
          actionLabel: actionLabels[r.action] ?? r.action,
        })),
        total,
      };
    }),
});
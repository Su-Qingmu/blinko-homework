/**
 * teamNote.ts · 协作笔记 router
 *
 * 端点:
 *   - listByTeam : 列出某个团队的所有笔记(含作者 / 共享者 / canEdit)
 *   - share      : 把当前用户的笔记分享到团队
 *   - unshare    : 从团队移除笔记(只有 owner 或 admin 可操作)
 *
 * 设计参考:右中屏"v2.0 启动会议要点"
 *   笔记本身仍归属原作者 account,teamNotes 是关联表。
 *   协作者面板显示当前可访问该笔记的成员。
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { prisma } from '../prisma';
import { authProcedure, router } from '../middleware';
import { TEAM_ROLE, teamNotesSchema } from '@shared/lib/prismaZodType';
import { logActivity, requireTeamMember } from '@server/lib/teamAuth';

const teamNoteRowSchema = teamNotesSchema.extend({
  note: z.object({
    id: z.number().int(),
    content: z.string(),
    type: z.number().int(),
    createdAt: z.date(),
    updatedAt: z.date(),
    accountId: z.number().int().nullable(),
    account: z.object({
      id: z.number().int(),
      nickname: z.string(),
      image: z.string(),
    }).nullable(),
    tags: z.array(z.object({
      tagId: z.number().int(),
      tag: z.object({
        id: z.number().int(),
        name: z.string(),
        icon: z.string(),
      }),
    })),
  }),
  sharedByAccount: z.object({
    id: z.number().int(),
    nickname: z.string(),
    image: z.string(),
  }).nullable(),
});

export const teamNoteRouter = router({
  /** 列出团队所有笔记(成员可访问) */
  listByTeam: authProcedure
    .input(z.object({
      teamId: z.number().int(),
      page: z.number().int().positive().default(1),
      size: z.number().int().positive().max(100).default(30),
    }))
    .output(z.array(teamNoteRowSchema))
    .query(async ({ input, ctx }) => {
      await requireTeamMember(ctx, input.teamId);
      const rows = await prisma.teamNotes.findMany({
        where: { teamId: input.teamId },
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.size,
        take: input.size,
      });
      // 单独补 account / tags
      const noteIds = rows.map((r) => r.noteId);
      const notes = await prisma.notes.findMany({
        where: { id: { in: noteIds } },
        include: {
          account: { select: { id: true, nickname: true, image: true } },
          tags: {
            include: { tag: { select: { id: true, name: true, icon: true } } },
          },
        },
      });
      const noteMap = new Map(notes.map((n) => [n.id, n]));

      // 共享者 account 信息
      const sharedByIds = Array.from(new Set(rows.map((r) => r.sharedById)));
      const accounts = await prisma.accounts.findMany({
        where: { id: { in: sharedByIds } },
        select: { id: true, nickname: true, image: true },
      });
      const acctMap = new Map(accounts.map((a) => [a.id, a]));

      return rows
        .filter((r) => noteMap.has(r.noteId))
        .map((r) => {
          const n: any = noteMap.get(r.noteId);
          return {
            id: r.id,
            teamId: r.teamId,
            noteId: r.noteId,
            canEdit: r.canEdit,
            sharedById: r.sharedById,
            createdAt: r.createdAt,
            note: {
              id: n.id,
              content: n.content,
              type: n.type,
              createdAt: n.createdAt,
              updatedAt: n.updatedAt,
              accountId: n.accountId,
              account: n.account,
              tags: n.tags.map((t: any) => ({
                tagId: t.tagId,
                tag: t.tag,
              })),
            },
            sharedByAccount: acctMap.get(r.sharedById) ?? null,
          };
        });
    }),

  /** 分享笔记到团队 (笔记 owner 才能分享) */
  share: authProcedure
    .input(z.object({
      teamId: z.number().int(),
      noteId: z.number().int(),
      canEdit: z.boolean().default(true),
    }))
    .output(z.boolean())
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      // 必须是团队成员
      await requireTeamMember(ctx, input.teamId);
      // 笔记必须是当前用户的
      const note = await prisma.notes.findUnique({
        where: { id: input.noteId },
      });
      if (!note) throw new TRPCError({ code: 'NOT_FOUND', message: 'Note not found' });
      if (note.accountId !== accountId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only share your own notes',
        });
      }
      // 已存在?
      const existing = await prisma.teamNotes.findUnique({
        where: { teamId_noteId: { teamId: input.teamId, noteId: input.noteId } },
      });
      if (existing) {
        // 更新 canEdit
        await prisma.teamNotes.update({
          where: { id: existing.id },
          data: { canEdit: input.canEdit },
        });
      } else {
        await prisma.teamNotes.create({
          data: {
            teamId: input.teamId,
            noteId: input.noteId,
            canEdit: input.canEdit,
            sharedById: accountId,
          },
        });
      }
      await logActivity(input.teamId, accountId, 'note.share', {
        targetType: 'note',
        targetId: input.noteId,
        metadata: { canEdit: input.canEdit },
      });
      return true;
    }),

  /** 从团队移除笔记 (笔记 owner 或 admin+) */
  unshare: authProcedure
    .input(z.object({
      teamId: z.number().int(),
      noteId: z.number().int(),
    }))
    .output(z.boolean())
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      const { member } = await requireTeamMember(ctx, input.teamId);
      const note = await prisma.notes.findUnique({
        where: { id: input.noteId },
      });
      if (!note) throw new TRPCError({ code: 'NOT_FOUND' });
      const isOwner = note.accountId === accountId;
      const isAdmin =
        member.role === TEAM_ROLE.OWNER || member.role === TEAM_ROLE.ADMIN;
      if (!isOwner && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only note owner or team admin can unshare',
        });
      }
      await prisma.teamNotes.delete({
        where: { teamId_noteId: { teamId: input.teamId, noteId: input.noteId } },
      }).catch(() => null);
      await logActivity(input.teamId, accountId, 'note.unshare', {
        targetType: 'note',
        targetId: input.noteId,
      });
      return true;
    }),

  /** 在团队里直接创建一条新笔记(等价于:创建个人笔记 + 立即分享到团队) */
  createNoteInTeam: authProcedure
    .input(z.object({
      teamId: z.number().int(),
      content: z.string().min(1).max(50_000),
      type: z.number().int().min(0).max(10).default(0),
    }))
    .output(z.object({
      noteId: z.number().int(),
      teamNoteId: z.number().int(),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      await requireTeamMember(ctx, input.teamId);

      const result = await prisma.$transaction(async (tx) => {
        const note = await tx.notes.create({
          data: {
            content: input.content,
            type: input.type,
            accountId,
          },
          select: { id: true },
        });
        const teamNote = await tx.teamNotes.create({
          data: {
            teamId: input.teamId,
            noteId: note.id,
            canEdit: true,
            sharedById: accountId,
          },
          select: { id: true },
        });
        return { noteId: note.id, teamNoteId: teamNote.id };
      });

      await logActivity(input.teamId, accountId, 'note.create', {
        targetType: 'note',
        targetId: result.noteId,
      });

      return result;
    }),

  /**
   * 批量分享笔记到多个团队,每个团队可指定成员子集。
   * 流程:对每个 target → upsert teamNotes → 同步 teamNoteMembers(删除旧 + 插入新)
   */
  shareMulti: authProcedure
    .input(z.object({
      noteId: z.number().int(),
      /**
       * teamId: 目标团队
       * memberIds: 该团队内被勾选的成员 accountId 列表
       *   - 不传 / 空数组 = 移除所有成员关联(等同于 unshare)
       *   - 传全部 = 整个团队可访问
       */
      targets: z.array(z.object({
        teamId: z.number().int(),
        memberIds: z.array(z.number().int()).default([]),
      })).min(1).max(20),
    }))
    .output(z.object({
      shared: z.number().int(),
      removed: z.number().int(),
    }))
    .mutation(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      // 笔记必须是当前用户的
      const note = await prisma.notes.findUnique({ where: { id: input.noteId } });
      if (!note) throw new TRPCError({ code: 'NOT_FOUND', message: 'Note not found' });
      if (note.accountId !== accountId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only share your own notes' });
      }
      // 校验每个 target 都是当前用户所在团队
      const teamIds = input.targets.map((t) => t.teamId);
      const memberships = await prisma.teamMembers.findMany({
        where: { teamId: { in: teamIds }, accountId },
      });
      const allowedTeamIds = new Set(memberships.map((m) => m.teamId));
      for (const tid of teamIds) {
        if (!allowedTeamIds.has(tid)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Not a member of team ${tid}`,
          });
        }
      }

      let shared = 0;
      let removed = 0;

      // 每个 target 独立事务
      for (const target of input.targets) {
        const memberSet = new Set(target.memberIds);
        const result = await prisma.$transaction(async (tx) => {
          // upsert teamNotes
          const teamNote = await tx.teamNotes.upsert({
            where: { teamId_noteId: { teamId: target.teamId, noteId: input.noteId } },
            update: { canEdit: true },
            create: {
              teamId: target.teamId,
              noteId: input.noteId,
              canEdit: true,
              sharedById: accountId,
            },
            select: { id: true },
          });
          // 同步成员:删除旧 → 插入新
          const old = await tx.teamNoteMembers.findMany({
            where: { teamNoteId: teamNote.id },
            select: { accountId: true },
          });
          await tx.teamNoteMembers.deleteMany({ where: { teamNoteId: teamNote.id } });
          if (memberSet.size > 0) {
            await tx.teamNoteMembers.createMany({
              data: Array.from(memberSet).map((aid) => ({
                teamNoteId: teamNote.id,
                accountId: aid,
                canEdit: true,
              })),
            });
          }
          return { oldCount: old.length, newCount: memberSet.size };
        });
        shared += result.newCount;
        removed += result.oldCount - result.newCount > 0 ? result.oldCount - result.newCount : 0;

        // activity 记录
        await logActivity(target.teamId, accountId, 'note.share', {
          targetType: 'note',
          targetId: input.noteId,
          metadata: { teamNoteId: result.oldCount + result.newCount, memberCount: memberSet.size },
        });
      }

      return { shared, removed };
    }),

  /**
   * 列出当前用户可分享到的所有团队(必须是成员)
   * + 该 note 是否已分享到该团队 + 已分享的成员数
   */
  getSharableTeams: authProcedure
    .input(z.object({ noteId: z.number().int() }))
    .output(z.array(z.object({
      teamId: z.number().int(),
      teamName: z.string(),
      teamIcon: z.string(),
      myRole: z.string(),
      memberCount: z.number().int(),
      isShared: z.boolean(),
      sharedMemberCount: z.number().int(),
    })))
    .query(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      // 我所在的团队
      const myMemberships = await prisma.teamMembers.findMany({
        where: { accountId },
        include: {
          team: { select: { id: true, name: true, icon: true } },
        },
      });
      if (myMemberships.length === 0) return [];
      const teamIds = myMemberships.map((m) => m.teamId);
      // 该 note 已被分享到哪些团队
      const existingShares = await prisma.teamNotes.findMany({
        where: { noteId: input.noteId, teamId: { in: teamIds } },
        include: { members: { select: { accountId: true } } },
      });
      const shareMap = new Map(existingShares.map((s) => [s.teamId, s]));
      // 每个团队的成员数
      const memberCounts = await prisma.teamMembers.groupBy({
        by: ['teamId'],
        where: { teamId: { in: teamIds } },
        _count: { _all: true },
      });
      const countMap = new Map(memberCounts.map((c) => [c.teamId, c._count._all]));

      return myMemberships.map((m) => {
        const share = shareMap.get(m.teamId);
        return {
          teamId: m.teamId,
          teamName: m.team.name,
          teamIcon: m.team.icon,
          myRole: m.role,
          memberCount: countMap.get(m.teamId) ?? 0,
          isShared: !!share,
          sharedMemberCount: share?.members.length ?? 0,
        };
      });
    }),

  /**
   * 列出某团队某笔记已勾选的成员(用于回显分享状态)
   */
  getTeamMembersForNote: authProcedure
    .input(z.object({
      noteId: z.number().int(),
      teamId: z.number().int(),
    }))
    .output(z.array(z.number().int()))
    .query(async ({ input, ctx }) => {
      const accountId = Number(ctx.id);
      const note = await prisma.notes.findUnique({ where: { id: input.noteId } });
      if (!note || note.accountId !== accountId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      const teamNote = await prisma.teamNotes.findUnique({
        where: { teamId_noteId: { teamId: input.teamId, noteId: input.noteId } },
        include: { members: { select: { accountId: true } } },
      });
      return teamNote?.members.map((m) => m.accountId) ?? [];
    }),

  /**
   * 列出某团队的成员(用于分享时勾选)
   */
  getTeamMembers: authProcedure
    .input(z.object({ teamId: z.number().int() }))
    .output(z.array(z.object({
      id: z.number().int(),
      nickname: z.string(),
      image: z.string(),
      role: z.string(),
    })))
    .query(async ({ input, ctx }) => {
      await requireTeamMember(ctx, input.teamId);
      const members = await prisma.teamMembers.findMany({
        where: { teamId: input.teamId },
        include: { account: { select: { id: true, nickname: true, image: true } } },
        orderBy: { joinedAt: 'asc' },
      });
      return members.map((m) => ({
        id: m.account.id,
        nickname: m.account.nickname || m.account.id.toString(),
        image: m.account.image,
        role: m.role,
      }));
    }),
});
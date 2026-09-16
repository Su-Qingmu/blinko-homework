'use client';
import { makeAutoObservable } from 'mobx';
import { Store } from './standard/base';
import { api } from '@/lib/trpc';
import { PromiseCall, PromiseState } from './standard/PromiseState';
import { useEffect } from 'react';
import { ToastPlugin } from './module/Toast/Toast';
import i18n from '@/lib/i18n';

/** 与后端 TeamRow 一致 */
export interface TeamRow {
  id: number;
  name: string;
  icon: string;
  description: string;
  ownerId: number;
  createdAt: Date;
  updatedAt: Date;
  myRole: string;
  memberCount: number;
  noteCount: number;
  owner: { id: number; name: string; nickname: string; image: string } | null;
}

export interface MemberRow {
  id: number;
  teamId: number;
  accountId: number;
  role: string;
  status: string;
  joinedAt: Date;
  lastActiveAt: Date | null;
  account: { id: number; name: string; nickname: string; image: string; description: string } | null;
}

export interface InviteRow {
  id: number;
  teamId: number;
  token: string;
  name: string;
  role: string;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  createdById: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: { id: number; nickname: string; image: string } | null;
}

export interface ActivityRow {
  id: number;
  teamId: number;
  accountId: number | null;
  action: string;
  targetType: string | null;
  targetId: number | null;
  metadata: any;
  createdAt: Date;
  account: { id: number; nickname: string; image: string } | null;
  actionLabel: string;
}

export interface TeamNoteRow {
  id: number;
  teamId: number;
  noteId: number;
  canEdit: boolean;
  sharedById: number;
  createdAt: Date;
  note: {
    id: number;
    content: string;
    type: number;
    createdAt: Date;
    updatedAt: Date;
    accountId: number | null;
    account: { id: number; nickname: string; image: string } | null;
    tags: { tagId: number; tag: { id: number; name: string; icon: string } }[];
  };
  sharedByAccount: { id: number; nickname: string; image: string } | null;
}

/** 协作页内部 tab */
export type CollabSection = 'overview' | 'notes' | 'members' | 'invites' | 'activity';

export class TeamStore implements Store {
  sid = 'TeamStore';

  constructor() {
    makeAutoObservable(this);
  }

  /** 当前选中的 team id(切换不刷新页面,只切数据源) */
  currentTeamId: number | null = null;

  /** 当前选中的 tab */
  currentSection: CollabSection = 'overview';

  /** 所有我所在的团队 */
  teamList = new PromiseState({
    function: async () => {
      const list = (await api.team.list.query()) as TeamRow[];
      return list;
    },
    autoAlert: false,
  });

  /** 当前选中的 team 详情 */
  currentTeam = new PromiseState({
    function: async () => {
      if (!this.currentTeamId) return null;
      const t = (await api.team.get.query({ teamId: this.currentTeamId })) as TeamRow | null;
      return t;
    },
    autoAlert: false,
  });

  /** 成员列表 */
  members = new PromiseState({
    function: async () => {
      if (!this.currentTeamId) return [];
      const list = (await api.teamMember.list.query({
        teamId: this.currentTeamId,
      })) as MemberRow[];
      return list;
    },
    autoAlert: false,
  });

  /** 邀请链接 */
  invites = new PromiseState({
    function: async () => {
      if (!this.currentTeamId) return [];
      const list = (await api.invite.list.query({
        teamId: this.currentTeamId,
      })) as InviteRow[];
      return list;
    },
    autoAlert: false,
  });

  /** 活动日志 */
  activity = new PromiseState({
    function: async () => {
      if (!this.currentTeamId) return { items: [], total: 0 };
      const r = (await api.activity.list.query({
        teamId: this.currentTeamId,
        days: 7,
      })) as { items: ActivityRow[]; total: number };
      return r;
    },
    autoAlert: false,
  });

  /** 协作笔记 */
  teamNotes = new PromiseState({
    function: async () => {
      if (!this.currentTeamId) return [];
      const list = (await api.teamNote.listByTeam.query({
        teamId: this.currentTeamId,
      })) as TeamNoteRow[];
      return list;
    },
    autoAlert: false,
  });

  /** 入口:加载团队列表 + 自动选中第一个 */
  async use() {
    useEffect(() => {
      this.refreshTeamList();
    }, []);
  }

  /** 切换当前 team 后,刷新所有相关数据 */
  async switchTeam(teamId: number | null) {
    this.currentTeamId = teamId;
    if (!teamId) {
      this.currentTeam.value = null;
      this.members.value = [];
      this.invites.value = [];
      this.activity.value = { items: [], total: 0 };
      this.teamNotes.value = [];
      return;
    }
    await Promise.all([
      this.currentTeam.call(),
      this.members.call(),
      this.invites.call(),
      this.activity.call(),
      this.teamNotes.call(),
    ]);
  }

  /** 切 tab */
  setSection(section: CollabSection) {
    this.currentSection = section;
  }

  /** 刷新团队列表 */
  async refreshTeamList() {
    await this.teamList.call();
    // 自动选中第一个团队
    const list = this.teamList.value ?? [];
    if (list.length > 0 && (this.currentTeamId == null || !list.find((t) => t.id === this.currentTeamId))) {
      await this.switchTeam(list[0].id);
    }
  }

  /** 创建团队 */
  async createTeam(input: { name: string; icon?: string; description?: string }) {
    const createdTeam = (await PromiseCall(
      api.team.create.mutate(input) as any,
      { successMsg: i18n.t('collab-team-create-success') },
    )) as TeamRow | undefined;
    if (createdTeam) {
      await this.refreshTeamList();
      await this.switchTeam(createdTeam.id);
    }
    return createdTeam;
  }

  /** 删除团队(owner only) */
  async deleteTeam(teamId: number) {
    await PromiseCall(api.team.delete.mutate({ teamId }) as any);
    await this.refreshTeamList();
  }

  /** 退出团队 */
  async leaveTeam(teamId: number) {
    await PromiseCall(api.teamMember.leave.mutate({ teamId }) as any);
    await this.refreshTeamList();
  }

  /** 改角色 */
  async updateMemberRole(teamId: number, accountId: number, role: 'admin' | 'member' | 'guest') {
    await PromiseCall(
      api.teamMember.updateRole.mutate({ teamId, accountId, role }) as any,
    );
    await this.members.call();
    await this.activity.call();
  }

  /** 移除成员 */
  async removeMember(teamId: number, accountId: number) {
    await PromiseCall(
      api.teamMember.remove.mutate({ teamId, accountId }) as any,
    );
    await this.members.call();
    await this.activity.call();
  }

  /** 创建邀请链接 */
  async createInvite(input: {
    teamId: number;
    name?: string;
    role: 'admin' | 'member' | 'guest';
    expiresInDays?: number | null;
    maxUses?: number | null;
  }) {
    await PromiseCall(api.invite.create.mutate(input) as any);
    await this.invites.call();
    await this.activity.call();
  }

  /** 撤销邀请 */
  async revokeInvite(inviteId: number) {
    await PromiseCall(api.invite.revoke.mutate({ inviteId }) as any);
    await this.invites.call();
    await this.activity.call();
  }

  /** 分享笔记到团队 */
  async shareNote(teamId: number, noteId: number, canEdit = true) {
    await PromiseCall(
      api.teamNote.share.mutate({ teamId, noteId, canEdit }) as any,
      { successMsg: i18n.t('collab-notes-share-success') },
    );
    await this.teamNotes.call();
    await this.activity.call();
  }

  /** 取消分享 */
  async unshareNote(teamId: number, noteId: number) {
    await PromiseCall(
      api.teamNote.unshare.mutate({ teamId, noteId }) as any,
    );
    await this.teamNotes.call();
    await this.activity.call();
  }

  /** 在团队里直接创建一条新笔记 */
  async createNoteInTeam(teamId: number, content: string, type = 0) {
    const res = await PromiseCall(
      api.teamNote.createNoteInTeam.mutate({ teamId, content, type }) as any,
      { successMsg: i18n.t('collab-notes-create-success', 'Note created in team') },
    );
    await this.teamNotes.call();
    await this.activity.call();
    return res as { noteId: number; teamNoteId: number };
  }

  /** 工具:判断角色等级 (>=) */
  isAtLeast(role: string, required: 'guest' | 'member' | 'admin' | 'owner') {
    const rank: Record<string, number> = { guest: 0, member: 1, admin: 2, owner: 3 };
    return (rank[role] ?? -1) >= (rank[required] ?? 99);
  }
}
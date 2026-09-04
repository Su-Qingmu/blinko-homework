'use client';
import { observer } from 'mobx-react-lite';
import { RootStore } from '@/store';
import { TeamStore } from '@/store/teamStore';
import { useTranslation } from 'react-i18next';
import { Chip, Select, SelectItem } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import dayjs from 'dayjs';
import { useState } from 'react';
import { api } from '@/lib/trpc';

export const CollabActivity = observer(() => {
  const { t } = useTranslation();
  const teamStore = RootStore.Get(TeamStore);
  const team = teamStore.currentTeam.value;
  const activity = teamStore.activity.value ?? { items: [], total: 0 };

  const [days, setDays] = useState('7');
  const [memberId, setMemberId] = useState('all');
  const [action, setAction] = useState('all');

  if (!team) return null;

  const members = teamStore.members.value ?? [];
  const filteredItems = activity.items.filter((it) => {
    if (memberId !== 'all' && String(it.accountId) !== memberId) return false;
    if (action !== 'all' && it.action !== action) return false;
    return true;
  });

  // 重新查询入口(简化:用 days 触发)
  const updateDays = (d: string) => {
    setDays(d);
    // 直接调 api 刷新
    api.activity.list.query({ teamId: team.id, days: Number(d) }).then((r: any) => {
      teamStore.activity.value = r;
    }).catch(() => {});
  };

  const actionOptions = [
    { key: 'all', label: t('collab-activity-all-actions') },
    { key: 'team.create', label: t('collab-action-team-create') },
    { key: 'member.add', label: t('collab-action-member-add') },
    { key: 'member.remove', label: t('collab-action-member-remove') },
    { key: 'role.change', label: t('collab-action-role-change') },
    { key: 'invite.create', label: t('collab-action-invite-create') },
    { key: 'invite.use', label: t('collab-action-invite-use') },
    { key: 'note.share', label: t('collab-action-note-share') },
  ];

  return (
    <div className="space-y-3">
      {/* 顶部 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold">{t('collab-activity')}</h2>
        <div className="flex items-center gap-2">
          <Select
            size="sm" variant="bordered"
            selectedKeys={[days]}
            onSelectionChange={(keys) => updateDays(Array.from(keys)[0] as string)}
            className="w-32"
            aria-label="days"
          >
            <SelectItem key="1">1 {t('days-ago').slice(-3)}</SelectItem>
            <SelectItem key="7">{t('collab-activity-days', { days: 7 })}</SelectItem>
            <SelectItem key="30">{t('collab-activity-days', { days: 30 })}</SelectItem>
            <SelectItem key="90">{t('collab-activity-days', { days: 90 })}</SelectItem>
          </Select>
          <Select
            size="sm" variant="bordered"
            selectedKeys={[memberId]}
            onSelectionChange={(keys) => setMemberId(Array.from(keys)[0] as string)}
            className="w-40"
            aria-label="member"
          >
            <SelectItem key="all">{t('collab-activity-all-members')}</SelectItem>
            {members.map((m) => (
              <SelectItem key={String(m.accountId)}>{m.account?.nickname ?? '?'}</SelectItem>
            ))}
          </Select>
          <Select
            size="sm" variant="bordered"
            selectedKeys={[action]}
            onSelectionChange={(keys) => setAction(Array.from(keys)[0] as string)}
            className="w-44"
            aria-label="action"
          >
            {actionOptions.map((o) => (
              <SelectItem key={o.key}>{o.label}</SelectItem>
            ))}
          </Select>
        </div>
      </div>

      <div className="text-xs text-desc">
        共 <strong>{activity.total}</strong> 条记录 · 当前筛选 <strong>{filteredItems.length}</strong> 条
      </div>

      {filteredItems.length === 0 ? (
        <div className="py-12 text-center text-desc">
          <Icon icon="hugeicons:activity-01" width="32" height="32" className="mx-auto mb-2 opacity-40" />
          <p>{t('collab-activity-empty')}</p>
        </div>
      ) : (
        <ol className="relative border-l-2 border-default-200 ml-4 space-y-3">
          {filteredItems.map((it) => (
            <li key={it.id} className="ml-6 relative">
              <span className="absolute -left-[33px] top-1 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              </span>
              <div className="bg-background border border-default-200 rounded-lg p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                    {(it.account?.nickname ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-sm">{it.account?.nickname ?? '?'}</span>
                  <span className="text-sm">{it.actionLabel}</span>
                  <Chip size="sm" variant="flat" className="ml-auto">
                    {dayjs(it.createdAt).format('MM-DD HH:mm')}
                  </Chip>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
});


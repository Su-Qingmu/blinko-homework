'use client';
import { observer } from 'mobx-react-lite';
import { RootStore } from '@/store';
import { TeamStore } from '@/store/teamStore';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import dayjs from 'dayjs';
import { useState } from 'react';

export const CollabMembers = observer(() => {
  const { t } = useTranslation();
  const teamStore = RootStore.Get(TeamStore);
  const team = teamStore.currentTeam.value;
  const members = teamStore.members.value ?? [];
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  if (!team) return null;
  const myRole = team.myRole;
  const canManage = teamStore.isAtLeast(myRole, 'admin');

  const filtered = members.filter((m) => {
    if (roleFilter !== 'all' && m.role !== roleFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.account?.nickname ?? '').toLowerCase().includes(q) ||
      (m.account?.name ?? '').toLowerCase().includes(q)
    );
  });

  const roleColor = (r: string) =>
    r === 'owner' ? 'warning' :
    r === 'admin' ? 'primary' :
    r === 'member' ? 'success' : 'default';

  return (
    <div className="space-y-3">
      {/* 顶部信息 + 操作 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">{t('collab-members')}</h2>
          <p className="text-xs text-desc mt-0.5">
            {team.memberCount} {t('collab-members').toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            size="sm"
            placeholder={t('collab-search-member')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startContent={<Icon icon="hugeicons:search-01" width="16" height="16" />}
            className="w-48"
            variant="bordered"
          />
          <Select
            size="sm"
            selectedKeys={[roleFilter]}
            onSelectionChange={(keys) => setRoleFilter(Array.from(keys)[0] as string)}
            className="w-32"
            variant="bordered"
            aria-label={t('collab-all-roles')}
          >
            <SelectItem key="all">{t('collab-all-roles')}</SelectItem>
            <SelectItem key="owner">{t('collab-role-owner')}</SelectItem>
            <SelectItem key="admin">{t('collab-role-admin')}</SelectItem>
            <SelectItem key="member">{t('collab-role-member')}</SelectItem>
            <SelectItem key="guest">{t('collab-role-guest')}</SelectItem>
          </Select>
        </div>
      </div>

      {/* 成员表 */}
      {filtered.length === 0 ? (
        <div className="py-12 text-desc text-center">
          <Icon icon="tabler:users" width="32" height="32" className="mx-auto mb-2 opacity-40" />
          <p>{t('collab-no-members')}</p>
        </div>
      ) : (
        <Table shadow="none" aria-label="members" classNames={{ wrapper: 'border border-default-200 rounded-xl' }}>
          <TableHeader>
            <TableColumn>{t('nickname')}</TableColumn>
            <TableColumn>{t('collab-tab-overview') === 'Overview' ? 'Role' : '角色'}</TableColumn>
            <TableColumn>{t('collab-status-active')}</TableColumn>
            <TableColumn>{t('last-active')}</TableColumn>
            <TableColumn>{t('notes')}</TableColumn>
            {canManage && <TableColumn>{t('action')}</TableColumn>}
          </TableHeader>
          <TableBody>
            {filtered.map((m) => {
              const isMe = m.accountId === team.ownerId ? false : false; // 简化,后端 ownerId 不一定对应当前用户
              const isOwnerRole = m.role === 'owner';
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold">
                        {(m.account?.nickname ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{m.account?.nickname ?? '?'}</div>
                        <div className="text-xs text-desc">{m.account?.description ?? ''}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat" color={roleColor(m.role) as any}>
                      {t(`collab-role-${m.role === 'owner' ? 'owner' : m.role === 'admin' ? 'admin' : m.role === 'member' ? 'member' : 'guest'}`)}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="dot" color={m.status === 'active' ? 'success' : 'default'}>
                      {t(`collab-status-${m.status}`)}
                    </Chip>
                  </TableCell>
                  <TableCell className="text-xs text-desc">
                    {m.lastActiveAt
                      ? dayjs(m.lastActiveAt).format('YYYY-MM-DD')
                      : t('collab-never')}
                  </TableCell>
                  <TableCell className="text-xs text-desc">
                    {m.accountId} {/* 笔记数需要 join query,先放 accountId 占位 */}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      {!isOwnerRole && myRole === 'owner' && (
                        <Dropdown placement="bottom-end">
                          <DropdownTrigger>
                            <Button isIconOnly size="sm" variant="light">
                              <Icon icon="hugeicons:more-horizontal" width="16" height="16" />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="member actions">
                            <DropdownItem
                              key="role"
                              startContent={<Icon icon="hugeicons:user-edit" width="14" height="14" />}
                              onPress={() => {
                                const next = m.role === 'admin' ? 'member' : m.role === 'member' ? 'guest' : 'member';
                                teamStore.updateMemberRole(team.id, m.accountId, next as any);
                              }}
                            >
                              {t('collab-change-role')}
                            </DropdownItem>
                            <DropdownItem
                              key="remove"
                              color="danger"
                              startContent={<Icon icon="hugeicons:user-remove" width="14" height="14" />}
                              onPress={() => {
                                if (window.confirm(t('collab-remove-confirm', { name: m.account?.nickname ?? '?' }))) {
                                  teamStore.removeMember(team.id, m.accountId);
                                }
                              }}
                            >
                              {t('collab-remove-member')}
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      )}
                      {!isOwnerRole && myRole === 'admin' && m.role !== 'admin' && (
                        <Button
                          isIconOnly size="sm" variant="light" color="danger"
                          onPress={() => {
                            if (window.confirm(t('collab-remove-confirm', { name: m.account?.nickname ?? '?' }))) {
                              teamStore.removeMember(team.id, m.accountId);
                            }
                          }}
                        >
                          <Icon icon="hugeicons:user-remove" width="14" height="14" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
});
'use client';
import { observer } from 'mobx-react-lite';
import { RootStore } from '@/store';
import { TeamStore } from '@/store/teamStore';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Switch, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import dayjs from 'dayjs';
import { useState } from 'react';
import { ToastPlugin } from '@/store/module/Toast/Toast';

export const CollabInvites = observer(() => {
  const { t } = useTranslation();
  const teamStore = RootStore.Get(TeamStore);
  const team = teamStore.currentTeam.value;
  const invites = teamStore.invites.value ?? [];
  const [createOpen, setCreateOpen] = useState(false);
  const myRole = team?.myRole ?? 'guest';
  const canManage = teamStore.isAtLeast(myRole, 'admin');

  if (!team) return null;

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      RootStore.Get(ToastPlugin).success(t('collab-invite-copied'));
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      RootStore.Get(ToastPlugin).success(t('collab-invite-copied'));
    }
  };

  const inviteStatus = (inv: any) => {
    if (!inv.isActive) return { label: t('collab-invite-revoked'), color: 'default' as const };
    if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) return { label: t('collab-invite-expired'), color: 'warning' as const };
    if (inv.maxUses !== null && inv.usedCount >= inv.maxUses) return { label: t('collab-invite-expired'), color: 'warning' as const };
    return { label: t('collab-invite-valid'), color: 'success' as const };
  };

  return (
    <div className="space-y-4">
      {/* 顶部横幅 */}
      <div className="rounded-2xl p-5 bg-gradient-to-br from-fuchsia-500/15 to-pink-500/15 border border-default-200 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center text-white">
          <Icon icon="hugeicons:link-01" width="22" height="22" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold">{t('collab-invite-banner')}</h3>
          <p className="text-sm text-desc mt-1">{t('collab-invite-banner-desc')}</p>
        </div>
        {canManage && (
          <Button color="primary" onPress={() => setCreateOpen(true)} startContent={<Icon icon="hugeicons:add-01" width="16" height="16" />}>
            {t('collab-invite-create')}
          </Button>
        )}
      </div>

      {/* 链接列表 */}
      <div>
        <h3 className="text-sm font-semibold mb-2">
          {t('collab-invite-active', { count: invites.length })}
        </h3>
        {invites.length === 0 ? (
          <div className="py-10 text-center text-desc">
            <Icon icon="hugeicons:link-01" width="32" height="32" className="mx-auto mb-2 opacity-40" />
            <p>{t('collab-invite-empty')}</p>
          </div>
        ) : (
          <Table shadow="none" aria-label="invites" classNames={{ wrapper: 'border border-default-200 rounded-xl' }}>
            <TableHeader>
              <TableColumn>{t('collab-invite-name')}</TableColumn>
              <TableColumn>{t('collab-invite-role')}</TableColumn>
              <TableColumn>{t('collab-invite-expires')}</TableColumn>
              <TableColumn>{t('collab-invite-max-uses')}</TableColumn>
              <TableColumn>{t('collab-invite-valid')}</TableColumn>
              <TableColumn>{t('action')}</TableColumn>
            </TableHeader>
            <TableBody>
              {invites.map((inv) => {
                  const status = inviteStatus(inv);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="font-medium">{inv.name || '(unnamed)'}</div>
                        <div className="text-xs text-desc mt-0.5">
                          {inv.createdBy?.nickname} · {dayjs(inv.createdAt).format('YYYY-MM-DD')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip size="sm" variant="flat">{t(`collab-role-${inv.role}`)}</Chip>
                      </TableCell>
                      <TableCell className="text-xs">
                        {inv.expiresAt ? dayjs(inv.expiresAt).format('YYYY-MM-DD') : t('collab-invite-permanent')}
                      </TableCell>
                      <TableCell className="text-xs">
                        {inv.maxUses === null ? (
                          <span className="text-desc">{t('collab-invite-unlimited')}</span>
                        ) : (
                          t('collab-invite-used', { used: inv.usedCount, max: inv.maxUses })
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="sm" variant="dot" color={status.color}>{status.label}</Chip>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            isIconOnly size="sm" variant="light"
                            onPress={() => copyLink(inv.token)}
                          >
                            <Icon icon="hugeicons:copy-01" width="14" height="14" />
                          </Button>
                          {canManage && inv.isActive && (
                            <Button
                              isIconOnly size="sm" variant="light" color="danger"
                              onPress={() => {
                                if (window.confirm(t('collab-invite-revoke-confirm'))) {
                                  teamStore.revokeInvite(inv.id);
                                }
                              }}
                            >
                              <Icon icon="hugeicons:delete-02" width="14" height="14" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateInviteDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        teamId={team.id}
      />
    </div>
  );
});

interface CreateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: number;
}

export const CreateInviteDialog = observer(({ createOpen, onOpenChange, teamId }: CreateProps) => {
  const { t } = useTranslation();
  const teamStore = RootStore.Get(TeamStore);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'member' | 'admin' | 'guest'>('member');
  const [permanent, setPermanent] = useState(true);
  const [days, setDays] = useState('7');
  const [unlimited, setUnlimited] = useState(true);
  const [maxUses, setMaxUses] = useState('10');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName('');
    setRole('member');
    setPermanent(true);
    setDays('7');
    setUnlimited(true);
    setMaxUses('10');
  };

  const submit = async () => {
    setBusy(true);
    await teamStore.createInvite({
      teamId,
      name: name.trim(),
      role,
      expiresInDays: permanent ? null : Number(days) || 7,
      maxUses: unlimited ? null : Number(maxUses) || 10,
    });
    setBusy(false);
    reset();
    onOpenChange(false);
  };

  return (
    <Modal isOpen={createOpen} onOpenChange={onOpenChange} size="lg" placement="center">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-2">
              <Icon icon="hugeicons:add-01" width="20" height="20" className="text-primary" />
              {t('collab-invite-create')}
            </ModalHeader>
            <ModalBody className="gap-3">
              <Input
                label={t('collab-invite-name')}
                placeholder={t('collab-invite-name-placeholder')}
                labelPlacement="outside"
                variant="bordered"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Select
                label={t('collab-invite-role')}
                selectedKeys={[role]}
                onSelectionChange={(keys) => setRole(Array.from(keys)[0] as any)}
                labelplacement="outside"
                variant="bordered"
              >
                <SelectItem key="member">{t('collab-role-member')}</SelectItem>
                <SelectItem key="admin">{t('collab-role-admin')}</SelectItem>
                <SelectItem key="guest">{t('collab-role-guest')}</SelectItem>
              </Select>
              <div className="flex items-center justify-between gap-3">
                <Switch isSelected={permanent} onValueChange={setPermanent}>
                  {t('collab-invite-permanent')}
                </Switch>
                {!permanent && (
                  <Input
                    type="number"
                    size="sm"
                    label={t('collab-invite-expires')}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    className="w-24"
                    endContent={<span className="text-xs text-desc">d</span>}
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <Switch isSelected={unlimited} onValueChange={setUnlimited}>
                  {t('collab-invite-unlimited')}
                </Switch>
                {!unlimited && (
                  <Input
                    type="number"
                    size="sm"
                    label={t('collab-invite-max-uses')}
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="w-24"
                  />
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>{t('cancel')}</Button>
              <Button color="primary" isLoading={busy} onPress={submit}>{t('create')}</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
});
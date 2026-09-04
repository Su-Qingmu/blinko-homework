'use client';
import { observer } from 'mobx-react-lite';
import { RootStore } from '@/store';
import { TeamStore } from '@/store/teamStore';
import { useTranslation } from 'react-i18next';
import { Button, Card, CardBody, CardFooter, CardHeader } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

export const CollabOverview = observer(() => {
  const { t } = useTranslation();
  const teamStore = RootStore.Get(TeamStore);
  const team = teamStore.currentTeam.value;
  const navigate = useNavigate();

  if (!team) return null;

  const isOwner = team.myRole === 'owner';
  const teamNotes = teamStore.teamNotes.value ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 团队卡片 */}
      <Card shadow="sm" className="md:col-span-2 border border-default-200">
        <CardHeader className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 text-primary flex items-center justify-center text-2xl font-semibold">
            {team.icon || team.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">{team.name}</h2>
              <span className="px-2 py-0.5 rounded-full text-xs bg-primary/15 text-primary font-medium">
                {t(`collab-role-${team.myRole === 'owner' ? 'owner' : team.myRole}`)}
              </span>
            </div>
            {team.description && <p className="text-sm text-desc mt-1">{team.description}</p>}
            <p className="text-xs text-desc mt-2">
              {t('collab-meta', { members: team.memberCount, notes: team.noteCount })}
              {' · '}
              {t('collab-team-created-at', { date: dayjs(team.createdAt).format('YYYY-MM-DD') })}
            </p>
          </div>
        </CardHeader>
        {team.owner && (
          <CardBody className="pt-0 flex items-center gap-3 text-sm text-desc">
            <Icon icon="hugeicons:crown" width="14" height="14" />
            <span>{team.owner.nickname}</span>
          </CardBody>
        )}
        <CardFooter className="gap-2 flex-wrap">
          <Button
            size="sm"
            variant="flat"
            color="primary"
            startContent={<Icon icon="hugeicons:user-multiple" width="16" height="16" />}
            onPress={() => teamStore.setSection('members')}
          >
            {t('collab-members')}
          </Button>
          <Button
            size="sm"
            variant="flat"
            startContent={<Icon icon="hugeicons:link-01" width="16" height="16" />}
            onPress={() => teamStore.setSection('invites')}
          >
            {t('collab-invites')}
          </Button>
          <Button
            size="sm"
            variant="flat"
            startContent={<Icon icon="hugeicons:note" width="16" height="16" />}
            onPress={() => teamStore.setSection('notes')}
          >
            {t('collab-notes')}
          </Button>
          {isOwner && (
            <Button
              size="sm"
              variant="flat"
              color="danger"
              className="ml-auto"
              startContent={<Icon icon="hugeicons:delete-02" width="16" height="16" />}
              onPress={async () => {
                const ok = window.confirm(t('collab-team-delete-confirm', { name: team.name }));
                if (ok) await teamStore.deleteTeam(team.id);
              }}
            >
              {t('delete')}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* 最近笔记 */}
      <Card shadow="sm" className="border border-default-200">
        <CardHeader className="flex justify-between items-center">
          <h3 className="text-sm font-semibold">{t('collab-notes')}</h3>
          <Button
            size="sm"
            variant="light"
            onPress={() => teamStore.setSection('notes')}
          >
            {t('view-all')}
          </Button>
        </CardHeader>
        <CardBody className="pt-0">
          {teamNotes.slice(0, 3).length === 0 ? (
            <p className="text-sm text-desc py-4 text-center">{t('collab-notes-empty')}</p>
          ) : (
            <ul className="space-y-2">
              {teamNotes.slice(0, 3).map((n) => (
                <li
                  key={n.id}
                  className="p-2 rounded-lg cursor-pointer"
                  onClick={() => navigate(`/?path=notes&id=${n.noteId}`)}
                >
                  <div className="text-sm font-medium line-clamp-1">
                    {n.note.content.replace(/^#+\s*/g, '').split('\n')[0] || '(无标题)'}
                  </div>
                  <div className="text-xs text-desc mt-0.5">
                    {n.sharedByAccount?.nickname} · {dayjs(n.createdAt).format('YYYY-MM-DD HH:mm')}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
});
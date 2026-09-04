'use client';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { RootStore } from '@/store';
import { TeamStore, type CollabSection } from '@/store/teamStore';
import { ScrollArea } from '@/components/Common/ScrollArea';
import { Button, Chip, Tab, Tabs } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { useTranslation } from 'react-i18next';
import { CollabOverview } from '@/components/Collaboration/CollabOverview';
import { CollabNotes } from '@/components/Collaboration/CollabNotes';
import { CollabMembers } from '@/components/Collaboration/CollabMembers';
import { CollabInvites } from '@/components/Collaboration/CollabInvites';
import { CollabActivity } from '@/components/Collaboration/CollabActivity';
import { CollabEmpty } from '@/components/Collaboration/CollabEmpty';
import { CreateTeamDialog } from '@/components/Collaboration/CreateTeamDialog';

const CollaborationPage = observer(() => {
  const teamStore = RootStore.Get(TeamStore);
  const { t } = useTranslation();
  teamStore.use();

  const teams = teamStore.teamList.value ?? [];
  const currentTeam = teamStore.currentTeam.value;
  const [createOpen, setCreateOpen] = useState(false);

  const sectionKeys: { key: CollabSection; label: string; icon: string }[] = [
    { key: 'overview', label: t('collab-tab-overview'), icon: 'hugeicons:dashboard-01' },
    { key: 'notes', label: t('collab-tab-notes'), icon: 'hugeicons:note' },
    { key: 'members', label: t('collab-tab-members'), icon: 'hugeicons:user-multiple' },
    { key: 'invites', label: t('collab-tab-invites'), icon: 'hugeicons:link-01' },
    { key: 'activity', label: t('collab-tab-activity'), icon: 'hugeicons:activity-01' },
  ];

  return (
    <ScrollArea fixMobileTopBar className="px-4 md:px-6 py-4 mx-auto max-w-7xl">
        {/* 顶部:团队选择 + 新建 */}
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icon icon="hugeicons:user-multiple" width="24" height="24" className="text-primary" />
            <h1 className="text-xl md:text-2xl font-semibold truncate">{t('collaboration')}</h1>
            {currentTeam && (
              <Chip size="sm" variant="flat" color="primary" className="ml-2">
                {currentTeam.name}
              </Chip>
            )}
          </div>
          <Button
            color="primary"
            size="sm"
            startContent={<Icon icon="hugeicons:add-team" width="16" height="16" />}
            onPress={() => setCreateOpen(true)}
          >
            {t('collab-create-team')}
          </Button>
        </div>

        {/* 团队列表(横向滚动条) */}
        {teams.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-1 px-1">
            {teams.map((team) => {
              const active = team.id === teamStore.currentTeamId;
              return (
                <button
                  key={team.id}
                  onClick={() => teamStore.switchTeam(team.id)}
                  className={[
                    'flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap transition-all border',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-hover border-default-200',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'w-7 h-7 rounded-full flex items-center justify-center font-semibold text-sm',
                      active ? 'bg-white/20' : 'bg-primary/15',
                    ].join(' ')}
                  >
                    {team.icon || team.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{team.name}</span>
                    <span className={['text-xs', active ? 'opacity-80' : 'text-desc'].join(' ')}>
                      {team.memberCount} {t('collab-members').toLowerCase()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 没有团队 → 空状态 */}
        {teams.length === 0 && !teamStore.teamList.loading.value ? (
          <CollabEmpty onCreate={() => setCreateOpen(true)} />
        ) : currentTeam ? (
          <>
            {/* 子 tab */}
            <Tabs
              aria-label="collab sections"
              selectedKey={teamStore.currentSection}
              onSelectionChange={(key) => teamStore.setSection(key as CollabSection)}
              variant="underlined"
              classNames={{
                tabList: 'gap-2 md:gap-6 w-full relative rounded-none p-0 border-b border-divider',
                cursor: 'w-full bg-primary',
                tab: 'max-w-fit px-0',
                tabContent: 'group-data-[selected=true]:text-primary',
              }}
            >
              {sectionKeys.map((s) => (
                <Tab
                  key={s.key}
                  title={
                    <div className="flex items-center gap-2">
                      <Icon icon={s.icon} width="16" height="16" />
                      <span>{s.label}</span>
                    </div>
                  }
                />
              ))}
            </Tabs>

            <div className="mt-4">
              {teamStore.currentSection === 'overview' && <CollabOverview />}
              {teamStore.currentSection === 'notes' && <CollabNotes />}
              {teamStore.currentSection === 'members' && <CollabMembers />}
              {teamStore.currentSection === 'invites' && <CollabInvites />}
              {teamStore.currentSection === 'activity' && <CollabActivity />}
            </div>
          </>
        ) : null}

        <CreateTeamDialog open={createOpen} onOpenChange={setCreateOpen} />
    </ScrollArea>
  );
});

export default CollaborationPage;
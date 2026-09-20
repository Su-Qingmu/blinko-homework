'use client';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Chip, ScrollShadow } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import { useTranslation } from 'react-i18next';
import { RootStore } from '@/store';
import { TeamStore } from '@/store/teamStore';
import { ToastPlugin } from '@/store/module/Toast/Toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: number;
  /** inline 模式 = 不渲染 fixed 全屏遮罩,作为子组件嵌入外层 */
  inline?: boolean;
  /** inline 模式下提交完成后的回调(外层用来关闭自己) */
  onSubmit?: () => void;
}

interface SharableTeam {
  teamId: number;
  teamName: string;
  teamIcon: string;
  myRole: string;
  memberCount: number;
  isShared: boolean;
  sharedMemberCount: number;
}

interface TeamMember {
  id: number;
  nickname: string;
  image: string;
  role: string;
}

type Step = 'team' | 'member';

export const TeamShareDialog = observer(({ open, onOpenChange, noteId, inline, onSubmit }: Props) => {
  const { t } = useTranslation();
  const teamStore = RootStore.Get(TeamStore);

  const [step, setStep] = useState<Step>('team');
  const [teams, setTeams] = useState<SharableTeam[]>([]);
  const [membersByTeam, setMembersByTeam] = useState<Record<number, TeamMember[]>>({});
  const [pickedTeams, setPickedTeams] = useState<Set<number>>(new Set());
  const [pickedMembers, setPickedMembers] = useState<Record<number, Set<number>>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  // 打开时初始化
  useEffect(() => {
    if (!open) return;
    setStep('team');
    setLoading(true);
    teamStore
      .sharableTeams(noteId)
      .then((list: any) => {
        const arr = (list ?? []) as SharableTeam[];
        setTeams(arr);
        // 默认:不选任何团队
        setPickedTeams(new Set());
        setPickedMembers({});
      })
      .catch((e) => {
        console.error(e);
        RootStore.Get(ToastPlugin).call({ title: 'Failed to load teams', type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [open, noteId]);

  const toggleTeam = (teamId: number) => {
    setPickedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const selectAllTeams = () => setPickedTeams(new Set(teams.map((t) => t.teamId)));
  const clearAllTeams = () => setPickedTeams(new Set());

  // 进入成员步骤
  const goMemberStep = async () => {
    if (pickedTeams.size === 0) return;
    setLoading(true);
    try {
      // 对每个新选中的团队:加载成员 + 回显已分享成员
      const newMembers: Record<number, TeamMember[]> = { ...membersByTeam };
      const newPicked: Record<number, Set<number>> = { ...pickedMembers };
      await Promise.all(
        Array.from(pickedTeams).map(async (teamId) => {
          if (!newMembers[teamId]) {
            const list = (await teamStore.teamMembers(teamId)) as TeamMember[];
            newMembers[teamId] = list;
            // 默认全选该团队成员
            newPicked[teamId] = new Set(list.map((m) => m.id));
          }
        }),
      );
      setMembersByTeam(newMembers);
      setPickedMembers(newPicked);
      setStep('member');
    } catch (e) {
      console.error(e);
      RootStore.Get(ToastPlugin).call({ title: 'Failed to load members', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setStep('team');
  };

  const toggleMember = (teamId: number, accountId: number) => {
    setPickedMembers((prev) => {
      const cur = prev[teamId] ?? new Set<number>();
      const next = new Set(cur);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return { ...prev, [teamId]: next };
    });
  };

  const toggleAllMembers = (teamId: number) => {
    setPickedMembers((prev) => {
      const list = membersByTeam[teamId] ?? [];
      const cur = prev[teamId] ?? new Set<number>();
      const allSelected = cur.size === list.length && list.length > 0;
      return { ...prev, [teamId]: allSelected ? new Set<number>() : new Set(list.map((m) => m.id)) };
    });
  };

  const submit = async () => {
    if (pickedTeams.size === 0) return;
    setBusy(true);
    try {
      const targets = Array.from(pickedTeams).map((teamId) => ({
        teamId,
        memberIds: Array.from(pickedMembers[teamId] ?? []),
      }));
      await teamStore.shareNoteToTeams(noteId, targets);
      onOpenChange(false);
      onSubmit?.();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  // 排序:已分享的排前(给视觉提示)
  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => Number(b.isShared) - Number(a.isShared)),
    [teams],
  );

  const pickedTeamCount = pickedTeams.size;
  const allTeamsSelected = pickedTeamCount === teams.length && teams.length > 0;
  const pickedMemberTotal = Object.values(pickedMembers).reduce((s, set) => s + set.size, 0);

  return (
    <div
      className={[
        inline
          ? (open ? 'flex flex-col h-full' : 'hidden')
          : 'fixed inset-0 z-50 flex items-center justify-center bg-black/40',
        open ? '' : 'hidden',
      ].join(' ')}
    >
      <div
        className={[
          'bg-background rounded-2xl p-5 w-[640px] max-w-[95vw] max-h-[85vh] shadow-xl flex flex-col',
          inline ? 'w-full max-w-none max-h-none shadow-none p-0' : '',
        ].join(' ')}
      >
        {/* 标题栏 */}
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <Icon icon="hugeicons:share-01" width="20" height="20" className="text-primary" />
          <h3 className="font-semibold">
            {t('collab-team-share', 'Share note to teams')}
          </h3>
          {!inline && (
            <button
              className="ml-auto opacity-60 hover:opacity-100"
              onClick={() => onOpenChange(false)}
              aria-label="close"
            >
              <Icon icon="hugeicons:cancel-01" width="20" height="20" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <Icon icon="line-md:loading-twotone-loop" className="text-primary" width="28" height="28" />
          </div>
        ) : step === 'team' ? (
          <>
            {/* Step 1: 选团队 */}
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="text-sm text-default-600">
                {t('collab-team-share-step1', 'Select teams to share')}
              </div>
              <Button
                size="sm" variant="light"
                onPress={allTeamsSelected ? clearAllTeams : selectAllTeams}
                isDisabled={teams.length === 0}
              >
                {allTeamsSelected
                  ? t('collab-deselect-all', 'Deselect all')
                  : t('collab-select-all', 'Select all')}
              </Button>
            </div>
            <ScrollShadow className="flex-1 min-h-0 max-h-[50vh] border border-default-200 rounded-xl">
              {sortedTeams.length === 0 ? (
                <div className="p-8 text-center text-default-400 text-sm">
                  {t('collab-team-share-no-teams', 'You are not in any team yet')}
                </div>
              ) : (
                <div className="divide-y divide-default-100">
                  {sortedTeams.map((team) => {
                    const selected = pickedTeams.has(team.teamId);
                    return (
                      <button
                        key={team.teamId}
                        className={[
                          'w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-hover',
                          selected ? 'bg-primary/10' : '',
                        ].join(' ')}
                        onClick={() => toggleTeam(team.teamId)}
                      >
                        <Checkbox isSelected={selected} onValueChange={() => toggleTeam(team.teamId)} />
                        <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm">
                          {team.teamIcon || team.teamName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{team.teamName}</div>
                          <div className="text-xs text-default-500">
                            {team.memberCount} {t('members', 'members')} · {t('my-role', 'role')}: {team.myRole}
                          </div>
                        </div>
                        {team.isShared && (
                          <Chip size="sm" variant="flat" color="success">
                            {t('collab-already-shared', 'Shared')}
                          </Chip>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollShadow>
            <div className="flex items-center justify-between mt-4 shrink-0">
              <span className="text-xs text-default-500">
                {t('collab-selected-count', { count: pickedTeamCount, defaultValue: `${pickedTeamCount} selected` })}
              </span>
              <div className="flex gap-2">
                <Button variant="light" onPress={() => onOpenChange(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  color="primary"
                  isDisabled={pickedTeamCount === 0}
                  onPress={goMemberStep}
                  endContent={<Icon icon="hugeicons:arrow-right-01" width="16" height="16" />}
                >
                  {t('next', 'Next')}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Step 2: 选成员 */}
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <Button
                size="sm" variant="light"
                startContent={<Icon icon="hugeicons:arrow-left-01" width="16" height="16" />}
                onPress={goBack}
              >
                {t('collab-back-to-teams', 'Teams')}
              </Button>
              <span className="text-sm text-default-600 ml-auto">
                {pickedTeamCount} {t('teams', 'teams')} · {pickedMemberTotal} {t('members', 'members')}
              </span>
            </div>
            <ScrollShadow className="flex-1 min-h-0 max-h-[55vh] border border-default-200 rounded-xl">
              <div className="divide-y divide-default-100">
                {Array.from(pickedTeams).map((teamId) => {
                  const team = teams.find((t) => t.teamId === teamId);
                  const members = membersByTeam[teamId] ?? [];
                  const picked = pickedMembers[teamId] ?? new Set<number>();
                  const allSel = picked.size === members.length && members.length > 0;
                  return (
                    <div key={teamId} className="p-2">
                      {/* 团队 header */}
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs">
                          {team?.teamIcon || team?.teamName?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="font-medium text-sm">{team?.teamName ?? `Team ${teamId}`}</div>
                        <Button
                          size="sm" variant="light" className="ml-auto"
                          onPress={() => toggleAllMembers(teamId)}
                        >
                          {allSel ? t('collab-deselect-all', 'Deselect all') : t('collab-select-all', 'Select all')}
                        </Button>
                      </div>
                      {/* 成员列表 */}
                      <div className="space-y-0.5 pl-3">
                        {members.length === 0 ? (
                          <div className="text-xs text-default-400 px-2 py-1">{t('no-members', 'No members')}</div>
                        ) : (
                          members.map((m) => {
                            const sel = picked.has(m.id);
                            return (
                              <button
                                key={m.id}
                                className={[
                                  'w-full text-left px-2 py-1.5 rounded-md flex items-center gap-2 hover:bg-hover',
                                  sel ? 'bg-primary/10' : '',
                                ].join(' ')}
                                onClick={() => toggleMember(teamId, m.id)}
                              >
                                <Checkbox isSelected={sel} onValueChange={() => toggleMember(teamId, m.id)} />
                                <div className="w-6 h-6 rounded-full bg-default-200 text-default-700 flex items-center justify-center text-[10px] font-semibold">
                                  {m.nickname?.charAt(0).toUpperCase() ?? '?'}
                                </div>
                                <div className="text-sm flex-1 truncate">{m.nickname}</div>
                                <Chip size="sm" variant="flat" className="text-[10px]">
                                  {m.role}
                                </Chip>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollShadow>
            <div className="flex items-center justify-between mt-4 shrink-0">
              <Button variant="light" onPress={goBack}>
                {t('back')}
              </Button>
              <div className="flex gap-2">
                <Button variant="light" onPress={() => onOpenChange(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  color="primary"
                  isLoading={busy}
                  isDisabled={pickedTeamCount === 0}
                  onPress={submit}
                >
                  {t('share')}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

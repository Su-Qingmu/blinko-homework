'use client';
import { observer } from 'mobx-react-lite';
import { RootStore } from '@/store';
import { TeamStore } from '@/store/teamStore';
import { BlinkoStore } from '@/store/blinkoStore';
import { useTranslation } from 'react-i18next';
import { Button, Card, CardBody, Chip } from '@heroui/react';
import { Icon } from '@/components/Common/Iconify/icons';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import { api } from '@/lib/trpc';

export const CollabNotes = observer(() => {
  const { t } = useTranslation();
  const teamStore = RootStore.Get(TeamStore);
  const blinkoStore = RootStore.Get(BlinkoStore);
  const team = teamStore.currentTeam.value;
  const notes = teamStore.teamNotes.value ?? [];
  const myRole = team?.myRole ?? 'guest';
  const [shareOpen, setShareOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [myNoteList, setMyNoteList] = useState<any[]>([]);

  if (!team) return null;

  // 拉当前用户的笔记列表(给 share 用)
  useEffect(() => {
    api.notes.list.query({ page: 1, size: 50 }).then((r: any) => {
      setMyNoteList(r ?? []);
    }).catch(() => {});
  }, [shareOpen]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-semibold">{t('collab-notes')}</h2>
        <div className="flex gap-2">
          <Button
            color="primary" size="sm" variant="flat"
            startContent={<Icon icon="hugeicons:add-01" width="14" height="14" />}
            onPress={() => setCreateOpen(true)}
          >
            {t('collab-notes-create', 'New note')}
          </Button>
          <Button
            color="primary" size="sm"
            startContent={<Icon icon="hugeicons:share-01" width="14" height="14" />}
            onPress={() => setShareOpen(true)}
          >
            {t('collab-notes-share')}
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="py-12 text-center text-desc">
          <Icon icon="hugeicons:note" width="32" height="32" className="mx-auto mb-2 opacity-40" />
          <p>{t('collab-notes-empty')}</p>
          <p className="text-xs mt-1">{t('collab-notes-share-hint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {notes.map((tn) => {
            const preview = tn.note.content.split('\n')[0].replace(/^#+\s*/, '');
            const tagNames = tn.note.tags.map((t) => t.tag.name);
            return (
              <Card key={tn.id} shadow="sm" className="border border-default-200">
                <CardBody className="gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium line-clamp-2">{preview || '(无标题)'}</div>
                    {tn.canEdit && (
                      <Chip size="sm" variant="flat" color="success">可编辑</Chip>
                    )}
                  </div>
                  {tagNames.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tagNames.slice(0, 3).map((tag) => (
                        <Chip key={tag} size="sm" variant="flat">{tag}</Chip>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-desc mt-2">
                    <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-semibold">
                      {(tn.sharedByAccount?.nickname ?? '?').charAt(0).toUpperCase()}
                    </div>
                    <span>{tn.sharedByAccount?.nickname ?? '?'}</span>
                    <span>·</span>
                    <span>{dayjs(tn.createdAt).format('YYYY-MM-DD')}</span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Button
                      size="sm" variant="light"
                      onPress={() => blinkoStore.noteContent = tn.note.content}
                      as="a" href={`/?path=notes&id=${tn.noteId}`}
                    >
                      打开
                    </Button>
                    {tn.sharedById === Number(blinkoStore.userList.value?.[0]?.id ?? 0) || myRole === 'admin' || myRole === 'owner' ? (
                      <Button
                        size="sm" variant="light" color="danger"
                        onPress={() => {
                          if (window.confirm(t('collab-notes-unshare-confirm'))) {
                            teamStore.unshareNote(team.id, tn.noteId);
                          }
                        }}
                      >
                        {t('collab-notes-unshare')}
                      </Button>
                    ) : null}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <ShareNoteDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        teamId={team.id}
        myNoteList={myNoteList}
        sharedIds={new Set(notes.map((n) => n.noteId))}
        onShared={() => teamStore.teamNotes.call()}
      />

      <CreateNoteDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        teamId={team.id}
        onCreated={() => teamStore.teamNotes.call()}
      />
    </div>
  );
});

interface ShareProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: number;
  myNoteList: any[];
  sharedIds: Set<number>;
  onShared: () => void;
}

export const ShareNoteDialog = observer(({ open, onOpenChange, teamId, myNoteList, sharedIds, onShared }: ShareProps) => {
  const { t } = useTranslation();
  const teamStore = RootStore.Get(TeamStore);
  const [picked, setPicked] = useState<number | null>(null);
  const [canEdit, setCanEdit] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!picked) return;
    setBusy(true);
    await teamStore.shareNote(teamId, picked, canEdit);
    setBusy(false);
    setPicked(null);
    onShared();
    onOpenChange(false);
  };

  return (
    <div className={[
      'fixed inset-0 z-50 flex items-center justify-center bg-black/40',
      open ? '' : 'hidden',
    ].join(' ')}>
      <div className="bg-background rounded-2xl p-5 w-[480px] max-w-[90vw] shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Icon icon="hugeicons:share-01" width="20" height="20" className="text-primary" />
          <h3 className="font-semibold">{t('collab-notes-share')}</h3>
        </div>
        <div className="max-h-72 overflow-y-auto border border-default-200 rounded-xl divide-y divide-default-100">
          {myNoteList.length === 0 && <div className="p-4 text-center text-desc text-sm">暂无笔记</div>}
          {myNoteList.map((n) => {
            const selected = picked === n.id;
            const preview = n.content?.split('\n')[0].replace(/^#+\s*/, '') || '(无标题)';
            return (
              <button
                key={n.id}
                className={[
                  'w-full text-left px-3 py-2 hover:bg-hover',
                  selected ? 'bg-primary/10' : '',
                  sharedIds.has(n.id) ? 'opacity-50' : '',
                ].join(' ')}
                disabled={sharedIds.has(n.id)}
                onClick={() => setPicked(n.id)}
              >
                <div className="text-sm line-clamp-1">{preview}</div>
                <div className="text-xs text-desc mt-0.5">{sharedIds.has(n.id) ? '已分享' : dayjs(n.createdAt).format('YYYY-MM-DD')}</div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} />
            允许成员编辑
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="light" onPress={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button color="primary" isLoading={busy} isDisabled={!picked} onPress={submit}>{t('share')}</Button>
        </div>
      </div>
    </div>
  );
});

interface CreateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: number;
  onCreated: () => void;
}

export const CreateNoteDialog = observer(({ open, onOpenChange, teamId, onCreated }: CreateProps) => {
  const { t } = useTranslation();
  const teamStore = RootStore.Get(TeamStore);
  const blinkoStore = RootStore.Get(BlinkoStore);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const text = content.trim();
    if (!text) return;
    setBusy(true);
    try {
      const res = await teamStore.createNoteInTeam(teamId, text);
      setContent('');
      onCreated();
      onOpenChange(false);
      // 跳转到新创建的笔记详情页
      if (res?.noteId) {
        blinkoStore.noteContent = text;
        window.location.href = `/?path=notes&id=${res.noteId}`;
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={[
      'fixed inset-0 z-50 flex items-center justify-center bg-black/40',
      open ? '' : 'hidden',
    ].join(' ')}>
      <div className="bg-background rounded-2xl p-5 w-[560px] max-w-[90vw] shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Icon icon="hugeicons:add-01" width="20" height="20" className="text-primary" />
          <h3 className="font-semibold">{t('collab-notes-create', 'New note in team')}</h3>
        </div>
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('collab-notes-create-placeholder', '写下团队笔记的内容(支持 Markdown)...')}
          className="w-full h-64 px-3 py-2 rounded-xl border border-default-200 bg-default-50 outline-none focus:border-primary resize-y"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="light" onPress={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button color="primary" isLoading={busy} isDisabled={!content.trim()} onPress={submit}>
            {t('create')}
          </Button>
        </div>
      </div>
    </div>
  );
});
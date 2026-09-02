import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { trpc } from '../lib/trpc';
import { PageHeader } from '../components/AppShell';
import { NoteEditor } from '../components/NoteEditor';
import { Icon } from '../components/Icon';

export default function Notes() {
  const utils = trpc.useUtils();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | 'note' | 'quick'>('all');
  const [tagId, setTagId] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tagId');
    if (t) setTagId(Number(t));
  }, []);

  const tags = trpc.note.tags.useQuery();
  const notes = trpc.note.list.useQuery({
    ...(search ? { search } : {}),
    ...(type !== 'all' ? { type } : {}),
    ...(tagId ? { tagId } : {}),
    includeArchived: showArchived,
  });

  const updateNote = trpc.note.update.useMutation({
    onSuccess: () => utils.note.list.invalidate(),
  });
  const deleteNote = trpc.note.delete.useMutation({
    onSuccess: () => utils.note.list.invalidate(),
  });

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        title="我的笔记"
        subtitle={`共 ${notes.data?.length ?? '…'} 条${showArchived ? ' (含归档)' : ''}`}
        actions={
          <>
            <button
              type="button"
              className="btn-outline flex items-center gap-1.5"
              onClick={() => setShowArchived((v) => !v)}
            >
              <Icon icon={showArchived ? 'hugeicons:view-off-slash' : 'hugeicons:archive'} width={16} height={16} />
              {showArchived ? '隐藏归档' : '归档'}
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-1.5"
              onClick={() => setCreating(true)}
            >
              <Icon icon="hugeicons:add-01" width={16} height={16} />
              新建笔记
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* 搜索框 */}
        <div className="relative">
          <Icon
            icon="hugeicons:search-01"
            width={16}
            height={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索笔记内容…"
            className="input pl-9"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Icon icon="hugeicons:cancel-01" width={14} height={14} />
            </button>
          )}
        </div>

        {/* 筛选条 */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">类型:</span>
            {(
              [
                { k: 'all' as const, label: '全部', icon: 'hugeicons:menu-grid' },
                { k: 'note' as const, label: '笔记', icon: 'hugeicons:note-01' },
                { k: 'quick' as const, label: '闪念', icon: 'basil:lightning-outline' },
              ]
            ).map((t) => (
              <button
                key={t.k}
                type="button"
                onClick={() => setType(t.k)}
                className={clsx(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition',
                  type === t.k
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground',
                )}
              >
                <Icon icon={t.icon} width={12} height={12} />
                {t.label}
              </button>
            ))}
          </div>

          {tags.data && tags.data.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
                <Icon icon="mingcute:hashtag-line" width={12} height={12} />
                标签:
              </span>
              <button
                type="button"
                onClick={() => setTagId(null)}
                className={clsx(
                  'flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition',
                  tagId === null
                    ? 'bg-primary-50 text-primary'
                    : 'text-muted-foreground hover:bg-accent',
                )}
              >
                全部
              </button>
              {tags.data.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTagId(t.id === tagId ? null : t.id)}
                  className={clsx(
                    'flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium transition',
                    tagId === t.id
                      ? 'bg-primary-50 text-primary'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  <Icon icon="mingcute:hashtag-line" width={11} height={11} />
                  {t.name}
                  <span className="text-[10px] opacity-60">({t._count.notes})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 新建笔记 弹窗 */}
        {creating && (
          <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm animate-fade-in flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
              <NoteEditor
                autoFocus
                onSaved={() => setCreating(false)}
                onCancel={() => setCreating(false)}
              />
            </div>
          </div>
        )}

        {/* 列表 */}
        {notes.isLoading ? (
          <div className="text-center py-12 text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Icon icon="hugeicons:loading-03" width={16} height={16} className="animate-spin" />
            加载中…
          </div>
        ) : notes.data?.length ? (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {notes.data.map((n) => (
              <li key={n.id} className="card card-hover p-4 flex flex-col gap-2 group">
                <Link to={`/notes/${n.id}`} className="flex-1 min-w-0 block">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon
                      icon={n.type === 1 ? 'basil:lightning-solid' : 'hugeicons:note-01'}
                      width={16}
                      height={16}
                      className={n.type === 1 ? 'text-flash' : 'text-primary'}
                    />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                      {n.type === 1 ? 'QUICK' : 'NOTE'}
                    </span>
                    {n.archived && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground inline-flex items-center gap-1">
                        <Icon icon="hugeicons:archive" width={10} height={10} /> 归档
                      </span>
                    )}
                    {n.top && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 inline-flex items-center gap-1">
                        <Icon icon="hugeicons:pin" width={10} height={10} /> 置顶
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {new Date(n.updatedAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <div className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap">
                    {n.content.slice(0, 200)}
                  </div>
                  {n.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {n.tags.map((t) => (
                        <span key={t.id} className="chip">
                          <Icon icon="mingcute:hashtag-line" width={10} height={10} />
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
                <div className="flex items-center justify-end gap-0.5 pt-1 border-t border-border opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                    onClick={() => updateNote.mutate({ id: n.id, top: !n.top })}
                    title={n.top ? '取消置顶' : '置顶'}
                  >
                    <Icon icon={n.top ? 'hugeicons:pin-tack-02' : 'hugeicons:pin'} width={14} height={14} />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                    onClick={() => updateNote.mutate({ id: n.id, archived: !n.archived })}
                    title={n.archived ? '恢复' : '归档'}
                  >
                    <Icon icon={n.archived ? 'hugeicons:refresh' : 'hugeicons:archive'} width={14} height={14} />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm('确定删除该笔记?')) deleteNote.mutate({ id: n.id });
                    }}
                    title="删除"
                  >
                    <Icon icon="hugeicons:delete-02" width={14} height={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted text-muted-foreground mx-auto flex items-center justify-center mb-3">
              <Icon icon="hugeicons:search-01" width={28} height={28} />
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              {search || tagId || type !== 'all'
                ? '没有匹配的笔记'
                : '还没有笔记,点右上角"新建笔记"开始'}
            </p>
            {!search && !tagId && type === 'all' && (
              <button
                type="button"
                className="btn-primary mt-4 inline-flex items-center gap-1.5"
                onClick={() => setCreating(true)}
              >
                <Icon icon="hugeicons:add-01" width={16} height={16} />
                创建第一条
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
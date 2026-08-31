import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { trpc } from '../lib/trpc';
import { NoteEditor } from '../components/NoteEditor';

type TypeFilter = 'all' | 'note' | 'quick';

/**
 * 笔记列表页(首页 /)
 * - 顶部:快速新建(收起/展开)+ 搜索 + 类型筛选
 * - 左侧:标签筛选
 * - 主体:笔记卡片列表
 */
export default function Notes() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [tagId, setTagId] = useState<number | undefined>();
  const [showEditor, setShowEditor] = useState(false);

  // debounce 搜索 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const utils = trpc.useUtils();
  const me = trpc.user.me.useQuery();
  const tags = trpc.note.tags.useQuery();
  const notes = trpc.note.list.useQuery({
    type: typeFilter === 'all' ? undefined : typeFilter,
    tagId,
    search: debounced || undefined,
  });
  const del = trpc.note.delete.useMutation({
    onSuccess: () => utils.note.list.invalidate(),
  });
  const toggleTop = trpc.note.update.useMutation({
    onSuccess: () => utils.note.list.invalidate(),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header nickname={me.data?.nickname || me.data?.username} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
        {/* 左侧栏:标签 */}
        <aside className="space-y-4">
          <div className="card p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">类型</h3>
            <ul className="space-y-0.5">
              {[
                { v: 'all', label: '全部' },
                { v: 'note', label: '📝 笔记' },
                { v: 'quick', label: '⚡ 闪念' },
              ].map((opt) => (
                <li key={opt.v}>
                  <button
                    className={clsx(
                      'w-full text-left px-2 py-1.5 rounded text-sm transition',
                      typeFilter === opt.v
                        ? 'bg-indigo-100 text-indigo-700 font-medium'
                        : 'hover:bg-gray-100 text-gray-700',
                    )}
                    onClick={() => setTypeFilter(opt.v as TypeFilter)}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">标签</h3>
            {tags.data?.length ? (
              <ul className="space-y-0.5">
                <li>
                  <button
                    className={clsx(
                      'w-full text-left px-2 py-1.5 rounded text-sm transition',
                      !tagId
                        ? 'bg-indigo-100 text-indigo-700 font-medium'
                        : 'hover:bg-gray-100 text-gray-700',
                    )}
                    onClick={() => setTagId(undefined)}
                  >
                    全部
                  </button>
                </li>
                {tags.data.map((t) => (
                  <li key={t.id}>
                    <button
                      className={clsx(
                        'w-full text-left px-2 py-1.5 rounded text-sm transition flex items-center justify-between',
                        tagId === t.id
                          ? 'bg-indigo-100 text-indigo-700 font-medium'
                          : 'hover:bg-gray-100 text-gray-700',
                      )}
                      onClick={() => setTagId(t.id)}
                    >
                      <span>#{t.name}</span>
                      <span className="text-xs text-gray-400">{t._count.notes}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 px-1">暂无标签</p>
            )}
          </div>

          <div className="card p-3">
            <Link
              to="/quick"
              className="block w-full text-center px-3 py-2 text-sm bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition"
            >
              ⚡ 闪念速记
              <span className="block text-xs text-amber-600 mt-0.5">Ctrl + Shift + N</span>
            </Link>
          </div>
        </aside>

        {/* 主体 */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="input flex-1"
              type="search"
              placeholder="🔍 搜索笔记内容..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary whitespace-nowrap"
              onClick={() => setShowEditor((v) => !v)}
            >
              {showEditor ? '收起编辑器' : '✏️ 新建笔记'}
            </button>
          </div>

          {showEditor && (
            <NoteEditor
              autoFocus
              onSaved={() => {
                setShowEditor(false);
              }}
              onCancel={() => setShowEditor(false)}
            />
          )}

          {/* 列表 */}
          {notes.isLoading ? (
            <div className="text-center py-12 text-gray-400">加载中…</div>
          ) : notes.data?.length ? (
            <ul className="space-y-3">
              {notes.data.map((note) => (
                <li key={note.id} className="card p-4 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/notes/${note.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <span>{note.type === 1 ? '⚡ 闪念' : '📝 笔记'}</span>
                        {note.top && <span className="text-amber-500">📌 置顶</span>}
                        <span>·</span>
                        <span>{new Date(note.updatedAt).toLocaleString('zh-CN')}</span>
                        {note._count.comments > 0 && (
                          <>
                            <span>·</span>
                            <span>💬 {note._count.comments}</span>
                          </>
                        )}
                      </div>
                      <div className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-3 break-words">
                        {note.content}
                      </div>
                      {note.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {note.tags.map((t) => (
                            <span
                              key={t.id}
                              className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                            >
                              #{t.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        className="text-xs text-gray-400 hover:text-amber-500 px-2 py-1"
                        title={note.top ? '取消置顶' : '置顶'}
                        onClick={() => toggleTop.mutate({ id: note.id, top: !note.top })}
                      >
                        {note.top ? '📌' : '📍'}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
                        title="删除"
                        onClick={() => {
                          if (confirm(`确认删除这条${note.type === 1 ? '闪念' : '笔记'}?`)) {
                            del.mutate({ id: note.id });
                          }
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-16 text-gray-400">
              {debounced || tagId || typeFilter !== 'all'
                ? '没有匹配的笔记'
                : '还没有笔记,点上方"新建笔记"开始记录 ✨'}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Header({ nickname }: { nickname?: string }) {
  const utils = trpc.useUtils();
  const logout = trpc.user.logout.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  });
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link to="/" className="text-lg font-semibold">
          📝 AI智能笔记
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:inline">{nickname}</span>
          <button
            className="btn-ghost"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            登出
          </button>
        </div>
      </div>
    </header>
  );
}
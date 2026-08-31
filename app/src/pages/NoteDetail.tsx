import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { MarkdownView } from '../components/MarkdownView';
import { TagSelector } from '../components/TagSelector';
import { CommentList } from '../components/CommentList';

/**
 * 笔记详情页 /notes/:id
 * - 默认:查看模式(markdown 渲染 + 标签展示)
 * - 点编辑:切换到编辑模式(同 NoteEditor 表单)
 * - 点删除:确认后返回首页
 */
export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const noteId = Number(id);
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const me = trpc.user.me.useQuery();
  const note = trpc.note.get.useQuery(
    { id: noteId },
    { enabled: Number.isFinite(noteId) && noteId > 0 },
  );
  const del = trpc.note.delete.useMutation({
    onSuccess: () => {
      utils.note.list.invalidate();
      navigate('/', { replace: true });
    },
  });
  const update = trpc.note.update.useMutation({
    onSuccess: () => {
      utils.note.get.invalidate({ id: noteId });
      utils.note.list.invalidate();
      setEditing(false);
    },
  });

  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState('');
  const [tagNames, setTagNames] = useState<string[]>([]);

  // 进入编辑模式时,把当前内容灌入表单
  useEffect(() => {
    if (editing && note.data) {
      setContent(note.data.content);
      setTagNames(note.data.tags.map((t) => t.name));
    }
  }, [editing, note.data]);

  if (!Number.isFinite(noteId) || noteId <= 0) {
    return <ErrorPage msg="无效的笔记 id" />;
  }

  if (note.isLoading) {
    return <CenterMsg>加载中…</CenterMsg>;
  }

  if (note.error) {
    return <ErrorPage msg={note.error.message} />;
  }

  if (!note.data) {
    return <ErrorPage msg="笔记不存在或已被删除" />;
  }

  const n = note.data;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link to="/" className="text-sm text-indigo-600 hover:underline">
            ← 返回列表
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 hidden sm:inline">
              {me.data?.nickname || me.data?.username}
            </span>
            {!editing ? (
              <>
                <button
                  className="btn-ghost"
                  onClick={() => setEditing(true)}
                  disabled={update.isPending}
                >
                  ✏️ 编辑
                </button>
                <button
                  className="btn-ghost text-red-600 hover:bg-red-50"
                  onClick={() => {
                    if (confirm('确认删除这条笔记?')) del.mutate({ id: n.id });
                  }}
                  disabled={del.isPending}
                >
                  🗑️ 删除
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-ghost"
                  onClick={() => setEditing(false)}
                  disabled={update.isPending}
                >
                  取消
                </button>
                <button
                  className="btn-primary"
                  onClick={() =>
                    update.mutate({
                      id: n.id,
                      content: content.trim() || n.content,
                      tagNames,
                    })
                  }
                  disabled={update.isPending || !content.trim()}
                >
                  {update.isPending ? '保存中…' : '保存'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
          <span>{n.type === 1 ? '⚡ 闪念' : '📝 笔记'}</span>
          {n.top && <span className="text-amber-500">📌 置顶</span>}
          <span>·</span>
          <span>更新于 {new Date(n.updatedAt).toLocaleString('zh-CN')}</span>
          <span>·</span>
          <span>创建于 {new Date(n.createdAt).toLocaleString('zh-CN')}</span>
        </div>

        {editing ? (
          <div className="card p-4 space-y-3">
            <textarea
              autoFocus
              className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
              rows={n.type === 1 ? 4 : 12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={20_000}
            />
            <div>
              <label className="block text-xs text-gray-500 mb-1">标签</label>
              <TagSelector value={tagNames} onChange={setTagNames} />
            </div>
            {update.error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {update.error.message}
              </div>
            )}
          </div>
        ) : (
          <>
            <article className="card p-6">
              <MarkdownView content={n.content} />
            </article>
            {n.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {n.tags.map((t) => (
                  <Link
                    key={t.id}
                    to={`/?tagId=${t.id}`}
                    className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full hover:bg-indigo-100 transition"
                  >
                    #{t.name}
                  </Link>
                ))}
              </div>
            )}

            {/* 评论区 */}
            <div className="mt-6">
              <CommentList noteId={n.id} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function CenterMsg({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center text-gray-400">{children}</div>;
}

function ErrorPage({ msg }: { msg: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <div className="text-5xl mb-3">😢</div>
      <p className="text-gray-600 mb-4">{msg}</p>
      <Link to="/" className="btn-primary">
        返回首页
      </Link>
    </div>
  );
}
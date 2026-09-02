import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { PageHeader } from '../components/AppShell';
import { MarkdownView } from '../components/MarkdownView';
import { NoteEditor } from '../components/NoteEditor';
import { CommentList } from '../components/CommentList';
import { TagSelector } from '../components/TagSelector';
import { Icon } from '../components/Icon';

export default function NoteDetail() {
  const { id } = useParams<{ id: string }>();
  const noteId = Number(id);
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const note = trpc.note.get.useQuery({ id: noteId });
  const [editing, setEditing] = useState(false);
  const [tagDraft, setTagDraft] = useState<string[] | null>(null);

  const updateNote = trpc.note.update.useMutation({
    onSuccess: () => {
      utils.note.get.invalidate({ id: noteId });
      utils.note.list.invalidate();
      setEditing(false);
      setTagDraft(null);
    },
  });
  const deleteNote = trpc.note.delete.useMutation({
    onSuccess: () => {
      utils.note.list.invalidate();
      navigate('/', { replace: true });
    },
  });

  if (note.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground gap-2">
        <Icon icon="hugeicons:loading-03" width={16} height={16} className="animate-spin" />
        加载中…
      </div>
    );
  }

  if (!note.data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-muted text-muted-foreground mx-auto flex items-center justify-center mb-3">
          <Icon icon="hugeicons:note-remove" width={28} height={28} />
        </div>
        <p className="text-sm text-muted-foreground mb-4">笔记不存在或已删除</p>
        <Link to="/" className="btn-primary inline-flex items-center gap-1.5">
          <Icon icon="hugeicons:arrow-left-01" width={16} height={16} />
          返回列表
        </Link>
      </div>
    );
  }

  const n = note.data;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        breadcrumb={
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Icon icon="hugeicons:arrow-left-01" width={14} height={14} />
            我的笔记
          </Link>
        }
        title={
          editing ? (
            '编辑笔记'
          ) : (
            <span className="inline-flex items-center gap-2">
              <Icon
                icon={n.type === 1 ? 'basil:lightning-solid' : 'hugeicons:note-01'}
                width={18}
                height={18}
                className={n.type === 1 ? 'text-flash' : 'text-primary'}
              />
              {n.type === 1 ? '闪念' : '笔记'}
              {n.archived && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal inline-flex items-center gap-1">
                  <Icon icon="hugeicons:archive" width={10} height={10} /> 归档
                </span>
              )}
              {n.top && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-normal inline-flex items-center gap-1">
                  <Icon icon="hugeicons:pin" width={10} height={10} /> 置顶
                </span>
              )}
            </span>
          )
        }
        subtitle={new Date(n.createdAt).toLocaleString('zh-CN')}
        actions={
          editing ? (
            <button type="button" className="btn-ghost" onClick={() => { setEditing(false); setTagDraft(null); }}>
              取消
            </button>
          ) : (
            <>
              <button type="button" className="btn-outline flex items-center gap-1.5" onClick={() => setEditing(true)}>
                <Icon icon="hugeicons:pencil-edit-01" width={14} height={14} />
                编辑
              </button>
              <button
                type="button"
                className="btn-outline flex items-center gap-1.5"
                onClick={() => updateNote.mutate({ id: n.id, top: !n.top })}
              >
                <Icon icon={n.top ? 'hugeicons:pin-tack-02' : 'hugeicons:pin'} width={14} height={14} />
                {n.top ? '取消置顶' : '置顶'}
              </button>
              <button
                type="button"
                className="btn-outline text-destructive hover:bg-destructive/10 flex items-center gap-1.5"
                onClick={() => {
                  if (confirm('确定删除该笔记?')) deleteNote.mutate({ id: n.id });
                }}
              >
                <Icon icon="hugeicons:delete-02" width={14} height={14} />
                删除
              </button>
            </>
          )
        }
      />

      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-4xl w-full mx-auto space-y-6">
        {editing ? (
          <>
            <NoteEditor
              defaultContent={n.content}
              defaultTagNames={tagDraft ?? n.tags.map((t) => t.name)}
              defaultType={n.type === 1 ? 'quick' : 'note'}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => { setEditing(false); setTagDraft(null); }}>
                取消
              </button>
              <button
                type="button"
                className="btn-primary flex items-center gap-1.5"
                onClick={() => {
                  const ta = document.querySelector('textarea') as HTMLTextAreaElement | null;
                  updateNote.mutate({
                    id: n.id,
                    content: ta?.value ?? n.content,
                    tagNames: tagDraft ?? n.tags.map((t) => t.name),
                  });
                }}
                disabled={updateNote.isPending}
              >
                {updateNote.isPending ? (
                  <>
                    <Icon icon="hugeicons:loading-03" width={14} height={14} className="animate-spin" />
                    保存中…
                  </>
                ) : (
                  <>
                    <Icon icon="hugeicons:tick-02" width={14} height={14} />
                    保存
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <article className="card p-6">
              <MarkdownView content={n.content} />
            </article>

            {/* 标签 */}
            {tagDraft !== null ? (
              <div className="card p-4 space-y-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Icon icon="mingcute:hashtag-line" width={14} height={14} />
                  编辑标签
                </div>
                <TagSelector value={tagDraft} onChange={setTagDraft} />
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn-ghost" onClick={() => setTagDraft(null)}>
                    取消
                  </button>
                  <button
                    type="button"
                    className="btn-primary flex items-center gap-1.5"
                    onClick={() => updateNote.mutate({ id: n.id, tagNames: tagDraft })}
                  >
                    <Icon icon="hugeicons:tick-02" width={14} height={14} />
                    保存标签
                  </button>
                </div>
              </div>
            ) : n.tags.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Icon icon="mingcute:hashtag-line" width={14} height={14} /> 标签:
                </span>
                {n.tags.map((t) => (
                  <Link key={t.id} to={`/?tagId=${t.id}`} className="chip">
                    <Icon icon="mingcute:hashtag-line" width={10} height={10} />
                    {t.name}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={() => setTagDraft(n.tags.map((t) => t.name))}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <Icon icon="hugeicons:pencil-edit-01" width={12} height={12} />
                  编辑
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTagDraft([])}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <Icon icon="hugeicons:add-01" width={12} height={12} />
                添加标签
              </button>
            )}

            {/* 评论区 */}
            <section>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Icon icon="hugeicons:message-01" width={16} height={16} />
                评论
                {n._count.comments > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">
                    {n._count.comments}
                  </span>
                )}
              </h3>
              <CommentList noteId={n.id} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
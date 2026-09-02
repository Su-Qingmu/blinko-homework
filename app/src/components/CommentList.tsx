import { useState } from 'react';
import clsx from 'clsx';
import { trpc } from '../lib/trpc';
import { Icon } from './Icon';

/**
 * 评论区 - 还原 Blinko 评论样式
 *
 * 视觉:
 * - 用户评论:bg-background + border(中性)
 * - AI 评论:bg-primary-50 + border-primary/30(品牌色调)
 * - hover 出现删除按钮
 */
export function CommentList({ noteId }: { noteId: number }) {
  const utils = trpc.useUtils();
  const list = trpc.comment.list.useQuery({ noteId });

  const add = trpc.comment.add.useMutation({
    onSuccess: () => {
      setContent('');
      utils.comment.list.invalidate({ noteId });
    },
  });

  const remove = trpc.comment.delete.useMutation({
    onSuccess: () => utils.comment.list.invalidate({ noteId }),
  });

  const aiComment = trpc.ai.commentNote.useMutation({
    onSuccess: () => utils.comment.list.invalidate({ noteId }),
  });

  const [content, setContent] = useState('');

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    add.mutate({ noteId, content: trimmed });
  };

  return (
    <section className="space-y-4">
      {/* 评论列表 */}
      {list.isLoading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Icon icon="hugeicons:loading-03" width={14} height={14} className="animate-spin" />
          加载评论…
        </div>
      ) : list.data?.length ? (
        <ul className="space-y-3">
          {list.data.map((c) => (
            <li
              key={c.id}
              className={clsx(
                'group rounded-lg p-3 text-sm border',
                c.isAI
                  ? 'bg-primary-50 border-primary/30'
                  : 'bg-card border-border',
              )}
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <div className="flex items-center gap-2">
                  {c.isAI ? (
                    <span className="font-semibold text-primary inline-flex items-center gap-1">
                      <Icon icon="hugeicons:ai-chemistry-02" width={12} height={12} />
                      AI 助手
                    </span>
                  ) : (
                    <span className="font-semibold text-foreground inline-flex items-center gap-1">
                      <Icon icon="hugeicons:user" width={12} height={12} />
                      {c.author?.nickname || c.author?.username || '用户'}
                    </span>
                  )}
                  <span>·</span>
                  <span>{new Date(c.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-destructive/10"
                  title="删除评论"
                  onClick={() => {
                    if (confirm('确认删除这条评论?')) remove.mutate({ id: c.id });
                  }}
                >
                  <Icon icon="hugeicons:delete-02" width={14} height={14} />
                </button>
              </div>
              <div className={clsx('whitespace-pre-wrap', c.isAI ? 'text-primary-foreground/80' : 'text-foreground')}>
                {c.content}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-md">
          还没有评论 - 添加一条或让 AI 帮你点评
        </p>
      )}

      {/* AI 触发 */}
      <div className="flex justify-end">
        <button
          type="button"
          className="text-xs font-medium text-primary hover:bg-primary-50 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition disabled:opacity-50"
          onClick={() => aiComment.mutate({ noteId })}
          disabled={aiComment.isPending}
          title="让 AI 为这篇笔记生成一条点评"
        >
          {aiComment.isPending ? (
            <>
              <Icon icon="hugeicons:loading-03" width={14} height={14} className="animate-spin" />
              AI 思考中…
            </>
          ) : (
            <>
              <Icon icon="hugeicons:ai-chemistry-02" width={14} height={14} />
              AI 帮我评论
            </>
          )}
        </button>
      </div>

      {aiComment.error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2 flex items-start gap-2">
          <Icon icon="hugeicons:alert-circle" width={14} height={14} className="shrink-0 mt-0.5" />
          <span className="flex-1">{aiComment.error.message}</span>
        </div>
      )}

      {/* 用户输入 */}
      <div className="card p-3 space-y-2">
        <textarea
          className="input resize-none text-sm"
          rows={3}
          placeholder="说点什么..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
        />
        {add.error && (
          <div className="text-sm text-destructive flex items-start gap-2">
            <Icon icon="hugeicons:alert-circle" width={14} height={14} className="shrink-0 mt-0.5" />
            <span className="flex-1">{add.error.message}</span>
          </div>
        )}
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground font-mono">{content.length} / 2000</span>
          <button
            type="button"
            className="btn-primary py-1 px-3 text-xs flex items-center gap-1.5"
            onClick={submit}
            disabled={add.isPending || !content.trim()}
          >
            {add.isPending ? (
              <>
                <Icon icon="hugeicons:loading-03" width={12} height={12} className="animate-spin" />
                发送中…
              </>
            ) : (
              <>
                <Icon icon="hugeicons:send-01" width={12} height={12} />
                发送
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
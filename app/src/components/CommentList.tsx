import { useState } from 'react';
import { trpc } from '../lib/trpc';

/**
 * 评论区组件
 * - 上方:用户评论 + AI 评论列表
 * - 下方:用户输入框 + AI 触发按钮
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
      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        💬 评论
        {list.data && (
          <span className="text-xs text-gray-400 font-normal">
            ({list.data.length})
          </span>
        )}
      </h3>

      {/* 评论列表 */}
      {list.isLoading ? (
        <div className="text-xs text-gray-400">加载评论…</div>
      ) : list.data?.length ? (
        <ul className="space-y-3">
          {list.data.map((c) => (
            <li
              key={c.id}
              className={`rounded-lg p-3 text-sm ${
                c.isAI
                  ? 'bg-indigo-50 border border-indigo-100'
                  : 'bg-gray-50 border border-gray-100'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <div className="flex items-center gap-2">
                  {c.isAI ? (
                    <span className="font-medium text-indigo-700">🤖 AI</span>
                  ) : (
                    <span className="font-medium text-gray-700">
                      👤 {c.author?.nickname || c.author?.username || '用户'}
                    </span>
                  )}
                  <span>·</span>
                  <span>{new Date(c.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <button
                  type="button"
                  className="text-gray-400 hover:text-red-500"
                  title="删除评论"
                  onClick={() => {
                    if (confirm('确认删除这条评论?')) remove.mutate({ id: c.id });
                  }}
                >
                  🗑️
                </button>
              </div>
              <div className={`whitespace-pre-wrap ${c.isAI ? 'text-indigo-900' : 'text-gray-800'}`}>
                {c.content}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-400">还没有评论 - 添加一条或让 AI 帮你点评</p>
      )}

      {/* AI 触发 */}
      <div className="flex justify-end">
        <button
          type="button"
          className="btn-ghost text-indigo-600 hover:bg-indigo-50"
          onClick={() => aiComment.mutate({ noteId })}
          disabled={aiComment.isPending}
          title="让 AI 为这篇笔记生成一条点评"
        >
          {aiComment.isPending ? '🤖 AI 思考中…' : '🤖 AI 帮我评论'}
        </button>
      </div>

      {aiComment.error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {aiComment.error.message}
        </div>
      )}

      {/* 用户输入 */}
      <div className="card p-3 space-y-2">
        <textarea
          className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          rows={4}
          placeholder="说点什么..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
        />
        {add.error && (
          <div className="text-sm text-red-600">{add.error.message}</div>
        )}
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span>{content.length} / 2000</span>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={add.isPending || !content.trim()}
          >
            {add.isPending ? '发送中…' : '发送'}
          </button>
        </div>
      </div>
    </section>
  );
}
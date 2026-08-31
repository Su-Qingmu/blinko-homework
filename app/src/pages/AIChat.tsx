import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { trpc } from '../lib/trpc';

/**
 * AI 助手页 /ai
 * - 左侧:对话列表 + 新建按钮
 * - 右侧:当前对话消息流 + 输入框
 *
 * 注意:简化版不做流式,等待完整 AI 回复后一次性渲染。
 * 模型:OPENAI_MODEL 环境变量配置(默认 gpt-4o-mini)
 */
export default function AIChat() {
  const utils = trpc.useUtils();
  const me = trpc.user.me.useQuery();
  const conversations = trpc.ai.conversations.useQuery();
  const createConv = trpc.ai.createConversation.useMutation({
    onSuccess: (c) => {
      utils.ai.conversations.invalidate();
      setActiveId(c.id);
    },
  });
  const deleteConv = trpc.ai.deleteConversation.useMutation({
    onSuccess: () => {
      utils.ai.conversations.invalidate();
      setActiveId(null);
    },
  });

  const [activeId, setActiveId] = useState<number | null>(null);
  const messages = trpc.ai.messages.useQuery(
    { conversationId: activeId! },
    { enabled: activeId !== null },
  );
  const chat = trpc.ai.chat.useMutation({
    onSuccess: () => utils.ai.messages.invalidate({ conversationId: activeId! }),
  });

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 首次加载自动选第一个对话
  useEffect(() => {
    if (activeId === null && conversations.data?.length) {
      setActiveId(conversations.data[0].id);
    }
  }, [conversations.data, activeId]);

  // 新消息自动滚到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.data, chat.isPending]);

  const send = () => {
    const trimmed = draft.trim();
    if (!trimmed || activeId === null || chat.isPending) return;
    chat.mutate(
      { conversationId: activeId, content: trimmed },
      {
        onSuccess: () => setDraft(''),
      },
    );
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-indigo-600 hover:underline">
              ← 返回笔记
            </Link>
            <h1 className="text-lg font-semibold">🤖 AI 助手</h1>
          </div>
          <span className="text-sm text-gray-500 hidden sm:inline">
            {me.data?.nickname || me.data?.username}
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 min-h-0">
        {/* 左侧对话列表 */}
        <aside className="card p-3 space-y-2 flex flex-col">
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => createConv.mutate(undefined)}
            disabled={createConv.isPending}
          >
            ✨ 新建对话
          </button>
          {conversations.isLoading ? (
            <div className="text-xs text-gray-400">加载中…</div>
          ) : conversations.data?.length ? (
            <ul className="space-y-1 overflow-y-auto flex-1">
              {conversations.data.map((c) => (
                <li key={c.id} className="group">
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={clsx(
                      'w-full text-left px-3 py-2 rounded text-sm transition flex items-center justify-between gap-2',
                      activeId === c.id
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'hover:bg-gray-100 text-gray-700',
                    )}
                  >
                    <span className="truncate flex-1">{c.title}</span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {c._count.messages}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="hidden group-hover:block text-xs text-gray-400 hover:text-red-500 px-3"
                    onClick={() => {
                      if (confirm(`删除对话"${c.title}"?`)) deleteConv.mutate({ id: c.id });
                    }}
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-400 px-1">还没有对话,点上方"新建对话"</p>
          )}
        </aside>

        {/* 右侧对话区 */}
        <section className="card flex flex-col min-h-[60vh]">
          {activeId === null ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="text-5xl mb-3">🤖</div>
              <p className="text-gray-600 mb-1">还没有选中的对话</p>
              <p className="text-xs text-gray-400">从左侧选一个对话,或新建一个开始聊天</p>
            </div>
          ) : (
            <>
              {/* 消息流 */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.isLoading ? (
                  <div className="text-xs text-gray-400">加载消息…</div>
                ) : messages.data?.length ? (
                  messages.data.map((m) => (
                    <MessageBubble key={m.id} role={m.role} content={m.content} />
                  ))
                ) : (
                  <p className="text-xs text-gray-400 text-center py-8">
                    对话是空的,在下方输入第一条消息
                  </p>
                )}
                {chat.isPending && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gray-100 text-gray-500 text-sm">
                      <span className="inline-flex gap-1">
                        <span className="animate-bounce">·</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.15s' }}>
                          ·
                        </span>
                        <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>
                          ·
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 输入框 */}
              <div className="border-t border-gray-200 p-3 space-y-2">
                <textarea
                  className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  rows={2}
                  placeholder="问点什么... (Ctrl/Cmd+Enter 发送)"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKey}
                  maxLength={4000}
                />
                {chat.error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                    {chat.error.message}
                  </div>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">{draft.length} / 4000</span>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={send}
                    disabled={chat.isPending || !draft.trim()}
                  >
                    {chat.isPending ? 'AI 思考中…' : '发送'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words',
          isUser
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-800',
        )}
      >
        {!isUser && <div className="text-xs text-gray-500 mb-0.5">🤖 AI</div>}
        {content}
      </div>
    </div>
  );
}
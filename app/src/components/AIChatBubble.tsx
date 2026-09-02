import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { trpc } from '../lib/trpc';
import { Icon } from './Icon';

/**
 * AI 悬浮气泡 + 右侧抽屉 - 还原 Blinko 原版交互
 *
 * 视觉:
 * - 右下角 56×56 圆形按钮,品牌色 bg-primary + 发光阴影
 * - hover:抬升 + 阴影加深
 * - 打开时变成关闭图标
 *
 * 抽屉(Blinko 风格):
 * - 顶部 Tab 切换:对话 / 历史
 * - 历史 tab:消息数 + 时间 + hover 删除
 * - 对话 tab:流式消息 + 用户右 indigo / AI 左 bg-background(浅灰)
 * - 输入区:多行 textarea + 字符计数 + 发送按钮
 */
export function AIChatBubble() {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [tab, setTab] = useState<'chat' | 'history'>('chat');

  // 监听全局快捷键 Ctrl/Cmd+Shift+I
  useEffect(() => {
    const handler = () => setOpen((v) => !v);
    window.addEventListener('toggle-ai-chat', handler);
    return () => window.removeEventListener('toggle-ai-chat', handler);
  }, []);

  return (
    <>
      {/* ===== 悬浮按钮 ===== */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'fixed bottom-6 right-6 z-40',
          'w-14 h-14 rounded-full',
          'bg-primary text-primary-foreground',
          'shadow-lg hover:shadow-2xl hover:shadow-primary/30',
          'flex items-center justify-center',
          'hover:-translate-y-0.5 active:translate-y-0',
          'transition-all duration-200',
        )}
        aria-label={open ? '关闭 AI 助手' : '打开 AI 助手'}
        title={open ? '关闭' : 'AI 助手 (Ctrl+Shift+I)'}
      >
        {open ? (
          <Icon icon="hugeicons:cancel-01" width={22} height={22} />
        ) : (
          <Icon icon="hugeicons:ai-chemistry-02" width={26} height={26} />
        )}
      </button>

      {open && (
        <>
          {/* 遮罩 */}
          <div
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* 抽屉 */}
          <div
            className={clsx(
              'fixed top-0 right-0 bottom-0 z-50',
              'w-full sm:w-[440px] sm:max-w-[92vw]',
              'bg-background text-foreground',
              'border-l border-border shadow-2xl',
              'flex flex-col',
              'animate-slide-in-right',
            )}
          >
            <AIDrawer
              activeId={activeId}
              setActiveId={setActiveId}
              tab={tab}
              setTab={setTab}
              onClose={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}

function AIDrawer({
  activeId,
  setActiveId,
  tab,
  setTab,
  onClose,
}: {
  activeId: number | null;
  setActiveId: (id: number | null) => void;
  tab: 'chat' | 'history';
  setTab: (t: 'chat' | 'history') => void;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const conversations = trpc.ai.conversations.useQuery();
  const createConv = trpc.ai.createConversation.useMutation({
    onSuccess: (c) => {
      utils.ai.conversations.invalidate();
      setActiveId(c.id);
      setTab('chat');
    },
  });
  const deleteConv = trpc.ai.deleteConversation.useMutation({
    onSuccess: () => {
      utils.ai.conversations.invalidate();
      setActiveId(null);
    },
  });

  useEffect(() => {
    if (activeId === null && conversations.data?.length) {
      setActiveId(conversations.data[0].id);
    }
  }, [conversations.data, activeId, setActiveId]);

  return (
    <>
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Icon icon="hugeicons:ai-chemistry-02" width={20} height={20} className="text-primary" />
          <span className="font-semibold">AI 助手</span>
          {activeId && (
            <span className="text-xs text-muted-foreground truncate ml-2">
              · 会话 #{activeId}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent"
          aria-label="关闭"
        >
          <Icon icon="hugeicons:cancel-01" width={20} height={20} />
        </button>
      </div>

      {/* ===== Tabs ===== */}
      <div className="flex border-b border-border px-3 items-center">
        {(
          [
            { key: 'chat' as const, label: '对话', icon: 'hugeicons:chatting-01' },
            { key: 'history' as const, label: `历史 (${conversations.data?.length ?? 0})`, icon: 'hugeicons:time-02' },
          ]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition',
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon icon={t.icon} width={14} height={14} />
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => createConv.mutate(undefined)}
          disabled={createConv.isPending}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary-50 rounded-md transition disabled:opacity-50"
        >
          <Icon icon="hugeicons:add-01" width={14} height={14} />
          新建
        </button>
      </div>

      {/* ===== Body ===== */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'history' ? (
          <HistoryList
            conversations={conversations.data ?? []}
            activeId={activeId}
            onPick={(id) => {
              setActiveId(id);
              setTab('chat');
            }}
            onDelete={(id) => {
              if (confirm('删除该对话?')) deleteConv.mutate({ id });
            }}
            loading={conversations.isLoading}
          />
        ) : activeId === null ? (
          <EmptyState onCreate={() => createConv.mutate(undefined)} />
        ) : (
          <ChatView conversationId={activeId} />
        )}
      </div>
    </>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary flex items-center justify-center mb-4">
        <Icon icon="hugeicons:ai-chemistry-02" width={36} height={36} />
      </div>
      <p className="text-sm text-muted-foreground mb-1">还没有对话</p>
      <p className="text-xs text-muted-foreground/60 mb-5">AI 可以帮你整理笔记、回答问题、生成评论</p>
      <button type="button" onClick={onCreate} className="btn-primary inline-flex items-center gap-2">
        <Icon icon="hugeicons:add-01" width={16} height={16} />
        新建对话
      </button>
    </div>
  );
}

function HistoryList({
  conversations,
  activeId,
  onPick,
  onDelete,
  loading,
}: {
  conversations: Array<{ id: number; title: string; updatedAt: string | Date; _count: { messages: number } }>;
  activeId: number | null;
  onPick: (id: number) => void;
  onDelete: (id: number) => void;
  loading: boolean;
}) {
  if (loading)
    return (
      <div className="p-6 text-center text-xs text-muted-foreground">
        <Icon icon="hugeicons:loading-03" width={16} height={16} className="inline animate-spin mr-1" />
        加载中…
      </div>
    );
  if (conversations.length === 0)
    return (
      <div className="p-6 text-center text-xs text-muted-foreground">还没有对话</div>
    );

  return (
    <ul className="p-2 space-y-1">
      {conversations.map((c) => (
        <li
          key={c.id}
          className={clsx(
            'group rounded-md border transition',
            activeId === c.id
              ? 'bg-primary-50 border-primary/30'
              : 'border-transparent hover:border-border hover:bg-accent',
          )}
        >
          <button
            type="button"
            onClick={() => onPick(c.id)}
            className="w-full px-3 py-2.5 text-left"
          >
            <div className="flex items-center gap-2">
              <Icon
                icon="hugeicons:message-01"
                width={16}
                height={16}
                className={activeId === c.id ? 'text-primary' : 'text-muted-foreground'}
              />
              <span className="text-sm font-medium truncate flex-1">{c.title}</span>
              <span className="text-[10px] text-muted-foreground">
                {c._count.messages} 条
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 ml-6">
              {new Date(c.updatedAt).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </button>
          <button
            type="button"
            onClick={() => onDelete(c.id)}
            className="hidden group-hover:flex w-full px-3 pb-1.5 text-right text-xs text-muted-foreground hover:text-destructive items-center justify-end gap-1"
          >
            <Icon icon="hugeicons:delete-02" width={12} height={12} />
            删除
          </button>
        </li>
      ))}
    </ul>
  );
}

function ChatView({ conversationId }: { conversationId: number }) {
  const utils = trpc.useUtils();
  const messages = trpc.ai.messages.useQuery({ conversationId });
  const chat = trpc.ai.chat.useMutation({
    onSuccess: () => {
      utils.ai.messages.invalidate({ conversationId });
      utils.ai.conversations.invalidate();
    },
  });
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.data, chat.isPending]);

  const send = () => {
    const trimmed = draft.trim();
    if (!trimmed || chat.isPending) return;
    chat.mutate(
      { conversationId, content: trimmed },
      { onSuccess: () => setDraft('') },
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* 消息流 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.isLoading ? (
          <div className="text-xs text-muted-foreground text-center py-8">
            <Icon icon="hugeicons:loading-03" width={16} height={16} className="inline animate-spin mr-1" />
            加载消息…
          </div>
        ) : messages.data?.length ? (
          messages.data.map((m) => <MessageBubble key={m.id} role={m.role} content={m.content} />)
        ) : (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-xs text-muted-foreground">在下方输入第一条消息</p>
          </div>
        )}
        {chat.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-accent text-muted-foreground text-sm">
              <Icon icon="hugeicons:loading-03" width={14} height={14} className="inline animate-spin mr-2" />
              AI 思考中…
            </div>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="border-t border-border p-3 space-y-2 bg-background">
        <textarea
          className="input resize-none text-sm"
          rows={3}
          placeholder="输入消息… (Ctrl/Cmd+Enter 发送)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
          maxLength={4000}
        />
        {chat.error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5 flex items-start gap-1.5">
            <Icon icon="hugeicons:alert-circle" width={14} height={14} className="shrink-0 mt-0.5" />
            <span className="flex-1">{chat.error.message}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground font-mono">
            {draft.length} / 4000
          </span>
          <button
            type="button"
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
            onClick={send}
            disabled={chat.isPending || !draft.trim()}
          >
            {chat.isPending ? (
              <>
                <Icon icon="hugeicons:loading-03" width={14} height={14} className="animate-spin" />
                思考中…
              </>
            ) : (
              <>
                <Icon icon="hugeicons:send-01" width={14} height={14} />
                发送
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ role, content }: { role: string; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={clsx('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words shadow-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-accent text-foreground rounded-bl-sm border border-border',
        )}
      >
        {!isUser && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5">
            <Icon icon="hugeicons:ai-chemistry-02" width={12} height={12} className="text-primary" />
            AI 助手
          </div>
        )}
        {content}
      </div>
    </div>
  );
}
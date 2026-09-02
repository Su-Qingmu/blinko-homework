import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { PageHeader } from '../components/AppShell';
import { Icon } from '../components/Icon';

/**
 * 闪念快速输入
 * - 全屏 amber 背景(flash token)
 * - 自动聚焦
 * - Ctrl/Cmd + Enter 提交
 * - Esc 退出
 */
export default function QuickNote() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [content, setContent] = useState('');
  const [lastSavedId, setLastSavedId] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const create = trpc.note.create.useMutation({
    onSuccess: (note) => {
      utils.note.list.invalidate();
      setLastSavedId(note.id);
    },
  });

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    create.mutate({ type: 'quick', content: trimmed });
    setContent('');
    taRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      navigate('/');
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-flash-foreground/30">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Icon icon="basil:lightning-solid" width={20} height={20} className="text-flash" />
            <span className="text-flash">闪念速记</span>
          </span>
        }
        subtitle="Ctrl/Cmd + Enter 提交 · Esc 退出"
        breadcrumb={
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Icon icon="hugeicons:arrow-left-01" width={14} height={14} />
            我的笔记
          </Link>
        }
        actions={
          <>
            <button type="button" className="btn-ghost" onClick={() => navigate('/')}>
              返回
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-1.5"
              onClick={submit}
              disabled={create.isPending || !content.trim()}
            >
              <Icon icon="hugeicons:tick-02" width={16} height={16} />
              {create.isPending ? '保存中…' : '保存闪念'}
            </button>
          </>
        }
      />

      <div className="flex-1 flex flex-col px-6 py-6 max-w-3xl w-full mx-auto">
        <textarea
          ref={taRef}
          className="flex-1 block w-full bg-transparent border-0 outline-none resize-none text-lg text-foreground placeholder:text-muted-foreground focus:ring-0"
          placeholder="一闪而过的灵感..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKey}
          maxLength={20_000}
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground py-2 border-t border-border">
          <span className="flex items-center gap-1.5">
            {lastSavedId ? (
              <>
                <Icon icon="hugeicons:tick-double-01" width={14} height={14} className="text-green-600" />
                已保存 (id={lastSavedId}),继续写下一条
              </>
            ) : (
              <>
                <Icon icon="hugeicons:pencil-edit-01" width={14} height={14} />
                {content.length} / 20000
              </>
            )}
          </span>
        </div>

        {create.error && (
          <div className="mt-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2 flex items-start gap-2">
            <Icon icon="hugeicons:alert-circle" width={16} height={16} className="shrink-0 mt-0.5" />
            <span className="flex-1">{create.error.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
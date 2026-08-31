import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';

/**
 * 闪念快速输入 /quick
 *
 * 设计目标:1 秒内捕住灵感
 * - 全屏 textarea
 * - 自动聚焦
 * - Esc 取消,Ctrl/Cmd+Enter 提交
 * - 提交后自动清空,继续输入下一条
 * - 点"完成"返回首页
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
    }
  };

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      <header className="border-b border-amber-200 bg-white/60 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-amber-700 hover:underline"
          >
            ← 返回
          </button>
          <div className="text-sm text-amber-700">
            ⚡ 闪念速记
            <span className="ml-2 text-xs text-amber-600">
              Ctrl/Cmd + Enter 提交 · Esc 取消
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col">
        <textarea
          ref={taRef}
          className="flex-1 block w-full bg-transparent border-0 outline-none resize-none text-lg text-gray-800 placeholder-amber-400 focus:ring-0"
          placeholder="一闪而过的灵感..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKey}
          maxLength={20_000}
        />

        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-400">
            {lastSavedId
              ? `✅ 已保存 (id=${lastSavedId}),继续写下一条`
              : `${content.length} / 20000`}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => navigate('/')}
            >
              完成
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={submit}
              disabled={create.isPending || !content.trim()}
            >
              {create.isPending ? '保存中…' : '保存闪念'}
            </button>
          </div>
        </div>

        {create.error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {create.error.message}
          </div>
        )}
      </main>
    </div>
  );
}
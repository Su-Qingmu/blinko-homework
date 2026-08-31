import { useState } from 'react';
import { TagSelector } from './TagSelector';
import { trpc } from '../lib/trpc';

type Mode = 'note' | 'quick';

/**
 * 笔记编辑器(新建 / 编辑通用)
 *
 * - 受控:外部传 defaultContent/defaultTagNames
 * - 完成后回调 onSaved(note) 由调用方决定跳转
 */
export function NoteEditor({
  defaultContent = '',
  defaultTagNames: defaultTags = [],
  defaultType = 'note',
  autoFocus = false,
  onSaved,
  onCancel,
}: {
  defaultContent?: string;
  defaultTagNames?: string[];
  defaultType?: Mode;
  autoFocus?: boolean;
  onSaved?: (noteId: number) => void;
  onCancel?: () => void;
}) {
  const [type, setType] = useState<Mode>(defaultType);
  const [content, setContent] = useState(defaultContent);
  const [tagNames, setTagNames] = useState<string[]>(defaultTags);

  const create = trpc.note.create.useMutation({
    onSuccess: (note) => onSaved?.(note.id),
  });

  const submitting = create.isPending;

  const handleSave = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    create.mutate({ type, content: trimmed, tagNames });
  };

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">类型:</span>
        <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-xs">
          <button
            type="button"
            className={`px-3 py-1 ${type === 'note' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setType('note')}
          >
            📝 笔记
          </button>
          <button
            type="button"
            className={`px-3 py-1 ${type === 'quick' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setType('quick')}
          >
            ⚡ 闪念
          </button>
        </div>
      </div>

      <textarea
        autoFocus={autoFocus}
        className="block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
        rows={defaultType === 'quick' ? 3 : 8}
        placeholder={defaultType === 'quick' ? '一闪而过的灵感...' : '支持 Markdown 语法\n\n# 标题\n**粗体** *斜体*\n- 列表\n```js\n代码\n```'}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={20_000}
      />

      <div>
        <label className="block text-xs text-gray-500 mb-1">标签</label>
        <TagSelector value={tagNames} onChange={setTagNames} />
      </div>

      {create.error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {create.error.message}
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={submitting}>
            取消
          </button>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={submitting || !content.trim()}
        >
          {submitting ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  );
}
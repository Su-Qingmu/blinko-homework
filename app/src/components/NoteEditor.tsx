import { useState } from 'react';
import clsx from 'clsx';
import { TagSelector } from './TagSelector';
import { Icon } from './Icon';
import { trpc } from '../lib/trpc';

type Mode = 'note' | 'quick';

/**
 * 笔记编辑器 - 还原 Blinko 新建/编辑弹窗
 *
 * 视觉:
 * - 顶部类型切换(笔记 / 闪念)
 * - 主编辑区:多行 textarea + monospace 字体 + 字符计数
 * - 底部:标签选择 + 取消 / 保存
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
    <div className="card p-5 space-y-4 shadow-card-hover">
      {/* 类型切换 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">类型:</span>
        <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
          <button
            type="button"
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 transition',
              type === 'note'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-accent',
            )}
            onClick={() => setType('note')}
          >
            <Icon icon="hugeicons:note-01" width={12} height={12} />
            笔记
          </button>
          <button
            type="button"
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 transition',
              type === 'quick'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-accent',
            )}
            onClick={() => setType('quick')}
          >
            <Icon icon="basil:lightning-solid" width={12} height={12} />
            闪念
          </button>
        </div>
      </div>

      {/* 编辑区 */}
      <textarea
        autoFocus={autoFocus}
        className="input font-mono text-sm leading-relaxed resize-y"
        rows={defaultType === 'quick' ? 3 : 8}
        placeholder={
          defaultType === 'quick'
            ? '一闪而过的灵感...'
            : '支持 Markdown 语法\n\n# 标题\n**粗体** *斜体*\n- 列表\n```js\n代码\n```'
        }
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={20_000}
      />

      {/* 标签 */}
      <div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
          <Icon icon="mingcute:hashtag-line" width={12} height={12} />
          标签 <span className="text-muted-foreground/60 font-normal">(回车或逗号添加)</span>
        </label>
        <TagSelector value={tagNames} onChange={setTagNames} />
      </div>

      {/* 错误 */}
      {create.error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2 flex items-start gap-2">
          <Icon icon="hugeicons:alert-circle" width={14} height={14} className="shrink-0 mt-0.5" />
          <span className="flex-1">{create.error.message}</span>
        </div>
      )}

      {/* 操作 */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-[10px] text-muted-foreground font-mono">
          {content.length} / 20000
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" className="btn-ghost" onClick={onCancel} disabled={submitting}>
              取消
            </button>
          )}
          <button
            type="button"
            className="btn-primary flex items-center gap-1.5"
            onClick={handleSave}
            disabled={submitting || !content.trim()}
          >
            {submitting ? (
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
      </div>
    </div>
  );
}
import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';

/**
 * 标签选择器
 - 输入:已选 tagNames 数组
 - 输出:onChange(tagNames)
 - 行为:回车 / 逗号提交新标签,点击 X 删除,失焦自动提交
 */
export function TagSelector({
  value,
  onChange,
  placeholder = '输入标签后回车',
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    if (value.includes(name)) {
      setDraft('');
      return;
    }
    onChange([...value, name]);
    setDraft('');
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const remove = (name: string) => onChange(value.filter((n) => n !== name));

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-1.5 border border-gray-300 rounded-md px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((name) => (
        <span
          key={name}
          className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded"
        >
          #{name}
          <button
            type="button"
            className="hover:text-indigo-900 leading-none"
            onClick={(e) => {
              e.stopPropagation();
              remove(name);
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        className="flex-1 min-w-[80px] outline-none text-sm bg-transparent"
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={() => commit(draft)}
        maxLength={32}
      />
    </div>
  );
}
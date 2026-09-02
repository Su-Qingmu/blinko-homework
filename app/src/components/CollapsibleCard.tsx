import { useState, useEffect, ReactNode } from 'react';
import clsx from 'clsx';
import { Icon } from './Icon';

/**
 * CollapsibleCard - 沿用 Blinko 设置页风格
 *
 * - 标题区:大图标 + 标题 + 折叠/展开按钮
 * - 内容区:可滚动,折叠时隐藏
 * - 折叠状态持久化到 localStorage(按标题)
 */
export function CollapsibleCard({
  icon,
  title,
  children,
  defaultCollapsed = false,
  headerRight,
  className,
}: {
  icon: string;
  title: string | ReactNode;
  children: ReactNode;
  defaultCollapsed?: boolean;
  headerRight?: ReactNode;
  className?: string;
}) {
  const storageKey = `blinko-card-collapsed-${typeof title === 'string' ? title : 'unknown'}`;

  const [collapsed, setCollapsed] = useState(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    return stored ? JSON.parse(stored) : defaultCollapsed;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(collapsed));
  }, [collapsed, storageKey]);

  return (
    <section
      className={clsx(
        'card relative overflow-hidden',
        className,
      )}
    >
      {/* 装饰背景图标(模拟 Blinko 装饰) */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.025] pointer-events-none">
        <Icon icon="uil:thunderstorm" width={80} height={80} className="absolute right-[5%] bottom-[10%] -rotate-12" />
        <Icon icon="uil:flask" width={60} height={60} className="absolute left-[10%] top-[20%] rotate-45" />
        <Icon icon="uil:compact-disc" width={50} height={50} className="absolute right-[25%] top-[8%] -rotate-30" />
      </div>

      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((v: boolean) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-accent/30 transition relative z-10"
      >
        <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary flex items-center justify-center shrink-0">
          <Icon icon={icon} width={20} height={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">{title}</div>
        </div>
        {headerRight && <div onClick={(e) => e.stopPropagation()}>{headerRight}</div>}
        <Icon
          icon={collapsed ? 'hugeicons:arrow-down-01' : 'hugeicons:arrow-up-01'}
          width={16}
          height={16}
          className="text-muted-foreground shrink-0"
        />
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="px-5 pb-5 pt-1 space-y-4 relative z-10 border-t border-border">
          {children}
        </div>
      )}
    </section>
  );
}

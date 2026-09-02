import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { trpc } from '../lib/trpc';
import { Icon } from './Icon';

type NavItem = { to: string; label: string; icon: string; shortcut?: string };

const NAV: readonly NavItem[] = [
  { to: '/', label: '我的笔记', icon: 'hugeicons:note-01' },
  { to: '/quick', label: '闪念速记', icon: 'basil:lightning-outline', shortcut: 'Ctrl+Shift+N' },
];

/**
 * 主框架 - 还原 Blinko 侧边栏风格
 *
 * - 左 sidebar 260px(可调整,Blinko 原版可拖拽,简化版固定)
 * - 顶部 logo + 折叠按钮(简化版固定展开)
 * - 主导航 + 标签列表(简化版只显示导航,标签列表移到主内容)
 * - 底部用户卡片 + 登出
 * - 右侧主内容区
 *
 * 配色 / 间距 / 圆角全部对齐 Blinko 视觉规范:
 * - 选中态:bg-primary text-primary-foreground
 * - hover:opacity / 灰底
 * - sidebar 整体:bg-background(浅色面板)
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const utils = trpc.useUtils();
  const me = trpc.user.me.useQuery();
  const logout = trpc.user.logout.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  });

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* ===== 侧边栏 ===== */}
      <aside
        className={clsx(
          'w-[260px] shrink-0 flex flex-col h-screen sticky top-0',
          'bg-background border-r border-border',
        )}
      >
        {/* Logo + 折叠按钮 */}
        <div className="px-5 py-5 flex items-center justify-between border-b border-border">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-base shadow-sm shrink-0">
              B
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight truncate">AI智能笔记</div>
              <div className="text-[10px] text-muted-foreground leading-tight truncate">Blinko Lite</div>
            </div>
          </Link>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-accent"
            title="折叠侧边栏(简化版固定)"
            disabled
          >
            <Icon icon="hugeicons:sidebar-left-01" width={18} height={18} />
          </button>
        </div>

        {/* 主导航 */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active =
                item.to === '/'
                  ? location.pathname === '/' || location.pathname.startsWith('/notes/')
                  : location.pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={clsx(
                      'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-semibold transition',
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon icon={item.icon} width={20} height={20} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.shortcut && (
                      <span
                        className={clsx(
                          'text-[10px] font-mono px-1.5 py-0.5 rounded',
                          active
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {item.shortcut}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 底部用户区 */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-accent transition">
            <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
              {(me.data?.nickname || me.data?.username || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {me.data?.nickname || me.data?.username || '...'}
              </div>
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                <Icon icon="hugeicons:logout-04" width={12} height={12} />
                登出
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ===== 主内容 ===== */}
      <main className="flex-1 min-w-0 flex flex-col">
        {children}
      </main>
    </div>
  );
}

/** 主内容区顶部条 - 还原 Blinko header 风格 */
export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border">
      <div className="px-6 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3">
          {breadcrumb}
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">{title}</h1>
            {subtitle && (
              <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Outlet } from 'react-router-dom';
import { trpc } from './lib/trpc';
import { AppShell } from './components/AppShell';
import { AIChatBubble } from './components/AIChatBubble';
import SignIn from './pages/SignIn';
import Notes from './pages/Notes';
import NoteDetail from './pages/NoteDetail';
import QuickNote from './pages/QuickNote';

/**
 * 全局快捷键
 * - Ctrl/Cmd + Shift + N → 闪念速记
 * - Ctrl/Cmd + Shift + I → AI 助手(打开抽屉)
 *
 * AI 抽屉状态由 AIChatBubble 内部管理,这里只发自定义事件通知
 */
function GlobalShortcuts({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      if (e.key === 'N' || e.key === 'n') {
        e.preventDefault();
        navigate('/quick');
      } else if (e.key === 'I' || e.key === 'i') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('toggle-ai-chat'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, navigate]);
  return null;
}

/** 已登录路由的统一外壳:sidebar + AI 悬浮气泡 */
function AuthedShell() {
  return (
    <AppShell>
      <Outlet />
      <AIChatBubble />
    </AppShell>
  );
}

export default function App() {
  const me = trpc.user.me.useQuery();
  const isAuthed = me.data !== null && me.data !== undefined;
  const isLoading = me.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-muted-foreground text-sm">
        加载中…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <GlobalShortcuts enabled={isAuthed} />
      <Routes>
        <Route
          path="/signin"
          element={isAuthed ? <Navigate to="/" replace /> : <SignIn />}
        />
        <Route element={isAuthed ? <AuthedShell /> : <Navigate to="/signin" replace />}>
          <Route path="/" element={<Notes />} />
          <Route path="/quick" element={<QuickNote />} />
          <Route path="/notes/:id" element={<NoteDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { trpc } from './lib/trpc';
import SignIn from './pages/SignIn';
import Notes from './pages/Notes';
import NoteDetail from './pages/NoteDetail';
import QuickNote from './pages/QuickNote';

/**
 * 全局快捷键:Ctrl+Shift+N / Cmd+Shift+N → 跳到闪念速记
 * 仅在已登录状态下生效(避免在 /signin 也触发)
 */
function GlobalShortcuts({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        e.preventDefault();
        navigate('/quick');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, navigate]);
  return null;
}

export default function App() {
  const me = trpc.user.me.useQuery();
  const isAuthed = me.data !== null && me.data !== undefined;
  const isLoading = me.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
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
        <Route
          path="/quick"
          element={isAuthed ? <QuickNote /> : <Navigate to="/signin" replace />}
        />
        <Route
          path="/notes/:id"
          element={isAuthed ? <NoteDetail /> : <Navigate to="/signin" replace />}
        />
        <Route
          path="/"
          element={isAuthed ? <Notes /> : <Navigate to="/signin" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
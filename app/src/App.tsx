import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { trpc } from './lib/trpc';
import SignIn from './pages/SignIn';
import Home from './pages/Home';

export default function App() {
  const me = trpc.user.me.useQuery();
  const isAuthed = me.data !== null && me.data !== undefined;

  if (me.isLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
        加载中…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/signin"
          element={isAuthed ? <Navigate to="/" replace /> : <SignIn />}
        />
        <Route
          path="/"
          element={isAuthed ? <Home /> : <Navigate to="/signin" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

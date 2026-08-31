import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TRPCClientError } from '@trpc/client';
import { trpc } from '../lib/trpc';

type Mode = 'login' | 'register';

export default function SignIn() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);

  const login = trpc.user.login.useMutation({
    onSuccess: async () => {
      await utils.user.me.invalidate();
      navigate('/', { replace: true });
    },
    onError: (err) => setError(err.message),
  });

  const register = trpc.user.register.useMutation({
    onSuccess: async () => {
      await utils.user.me.invalidate();
      navigate('/', { replace: true });
    },
    onError: (err) => setError(err.message),
  });

  const pending = login.isPending || register.isPending;
  const mutation = mode === 'login' ? login : register;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'login') {
      login.mutate({ username: username.trim(), password });
    } else {
      register.mutate({
        username: username.trim(),
        password,
        nickname: nickname.trim() || undefined,
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-indigo-600 text-white text-2xl font-bold shadow-lg mb-3">
            B
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AI智能笔记</h1>
          <p className="text-sm text-gray-500 mt-1">让 AI 对话中的每个灵感都成为可复习的知识</p>
        </div>

        <div className="card p-6">
          {/* 切换 Tab */}
          <div className="flex mb-5 border-b border-gray-200">
            <button
              type="button"
              className={`flex-1 pb-2 text-sm font-medium border-b-2 transition ${
                mode === 'login'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
            >
              登录
            </button>
            <button
              type="button"
              className={`flex-1 pb-2 text-sm font-medium border-b-2 transition ${
                mode === 'register'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
              <input
                className="input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3-20 位字母/数字/下划线"
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? '至少 8 位，含字母和数字' : '请输入密码'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  昵称 <span className="text-gray-400 font-normal">(可选)</span>
                </label>
                <input
                  className="input"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="留空则使用用户名"
                  maxLength={20}
                />
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={pending}>
              {pending ? '处理中…' : mode === 'login' ? '登录' : '创建账号'}
            </button>
          </form>

          <p className="mt-4 text-xs text-gray-400 text-center">
            阶段1+2 课设骨架 · 详见 README
          </p>
        </div>
      </div>
    </div>
  );
}

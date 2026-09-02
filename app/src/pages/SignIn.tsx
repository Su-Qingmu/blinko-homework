import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { Icon } from '../components/Icon';

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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* 品牌区 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground shadow-lg mb-3">
            <Icon icon="hugeicons:ai-chemistry-02" width={30} height={30} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AI智能笔记</h1>
          <p className="text-sm text-muted-foreground mt-1.5 flex items-center justify-center gap-1">
            <Icon icon="hugeicons:sparkles" width={14} height={14} className="text-flash" />
            让 AI 对话中的每个灵感都成为可复习的知识
          </p>
        </div>

        {/* 表单卡片 */}
        <div className="card p-6 shadow-card-hover">
          {/* Tabs */}
          <div className="flex mb-5 border-b border-border -mx-6 px-6">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`flex-1 pb-2.5 text-sm font-semibold border-b-2 transition flex items-center justify-center gap-1.5 ${
                  mode === m
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
              >
                <Icon icon={m === 'login' ? 'hugeicons:login-02' : 'hugeicons:user-add-01'} width={14} height={14} />
                {m === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Icon icon="hugeicons:user" width={12} height={12} />
                用户名
              </label>
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
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                <Icon icon="hugeicons:lock-key" width={12} height={12} />
                密码
              </label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? '至少 8 位,含字母和数字' : '请输入密码'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Icon icon="hugeicons:user-circle" width={12} height={12} />
                  昵称 <span className="text-muted-foreground/60 font-normal">(可选)</span>
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
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2 flex items-start gap-2">
                <Icon icon="hugeicons:alert-circle" width={16} height={16} className="shrink-0 mt-0.5" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-1.5" disabled={pending}>
              {pending ? (
                <>
                  <Icon icon="hugeicons:loading-03" width={14} height={14} className="animate-spin" />
                  处理中…
                </>
              ) : (
                <>
                  <Icon icon={mode === 'login' ? 'hugeicons:login-02' : 'hugeicons:tick-double-01'} width={14} height={14} />
                  {mode === 'login' ? '登录' : '创建账号'}
                </>
              )}
            </button>
          </form>
        </div>

        <p className="mt-6 text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
          <Icon icon="hugeicons:copyright" width={12} height={12} />
          Blinko Lite · 课设项目 · 详见 README
        </p>
      </div>
    </div>
  );
}
import { Link } from 'react-router-dom';
import { trpc } from '../lib/trpc';

/**
 * 阶段1+2 占位首页：登录后跳转至此。
 * 阶段3 起替换为笔记列表 / 闪念输入 / AI 助手入口。
 */
export default function Home() {
  const me = trpc.user.me.useQuery();
  const utils = trpc.useUtils();
  const logout = trpc.user.logout.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  });
  const placeholder = trpc.note.placeholder.useQuery(undefined, { retry: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">📝 AI智能笔记</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {me.data?.nickname || me.data?.username}
            </span>
            <button className="btn-ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
              登出
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <section className="card p-6">
          <h2 className="text-xl font-semibold mb-2">👋 欢迎，阶段1+2 骨架就绪</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            后端 tRPC 已连通，前端路由 / 登录 / 注册 / 登出 / me 全部跑通。
            后续阶段：笔记 CRUD → 闪念 → AI 对话/评论 → 部署。
          </p>
          <pre className="mt-4 p-3 bg-gray-900 text-gray-100 text-xs rounded overflow-x-auto">
            {JSON.stringify(placeholder.data ?? placeholder.error?.message ?? 'loading…', null, 2)}
          </pre>
        </section>

        <section className="card p-6">
          <h3 className="font-semibold mb-2">路线图</h3>
          <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li className="text-gray-400">阶段1 基础骨架 ✅</li>
            <li className="text-gray-400">阶段2 用户系统 ✅</li>
            <li>阶段3 笔记核心（待开发）</li>
            <li>阶段4 闪念速记</li>
            <li>阶段5 AI 对话 / 评论</li>
            <li>阶段6 Docker 部署</li>
          </ol>
        </section>

        <p className="text-xs text-gray-400">
          详见 <Link to="/" className="underline">SIMPLIFIED.md</Link>
        </p>
      </main>
    </div>
  );
}

# AI智能笔记 · Blinko-Lite

> 课设项目，基于 [blinkospace/blinko](https://github.com/blinkospace/blinko) 1.8.8 精简。
> 保留核心：**笔记 / 闪念 / AI 对话 / AI 评论 / 用户登录**。
> 砍掉：Tauri 桌面端 / 多 AI Provider / 插件系统 / Mastra / MCP / pg-boss / 多语言 等。

详细方案见 [SIMPLIFIED.md](./SIMPLIFIED.md)。课设文档见 [docs/](./docs/)。

## 技术栈

**后端** Node.js 20+ · TypeScript · Express · tRPC · Prisma · SQLite · OpenAI SDK
**前端** Vite · React 18 · TypeScript · Tailwind CSS · React Router 6 · TanStack Query
**部署** 单 Docker 容器（多阶段构建，阶段6实现）

## 数据模型（6 个 Prisma model）

| Model | 用途 |
|---|---|
| `Account` | 用户（bcrypt 密码） |
| `Session` | 登录态（cookie sid） |
| `Note` | 笔记 / 闪念（type 区分） |
| `Tag` | 标签（每用户独立命名空间） |
| `Comment` | 评论（含 AI 评论，isAI 区分） |
| `Conversation` / `Message` | AI 对话历史 |

## 快速开始

```bash
# 1. 安装依赖
bun install

# 2. 准备数据库
cp .env.tmpl .env          # 首次需复制
bun run prisma:migrate     # 生成 SQLite + 应用 schema

# 3. 启动开发（同时跑后端 :4000 与前端 :5173）
bun run dev
```

访问 http://localhost:5173 。

## 目录结构

```
blinko-homework/
├── prisma/
│   └── schema.prisma         # 6 models · SQLite
├── server/
│   ├── src/
│   │   ├── index.ts          # Express 入口（cookie + CORS + tRPC）
│   │   ├── trpc/
│   │   │   ├── trpc.ts       # initTRPC + protectedProcedure
│   │   │   ├── context.ts    # 注入 prisma + account
│   │   │   └── routers/      # user / note / comment / ai
│   │   └── lib/
│   │       ├── prisma.ts     # PrismaClient 单例
│   │       ├── auth.ts       # bcrypt + session token
│   │       └── openai.ts     # OpenAI 客户端（阶段5）
│   └── package.json
├── app/
│   ├── src/
│   │   ├── main.tsx          # React + tRPC Provider
│   │   ├── App.tsx           # 路由守卫
│   │   ├── pages/
│   │   │   ├── SignIn.tsx    # 登录/注册
│   │   │   └── Home.tsx      # 占位首页（阶段3 替换为笔记列表）
│   │   └── lib/trpc.ts       # 类型化 tRPC 客户端
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
├── docs/                     # 课设文档（立项书/需求规格/系统设计）
├── SIMPLIFIED.md             # 精简方案
└── package.json              # workspaces + concurrently
```

## 开发路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| 1 | 基础骨架：monorepo + Prisma + Express + tRPC + Vite hello world | ✅ |
| 2 | 用户系统：注册 / 登录 / 登出 / session | ✅ |
| 3 | 笔记核心：Note CRUD + 标签 + 搜索 + markdown 渲染 | ⏳ |
| 4 | 闪念：极简快速输入 + Ctrl+Shift+N | ⏳ |
| 5 | AI 模块：流式对话 + AI 自动评论 + AI 助手页 | ⏳ |
| 6 | 部署：Dockerfile + docker-compose + README | ⏳ |

## 课程文档

- [docs/01-项目立项书.md](./docs/01-项目立项书.md)
- [docs/02-需求规格说明书.md](./docs/02-需求规格说明书.md)
- [docs/03-系统设计报告.md](./docs/03-系统设计报告.md)
- [docs/04-软件安装与使用说明.md](./docs/04-软件安装与使用说明.md)

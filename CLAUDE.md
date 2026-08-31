# CLAUDE.md

Blinko-Lite 是基于 [blinkospace/blinko](https://github.com/blinkospace/blinko) 1.8.8 精简而来的课设项目，详见 [SIMPLIFIED.md](./SIMPLIFIED.md)。本文档供 Claude Code 在本仓库工作时参考。

## 项目概述

**一句话**：让 AI 对话中的每一个灵感都成为可复习的知识资产。

**核心功能（5 个）**：笔记 / 闪念 / AI 对话 / AI 自动评论 / 用户登录。

**砍掉（vs 原版）**：Tauri 桌面端 / 多 AI Provider / 插件系统 / Mastra 抽象层 / MCP / pg-boss 队列 / 17 国 i18n / PWA / 主题系统。

## 技术栈

- **后端**：Node.js 20+ · TypeScript · Express · tRPC 11 · Prisma 5 · SQLite · OpenAI SDK 4
- **前端**：React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · React Router 6 · TanStack Query 5 · tRPC Client
- **包管理**：Bun 1.3+
- **部署**：单 Docker 容器（阶段6实现）

## 仓库结构

```
blinko-homework/
├── prisma/schema.prisma       # 6 models: Account / Session / Note / Tag / Comment / Conversation / Message
├── server/
│   └── src/
│       ├── index.ts           # Express 入口
│       ├── trpc/
│       │   ├── trpc.ts        # initTRPC + protectedProcedure
│       │   ├── context.ts     # 注入 prisma + account + res
│       │   └── routers/       # user / note / comment / ai
│       └── lib/
│           ├── prisma.ts      # 单例 PrismaClient
│           ├── auth.ts        # bcrypt + session token
│           └── openai.ts      # OpenAI 单例（阶段5）
├── app/
│   ├── vite.config.ts         # /trpc 代理 → :4000
│   └── src/
│       ├── main.tsx           # tRPC + ReactQuery Provider
│       ├── App.tsx            # 路由守卫
│       ├── lib/trpc.ts        # 类型化 tRPC 客户端
│       └── pages/             # SignIn / Home（阶段3+ 加入 Notes/NoteDetail/QuickNote/AIChat）
├── docs/                      # 课设文档（立项书/需求规格/系统设计/使用说明）
└── SIMPLIFIED.md              # 精简方案
```

## 常用命令

```bash
bun install                       # 装依赖（workspaces）
bun run prisma:migrate            # 生成 + 应用 SQLite schema（首次）
bun run prisma:generate           # 仅生成 Prisma Client
bun run prisma:studio             # 打开 Prisma Studio 浏览数据

bun run dev                       # 并发启动 server (:4000) + app (:5173)
bun run dev:server                # 仅后端
bun run dev:app                   # 仅前端

bun run build                     # 全部构建
bun run start                     # 生产模式跑 server（需先 build:server）
```

## 核心约定

### 1. tRPC 路由组织
- `user` 路由：`register / login / logout / me`，前三个用 `publicProcedure`（me 也 public，未登录返 null）
- 其他路由：`protectedProcedure`（自动校验 ctx.account）
- 输入校验统一用 `zod`

### 2. Session 设计
- cookie 名：`sid`，`httpOnly + sameSite=lax`，30 天过期
- 服务端：`Session { id: token, accountId, expiresAt }`，过期自动清理
- 前端：所有 tRPC 请求 `credentials: 'include'`，无需手动管理

### 3. 数据隔离
- 所有查询强制带 `accountId` 过滤（`ctx.account.id`）
- 标签 `(accountId, name)` 唯一，避免跨用户冲突

### 4. Markdown 渲染
- 写入：`content` 存 markdown 文本
- 渲染：`<div className="markdown"><ReactMarkdown>{content}</ReactMarkdown></div>`（阶段3 实现）
- XSS：依赖 `react-markdown` 自带转义，不引入额外 sanitizer

### 5. AI 调用
- 统一通过 `getOpenAI()` 拿单例，未配 `OPENAI_API_KEY` 时直接抛错
- 默认模型 `gpt-4o-mini`，可通过 `OPENAI_MODEL` 环境变量覆盖
- 流式：阶段5 用 `openai.chat.completions.create({ stream: true })`，前端通过 tRPC subscription 或独立 SSE 路由消费

## 阶段路线图（与 SIMPLIFIED.md §八 对齐）

| 阶段 | 内容 | 状态 |
|---|---|---|
| 1 | 基础骨架（schema + Express + tRPC + Vite） | ✅ |
| 2 | 用户系统（register/login/logout/me + SignIn 页） | ✅ |
| 3 | 笔记核心（Note/Tag CRUD + 列表/详情 + markdown + 搜索） | ⏳ |
| 4 | 闪念（极简快速输入 + Ctrl+Shift+N） | ⏳ |
| 5 | AI（流式对话 + 自动评论 + AI 助手页） | ⏳ |
| 6 | Docker 部署 | ⏳ |

## 环境变量

参考 [.env.tmpl](./.env.tmpl)：
- `DATABASE_URL`：SQLite 文件路径，默认 `file:./dev.db`
- `PORT`：后端端口，默认 `4000`
- `CLIENT_ORIGIN`：前端来源，用于 CORS，默认 `http://localhost:5173`
- `SESSION_SECRET`：保留位（当前未用，bcrypt 自带 salt）
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`：阶段5 启用

## 端口

- 前端：`5173`
- 后端：`4000`
- 开发期前端通过 Vite proxy 把 `/trpc` 转到 `:4000`

## 注意事项

1. **不要引入新依赖**除非必要 - 课设要求精简
2. **不要保留原版 Blinko 风格** - 砍掉 MobX / HeroUI / framer-motion / 多语言 / PWA
3. **每个阶段完成后单独提交** git，保持 commit 历史清晰
4. **不要破坏数据隔离** - 所有 user-scoped 查询必须带 accountId
5. **AI 调用必须走 `getOpenAI()` 单例** - 不要直接 `new OpenAI()`

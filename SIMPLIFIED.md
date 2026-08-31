# Blinko 课设简化方案

> 基于 [blinkospace/blinko](https://github.com/blinkospace/blinko) 1.8.8 改造，保留核心功能，砍掉课设不需要的部分。

## 一、为什么简化

原版 Blinko 是完整的商业级产品：
- 19 个 Prisma 模型、21 个 tRPC 路由、9000+ 行服务端代码
- 后端：tRPC + Prisma + Mastra + 6 个 AI Provider + MCP + pgBoss 队列
- 前端：React + Tauri 桌面端 + 完整插件系统 + i18n + PWA
- 依赖：PostgreSQL + Redis + S3 兼容存储 + 各种 OAuth

课设只要：**笔记 / 闪念 / AI 对话 / AI 评论 / 用户登录**。

---

## 二、技术栈（最终选择）

### 后端
| 项 | 选择 | 理由 |
|---|---|---|
| 运行时 | Node.js 20+ | 课设环境通用 |
| 语言 | TypeScript | 类型安全 |
| 框架 | Express | 比 Hono/Nest 简单 |
| API | tRPC | 类型前后端贯通，少写 schema |
| ORM | Prisma | 类型安全 + 迁移友好 |
| 数据库 | **SQLite** | 零配置、单文件、便于演示 |
| AI | OpenAI SDK（直连） | 砍掉 Mastra 抽象层 |

### 前端
| 项 | 选择 | 理由 |
|---|---|---|
| 构建 | Vite | 快 |
| 框架 | React 18 + TS | 主流 |
| 样式 | Tailwind CSS | 快 |
| 状态 | React Query（tRPC 配套） | 砍掉原 store 目录 |
| 路由 | React Router 6 | 简单 |
| 编辑器 | `<textarea>` + react-markdown | 砍掉 vditor |
| 桌面端 | ❌ 不做 Tauri | 只做 Web |

### 部署
单容器：`Dockerfile`（多阶段构建，前端 build → nginx，后端 Node） + `docker-compose.yml`

---

## 三、数据模型（精简 Prisma schema）

只保留 **6 个 model**：

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Account {
  id        Int       @id @default(autoincrement())
  username  String    @unique
  password  String              // bcrypt 哈希
  nickname  String?
  avatar    String?
  role      String    @default("user")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  notes        Note[]
  comments     Comment[]
  conversations Conversation[]
  sessions     Session[]
  tags         Tag[]
}

model Session {
  id        String   @id              // 随机 token
  accountId Int
  expiresAt DateTime
  account   Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
}

model Note {
  id        Int       @id @default(autoincrement())
  type      Int       @default(0)     // 0=笔记 1=闪念
  content   String                      // markdown 文本
  archived  Boolean   @default(false)
  top       Boolean   @default(false)
  accountId Int
  account   Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)

  tags     Tag[]      @relation("NoteTags")
  comments Comment[]

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([accountId, type, archived])
}

model Tag {
  id        Int      @id @default(autoincrement())
  name      String
  accountId Int
  account   Account  @relation(fields: [accountId], references: [id], onDelete: Cascade)
  notes     Note[]   @relation("NoteTags")

  @@unique([accountId, name])
}

model Comment {
  id        Int      @id @default(autoincrement())
  content   String
  isAI      Boolean  @default(false)  // true=AI 评论 false=用户评论
  accountId Int?
  noteId    Int

  account   Account? @relation(fields: [accountId], references: [id], onDelete: SetNull)
  note      Note     @relation(fields: [noteId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([noteId])
}

model Conversation {
  id        Int       @id @default(autoincrement())
  title     String    @default("新对话")
  accountId Int
  account   Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id             Int          @id @default(autoincrement())
  role           String                              // "user" | "assistant" | "system"
  content        String
  conversationId Int
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  createdAt      DateTime     @default(now())

  @@index([conversationId, createdAt])
}
```

### 砍掉的 13 个 model
`Attachment` / `Config` / `NoteReference` / `Follow` / `Notification` / `Cache` / `Plugin` / `AiProvider` / `AiModel` / `AiScheduledTask` / `McpServer` / `Font` / `NoteHistory` / `NoteInternalShare`

---

## 四、目录结构

```
blinko-lite/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── server/
│   ├── src/
│   │   ├── index.ts                  # Express 入口
│   │   ├── trpc/
│   │   │   ├── trpc.ts               # initTRPC + context
│   │   │   ├── context.ts            # session 注入
│   │   │   └── routers/
│   │   │       ├── index.ts          # appRouter
│   │   │       ├── user.ts           # 注册/登录/登出/me
│   │   │       ├── note.ts           # CRUD + 标签 + 搜索
│   │   │       ├── comment.ts        # 用户评论 + 触发 AI 评论
│   │   │       └── ai.ts             # 流式对话 + 历史
│   │   ├── lib/
│   │   │   ├── prisma.ts             # PrismaClient 单例
│   │   │   ├── auth.ts               # bcrypt + session
│   │   │   └── openai.ts             # OpenAI 客户端
│   │   └── middleware/
│   │       └── auth.ts               # 解析 session
│   ├── package.json
│   └── tsconfig.json
├── app/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── lib/
│   │   │   ├── trpc.ts               # tRPC 客户端
│   │   │   └── api.ts                # tRPC React 配置
│   │   ├── pages/
│   │   │   ├── SignIn.tsx
│   │   │   ├── Notes.tsx             # 笔记列表
│   │   │   ├── NoteDetail.tsx        # 笔记详情 + 评论
│   │   │   ├── QuickNote.tsx         # 闪念快速输入
│   │   │   └── AIChat.tsx            # AI 对话
│   │   ├── components/
│   │   │   ├── NoteEditor.tsx        # textarea + 标签
│   │   │   ├── MarkdownView.tsx      # react-markdown 渲染
│   │   │   ├── TagSelector.tsx
│   │   │   └── CommentList.tsx
│   │   └── styles/
│   │       └── index.css             # tailwind 入口
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
├── package.json                      # workspaces: server, app
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── README.md
```

---

## 五、核心代码骨架

### 5.1 后端：tRPC + 上下文注入 session

```typescript
// server/src/trpc/context.ts
import type { Request } from 'express';
import { prisma } from '../lib/prisma';

export async function createContext({ req }: { req: Request }) {
  const sessionToken = req.cookies?.sid;
  const session = sessionToken
    ? await prisma.session.findUnique({
        where: { id: sessionToken },
        include: { account: true },
      })
    : null;

  return {
    prisma,
    account: session?.account ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

```typescript
// server/src/trpc/trpc.ts
import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.account) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, account: ctx.account } });
});
```

### 5.2 后端：note 路由（精简版）

```typescript
// server/src/trpc/routers/note.ts
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

export const noteRouter = router({
  list: protectedProcedure
    .input(z.object({
      type: z.enum(['note', 'quick']).optional(),
      tagId: z.number().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.note.findMany({
        where: {
          accountId: ctx.account.id,
          archived: false,
          ...(input?.type && { type: input.type === 'note' ? 0 : 1 }),
          ...(input?.tagId && { tags: { some: { id: input.tagId } } }),
          ...(input?.search && { content: { contains: input.search } }),
        },
        include: { tags: true },
        orderBy: [{ top: 'desc' }, { updatedAt: 'desc' }],
      });
    }),

  create: protectedProcedure
    .input(z.object({
      type: z.enum(['note', 'quick']).default('note'),
      content: z.string().min(1),
      tagNames: z.array(z.string()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const tags = await Promise.all(
        input.tagNames.map(name =>
          ctx.prisma.tag.upsert({
            where: { accountId_name: { accountId: ctx.account.id, name } },
            create: { name, accountId: ctx.account.id },
            update: {},
          })
        )
      );
      return ctx.prisma.note.create({
        data: {
          type: input.type === 'note' ? 0 : 1,
          content: input.content,
          accountId: ctx.account.id,
          tags: { connect: tags.map(t => ({ id: t.id })) },
        },
        include: { tags: true },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      content: z.string().optional(),
      top: z.boolean().optional(),
      archived: z.boolean().optional(),
      tagNames: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, tagNames, ...data } = input;
      if (tagNames) {
        const tags = await Promise.all(
          tagNames.map(name =>
            ctx.prisma.tag.upsert({
              where: { accountId_name: { accountId: ctx.account.id, name } },
              create: { name, accountId: ctx.account.id },
              update: {},
            })
          )
        );
        await ctx.prisma.note.update({
          where: { id },
          data: { ...data, tags: { set: tags.map(t => ({ id: t.id })) } },
        });
      } else {
        await ctx.prisma.note.update({ where: { id }, data });
      }
      return ctx.prisma.note.findUnique({ where: { id }, include: { tags: true } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) =>
      ctx.prisma.note.delete({ where: { id } })
    ),
});
```

### 5.3 后端：AI 路由（流式对话 + AI 评论）

```typescript
// server/src/trpc/routers/ai.ts
import { z } from 'zod';
import OpenAI from 'openai';
import { router, protectedProcedure } from '../trpc';
import { observable } from '@trpc/server/observable';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const aiRouter = router({
  // 流式对话
  chat: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 保存用户消息
      await ctx.prisma.message.create({
        data: { role: 'user', content: input.content, conversationId: input.conversationId },
      });

      // 加载历史
      const history = await ctx.prisma.message.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: 'asc' },
        take: 20,
      });

      // 流式调用 OpenAI
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        stream: true,
        messages: [
          { role: 'system', content: '你是 Blinko 笔记助手，帮助用户整理和扩展他们的想法。' },
          ...history.map(m => ({ role: m.role as any, content: m.content })),
        ],
      });

      let full = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? '';
        full += delta;
        // 这里简化：实际场景用 SSE / WebSocket 推送
      }

      await ctx.prisma.message.create({
        data: { role: 'assistant', content: full, conversationId: input.conversationId },
      });

      return { content: full };
    }),

  // AI 自动评论笔记
  commentNote: protectedProcedure
    .input(z.object({ noteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const note = await ctx.prisma.note.findUnique({ where: { id: input.noteId } });
      if (!note) throw new Error('笔记不存在');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: '你是一个笔记评论助手，对用户的笔记给出 1-2 句有建设性的反馈、补充或问题。',
        }, {
          role: 'user',
          content: note.content,
        }],
      });

      const aiComment = completion.choices[0].message.content ?? '';

      return ctx.prisma.comment.create({
        data: {
          content: aiComment,
          isAI: true,
          noteId: input.noteId,
          accountId: null,  // AI 评论不绑定用户
        },
      });
    }),
});
```

### 5.4 后端：入口

```typescript
// server/src/index.ts
import express from 'express';
import cookieParser from 'cookie-parser';
import { createContext } from './trpc/context';
import { appRouter } from './trpc/routers';
import { createExpressMiddleware } from '@trpc/server/adapters/express';

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use('/trpc', createExpressMiddleware({
  router: appRouter,
  createContext,
}));

app.get('/health', (_, res) => res.json({ ok: true }));

app.listen(4000, () => console.log('Server: http://localhost:4000'));
```

### 5.5 前端：tRPC 客户端

```typescript
// app/src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../server/src/trpc/routers';

export const trpc = createTRPCReact<AppRouter>();
```

```typescript
// app/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from './lib/trpc';
import App from './App';

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: 'http://localhost:4000/trpc' })],
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
```

### 5.6 前端：笔记列表页

```tsx
// app/src/pages/Notes.tsx
import { trpc } from '../lib/trpc';
import { useState } from 'react';

export default function Notes() {
  const [search, setSearch] = useState('');
  const { data: notes, refetch } = trpc.note.list.useQuery({ search });
  const createNote = trpc.note.create.useMutation({
    onSuccess: () => refetch(),
  });
  const [content, setContent] = useState('');

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">📝 我的笔记</h1>

      {/* 快速新建 */}
      <div className="mb-6 bg-white shadow rounded p-4">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className="w-full border rounded p-2"
          rows={3}
          placeholder="写点什么..."
        />
        <button
          className="mt-2 px-4 py-1 bg-blue-500 text-white rounded"
          onClick={() => {
            createNote.mutate({ type: 'note', content });
            setContent('');
          }}
        >
          保存
        </button>
      </div>

      {/* 搜索 */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 搜索笔记"
        className="w-full border rounded p-2 mb-4"
      />

      {/* 列表 */}
      <div className="space-y-3">
        {notes?.map(note => (
          <div key={note.id} className="bg-white shadow rounded p-4">
            <div className="text-sm text-gray-500">
              {note.type === 1 ? '⚡ 闪念' : '📝 笔记'}
              {' · '}
              {new Date(note.createdAt).toLocaleString('zh-CN')}
            </div>
            <div className="mt-2 whitespace-pre-wrap">{note.content}</div>
            <div className="mt-2 flex gap-2">
              {note.tags.map(t => (
                <span key={t.id} className="text-xs bg-blue-100 px-2 py-1 rounded">
                  #{t.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 六、AI 模块设计

### 6.1 必备能力
1. **AI 对话**：基于笔记 / 闪念内容的多轮对话（流式）
3. **AI 自动评论**：用户保存笔记后，异步生成 1-2 条 AI 评论
3. **AI 续写 / 润色**（加分项）：用户选中笔记片段调用

### 6.2 砍掉
- 多 Provider（Anthropic / DeepSeek / Google / xAI / Azure / OpenRouter）→ **只保留 OpenAI**
- MCP（Model Context Protocol）
- Mastra 抽象层 → **直接 OpenAI SDK**
- AI 定时任务（aiScheduledTask）→ 用 setInterval 即可
- aiProviders / aiModels 表 → **用环境变量配置**

### 6.3 `.env` 配置

```env
# 数据库（SQLite）
DATABASE_URL="file:./dev.db"

# 服务
PORT=4000

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

---

## 七、部署方案

### 7.1 单容器（推荐）

```yaml
# docker-compose.yml
services:
  blinko:
    build: .
    ports:
      - "4000:4000"     # 后端 API
      - "5173:80"       # 前端 nginx
    environment:
      - DATABASE_URL=file:/data/dev.db
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    volumes:
      - ./data:/data    # 持久化 SQLite
```

```dockerfile
# Dockerfile（多阶段）
FROM node:20-alpine AS server
WORKDIR /app
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
COPY prisma/ ./prisma/
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS app
WORKDIR /app
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=app /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=server /app/dist /app/server
COPY --from=server /app/node_modules /app/server/node_modules
WORKDIR /app/server
EXPOSE 80 4000
CMD sh -c "node dist/index.js & nginx -g 'daemon off;'"
```

### 7.2 本地开发（不用 Docker）

```bash
# 后端
cd server && npm install && npm run dev

# 前端
cd app && npm install && npm run dev
```

---

## 八、路线图（开发顺序）

### 阶段 1：基础骨架（1-2 天）
- [ ] 初始化 monorepo + workspaces
- [ ] 写 schema + 跑通 migrate
- [ ] 写 Express + tRPC 入口
- [ ] 跑通 hello world

### 阶段 2：用户系统（0.5 天）
- [ ] 注册 / 登录 / 登出
- [ ] session 中间件
- [ ] 前端登录页

### 阶段 3：笔记核心（1-2 天）
- [ ] Note CRUD
- [ ] Tag CRUD
- [ ] 笔记列表 + 详情页
- [ ] markdown 渲染
- [ ] 搜索（按内容 + 标签）

### 阶段 4：闪念（0.5 天）
- [ ] 快速输入页（极简 UI，类似发推）
- [ ] 全局快捷键（Ctrl/Cmd + Shift + N）

### 阶段 5：AI 模块（1-2 天）
- [ ] AI 对话（流式）
- [ ] AI 自动评论（保存后异步触发）
- [ ] AI 助手页（独立对话窗口）

### 阶段 6：部署 + 文档（0.5-1 天）
- [ ] Dockerfile
- [ ] docker-compose.yml
- [ ] README.md
- [ ] 录演示视频

**总计：约 5-7 天**

---

## 十、加分项（挑 1-2 个做亮点）

### A. 双向链接 `[[标题]]`（推荐 ✨）
- 笔记编辑时输入 `[[` 触发搜索建议
- 解析时用正则提取 `[[xxx]]` 替换为链接
- 数据库存 references 表（可加回，但只加这一个被砍的 model）

### B. 全局搜索
- 标题 + 内容 + 标签 联合 `contains` 搜索
- 前端 debounce + 高亮关键字

### C. 暗色模式
- Tailwind `dark:` 类，一行配置

### D. 笔记导出
- 全部笔记导出为 JSON / Markdown 压缩包

---

## 十一、与原版对比

| 项 | 原版 Blinko | 课设简化版 |
|---|---|---|
| 代码行数 | ~30000 | ~2000 |
| 数据模型 | 19 | 6 |
| tRPC 路由 | 21 | 4 |
| AI Provider | 6 个 + 抽象 | 1 个直连 |
| 数据库 | PostgreSQL | SQLite |
| 前端路由 | 20+ 页面 | 5 页面 |
| 部署依赖 | PostgreSQL + Redis + S3 | 单文件 SQLite |
| 演示成本 | 高 | 低 |

---

## 参考
- 原仓库：https://github.com/blinkospace/blinko
- tRPC 文档：https://trpc.io
- Prisma 文档：https://www.prisma.io/docs
- OpenAI SDK：https://platform.openai.com/docs/api-reference
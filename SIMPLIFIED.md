# Blinko 课设精简方案

> **2026-09-04 方向锁定**:经过复盘,精简目标调整为 **18 model 终态**(原计划的 18→6 已放弃,原因见末尾"方向调整记录")。当前 commit `b61a0c5a` 即为终态,不再继续精简 Prisma model。

---

## 〇、方向锁定 (2026-09-04)

| 项 | 终态 | 状态 |
|---|---|---|
| Prisma model | **18 个**(基线 22 - 删 4 个 0 引用) | ✅ 已达 |
| 数据库 | **SQLite**(单文件 `prisma/dev.db`) | ✅ 已达 |
| 后端框架 | Express + tRPC | ✅ 保留 |
| tRPC router | 11 个文件,按 4 类组织(user/note/comment/ai) | ✅ 已达 |
| AI Provider | 仅 OpenAI 直连(删 Mastra / MCP / 多 Provider 抽象) | ✅ 保留 |
| Session | 自管 token(替代 next-auth) | ✅ 保留 |
| 前端 | 沿用原版 Blinko UI(224 文件,从 commit `8865949d` 拉回) | ✅ 保留 |
| 桌面端 | 删 Tauri / Tauri 插件 | ✅ 已删 |

---

## 一、精简范围

### 沿用原版(不精简)
- ✅ 前端完整 UI(`app/src/` 224 个文件)
  - HeroUI 组件库 · MobX 状态管理 · framer-motion · Vditor · Iconify
  - 原版侧边栏 `Sidebar` / 笔记卡 `BlinkoCard` / AI 抽屉 `BlinkoAi` / 设置 `BlinkoSettings`
- ✅ 前端技术栈:tRPC Client · React Router 7 · Tailwind 4 · react-i18next · next-themes
- ✅ 前端构建:Vite 5 + vite-plugin-pwa(PWA 保留)
- ✅ 国际化(原 17 国语言文件保留)
- ✅ 共享类型 `shared/lib/types`

### 后端精简(终态)
- ✅ 数据库:**PostgreSQL → SQLite**(单文件 `prisma/dev.db`)
- ✅ ORM:Prisma 保留,schema **18 个 model**(基线 22 删 4 个 0 引用的)
- ✅ AI Provider:6 个 + Mastra 抽象层 → **只保留 OpenAI 直连**
- ✅ 砍:Mastra · MCP · pg-boss · 多 Provider 抽象 · OAuth · S3 存储
- ✅ Session:自管 token(替代 next-auth)

### 业务功能精简
- ❌ 不做 Tauri 桌面端(纯 Web)
- ❌ 不做插件系统
- ❌ 不做附件 / 上传 / 文件存储(notes/attachments 表保留 schema 但不实现上传端点)
- ❌ 不做通知 / 关注 / 分享(follows/notifications/noteInternalShare 表保留 schema 但不实现业务)
- ❌ 不做 MCP 服务
- ❌ 不做音乐设置 / SSO / 主题切换 / 定时任务
- ❌ 不做笔记历史 / 引用 / 双向链接(noteHistory/noteReference 表保留 schema 但不实现业务)

---

## 二、当前精简状态 (2026-09-04)

### 累计 4 个 simplify commit(领先 origin 4 个)

| commit | 内容 |
|---|---|
| `80744273` | revert: 恢复原版 Blinko 基线(后端 + Prisma + 配置) |
| `ffe4ffb6` | 精简后端功能(不动技术栈/UI) |
| `9f51b51d` | 删 Tauri 桌面端 + 部署配置 + vditor 静态资源 |
| `3aca9cdc` | Prisma schema 删除 4 个 0 引用 model(plugin/aiScheduledTask/mcpServers/fonts) |
| `b61a0c5a` | 数据库 PostgreSQL → SQLite |

### 仓库当前结构

```
blinko-homework/
├── app/                          # ✅ 原版 Blinko 前端(从 8865949d 拉回,224 文件)
│   ├── src/
│   │   ├── components/           # 原版 HeroUI + BlinkoCard + BlinkoAi + BlinkoSettings ...
│   │   ├── store/                # 原版 MobX stores
│   │   ├── pages/                # 原版 SignIn / Home / Notes / NoteDetail / Settings ...
│   │   ├── hooks/                # 原版 hooks
│   │   └── lib/                  # 原版 trpc / auth-client / blinkoEndpoint ...
│   ├── public/                   # 原版 logos / icons / locales / fonts
│   └── package.json              # ✅ 原版依赖
├── shared/                       # ✅ 原版共享类型
├── server/                       # ✅ 精简后端
│   ├── index.ts                  # Express + tRPC + cookie + CORS
│   ├── prisma.ts                 # 单例 PrismaClient
│   ├── routerTrpc/               # 11 个 tRPC router 文件
│   │   ├── _app.ts               # 入口(聚合所有 router)
│   │   ├── user.ts               # 分类 1:user
│   │   ├── note.ts               # 分类 2:note
│   │   ├── tag.ts                # 分类 2:note(子模块)
│   │   ├── comment.ts            # 分类 3:comment
│   │   ├── ai.ts                 # 分类 4:ai
│   │   ├── conversation.ts       # 分类 4:ai(子模块)
│   │   ├── message.ts            # 分类 4:ai(子模块)
│   │   ├── config.ts             # 分类 4:ai(子模块:AI 配置)
│   │   ├── public.ts             # 公共端点
│   │   └── stubs.ts              # 桩
│   ├── routerExpress/            # Express router(认证 / openai 代理)
│   ├── middleware/
│   ├── lib/                      # auth / openai / settings
│   ├── aiServer/                 # AI agent 实现
│   └── types/
├── prisma/
│   └── schema.prisma             # ✅ 18 个 model
├── docs/                         # 课设文档(立项书 / 需求规格 / 系统设计)
├── data/settings.json            # ⏳ gitignore,不入库(本地 AI 设置)
├── SIMPLIFIED.md                 # 本文档
├── CLAUDE.md                     # 项目指引
└── package.json                  # root workspaces: server, app
```

### Prisma model 清单(18 个终态)

| # | model | 用途 | 备注 |
|---|---|---|---|
| 1 | `accounts` | 用户账号 | 必留 |
| 2 | `attachments` | 笔记附件 schema | 表保留,业务端点不实现 |
| 3 | `config` | 应用配置(全局) | AI provider / 用户偏好 |
| 4 | `notes` | 笔记 | 核心 |
| 5 | `comments` | 评论 | 核心 |
| 6 | `tag` | 标签 | 核心 |
| 7 | `tagsToNote` | 笔记↔标签多对多 | 必留(否则 tag 关联废) |
| 8 | `noteReference` | 笔记双向引用 schema | 表保留,业务端点不实现 |
| 9 | `follows` | 关注关系 schema | 表保留,业务端点不实现 |
| 10 | `notifications` | 通知 schema | 表保留,业务端点不实现 |
| 11 | `cache` | 缓存 | Mastra 残留,功能下线后未删表 |
| 12 | `conversation` | AI 会话 | 核心 |
| 13 | `message` | AI 消息 | 核心 |
| 14 | `noteHistory` | 笔记历史 schema | 表保留,业务端点不实现 |
| 15 | `noteInternalShare` | 内部分享 schema | 表保留,业务端点不实现 |
| 16 | `session` | 登录会话 | 必留 |
| 17 | `aiProviders` | AI Provider 配置 | 必留(ai router 依赖) |
| 18 | `aiModels` | AI 模型配置 | 必留(ai router 依赖) |

**已删的 4 个 0 引用 model**(从 22 → 18):
- `plugin`(插件系统,已删 Tauri 时一并废)
- `aiScheduledTask`(定时任务,功能下线)
- `mcpServers`(MCP 服务,功能下线)
- `fonts`(字体配置,前端用 Iconify 后未引用)

### tRPC router 清单(11 文件 / 4 分类)

| 分类 | 文件 | 端点(原版) |
|---|---|---|
| **user** | `user.ts` | register / login / logout / me |
| **note** | `note.ts` | list / get / create / update / delete / tags |
| | `tag.ts` | list / upsert / delete |
| **comment** | `comment.ts` | list / add / delete |
| **ai** | `ai.ts` | chat / commentNote |
| | `conversation.ts` | list / create / delete |
| | `message.ts` | 消息列表 / 增删 |
| | `config.ts` | getSettings / updateSettings / testConnection |
| 公共 | `public.ts` | config / oauthProviders |
| 桩 | `stubs.ts` | 测试桩 |
| 入口 | `_app.ts` | 聚合 router |

### 已知问题 / 待解决

#### 🔴 阻塞问题

1. **后端 API 缺口**:原版前端 MobX stores 调用了大量原版 tRPC 端点,当前后端按 4 分类精简,缺:
   - `blinko.list / create / update / delete / updateShare` 等(原版 store 字段)
   - `note.toTodo / attachments / share / reference`(附件/分享/引用业务未实现)
   - `notification.*` / `analytics.*` / `plugin.*`
   
   **方案 A**(扩展后端):逐个补全原版用到的端点,工作量很大
   **方案 B**(限制前端):精简 `app/src/App.tsx` 路由,只显示能用的页面
   **方案 C**(渐进):先让首屏能加载,逐个补端点

2. **Prisma schema 字段缺失**:原版 Note 有 `isRecycle / isShare / metadata / sortOrder` 等字段,精简版可能缺,会导致 Prisma 查询报错。

3. **配置差异**:原版用 next-auth / 多 cookie / OAuth,简化版用自管 session,需确认 `auth-client.ts` 能否工作。

#### 🟡 体验问题

4. 前端重复组件已清理(精简版 AppShell/AIChatBubble/Settings 已删,完全用原版)
5. 原版 HeroUI / MobX / framer-motion / vditor 依赖保留完整

#### 🟢 已完成

- ✅ bun install(原版依赖,含 HeroUI / MobX / framer-motion / vditor / next-themes / i18next)
- ✅ vite-plugin-pwa / workbox-window 已装
- ✅ 共享类型 `shared/lib/types` 已恢复
- ✅ 数据库从 Postgres 迁到 SQLite(`b61a0c5a`)
- ✅ 删 4 个 0 引用 model(`3aca9cdc`)
- ✅ 删 Tauri / 部署 / vditor 静态资源(`9f51b51d`)

---

## 三、下一步建议(供新会话继续)

### 推荐路径:方案 C(渐进补端点)

1. **启动并定位错误**
   ```bash
   cd server && bun run dev    # 后端 :4000
   cd app && bun run dev       # 前端 :5173
   ```
   - 浏览器打开 `http://localhost:5173`
   - 打开 DevTools Console,记录所有 tRPC 报错
   - 把报错端点逐个记录到本文档"待补端点"列表

2. **优先补的端点(高频)**
   - `public.config`(原版 AppProvider 启动会拉)
   - `user.canRegister` / `user.publicKey`
   - `note.list` / `note.create`(统一字段名)

3. **字段补齐**
   - 给 `Note` 加 `isRecycle / isShare / metadata / sortOrder`
   - 给 `Account` 加 `name / image / apiToken / description / loginType / linkAccountId`
   - 否则原版 store 的 Prisma 查询会报"unknown field"

4. **逐个修 store**
   - 原版 `blinkoStore.tsx` 调用了大量端点,优先改 store 调用为 `trpc.x.useQuery()` 直接调用
   - 或者保留 MobX 但 `PromiseState` 后端从 trpc 取数据

### 暂不做(本轮跳过)

- Docker 部署 / Helm chart(原版已删,本课设可只跑 `bun run dev` 演示)
- Tauri 桌面端
- 插件系统
- 笔记附件 / 分享 / 引用 业务实现(schema 表保留,功能待后续)
- 多 OAuth

---

## 四、关键技术细节(供新会话参考)

### 后端入口

```typescript
// server/index.ts
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.get('/health', (_, res) => res.json({ ok: true }));
app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }));
app.listen(4000);
```

### Session 管理

```typescript
// cookie 名 'sid', httpOnly + sameSite=lax, 30 天
// Session { id: token, accountId, expiresAt }
// 过期自动清理
```

### AI 设置

存 `data/settings.json`(gitignored),后端实时读取,前端可在线编辑:
- OpenAI API Key(Base URL, Default Model)
- 两个全局 Prompt(对话 / 评论)
- 优先级:文件 > 环境变量 > 内置默认

### 测试账号

```
用户名: testuser
密码: test1234
```

---

## 五、方向调整记录(供后续会话参考)

### 2026-09-04:放弃 18→6 model 计划,锁定 18 终态

**原计划**(SIMPLIFIED.md 旧版):Prisma model 18→6(Account/Session/Note/Tag/Comment/Conv/Message)

**放弃原因**:目标"6 model"清单漏算了多个核心功能依赖:
- `attachments` — 笔记附件,删了笔记无法上传图片
- `tagsToNote` — note↔tag 多对多 join 表,删了 tag 关联全废
- `noteReference` — Blinko 笔记双向引用核心特色
- `config` — AI 配置存这里,删了 ai router 是空壳
- `aiProviders` + `aiModels` — AI router 配置依赖,删了 AI 功能不可用

按 18→6 硬删会砍掉这些核心能力,产品不可用。

**结论**:
- 维持 **18 个 model 终态**,不再精简
- 业务上"附件 / 引用 / 分享 / 关注 / 通知 / 历史"功能不实现,但 schema 表保留(便于后续扩展)
- 下一步重点:**不删 model**,转去补端点 / 修字段对齐

### 历史方案(已废弃,仅供设计思路参考)

旧版方案目标"6 model + 4 router + 自管 session + SQLite + OpenAI 直连",已实施到 `b61a0c5a` 阶段后被本记录推翻。**只保留实施成功的部分**(SQLite / 自管 session / OpenAI 直连),其他(model 数 / router 数)回到原版精简线。

---

## 六、参考

- 原版仓库:[blinkospace/blinko](https://github.com/blinkospace/blinko) 1.8.8
- 原版 UI 源码:commit `8865949d`(本仓库 git 历史)
- tRPC 文档:https://trpc.io
- Prisma 文档:https://www.prisma.dev/docs
- OpenAI SDK:https://platform.openai.com/docs

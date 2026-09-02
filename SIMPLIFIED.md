# Blinko 课设精简方案(已更新)

> **2026-09-02 修订**:根据用户反馈,本方案调整方向 — **沿用原版 Blinko 的前端 UI 与技术栈**,仅在后端 / 数据模型 / 业务功能上做精简。本文记录当前精简状态,供后续会话继续推进。

---

## 一、精简范围(更新版)

### 沿用原版(不精简)
- ✅ 前端完整 UI(`app/src/` 224 个文件,从 commit `8865949d` 拉回原版)
  - HeroUI 组件库 · MobX 状态管理 · framer-motion · Vditor · Iconify(全量 icons)
  - 原版侧边栏 `Sidebar` / 笔记卡 `BlinkoCard` / AI 抽屉 `BlinkoAi` / 设置 `BlinkoSettings` 等
- ✅ 前端技术栈:tRPC Client · React Router 7 · Tailwind 4 · react-i18next · next-themes
- ✅ 前端构建:Vite 5 + vite-plugin-pwa(PWA 保留)
- ✅ 国际化(原 17 国语言文件保留)

### 后端精简
- ✅ 数据库:PostgreSQL → **SQLite**(单文件 `prisma/dev.db`)
- ✅ ORM:Prisma 保留,schema 裁剪到 **6 个 model**
- ✅ AI Provider:6 个 + Mastra 抽象层 → **只保留 OpenAI 直连**
- ✅ 砍:Mastra · MCP · pg-boss · 多 Provider 抽象 · OAuth · S3 存储
- ✅ 简化:Express + tRPC + 自写的 session 管理(替代原 next-auth)

### 业务功能精简
- ❌ 不做 Tauri 桌面端(纯 Web)
- ❌ 不做插件系统
- ❌ 不做附件 / 上传 / 文件存储
- ❌ 不做通知 / 关注 / 分享
- ❌ 不做 MCP 服务
- ❌ 不做音乐设置 / SSO / 主题切换 / 定时任务
- ❌ 不做笔记历史 / 引用 / 双向链接

---

## 二、当前精简状态(2026-09-02)

### 仓库当前结构

```
blinko-homework/
├── app/                          # ✅ 原版 Blinko 前端(从 8865949d 拉回,224 文件)
│   ├── src/
│   │   ├── components/           # 原版 HeroUI + BlinkoCard + BlinkoAi + BlinkoSettings ...
│   │   ├── store/                # 原版 MobX stores(blinkoStore / aiStore / aiSettingStore / ...)
│   │   ├── pages/                # 原版 SignIn / Home / Notes / NoteDetail / Settings ...
│   │   ├── hooks/                # 原版 useMediaQuery / useQuicknoteHotkey / ...
│   │   └── lib/                  # 原版 trpc / auth-client / blinkoEndpoint ...
│   ├── public/                   # 原版 logos / icons / locales / fonts / manifest.json
│   ├── src-tauri/                # ❌ 已删除(Tauri 桌面端)
│   ├── tauri-plugin-blinko/      # ❌ 已删除
│   └── package.json              # ✅ 原版依赖(已 bun install,1009 包)
├── shared/                       # ✅ 从 8865949d 拉回(共享类型)
├── server/                       # ✅ 精简后端
│   └── src/
│       ├── index.ts              # Express + tRPC + cookie + CORS
│       ├── trpc/
│       │   ├── trpc.ts           # initTRPC + protectedProcedure
│       │   ├── context.ts        # prisma + account + res
│       │   └── routers/          # user / note / comment / ai(只有这 4 个)
│       └── lib/
│           ├── prisma.ts         # 单例 PrismaClient
│           ├── auth.ts           # bcrypt + Session token
│           ├── openai.ts         # OpenAI 单例 + testConnection
│           └── settings.ts       # JSON 文件持久化(API Key / 模型 / Prompt)
├── prisma/
│   └── schema.prisma             # ✅ 6 个 model
├── docs/                         # 课设文档(立项书 / 需求规格 / 系统设计)
├── data/settings.json           # ⏳ gitignore,不入库(本地 AI 设置)
├── SIMPLIFIED.md                 # 本文档
├── CLAUDE.md                     # 项目指引
└── package.json                  # root workspaces: server, app
```

### 已完成的工作(累计)

| 阶段 | 内容 | 提交 |
|---|---|---|
| 1 | 精简后端骨架(Express + tRPC + Prisma + SQLite,6 model) | `1b21a546` |
| 2 | 用户系统(register/login/logout/me) | `1b21a546` |
| 3-4 | 笔记 CRUD + 标签 + 搜索 + 闪念 + Ctrl+Shift+N(精简版前端,**已被原版覆盖**) | `27fa9a1b` |
| 5 | AI 对话 + AI 评论(精简版前端,**已被原版覆盖**) | `c01a8976` |
| 6 | AI 设置页(精简版前端,**已被原版覆盖**) | `15818475` |
| 临时存档 | 当前精简版存档(commit `360f6f23`) | `360f6f23` |
| 当前 | **从 git 拉回原版 app/ + shared/ + bun.lock,装 1009 包** | 未提交 |

### 当前未提交(工作树)

```
A  app/                                       # 224 文件从 git 拉回(替代精简版)
A  shared/                                    # 原版共享类型
M  bun.lock                                   # 原版依赖锁
M  app/src/App.tsx, ... 等所有原版文件         # 替换原精简版
```

### 已知问题 / 待解决

#### 🔴 阻塞问题

1. **后端 API 缺口**:原版前端 MobX stores 调用了大量原版 tRPC 端点,我精简后端只有 4 个 router(user/note/comment/ai),缺:
   - `blinko.list / create / update / delete / updateShare` 等
   - `tag.list / upsert / delete`
   - `note.toTodo / attachments / share / reference`
   - `public.config` / `public.oauthProviders`
   - `user.canRegister` / `user.publicKey`
   - `attachment.*` / `share.*` / `notification.*` / `analytics.*`
   - `config.*` / `plugin.*` 等
   
   **方案 A**(扩展后端):逐个补全原版用到的端点,工作量很大
   **方案 B**(限制前端):精简 App.tsx 路由,只显示能用的页面(笔记 / AI / 设置),其他页面入口隐藏
   **方案 C**(渐进):先让首屏能加载,逐个补端点

2. **配置差异**:原版用 next-auth / 多 cookie / OAuth,我的简化版用 bcrypt + 自管 session。需要确认 `auth-client.ts` 等能否工作。

3. **Prisma schema 字段缺失**:原版 Note 有 `isRecycle / isShare / metadata` 等字段,我精简版只有基础字段,会导致 Prisma 查询报错。

#### 🟡 体验问题

4. **AI 设置页重复**:原版已经有 `BlinkoSettings/AiSetting/`,我自己写的 `pages/Settings.tsx` 已无意义。
5. **侧边栏 / AI 抽屉重复**:原版有 `Layout/Sidebar.tsx` 和 `BlinkoAi/aiChatBox.tsx`,我自己写的 `AppShell.tsx` 和 `AIChatBubble.tsx` 已无意义。
6. **Home / Notes / NoteDetail / QuickNote / SignIn 页重复**:原版都有,我的精简版被覆盖。

#### 🟢 已完成

- ✅ bun install(1009 包,含 HeroUI / MobX / framer-motion / vditor / next-themes / i18next)
- ✅ vite-plugin-pwa / workbox-window 已装
- ✅ 共享类型 `shared/lib/types` 已恢复

---

## 三、下一步建议(供新会话继续)

### 推荐路径:方案 A(渐进补端点)

1. **启动并定位错误**
   ```bash
   cd server && bun run dev    # 后端 :4000
   cd app && bun run dev       # 前端 :5173
   ```
   - 浏览器打开 `http://localhost:5173`
   - 打开 DevTools Console,记录所有 tRPC 报错
   - 把报错端点逐个记录到本文件"待补端点"列表

2. **优先补的端点(高频)**
   - `blinko.list` / `note.list`(可能已经叫 note.list,需统一)
   - `public.config`(原版 AppProvider 启动会拉)
   - `user.canRegister` / `user.publicKey`
   - `tag.*`(CRUD)

3. **字段补齐**
   - 给 `Note` 加 `isRecycle / isShare / metadata / sortOrder`
   - 给 `Account` 加 `name / image / apiToken / description / loginType / linkAccountId`
   - 否则原版 store 的 Prisma 查询会报"unknown field"

4. **逐个修 store**
   - 原版 `blinkoStore.tsx` 调用了大量端点,优先改 store 调用为 `trpc.x.useQuery()` 直接调用(去掉 MobX 中间层)
   - 或者保留 MobX 但 `PromiseState` 后端从 trpc 取数据

### 备选路径:方案 B(限制前端)

1. 改 `app/src/App.tsx` 路由配置,只保留:
   - `/signin`(用原版,但需要 auth-client.ts 兼容)
   - `/`(笔记列表)
   - `/notes/:id`
   - `/quick`
   - `/ai`
   - `/settings`
2. 改 `app/src/components/Layout/Sidebar.tsx` 隐藏设置项外的菜单
3. 删除不需要的 `BlinkoSettings/*` 等组件引用

### 暂不做(本轮跳过)

- Docker 部署 / Helm chart(原版已删,本课设可只跑 `bun run dev` 演示)
- Tauri 桌面端
- 插件系统
- 笔记附件 / 分享
- 多 OAuth

---

## 四、关键技术细节(供新会话参考)

### 后端入口

```typescript
// server/src/index.ts
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

### tRPC router(4 个)

| Router | 端点 |
|---|---|
| `user` | register / login / logout / me |
| `note` | list / get / create / update / delete / tags |
| `comment` | list / add / delete |
| `ai` | conversations / createConversation / deleteConversation / messages / chat / commentNote / getSettings / updateSettings / testConnection |

### Prisma schema(6 model)

`Account` / `Session` / `Note(type 0=笔记 1=闪念, archived, top)` / `Tag(accountId+name 唯一)` / `Comment(isAI, accountId?)` / `Conversation` / `Message`

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

## 五、参考

- 原版仓库:[blinkospace/blinko](https://github.com/blinkospace/blinko) 1.8.8
- 原版 UI 源码:commit `8865949d`(本仓库 git 历史)
- tRPC 文档:https://trpc.io
- Prisma 文档:https://www.prisma.dev/docs
- OpenAI SDK:https://platform.openai.com/docs

# 05 · Docker 部署

> 阶段 6：把 Blinko-Lite 打包成单容器镜像，多架构（`linux/amd64` + `linux/arm64`），通过 GitHub Actions 自动构建并发布到 GitHub Container Registry。

## 一、产物

| 类型         | 名称 / 路径                                              | 备注                                                                 |
|--------------|----------------------------------------------------------|----------------------------------------------------------------------|
| 镜像清单     | `ghcr.io/su-qingmu/blinko-homework:1.0`                  | 多架构 manifest list，`docker pull` 自动按当前机器架构挑选变体        |
| 镜像标签     | `1.0` · `1` · `latest`                                  | 由 GitHub Actions 按 semver 规则生成                                  |
| Docker Compose | `docker-compose.yml`                                    | 单文件，含卷、健康检查、环境变量示例                                 |
| 健康检查     | `GET /health` → 200                                     | 30s 间隔，失败 3 次判不健康                                          |

## 二、本地启动（不写一行代码）

```bash
# 1. 拉取最新镜像
docker pull ghcr.io/su-qingmu/blinko-homework:1.0

# 2. 启动（SQLite 数据落在命名卷 blinko-data，删容器不丢数据）
docker compose up -d

# 3. 看日志
docker compose logs -f

# 4. 打开浏览器
#    http://localhost:1111
```

替换 `docker-compose.yml` 里的镜像版本即可升级：

```bash
docker compose pull && docker compose up -d
```

## 三、自定义环境变量

通过项目根目录的 `.env` 文件（与 `docker-compose.yml` 同级）覆盖默认值：

```dotenv
# 端口映射（主机:容器）
BLINKO_PORT=1111

# 公网地址 · 反向代理场景改成 https://blinko.example.com
NEXTAUTH_URL=http://localhost:1111
NEXT_PUBLIC_BASE_URL=http://localhost:1111

# 必改：用 openssl rand -hex 32 生成
NEXTAUTH_SECRET=please-change-me-to-a-random-string

# 阶段 5 AI · 留空则禁用 AI
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

然后 `docker compose up -d` 会自动加载。

## 四、平台对照表

| 架构         | 适用场景                                                  | 备注                                       |
|--------------|-----------------------------------------------------------|--------------------------------------------|
| `linux/amd64` | Windows 11（Docker Desktop）· x86 Linux · Intel macOS    | 镜像变体自动选中，无需 `--platform`         |
| `linux/arm64` | Apple Silicon Docker · 树莓派 · AWS Graviton · 飞腾 / 鲲鹏 | Windows on ARM 同样通过 QEMU 兼容           |

Windows 11 装好 Docker Desktop 后，`docker pull` 拿到的就是 `linux/amd64` 变体，**无需任何特殊参数**。

## 五、GitHub Actions 自动化

文件：`.github/workflows/release.yml`

触发方式：

1. **打 tag 推送**（推荐）—— 在 main 分支执行：

   ```bash
   git tag v1.0
   git push origin v1.0
   ```

   流程：buildx + QEMU 并行构建 `linux/amd64` + `linux/arm64` → 推送到 ghcr.io → 创建同名 GitHub Release（自动生成 changelog）。

2. **手动触发** —— `Actions` 页 → `Release` → `Run workflow`，输入要发布的 tag（如 `1.0` 或 `latest`），用于强制重建缓存。

镜像标签规则（`v1.0` 推送后）：

| 标签            | 指向                                                       |
|-----------------|------------------------------------------------------------|
| `1.0`           | 此次发布对应的多架构清单                                    |
| `1`             | 主版本号最新（同一主版本下后续 `v1.x` 也会更新这个标签）    |
| `latest`        | 主分支最近一次发布的快照                                    |

## 六、架构说明

```
┌─────────────────────────────────────────────────────────────┐
│ GitHub Actions (ubuntu-latest)                              │
│  ┌──────────────┐    ┌─────────────────────────────────────┐ │
│  │  docker     │    │   docker/buildx (QEMU)               │ │
│  │  setup-qemu │───▶│                                     │ │
│  └──────────────┘    │   ┌───────────┐  ┌───────────┐      │ │
│                      │   │ linux/amd64│  │linux/arm64│      │ │
│                      │   └─────┬─────┘  └─────┬─────┘      │ │
│                      │         ▼              ▼            │ │
│                      │   ┌─────────────────────────┐       │ │
│                      │   │  multi-arch manifest list│       │ │
│                      │   └────────────┬────────────┘       │ │
│                      └────────────────┼────────────────────┘ │
└───────────────────────────────────┼─────────────────────────┘
                                    ▼
                ghcr.io/su-qingmu/blinko-homework:1.0
                ghcr.io/su-qingmu/blinko-homework:1
                ghcr.io/su-qingmu/blinko-homework:latest

        用户侧（Windows 11 / Linux / macOS）：
        $ docker compose up -d
        → 自动选架构 → 端口 1111 → 浏览器访问 http://localhost:1111
```

### 关键技术点

1. **多阶段构建**
   - `builder`：`oven/bun:1`（含 g++ / python3，原生模块编译用）
   - `runner`：`oven/bun:1-slim`（仅含 openssl / wget / tini，最终 ~500MB）

2. **原生模块跨平台**
   - `schema.prisma` 已配 `binaryTargets = [..., linux-arm64-openssl-3.0.x, ...]`
   - `bun install` 自动按当前 buildx 架构下载 `sqlite3` / `sharp` / `@libsql/*` 的 prebuilt 二进制
   - QEMU 在 GitHub Actions 端透明处理，无需本地工具链

3. **数据持久化**
   - `DATABASE_URL=file:/app/data/dev.db`（容器内路径）
   - 命名卷 `blinko-data` 挂载到 `/app/data`，容器重建不丢数据

4. **进程模型**
   - `tini` 作为 PID 1，正确转发 SIGTERM（容器停止时优雅退出）
   - `HEALTHCHECK` 每 30s 访问 `/health`，Docker Compose 据此滚动重启

5. **安全**
   - 非 root 用户（`blinko:1001`）运行应用
   - `provenance: false` 避免在公开镜像里泄露构建链路

## 七、常见问题

**Q1. 启动报 `prisma migrate deploy` 失败？**
A: 大概率是旧版 DB 与新迁移冲突。`docker-entrypoint.sh` 会 fallback 到 `prisma db push --accept-data-loss`。如果还失败，看 `docker compose logs blinko` 顶部。

**Q2. 镜像很大（~500MB）？**
A: 主要是 `node_modules` + 原生模块二进制。可优化点（暂未实施）：
- 多阶段剥离 devDependencies
- 用 `bun build --compile` 编译成单文件二进制（实测兼容性有坑，未启用）

**Q3. Windows 11 上拉镜像慢？**
A: 首次拉取 ~200MB。开启 Docker Desktop 的镜像加速配置（Settings → Docker Engine）。

**Q4. 怎么升级？**
A: 编辑 `docker-compose.yml` 的 image tag → `docker compose pull && docker compose up -d`。数据卷不动。

**Q5. AI 不可用？**
A: 在 `.env` 填 `OPENAI_API_KEY` 后重启 `docker compose up -d`。留空时 AI 接口返回 503，前端正常降级。

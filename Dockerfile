# Blinko - 生产模式 Docker 部署
# 使用 oven/bun 官方镜像（预装 bun + node）
FROM oven/bun:1.2.8-alpine AS base

WORKDIR /app

# 只复制关键文件，减少传输大小
COPY package.json bun.lock* ./
COPY app/package.json ./app/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY prisma ./prisma/
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY tsconfig.blinko.json ./

# 安装依赖（不用 --frozen-lockfile，允许 bun 自动同步 lockfile）
RUN bun install --ignore-scripts

# 生成 Prisma client
RUN cd prisma && bunx prisma generate

# 复制应用代码
COPY . .

# 构建前端
RUN cd app && NODE_OPTIONS="--max-old-space-size=4096" bunx vite build

# 构建后端
RUN cd server && bun run esbuild.config.ts

# 复制静态资源到 server/public
RUN mkdir -p server/public && cp -r dist/public/* server/public/

# 生产环境
FROM oven/bun:1.2.8-alpine AS production

WORKDIR /app

# 安装 curl（healthcheck）
RUN apk add --no-cache curl

# 复制构建产物
COPY --from=base /app/dist ./dist
COPY --from=base /app/server ./server
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=base /app/.env.tmpl ./.env

# 创建数据目录
RUN mkdir -p /app/.blinko/prisma && chmod 777 /app/.blinko

# 暴露端口
EXPOSE 1111

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:1111/api/health || exit 1

# 启动生产服务器
CMD ["bun", "run", "start"]

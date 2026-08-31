/**
 * tRPC 客户端（React Query 适配）
 *
 * 类型来自 server 端 AppRouter，确保前后端类型贯通。
 * dev 阶段走 Vite 代理 /trpc → 后端 :4000；生产走同源（nginx 反代）。
 */
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../server/src/trpc/routers';

export const trpc = createTRPCReact<AppRouter>();

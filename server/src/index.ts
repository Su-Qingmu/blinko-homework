import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { createContext } from './trpc/context.js';
import { appRouter } from './trpc/routers/index.js';

const PORT = Number(process.env.PORT) || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true, // 允许跨域发送 cookie
  }),
);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'blinko-lite-server', ts: Date.now() });
});

app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ error, path }) => {
      console.error(`[trpc] ${path}:`, error.message);
    },
  }),
);

app.listen(PORT, () => {
  console.log(`✅ Server:  http://localhost:${PORT}`);
  console.log(`   tRPC:    http://localhost:${PORT}/trpc`);
  console.log(`   CORS:    ${CLIENT_ORIGIN}`);
});

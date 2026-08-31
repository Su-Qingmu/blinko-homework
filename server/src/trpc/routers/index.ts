import { router } from '../trpc.js';
import { userRouter } from './user.js';
import { noteRouter } from './note.js';
import { commentRouter } from './comment.js';
import { aiRouter } from './ai.js';

export const appRouter = router({
  user: userRouter,
  note: noteRouter,
  comment: commentRouter,
  ai: aiRouter,
});

export type AppRouter = typeof appRouter;

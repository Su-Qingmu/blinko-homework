/**
 * AI 对话 router（流式 + 自动评论）- 阶段5 实现
 * 当前为占位。
 */
import { router, protectedProcedure } from '../trpc.js';

export const aiRouter = router({
  placeholder: protectedProcedure.query(() => {
    return { ok: true, stage: 5, message: 'ai router 待阶段5 实现' };
  }),
});

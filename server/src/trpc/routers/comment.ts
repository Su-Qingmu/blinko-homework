/**
 * 评论 router（含 AI 评论触发）- 阶段4 实现
 * 当前为占位。
 */
import { router, protectedProcedure } from '../trpc.js';

export const commentRouter = router({
  placeholder: protectedProcedure.query(() => {
    return { ok: true, stage: 4, message: 'comment router 待阶段4 实现' };
  }),
});

/**
 * 笔记 / 闪念 router - 阶段3 实现
 * 当前为占位，阶段1+2 仅保证 tRPC 调用链路通畅。
 */
import { router, protectedProcedure } from '../trpc.js';

export const noteRouter = router({
  placeholder: protectedProcedure.query(() => {
    return { ok: true, stage: 3, message: 'note router 待阶段3 实现' };
  }),
});

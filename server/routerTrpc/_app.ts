/**
 * This file contains the root router of your tRPC-backend
 */
import { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { router, t } from '../middleware';
import { Context } from '../context';
import { lazy } from '@trpc/server';
import { noteRouter } from './note';
import { configRouter } from './config';
import { aiRouter } from './ai';
import { tagRouter } from './tag';
import { userRouter } from './user';
import { commentRouter } from './comment';
import { conversationRouter } from './conversation';
import { publicRouter } from './public';
import { messageRouter } from './message';
// 协作模块 (新增 5 个 router,Phase 1)
import { teamRouter } from './team';
import { teamMemberRouter } from './teamMember';
import { inviteRouter } from './invite';
import { activityRouter } from './activity';
import { teamNoteRouter } from './teamNote';
import {
  notificationRouter, fontRouter, analyticsRouter, mcpServersRouter,
  aiScheduledTaskRouter, pluginRouter, followsRouter, attachmentsRouter, taskRouter,
} from './stubs';
export const appRouter = router({
  ai: aiRouter,
  notes: noteRouter,
  tags: tagRouter,
  users: userRouter,
  config: configRouter,
  public: publicRouter,
  comments: commentRouter,
  conversation: conversationRouter,
  message: messageRouter,
  // 协作模块 (Phase 1)
  team: teamRouter,
  teamMember: teamMemberRouter,
  invite: inviteRouter,
  activity: activityRouter,
  teamNote: teamNoteRouter,
  // Stubs to satisfy AppRouter type; procedures return empty/null at runtime
  attachments: attachmentsRouter,
  follows: followsRouter,
  notifications: notificationRouter,
  plugin: pluginRouter,
  aiTask: aiScheduledTaskRouter,
  analytics: analyticsRouter,
  mcpServers: mcpServersRouter,
  fonts: fontRouter,
  task: taskRouter,
});

export const createCaller = t.createCallerFactory(appRouter);

//not recommend to use this
export const adminCaller = createCaller({ id: '1', name: 'admin', sub: '1', role: 'superadmin', exp: 0, iat: 0 });

export const userCaller = (ctx: Context) => {
  return createCaller(ctx);
};

export type AppRouter = typeof appRouter;
export type RouterOutput = inferRouterOutputs<AppRouter>;
export type RouterInput = inferRouterInputs<AppRouter>;

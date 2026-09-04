/**
 * Stub routers for simplified build.
 *
 * The original Blinko backend had these routers (attachments, follows,
 * notifications, plugin, aiTask, analytics, mcpServers, fonts) but they
 * are out of scope for the course project. We keep empty router stubs so
 * the frontend AppRouter type still resolves and the UI doesn't break
 * the build. Calls to these procedures return empty defaults at runtime.
 */
import { z } from 'zod';
import { router, publicProcedure, authProcedure } from '../middleware';

const empty = router({
  placeholder: publicProcedure.query(() => null),
});

const noteAction = router({
  list: publicProcedure.query(() => []),
});

// notifRouter 桩:通知功能在精简版下线,返回空列表
const notifRouter = router({
  list: publicProcedure.query(() => [] as any[]),
  unreadCount: publicProcedure.query(() => 0),
  markRead: publicProcedure.input(z.any()).mutation(() => true),
  markAllRead: publicProcedure.input(z.any()).mutation(() => true),
  delete: publicProcedure.input(z.any()).mutation(() => true),
});
const fontRouter = empty;
const analyticsRouter = empty;
const mcpServersRouter = empty;
const aiScheduledTaskRouter = empty;
// pluginRouter 桩实现:返回空列表,避免前端 store 调用报 NOT_FOUND
// plugin 功能在精简版中下线(原 plugin model 已删)
const pluginRouter = router({
  getInstalledPlugins: publicProcedure.query(() => [] as any[]),
  getAllPlugins: publicProcedure.query(() => [] as any[]),
  getPluginCssContents: publicProcedure.input(z.object({ pluginName: z.string() })).query(() => ''),
  saveDevPlugin: publicProcedure.input(z.any()).mutation(() => true),
  saveAdditionalDevFile: publicProcedure.input(z.any()).mutation(() => true),
  installPlugin: publicProcedure.input(z.any()).mutation(() => true),
  uninstallPlugin: publicProcedure.input(z.object({ id: z.number() })).mutation(() => true),
  getPluginSettings: publicProcedure.input(z.object({ pluginName: z.string() })).query(() => ({})),
  savePluginSettings: publicProcedure.input(z.any()).mutation(() => true),
});
const followsRouter = empty;
const attachmentsRouter = noteAction;
const taskRouter = noteAction;

export {
  notifRouter as notificationRouter,
  fontRouter,
  analyticsRouter,
  mcpServersRouter,
  aiScheduledTaskRouter,
  pluginRouter,
  followsRouter,
  attachmentsRouter,
  taskRouter,
};
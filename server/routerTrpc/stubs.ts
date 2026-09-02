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

const notifRouter = empty;
const fontRouter = empty;
const analyticsRouter = empty;
const mcpServersRouter = empty;
const aiScheduledTaskRouter = empty;
const pluginRouter = empty;
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
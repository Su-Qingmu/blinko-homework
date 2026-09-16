import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authProcedure } from '../middleware';
import { prisma } from '../prisma';

/**
 * 统计 router
 * - dailyNoteCount: 近 12 个月的每日新增笔记数(热力图用)
 * - monthlyStats: 指定月份的汇总统计(统计卡片用)
 *
 * 全部按当前登录用户 accountId 过滤
 */

const stripMarkdown = (s: string): string => {
  if (!s) return '';
  // 去掉代码块、行内代码、链接、图片、HTML 标签、Markdown 符号,粗略估算字数
  return s
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const countWords = (s: string): number => {
  // 中日韩按字符计,英文按词计(混合时取较大值)
  if (!s) return 0;
  const stripped = stripMarkdown(s);
  const cjk = (stripped.match(/[一-鿿぀-ヿ가-힯]/g) || []).length;
  const en = (stripped.match(/[A-Za-z0-9]+/g) || []).length;
  return Math.max(cjk, en);
};

const monthRange = (yyyyMm: string): { start: Date; end: Date } => {
  const [y, m] = yyyyMm.split('-').map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0); // 下个月 1 号(开区间)
  return { start, end };
};

const ymdKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const analyticsRouter = router({
  /**
   * 近 12 个月每天的新增笔记数。
   * 用于热力图(HeatMap)。已排除回收站里的笔记。
   */
  dailyNoteCount: authProcedure
    .mutation(async ({ ctx }) => {
      const accountId = Number(ctx.id);
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

      const rows = await prisma.notes.findMany({
        where: {
          accountId,
          isRecycle: false,
          createdAt: { gte: start, lt: end },
        },
        select: { createdAt: true },
      });

      // 聚合到 YYYY-MM-DD
      const counts = new Map<string, number>();
      for (const r of rows) {
        const key = ymdKey(r.createdAt);
        counts.set(key, (counts.get(key) || 0) + 1);
      }

      return Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));
    }),

  /**
   * 指定月份的汇总统计。
   * input.month = "YYYY-MM"
   */
  monthlyStats: authProcedure
    .input(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .mutation(async ({ ctx, input }) => {
      const accountId = Number(ctx.id);
      const { start, end } = monthRange(input.month);

      // 一次查出当月所有笔记(含 content 用于字数)
      const notes = await prisma.notes.findMany({
        where: {
          accountId,
          isRecycle: false,
          createdAt: { gte: start, lt: end },
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          tags: {
            select: {
              tag: { select: { id: true, name: true } },
            },
          },
        },
      });

      // 字数与峰值
      let totalWords = 0;
      let maxDailyWords = 0;
      const dailyWords = new Map<string, number>();
      const activeDaysSet = new Set<string>();

      for (const n of notes) {
        const w = countWords(n.content || '');
        totalWords += w;
        const key = ymdKey(n.createdAt);
        activeDaysSet.add(key);
        dailyWords.set(key, (dailyWords.get(key) || 0) + w);
      }
      for (const w of dailyWords.values()) {
        if (w > maxDailyWords) maxDailyWords = w;
      }

      // 标签统计:同一笔记内同标签去重
      const tagCounts = new Map<string, { tagName: string; count: number }>();
      for (const n of notes) {
        const tagIds = new Set<number>();
        for (const t of n.tags) {
          if (t.tag && !tagIds.has(t.tag.id)) {
            tagIds.add(t.tag.id);
            const cur = tagCounts.get(t.tag.name);
            if (cur) cur.count += 1;
            else tagCounts.set(t.tag.name, { tagName: t.tag.name, count: 1 });
          }
        }
      }
      const tagStats = Array.from(tagCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      return {
        noteCount: notes.length,
        totalWords,
        maxDailyWords,
        activeDays: activeDaysSet.size,
        tagStats,
      };
    }),
});
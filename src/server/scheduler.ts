// تشغيل مهام الخلفية بنبضة كل دقيقة بدل العامل الدائم (للاستضافة المجانية):
// Supabase تستدعي /api/v1/internal/tick كل دقيقة عبر pg_cron، فتُشغَّل المهام
// المستحقة في تلك الدقيقة حسب جدولها نفسه في JOBS. كل مهمة تحجز خانة دقيقتها
// في job_runs أولاً، فلا تتكرر إن وصلت نبضتان في الدقيقة نفسها.
import { and, desc, eq } from 'drizzle-orm';
import { asSystem } from './db/client';
import { jobRuns } from './db/schema';
import { JOBS } from './jobs';

type JobName = keyof typeof JOBS;

function fieldMatches(field: string, value: number): boolean {
  return field.split(',').some((part) => {
    if (part === '*') return true;
    const step = part.match(/^\*\/(\d+)$/);
    if (step) return value % Number(step[1]) === 0;
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) return value >= Number(range[1]) && value <= Number(range[2]);
    return Number(part) === value;
  });
}

/** يطابق تعبير cron من خمس خانات مع دقيقة بتوقيت UTC */
export function cronMatches(expr: string, d: Date): boolean {
  const [min, hour, dom, mon, dow] = expr.trim().split(/\s+/);
  return (
    fieldMatches(min, d.getUTCMinutes()) &&
    fieldMatches(hour, d.getUTCHours()) &&
    fieldMatches(dom, d.getUTCDate()) &&
    fieldMatches(mon, d.getUTCMonth() + 1) &&
    fieldMatches(dow, d.getUTCDay())
  );
}

export type TickResult = Record<string, { ok: boolean; result?: unknown; error?: string } | 'skipped'>;

/** يشغّل المهام المستحقة في دقيقة now (أو المحددة بالاسم دون النظر لجدولها) */
export async function runDue(now = new Date(), only?: JobName[]): Promise<TickResult> {
  const slot = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const out: TickResult = {};
  for (const [name, job] of Object.entries(JOBS) as [JobName, (typeof JOBS)[JobName]][]) {
    if (only ? !only.includes(name) : !cronMatches(job.cron, slot)) continue;
    const claimed = await asSystem(null, (tx) => tx.insert(jobRuns).values({ name, slot }).onConflictDoNothing().returning({ name: jobRuns.name }));
    if (!claimed.length) {
      out[name] = 'skipped';
      continue;
    }
    try {
      const result = await job.run();
      await asSystem(null, (tx) =>
        tx.update(jobRuns).set({ finishedAt: new Date(), ok: true, result: result as object }).where(and(eq(jobRuns.name, name), eq(jobRuns.slot, slot))),
      );
      out[name] = { ok: true, result };
    } catch (e) {
      const error = (e as Error).message.slice(0, 500);
      await asSystem(null, (tx) => tx.update(jobRuns).set({ finishedAt: new Date(), ok: false, error }).where(and(eq(jobRuns.name, name), eq(jobRuns.slot, slot))));
      out[name] = { ok: false, error };
    }
  }
  return out;
}

/** آخر تشغيل لكل مهمة (للوحة الإدارة: هل النبضة تعمل؟) */
export async function lastRuns() {
  return asSystem(null, async (tx) => {
    const rows = await tx
      .selectDistinctOn([jobRuns.name], { name: jobRuns.name, at: jobRuns.startedAt, ok: jobRuns.ok, error: jobRuns.error })
      .from(jobRuns)
      .orderBy(jobRuns.name, desc(jobRuns.startedAt));
    return rows;
  });
}

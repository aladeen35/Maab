// صفحة الإعدادات في الإدارة: حالة التشغيل (القنوات، النبضة، التخزين، ربط
// Google) وحسابات الاستلام التي تظهر لولي الأمر عند الدفع.
import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import { notFound } from '../api/http';
import { assertCan, type Viewer } from '../api/route';
import { channelReady, loginMethods } from '../auth/methods';
import { asSystem } from '../db/client';
import { meetings, paymentAccounts, sessions } from '../db/schema';
import { env } from '../env';
import { lastRuns } from '../scheduler';
import { audit } from './audit';
import { googleConfigured, redirectUri } from './google';
import { googleMeetLink } from './integrations';

export type PaymentAccountRow = typeof paymentAccounts.$inferSelect;

export async function systemStatus(viewer: Viewer) {
  assertCan(viewer, 'settings.manage');
  const e = env();
  const [google, runs, accounts] = await Promise.all([
    googleMeetLink(),
    lastRuns(),
    asSystem(viewer.userId, (tx) => tx.select().from(paymentAccounts).orderBy(asc(paymentAccounts.sort), asc(paymentAccounts.createdAt))),
  ]);
  const tick = runs.find((r) => r.name === 'outbox');
  return {
    appUrl: e.APP_URL,
    login: loginMethods(),
    email: { ready: channelReady('email') && e.EMAIL_DRIVER === 'smtp', from: e.EMAIL_FROM },
    whatsapp: e.WHATSAPP_DRIVER === 'meta' && channelReady('whatsapp'),
    storage: e.STORAGE_DRIVER,
    tick: tick ? { at: tick.at.toISOString(), ok: tick.ok !== false } : null,
    jobs: runs.map((r) => ({ name: r.name, at: r.at.toISOString(), ok: r.ok, error: r.error })),
    google: {
      configured: googleConfigured(),
      connected: Boolean(google),
      email: google?.email ?? null,
      scopes: google?.scopes ?? [],
      redirectUri: redirectUri(),
      origin: e.APP_URL,
    },
    accounts: accounts.map((a) => ({
      id: a.id,
      method: a.method,
      currency: a.currency,
      title: a.titleAr,
      bankName: a.bankName,
      accountName: a.accountName,
      accountNumber: a.accountNumber,
      instructions: a.instructionsAr ?? '',
      active: a.active,
    })),
  };
}

export type SystemStatus = Awaited<ReturnType<typeof systemStatus>>;

/** بعد ربط Google: روابط الحصص القادمة التي أنشأها المزوّد الوهمي تُعاد إنشاؤها */
export async function regenerateMockLinks(viewer: Viewer, ip?: string | null) {
  assertCan(viewer, 'settings.manage');
  return asSystem(viewer.userId, async (tx) => {
    const upcoming = await tx
      .select({ id: meetings.id })
      .from(meetings)
      .innerJoin(sessions, eq(sessions.id, meetings.sessionId))
      .where(and(eq(meetings.provider, 'mock'), eq(sessions.status, 'scheduled'), gt(sessions.endsAt, new Date())));
    if (!upcoming.length) return { queued: 0 };
    await tx
      .update(meetings)
      .set({ status: 'pending', attempts: 0, externalEventId: null, joinUrl: null, lastError: null })
      .where(inArray(meetings.id, upcoming.map((m) => m.id)));
    await audit(tx, viewer, { action: 'meetings.regenerate', entity: 'meetings', after: { count: upcoming.length } }, ip);
    return { queued: upcoming.length };
  });
}

export type PaymentAccountInput = {
  method: PaymentAccountRow['method'];
  currency: PaymentAccountRow['currency'];
  title: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions?: string | null;
  active: boolean;
};

export async function savePaymentAccount(viewer: Viewer, id: string | null, input: PaymentAccountInput, ip?: string | null) {
  assertCan(viewer, 'prices.manage');
  const values = {
    method: input.method,
    currency: input.currency,
    titleAr: input.title,
    bankName: input.bankName,
    accountName: input.accountName,
    accountNumber: input.accountNumber,
    instructionsAr: input.instructions?.trim() || null,
    active: input.active,
    updatedAt: new Date(),
  };
  return asSystem(viewer.userId, async (tx) => {
    const [before] = id ? await tx.select().from(paymentAccounts).where(eq(paymentAccounts.id, id)) : [];
    if (id && !before) throw notFound('الحساب');
    const [row] = id
      ? await tx.update(paymentAccounts).set(values).where(eq(paymentAccounts.id, id)).returning()
      : await tx.insert(paymentAccounts).values(values).returning();
    await audit(tx, viewer, { action: id ? 'payment_account.update' : 'payment_account.create', entity: 'payment_accounts', entityId: row.id, before: before ?? null, after: row }, ip);
    return { id: row.id };
  });
}

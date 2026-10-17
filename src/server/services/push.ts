// إشعارات الجهاز (Web Push، القسم 11): مجانية وتصل لتطبيق أندرويد والمتصفح.
// مفاتيح VAPID تُولَّد تلقائياً عند أول استعمال وتُحفظ مشفّرة، فلا تحتاج ضبطاً.
import { and, eq, inArray, sql } from 'drizzle-orm';
import webpush from 'web-push';
import type { Viewer } from '../api/route';
import { asSystem, type Tx } from '../db/client';
import { pushSubscriptions } from '../db/schema';
import { env } from '../env';
import { getIntegration, seal, setIntegration, unseal } from './integrations';

type Vapid = { publicKey: string; privateKey: string };

let cached: Vapid | undefined;

export async function vapid(): Promise<Vapid> {
  if (cached) return cached;
  cached = await asSystem(null, async (tx) => {
    const row = await getIntegration<{ publicKey: string; privateKey: string }>(tx, 'vapid');
    if (row) return { publicKey: row.publicKey, privateKey: unseal(row.privateKey) };
    const keys = webpush.generateVAPIDKeys();
    // نسختان متزامنتان: الأولى تُحفظ والثانية تقرأ ما حُفظ
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('vapid'))`);
    const again = await getIntegration<{ publicKey: string; privateKey: string }>(tx, 'vapid');
    if (again) return { publicKey: again.publicKey, privateKey: unseal(again.privateKey) };
    await setIntegration(tx, 'vapid', { publicKey: keys.publicKey, privateKey: seal(keys.privateKey) }, null);
    return keys;
  });
  return cached;
}

export async function subscribe(viewer: Viewer, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent: string | null) {
  await asSystem(viewer.userId, (tx) =>
    tx
      .insert(pushSubscriptions)
      .values({ userId: viewer.userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 300) ?? null })
      // الجهاز نفسه قد ينتقل لحساب آخر بعد تسجيل الخروج
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: viewer.userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, failures: 0 } }),
  );
  return { subscribed: true };
}

export async function unsubscribe(viewer: Viewer, endpoint: string) {
  await asSystem(viewer.userId, (tx) => tx.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, viewer.userId), eq(pushSubscriptions.endpoint, endpoint))));
  return { subscribed: false };
}

export async function hasDevices(tx: Tx, userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  const rows = await tx.selectDistinct({ userId: pushSubscriptions.userId }).from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  return new Set(rows.map((r) => r.userId));
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

/** يرسل لكل أجهزة المستخدم؛ الاشتراك المنتهي (404/410) يُحذف. يعيد عدد ما وصل */
export async function sendPush(tx: Tx, userId: string, payload: PushPayload): Promise<number> {
  const subs = await tx.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (!subs.length) return 0;
  const keys = await vapid();
  const contact = env().GMAIL_USER ? `mailto:${env().GMAIL_USER}` : env().APP_URL;
  let delivered = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { vapidDetails: { subject: contact.startsWith('http://localhost') ? 'mailto:dev@example.com' : contact, publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 6 * 3600, urgency: 'high' },
      );
      delivered++;
      await tx.update(pushSubscriptions).set({ failures: 0, lastSuccessAt: new Date() }).where(eq(pushSubscriptions.id, s.id));
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410 || s.failures >= 4) await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
      else await tx.update(pushSubscriptions).set({ failures: s.failures + 1 }).where(eq(pushSubscriptions.id, s.id));
    }
  }
  return delivered;
}

/** رابط الشاشة المناسبة لكل حدث عند الضغط على الإشعار */
export function linkFor(event: string, data: Record<string, unknown> | null | undefined): string {
  const d = data ?? {};
  switch (event) {
    case 'report_ready':
      return d.reportId ? `/guardian/reports/${d.reportId}` : '/guardian';
    case 'payment_approved':
    case 'payment_rejected':
      return '/guardian/payments';
    case 'payment_submitted':
      return '/admin/payments';
    case 'juz_completed':
    case 'certificate_issued':
      return d.code ? `/c/${d.code}` : '/guardian/progress';
    case 'application_update':
      return '/teacher';
    case 'report_late':
      return '/teacher';
    default:
      return '/guardian/notifications';
  }
}

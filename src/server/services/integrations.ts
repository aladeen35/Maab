// ربط الخدمات الخارجية من لوحة الإدارة بدل متغيرات البيئة: حساب Google
// للحصص ومفاتيح إشعارات الجهاز. تُحفظ في جدول integrations الذي لا يصله إلا
// النظام، والأسرار فيه مشفّرة بـAES-256-GCM بمفتاح مشتق من AUTH_SECRET.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { asSystem, type Tx } from '../db/client';
import { integrations } from '../db/schema';
import { authSecret } from '../env';

const key = () => createHash('sha256').update(`${authSecret()}:integrations`).digest();

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString('base64url')).join('.');
}

export function unseal(sealed: string): string {
  const [iv, tag, body] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString('utf8');
}

export type GoogleMeetLink = { email: string | null; refreshToken: string; scopes: string[]; connectedAt: string };

export async function getIntegration<T extends Record<string, unknown>>(tx: Tx, k: string): Promise<T | null> {
  const [row] = await tx.select({ data: integrations.data }).from(integrations).where(eq(integrations.key, k));
  return (row?.data as T) ?? null;
}

export async function setIntegration(tx: Tx, k: string, data: Record<string, unknown>, by: string | null) {
  await tx
    .insert(integrations)
    .values({ key: k, data, updatedBy: by })
    .onConflictDoUpdate({ target: integrations.key, set: { data, updatedBy: by, updatedAt: new Date() } });
}

export async function deleteIntegration(tx: Tx, k: string) {
  await tx.delete(integrations).where(eq(integrations.key, k));
}

/** حساب Google المربوط للحصص (الرمز مفكوك التشفير) أو null */
export async function googleMeetLink(tx?: Tx): Promise<GoogleMeetLink | null> {
  const read = async (t: Tx) => {
    const row = await getIntegration<{ email: string | null; refreshToken: string; scopes: string[]; connectedAt: string }>(t, 'google_meet');
    if (!row) return null;
    try {
      return { ...row, refreshToken: unseal(row.refreshToken) };
    } catch {
      // تغيّر AUTH_SECRET بعد الربط: يلزم إعادة الربط
      return null;
    }
  };
  return tx ? read(tx) : asSystem(null, read);
}

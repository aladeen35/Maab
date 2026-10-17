// سرّ نبضة المهام: مشتق من AUTH_SECRET فلا يحتاج متغيراً مستقلاً في الاستضافة
import { createHmac, timingSafeEqual } from 'node:crypto';
import { authSecret } from '../env';

export const cronSecret = () => createHmac('sha256', authSecret()).update('maab:cron-tick').digest('base64url');

export function verifyCronSecret(header: string | null): boolean {
  const given = Buffer.from((header ?? '').replace(/^Bearer\s+/i, ''));
  const expected = Buffer.from(cronSecret());
  return given.length === expected.length && timingSafeEqual(given, expected);
}

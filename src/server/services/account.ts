// الحساب: بيانات المستخدم الحالي وتفضيلاته، والدخول بحساب Google لمن هم
// خارج السعودية (رمز Google ID يُتحقق منه بمفاتيح Google العامة).
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { and, eq, gt, inArray, isNull, ne } from 'drizzle-orm';
import { isStaff } from '@/lib/domain/permissions';
import { asSystem } from '../db/client';
import { certificates, guardians, guardianStudents, meetings, pushSubscriptions, sessions, students, teachers, userRoles, users } from '../db/schema';
import { ApiError, badRequest, conflict } from '../api/http';
import { audit } from './audit';
import type { Viewer } from '../api/route';
import { env } from '../env';
import { isValidTimezone } from '@/lib/tz';

export async function getMe(viewer: Viewer) {
  return asSystem(viewer.userId, async (tx) => {
    const [g] = await tx.select({ id: guardians.id }).from(guardians).where(and(eq(guardians.userId, viewer.userId), isNull(guardians.deletedAt)));
    const [t] = await tx.select({ id: teachers.id, status: teachers.status }).from(teachers).where(eq(teachers.userId, viewer.userId));
    const [u] = await tx.select({ prefs: users.notificationPrefs, city: users.city }).from(users).where(eq(users.id, viewer.userId));
    return {
      ...viewer.user,
      city: u.city,
      roles: viewer.roles,
      impersonatedBy: viewer.impersonatedBy ?? null,
      guardianId: g?.id ?? null,
      teacherId: t?.id ?? null,
      notificationPrefs: u.prefs,
    };
  });
}

export async function updateMe(viewer: Viewer, patch: { fullName?: string; city?: string | null; timezone?: string }) {
  if (patch.timezone && !isValidTimezone(patch.timezone)) throw badRequest('timezone_invalid', 'منطقة زمنية غير معروفة');
  return asSystem(viewer.userId, async (tx) => {
    const [u] = await tx
      .update(users)
      .set({
        ...(patch.fullName ? { fullName: patch.fullName } : {}),
        ...(patch.city !== undefined ? { city: patch.city } : {}),
        ...(patch.timezone ? { timezone: patch.timezone } : {}),
      })
      .where(eq(users.id, viewer.userId))
      .returning({ fullName: users.fullName, city: users.city, timezone: users.timezone });
    return u;
  });
}

export async function setNotificationPrefs(viewer: Viewer, prefs: Record<string, Partial<Record<'whatsapp' | 'email' | 'sms' | 'push', boolean>>>) {
  return asSystem(viewer.userId, async (tx) => {
    const [u] = await tx.update(users).set({ notificationPrefs: prefs }).where(eq(users.id, viewer.userId)).returning({ prefs: users.notificationPrefs });
    return u.prefs;
  });
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/** يتحقق من رمز Google Identity Services ويعيد هوية صاحبه */
export async function verifyGoogleCredential(credential: string): Promise<{ sub: string; email: string | null; name: string | null }> {
  const clientId = env().GOOGLE_CLIENT_ID;
  if (!clientId) throw new ApiError(503, 'google_disabled', 'الدخول بحساب Google غير مفعّل حالياً');
  try {
    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientId });
    if (!payload.sub) throw new Error('no sub');
    const verified = payload.email_verified === true || payload.email_verified === 'true';
    return { sub: payload.sub, email: verified ? String(payload.email ?? '') || null : null, name: (payload.name as string | undefined) ?? null };
  } catch {
    throw new ApiError(401, 'google_invalid', 'تعذّر التحقق من حساب Google');
  }
}

/**
 * حذف الحساب (شرط Google Play): يُمحى ما يعرّف بالمستخدم وأبنائه — الاسم
 * والجوال والبريد ورموز الدخول وأجهزة الإشعارات والشهادات — وتُلغى حصصهم
 * القادمة. يبقى من السجلات المالية والتقارير ما يلزم نظاماً بلا ما يدل على
 * صاحبه. المعلمات وموظفو الإدارة يُنهي ارتباطهم المدير العام.
 */
export async function deleteAccount(viewer: Viewer, ip?: string | null) {
  if (viewer.roles.includes('teacher') || isStaff(viewer.roles)) {
    throw conflict('ask_admin', 'حساب المعلمة أو الإدارة يُغلق عبر المدير العام حتى تُنقل الحصص والطلاب أولاً');
  }
  return asSystem(viewer.userId, async (tx) => {
    const now = new Date();
    const [g] = await tx.select({ id: guardians.id }).from(guardians).where(and(eq(guardians.userId, viewer.userId), isNull(guardians.deletedAt)));
    const kids = g
      ? (await tx.select({ id: guardianStudents.studentId }).from(guardianStudents).where(eq(guardianStudents.guardianId, g.id))).map((r) => r.id)
      : (await tx.select({ id: students.id }).from(students).where(eq(students.userId, viewer.userId))).map((r) => r.id);
    // أبناء مشتركون مع ولي أمر آخر يبقون له
    const shared = kids.length
      ? (await tx.select({ id: guardianStudents.studentId }).from(guardianStudents).where(and(inArray(guardianStudents.studentId, kids), g ? ne(guardianStudents.guardianId, g.id) : undefined))).map((r) => r.id)
      : [];
    const mine = kids.filter((k) => !shared.includes(k));

    if (mine.length) {
      const upcoming = await tx
        .update(sessions)
        .set({ status: 'cancelled' })
        .where(and(inArray(sessions.studentId, mine), inArray(sessions.status, ['scheduled', 'held']), gt(sessions.startsAt, now)))
        .returning({ id: sessions.id });
      if (upcoming.length) await tx.update(meetings).set({ status: 'pending', attempts: 0 }).where(inArray(meetings.sessionId, upcoming.map((x) => x.id)));
      await tx.delete(certificates).where(inArray(certificates.studentId, mine));
      const kidUsers = (await tx.select({ userId: students.userId }).from(students).where(inArray(students.id, mine))).map((r) => r.userId).filter((x): x is string => Boolean(x));
      await tx
        .update(students)
        .set({ fullName: 'حساب محذوف', displayName: 'محذوف', goal: null, level: null, loginCodeHash: null, userId: null, deletedAt: now })
        .where(inArray(students.id, mine));
      if (kidUsers.length) await tx.update(users).set({ fullName: '', deletedAt: now }).where(inArray(users.id, kidUsers));
    }
    if (g) await tx.update(guardians).set({ deletedAt: now }).where(eq(guardians.id, g.id));
    await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, viewer.userId));
    await tx.delete(userRoles).where(eq(userRoles.userId, viewer.userId));
    await tx
      .update(users)
      .set({ phone: null, email: null, googleSub: null, fullName: '', city: null, notificationPrefs: {}, deletedAt: now })
      .where(eq(users.id, viewer.userId));
    await audit(tx, viewer, { action: 'account.delete', entity: 'users', entityId: viewer.userId, after: { students: mine.length } }, ip);
    return { deleted: true, students: mine.length };
  });
}


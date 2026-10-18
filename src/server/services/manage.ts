// إدارة الكوبونات وفريق الإدارة من اللوحة: كوبون بنسبة خصم وصلاحية وحدّ
// استخدام، وإضافة بريد عضو في الإدارة بأدوار محددة (يدخل به برمز البريد أو
// بحساب Google فيجد صلاحياته جاهزة).
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { currencyFor, defaultTimezone, type CountryCode } from '@/lib/domain/market';
import { ROLES, STAFF_ROLES, type Role } from '@/lib/domain/permissions';
import { badRequest, conflict, notFound } from '../api/http';
import { assertCan, type Viewer } from '../api/route';
import { asSystem } from '../db/client';
import { couponRedemptions, coupons, orders, userRoles, users } from '../db/schema';
import { normalizeEmail } from '../env';
import { audit } from './audit';

// ——— الكوبونات ———

export type CouponInput = {
  code: string;
  percent: number;
  endsOn?: string | null;
  maxUses?: number | null;
  maxUsesPerUser: number;
  active: boolean;
};

export async function listCoupons(viewer: Viewer) {
  assertCan(viewer, 'prices.manage');
  return asSystem(viewer.userId, async (tx) => {
    const rows = await tx
      .select({ c: coupons, used: sql<number>`count(${couponRedemptions.orderId}) filter (where ${orders.status} in ('pending_payment','paid'))::int` })
      .from(coupons)
      .leftJoin(couponRedemptions, eq(couponRedemptions.couponId, coupons.id))
      .leftJoin(orders, eq(orders.id, couponRedemptions.orderId))
      .groupBy(coupons.id)
      .orderBy(desc(coupons.createdAt));
    return rows.map(({ c, used }) => ({
      id: c.id,
      code: c.code,
      percent: c.kind === 'percent' ? c.value : null,
      endsOn: c.endsAt.toISOString().slice(0, 10),
      maxUses: c.maxUses,
      maxUsesPerUser: c.maxUsesPerUser,
      active: c.active,
      used,
    }));
  });
}

export type CouponRow = Awaited<ReturnType<typeof listCoupons>>[number];

export async function saveCoupon(viewer: Viewer, id: string | null, input: CouponInput, ip?: string | null) {
  assertCan(viewer, 'prices.manage');
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw badRequest('code_invalid', 'رمز الكوبون من 3 إلى 30 حرفاً إنجليزياً أو رقماً');
  const endsAt = input.endsOn ? new Date(`${input.endsOn}T23:59:59Z`) : new Date(Date.now() + 365 * 86_400_000);
  if (endsAt <= new Date()) throw badRequest('ends_past', 'تاريخ الانتهاء يجب أن يكون في المستقبل');
  const values = { code, kind: 'percent', value: input.percent, currency: null, endsAt, maxUses: input.maxUses ?? null, maxUsesPerUser: input.maxUsesPerUser, active: input.active, updatedAt: new Date() };
  return asSystem(viewer.userId, async (tx) => {
    const [clash] = await tx.select({ id: coupons.id }).from(coupons).where(sql`upper(${coupons.code}) = ${code}`);
    if (clash && clash.id !== id) throw conflict('code_taken', 'هذا الرمز مستخدم لكوبون آخر');
    let row: typeof coupons.$inferSelect;
    if (id) {
      const [before] = await tx.select().from(coupons).where(eq(coupons.id, id));
      if (!before) throw notFound('الكوبون');
      [row] = await tx.update(coupons).set(values).where(eq(coupons.id, id)).returning();
      await audit(tx, viewer, { action: 'coupon.update', entity: 'coupons', entityId: id, before: { code: before.code, value: before.value, active: before.active }, after: { code, value: input.percent, active: input.active } }, ip);
    } else {
      [row] = await tx.insert(coupons).values({ ...values, startsAt: new Date() }).returning();
      await audit(tx, viewer, { action: 'coupon.create', entity: 'coupons', entityId: row.id, after: { code, value: input.percent } }, ip);
    }
    return { id: row.id, code: row.code };
  });
}

// ——— فريق الإدارة ———

export async function listStaff(viewer: Viewer) {
  assertCan(viewer, 'roles.manage');
  return asSystem(viewer.userId, async (tx) => {
    const rows = await tx
      .select({ id: users.id, email: users.email, phone: users.phone, name: users.fullName, lastLoginAt: users.lastLoginAt, role: userRoles.role })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(and(inArray(userRoles.role, STAFF_ROLES), sql`${users.deletedAt} is null`))
      .orderBy(asc(users.email));
    const byUser = new Map<string, { id: string; email: string | null; phone: string | null; name: string; lastLoginAt: string | null; roles: Role[] }>();
    for (const r of rows) {
      const u = byUser.get(r.id) ?? { id: r.id, email: r.email, phone: r.phone, name: r.name, lastLoginAt: r.lastLoginAt?.toISOString() ?? null, roles: [] };
      u.roles.push(r.role);
      byUser.set(r.id, u);
    }
    return [...byUser.values()];
  });
}

export type StaffRow = Awaited<ReturnType<typeof listStaff>>[number];

/** يمنح بريداً أدواراً إدارية (أو يسحبها كلها بقائمة فارغة)؛ أدواره الأخرى كولي أمر أو معلمة تبقى */
export async function setStaffRoles(viewer: Viewer, input: { email: string; roles: Role[] }, ip?: string | null) {
  assertCan(viewer, 'roles.manage');
  const roles = [...new Set(input.roles)].filter((r) => STAFF_ROLES.includes(r));
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('email_invalid', 'صيغة البريد غير صحيحة');
  return asSystem(viewer.userId, async (tx) => {
    // البحث بالصيغة الموحّدة: نقاط Gmail لا أثر لها
    const candidates = await tx.select().from(users).where(and(sql`${users.deletedAt} is null`, sql`split_part(lower(${users.email}), '@', 2) = ${email.split('@')[1].replace('googlemail.com', 'gmail.com')}`));
    let user = candidates.find((u) => u.email && normalizeEmail(u.email) === normalizeEmail(email));
    if (!user) {
      if (!roles.length) throw notFound('العضو');
      const [me] = await tx.select({ country: users.country }).from(users).where(eq(users.id, viewer.userId));
      const country = (me?.country ?? 'SA') as CountryCode;
      [user] = await tx.insert(users).values({ email, fullName: '', country, currency: currencyFor(country), timezone: defaultTimezone(country) }).returning();
    }
    if (user.id === viewer.userId && !roles.includes('super_admin')) throw conflict('self_demote', 'لا يمكنك سحب دور المدير العام من نفسك');
    const current = (await tx.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id))).map((r) => r.role);
    if (current.includes('super_admin') && !roles.includes('super_admin')) {
      const [{ n }] = await tx.select({ n: count() }).from(userRoles).where(eq(userRoles.role, 'super_admin'));
      if (n <= 1) throw conflict('last_admin', 'لا بد من مدير عام واحد على الأقل');
    }
    const remove = current.filter((r) => STAFF_ROLES.includes(r) && !roles.includes(r));
    const add = roles.filter((r) => !current.includes(r));
    if (remove.length) await tx.delete(userRoles).where(and(eq(userRoles.userId, user.id), inArray(userRoles.role, remove)));
    if (add.length) await tx.insert(userRoles).values(add.map((role) => ({ userId: user.id, role, grantedBy: viewer.userId }))).onConflictDoNothing();
    await audit(tx, viewer, { action: 'staff.roles', entity: 'user_roles', entityId: user.id, before: { roles: current }, after: { email, roles: [...current.filter((r) => !remove.includes(r)), ...add] } }, ip);
    return { userId: user.id, email: user.email, roles: [...current.filter((r) => !remove.includes(r)), ...add].map((r) => ({ key: r, label: ROLES[r] })) };
  });
}

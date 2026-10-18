/*
 * التشغيل المجاني (Vercel + Supabase): البريد وGoogle بدل واتساب، والمدير الأول
 * من ADMIN_EMAILS، والملفات داخل القاعدة، ونبضة المهام بدل العامل، والشهادات،
 * وإشعارات الجهاز، وحذف الحساب. قاعدة مستقلة <TEST_DATABASE_URL>_free.
 */
import { execFileSync } from 'node:child_process';
import { and, eq } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const BASE = process.env.TEST_DATABASE_URL;
const URL_FREE = BASE ? BASE.replace(/\/([^/?]+)(\?|$)/, '/$1_free$2') : undefined;

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
type CallOpts = { method?: string; body?: unknown; form?: FormData; cookie?: string; params?: Record<string, string>; headers?: Record<string, string> };

let ipSeq = 1;

async function call(handler: Handler, path: string, o: CallOpts = {}) {
  const headers = new Headers(o.headers);
  headers.set('x-forwarded-for', `10.9.${Math.floor(ipSeq / 250)}.${ipSeq++ % 250}`);
  if (o.cookie) headers.set('cookie', o.cookie);
  let body: BodyInit | undefined;
  if (o.form) body = o.form;
  else if (o.body !== undefined) {
    body = JSON.stringify(o.body);
    headers.set('content-type', 'application/json');
  }
  const res = await handler(new Request(`http://localhost/api/v1${path}`, { method: o.method ?? (body ? 'POST' : 'GET'), headers, body }), {
    params: Promise.resolve(o.params ?? {}),
  });
  const type = res.headers.get('content-type') ?? '';
  const json = type.includes('json') ? await res.json() : null;
  const set = res.headers.getSetCookie().find((c) => c.startsWith('maab_session='));
  return { res, status: res.status, json, cookie: set ? set.split(';')[0] : undefined };
}

describe.skipIf(!URL_FREE)('التشغيل المجاني', () => {
  let c: typeof import('../db/client');
  let t: typeof import('../db/schema');
  let outbox: typeof import('../auth/channels').devOutbox;
  let session: typeof import('../auth/session');
  const api = {} as Record<string, Record<string, Handler>>;
  const db = () => c.getDb();
  const code = (to: string) => {
    const m = outbox().find((x) => x.to === to)?.text.match(/(\d{6})/);
    if (!m) throw new Error(`لا رمز مرسل إلى ${to}`);
    return m[1];
  };
  const cookieFor = async (userId: string) => {
    const roles = (await db().select({ role: t.userRoles.role }).from(t.userRoles).where(eq(t.userRoles.userId, userId))).map((r) => r.role);
    return `maab_session=${(await session.signSession({ userId, roles })).token}`;
  };
  const emailLogin = async (email: string, country = 'SD') => {
    expect((await call(api['auth/otp/send'].POST, '/auth/otp/send', { body: { email } })).status).toBe(200);
    return call(api['auth/otp/verify'].POST, '/auth/otp/verify', { body: { email, country, code: code(email.toLowerCase()) } });
  };

  beforeAll(async () => {
    process.env.ADMIN_EMAILS = 'Boss@Example.com, second@example.com';
    process.env.STORAGE_DRIVER = 'db';
    const admin = postgres(BASE!, { max: 1, onnotice: () => {} });
    const name = new URL(URL_FREE!).pathname.slice(1);
    const [exists] = await admin`select 1 from pg_database where datname = ${name}`;
    if (!exists) await admin.unsafe(`create database "${name}"`);
    await admin.end();
    execFileSync('npx', ['tsx', 'scripts/db/reset-local.ts', '--demo'], { env: { ...process.env, DATABASE_URL: URL_FREE }, stdio: 'pipe' });
    process.env.DATABASE_URL = URL_FREE;

    c = await import('../db/client');
    t = await import('../db/schema');
    outbox = (await import('../auth/channels')).devOutbox;
    session = await import('../auth/session');
    const load = async (path: string) => (await import(`../../app/api/v1/${path}/route`)) as Record<string, Handler>;
    for (const p of [
      'auth/otp/send', 'auth/otp/verify', 'me', 'teacher-applications', 'teacher-applications/[id]/status', 'files/[id]', 'files/[id]/content',
      'internal/tick', 'certificates', 'certificates/[id]/revoke', 'certificates/verify/[code]', 'push/key', 'push/subscriptions', 'admin/system',
      'admin/payment-accounts', 'admin/payment-accounts/[id]', 'students', 'admin/coupons', 'admin/coupons/[id]', 'admin/staff', 'coupons/validate',
    ]) api[p] = await load(p);
  }, 180_000);

  afterAll(async () => {
    await c?.closeDb();
  });

  it('المدير الأول من ADMIN_EMAILS بأول دخول بالبريد، ومن سواه بلا دور', async () => {
    const boss = await emailLogin('boss@example.com');
    expect(boss.json.data).toMatchObject({ next: '/admin', roles: ['super_admin'] });
    const other = await emailLogin('someone@example.com');
    expect(other.json.data).toMatchObject({ next: '/onboarding', roles: [] });
    const [log] = await db().select().from(t.auditLogs).where(eq(t.auditLogs.action, 'role.bootstrap'));
    expect(log.after).toMatchObject({ role: 'super_admin', email: 'boss@example.com' });
  });

  it('طلب المعلمة يلزمه البريد، والملفات تُحفظ في القاعدة، والمقبولة تدخل ببريدها', async () => {
    const sharp = (await import('sharp')).default;
    const jpeg = await sharp({ create: { width: 30, height: 30, channels: 3, background: '#eee' } }).jpeg().toBuffer();
    const form = () => {
      const f = new FormData();
      f.set('fullName', 'سارة الأمين محمد');
      f.set('phone', '+249912777001');
      f.set('country', 'SD');
      f.set('ijazah', 'حفص عن عاصم — الشيخة آمنة');
      f.set('experience', 'ثلاث سنوات في خلوة الحي');
      f.append('categories', 'children');
      f.set('id_document', new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), 'id.jpg');
      f.append('ijazah', new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), 'ijazah.jpg');
      return f;
    };
    expect((await call(api['teacher-applications'].POST, '/teacher-applications', { form: form() })).status).toBe(422);
    const withEmail = form();
    withEmail.set('email', 'sara.teacher@example.com');
    const r = await call(api['teacher-applications'].POST, '/teacher-applications', { form: withEmail });
    expect(r.status).toBe(200);
    const [doc] = await db().select().from(t.files).where(eq(t.files.kind, 'id_document'));
    const [blob] = await db().select().from(t.fileBlobs).where(eq(t.fileBlobs.fileId, doc.id));
    expect(blob.bytes.byteLength).toBe(doc.sizeBytes);

    const [boss] = await db().select().from(t.users).where(eq(t.users.email, 'boss@example.com'));
    const bossCookie = await cookieFor(boss.id);
    const signed = await call(api['files/[id]'].GET, `/files/${doc.id}`, { cookie: bossCookie, params: { id: doc.id } });
    const link = new URL(signed.json.data.url, 'http://localhost');
    const content = await call(api['files/[id]/content'].GET, `${link.pathname.replace('/api/v1', '')}${link.search}`, { params: { id: doc.id } });
    expect(content.status).toBe(200);
    expect(Buffer.from(await content.res.arrayBuffer()).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));

    const id = r.json.data.id as string;
    for (const status of ['under_review', 'interview', 'accepted']) {
      const body = status === 'interview' ? { status, interviewAt: new Date(Date.now() + 86_400_000).toISOString() } : { status };
      const moved = await call(api['teacher-applications/[id]/status'].PATCH, `/teacher-applications/${id}/status`, { method: 'PATCH', cookie: bossCookie, body, params: { id } });
      expect(moved.status).toBe(200);
    }
    const sara = await emailLogin('sara.teacher@example.com');
    expect(sara.json.data).toMatchObject({ next: '/teacher', roles: ['teacher'] });
  });

  it('نبضة المهام: ترفض بلا سرّ، وتشغّل المستحق مرة واحدة في الدقيقة', async () => {
    const { cronSecret } = await import('../auth/cron');
    expect((await call(api['internal/tick'].POST, '/internal/tick', { body: {} })).status).toBe(401);
    const auth = { authorization: `Bearer ${cronSecret()}` };
    const first = await call(api['internal/tick'].POST, '/internal/tick', { body: {}, headers: auth });
    expect(first.status).toBe(200);
    expect(first.json.data.jobs.outbox).toMatchObject({ ok: true });
    const second = await call(api['internal/tick'].POST, '/internal/tick', { body: {}, headers: auth });
    // الدقيقة نفسها: محجوزة من النبضة الأولى (إلا إن عبرت الدقيقة بين الطلبين)
    expect(['skipped', expect.objectContaining({ ok: true })]).toContainEqual(second.json.data.jobs.outbox);
    const runs = await db().select().from(t.jobRuns).where(eq(t.jobRuns.name, 'outbox'));
    expect(runs.length).toBeGreaterThanOrEqual(1);
    expect(runs.every((r) => r.ok)).toBe(true);
  });

  it('حالة التشغيل للمدير العام وحده، وحسابات الاستلام تُعدّل', async () => {
    const [boss] = await db().select().from(t.users).where(eq(t.users.email, 'boss@example.com'));
    const bossCookie = await cookieFor(boss.id);
    const sys = await call(api['admin/system'].GET, '/admin/system', { cookie: bossCookie });
    expect(sys.status).toBe(200);
    expect(sys.json.data).toMatchObject({ storage: 'db', google: { connected: false }, tick: { ok: true } });
    const [salma] = await db().select().from(t.users).where(eq(t.users.phone, '+966512345678'));
    expect((await call(api['admin/system'].GET, '/admin/system', { cookie: await cookieFor(salma.id) })).status).toBe(403);

    const acc = sys.json.data.accounts[0];
    const body = { method: acc.method, currency: acc.currency, title: 'تحويل بنكي سعودي', bankName: 'بنك الإنماء', accountName: 'أكاديمية مآب', accountNumber: 'SA00 1111 2222 3333 4444 5555', instructions: 'اكتبي الرقم المرجعي', active: true };
    const put = await call(api['admin/payment-accounts/[id]'].PUT, `/admin/payment-accounts/${acc.id}`, { method: 'PUT', cookie: bossCookie, body, params: { id: acc.id } });
    expect(put.status).toBe(200);
    const [row] = await db().select().from(t.paymentAccounts).where(eq(t.paymentAccounts.id, acc.id));
    expect(row).toMatchObject({ bankName: 'بنك الإنماء', instructionsAr: 'اكتبي الرقم المرجعي' });
  });

  it('كوبونات من اللوحة: MAAB20 وNANI90 يخصمان عند الشراء، والإيقاف يبطلها', async () => {
    const [boss] = await db().select().from(t.users).where(eq(t.users.email, 'boss@example.com'));
    const bossCookie = await cookieFor(boss.id);
    const [salma] = await db().select().from(t.users).where(eq(t.users.phone, '+966512345678'));
    const salmaCookie = await cookieFor(salma.id);
    const create = (body: unknown) => call(api['admin/coupons'].POST, '/admin/coupons', { cookie: bossCookie, body });
    const validate = (code: string) => call(api['coupons/validate'].POST, '/coupons/validate', { cookie: salmaCookie, body: { code, planCodes: ['regular'], subtotal: 200 } });

    expect((await create({ code: 'maab20', percent: 20 })).status).toBe(200);
    expect((await create({ code: 'NANI90', percent: 90, maxUses: 3 })).status).toBe(200);
    expect((await create({ code: 'MAAB20', percent: 30 })).json.code).toBe('code_taken');
    expect((await create({ code: 'خصم', percent: 10 })).json.code).toBe('code_invalid');
    expect((await create({ code: 'OVER', percent: 120 })).status).toBe(422);
    expect((await call(api['admin/coupons'].POST, '/admin/coupons', { cookie: salmaCookie, body: { code: 'MINE', percent: 50 } })).status).toBe(403);

    expect((await validate('maab20')).json.data).toMatchObject({ code: 'MAAB20', discount: 40, total: 160 });
    expect((await validate('Nani90')).json.data).toMatchObject({ discount: 180, total: 20 });

    const list = await call(api['admin/coupons'].GET, '/admin/coupons', { cookie: bossCookie });
    const nani = list.json.data.find((x: { code: string }) => x.code === 'NANI90');
    expect(nani).toMatchObject({ percent: 90, maxUses: 3, used: 0, active: true });
    const off = await call(api['admin/coupons/[id]'].PUT, `/admin/coupons/${nani.id}`, { method: 'PUT', cookie: bossCookie, params: { id: nani.id }, body: { code: 'NANI90', percent: 90, active: false } });
    expect(off.status).toBe(200);
    expect((await validate('NANI90')).json.code).toBe('coupon_invalid');
    const [log] = await db().select().from(t.auditLogs).where(and(eq(t.auditLogs.action, 'coupon.update'), eq(t.auditLogs.entityId, nani.id)));
    expect(log.after).toMatchObject({ active: false });
  });

  it('فريق الإدارة: بريد جديد يدخل بأدواره، والمدير لا يسحب دوره من نفسه ولا يبقى الفريق بلا مدير عام', async () => {
    const [boss] = await db().select().from(t.users).where(eq(t.users.email, 'boss@example.com'));
    const bossCookie = await cookieFor(boss.id);
    const grant = (body: unknown, cookie = bossCookie) => call(api['admin/staff'].POST, '/admin/staff', { cookie, body });

    const g = await grant({ email: 'Fin.Ance@gmail.com', roles: ['finance', 'support'] });
    expect(g.status).toBe(200);
    // يدخل بالبريد (ولو بنقاط مختلفة في Gmail) فيجد الأدوار
    const login = await emailLogin('finance@gmail.com');
    expect(login.json.data.next).toBe('/admin');
    expect([...login.json.data.roles].sort()).toEqual(['finance', 'support']);

    const finCookie = login.cookie!;
    expect((await call(api['admin/staff'].GET, '/admin/staff', { cookie: finCookie })).status).toBe(403);
    expect((await call(api['admin/coupons'].GET, '/admin/coupons', { cookie: finCookie })).status).toBe(200);

    const list = await call(api['admin/staff'].GET, '/admin/staff', { cookie: bossCookie });
    expect(list.json.data.find((x: { email: string }) => x.email === 'fin.ance@gmail.com').roles.sort()).toEqual(['finance', 'support']);

    expect((await grant({ email: 'finance@gmail.com', roles: ['finance'] })).status).toBe(200);
    expect((await grant({ email: 'boss@example.com', roles: ['supervisor'] })).json.code).toBe('self_demote');

    // مدير عام ثانٍ يحاول سحب دور الأول: يُسمح ما دام يبقى مدير، ويُمنع إن كان الأخير
    await grant({ email: 'deputy@example.com', roles: ['super_admin'] });
    const [deputy] = await db().select().from(t.users).where(eq(t.users.email, 'deputy@example.com'));
    const deputyCookie = await cookieFor(deputy.id);
    const others = await db().select({ userId: t.userRoles.userId }).from(t.userRoles).where(eq(t.userRoles.role, 'super_admin'));
    for (const o of others) {
      if (o.userId === deputy.id) continue;
      const [u] = await db().select().from(t.users).where(eq(t.users.id, o.userId));
      if (u.email) expect((await grant({ email: u.email, roles: [] }, deputyCookie)).status).toBe(200);
      else await db().delete(t.userRoles).where(and(eq(t.userRoles.userId, o.userId), eq(t.userRoles.role, 'super_admin')));
    }
    expect((await grant({ email: 'deputy@example.com', roles: [] }, deputyCookie)).json.code).toBe('self_demote');
    await grant({ email: 'boss@example.com', roles: ['super_admin'] }, deputyCookie);
    expect((await grant({ email: 'finance@gmail.com', roles: [] })).status).toBe(200);
    const [log] = await db().select().from(t.auditLogs).where(eq(t.auditLogs.action, 'staff.roles')).orderBy(t.auditLogs.createdAt).limit(1);
    expect(log.after).toMatchObject({ email: 'fin.ance@gmail.com' });
  });

  it('شهادة دورة من الإشراف: تصل للأسرة، وتُتحقق برمزها، وتُلغى بسبب', async () => {
    const [boss] = await db().select().from(t.users).where(eq(t.users.email, 'boss@example.com'));
    const bossCookie = await cookieFor(boss.id);
    const [salma] = await db().select().from(t.users).where(eq(t.users.phone, '+966512345678'));
    const salmaCookie = await cookieFor(salma.id);
    const kids = await call(api.students.GET, '/students', { cookie: salmaCookie });
    const kid = kids.json.data[0];

    expect((await call(api.certificates.POST, '/certificates', { cookie: salmaCookie, body: { studentId: kid.id, title: 'دورة التجويد', body: 'أتمّت دورة التجويد بنجاح.' } })).status).toBe(403);
    const issued = await call(api.certificates.POST, '/certificates', { cookie: bossCookie, body: { studentId: kid.id, title: 'دورة التجويد', body: 'أتمّت الطالبة دورة التجويد بنجاح.' } });
    expect(issued.status).toBe(200);
    expect(issued.json.data.code).toMatch(/^[2-9A-HJ-NP-Z]{10}$/);

    const mine = await call(api.certificates.GET, `/certificates?studentId=${kid.id}`, { cookie: salmaCookie });
    expect(mine.json.data.map((x: { title: string }) => x.title)).toContain('دورة التجويد');
    const [note] = await db().select().from(t.notifications).where(and(eq(t.notifications.userId, salma.id), eq(t.notifications.event, 'certificate_issued')));
    expect(note.data).toMatchObject({ code: issued.json.data.code });

    const v = await call(api['certificates/verify/[code]'].GET, `/certificates/verify/${issued.json.data.code}`, { params: { code: issued.json.data.code.toLowerCase() } });
    expect(v.json.data).toMatchObject({ valid: true, title: 'دورة التجويد', studentName: kid.fullName });
    expect((await call(api['certificates/verify/[code]'].GET, '/certificates/verify/X', { params: { code: 'ZZZZZZZZZZ' } })).status).toBe(404);

    const revoke = await call(api['certificates/[id]/revoke'].POST, `/certificates/${issued.json.data.id}/revoke`, { cookie: bossCookie, body: { reason: 'صدرت للطالب الخطأ' }, params: { id: issued.json.data.id } });
    expect(revoke.status).toBe(200);
    const after = await call(api['certificates/verify/[code]'].GET, '/certificates/verify/x', { params: { code: issued.json.data.code } });
    expect(after.json.data.valid).toBe(false);
  });

  it('إشعار الجهاز: الاشتراك يُحفظ لصاحبه، والحدث يضع إشعاراً في الطابور', async () => {
    const key = await call(api['push/key'].GET, '/push/key');
    expect(key.json.data.publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);
    // المفتاح نفسه في كل مرة (يُولَّد مرة ويُحفظ)
    expect((await call(api['push/key'].GET, '/push/key')).json.data.publicKey).toBe(key.json.data.publicKey);
    const [salma] = await db().select().from(t.users).where(eq(t.users.phone, '+966512345678'));
    const salmaCookie = await cookieFor(salma.id);
    const sub = { endpoint: 'https://push.example.invalid/abc', keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } };
    expect((await call(api['push/subscriptions'].POST, '/push/subscriptions', { cookie: salmaCookie, body: sub })).status).toBe(200);
    const { notify } = await import('../services/notifications');
    await c.asSystem(null, (tx) => notify(tx, { userIds: [salma.id], event: 'report_ready', vars: { student: 'رؤى', range: 'النبأ 1–10', grade: 'ممتاز' } }));
    const queued = await db().select().from(t.notifications).where(and(eq(t.notifications.userId, salma.id), eq(t.notifications.channel, 'push')));
    expect(queued[0]).toMatchObject({ status: 'queued', title: 'تقرير الحفظ جاهز' });
    expect((await call(api['push/subscriptions'].DELETE, '/push/subscriptions', { method: 'DELETE', cookie: salmaCookie, body: { endpoint: sub.endpoint } })).status).toBe(200);
    expect(await db().select().from(t.pushSubscriptions)).toHaveLength(0);
    // لا جهاز: الإشعار المعلّق يفشل دون إعادة محاولة
    await db().delete(t.notifications).where(eq(t.notifications.channel, 'push'));
  });

  it('حذف الحساب: تأكيد مكتوب، تُمحى المعرّفات والأبناء، وتنتهي الجلسة', async () => {
    const [salma] = await db().select().from(t.users).where(eq(t.users.phone, '+966512345678'));
    const salmaCookie = await cookieFor(salma.id);
    const kidIds = (await call(api.students.GET, '/students', { cookie: salmaCookie })).json.data.map((k: { id: string }) => k.id);
    expect((await call(api.me.DELETE, '/me', { method: 'DELETE', cookie: salmaCookie, body: { confirm: 'نعم' } })).status).toBe(422);
    const del = await call(api.me.DELETE, '/me', { method: 'DELETE', cookie: salmaCookie, body: { confirm: 'احذف حسابي' } });
    expect(del.status).toBe(200);
    expect(del.res.headers.getSetCookie().some((x) => x.startsWith('maab_session=;'))).toBe(true);
    const [u] = await db().select().from(t.users).where(eq(t.users.id, salma.id));
    expect(u).toMatchObject({ phone: null, email: null, googleSub: null, fullName: '' });
    expect(u.deletedAt).not.toBeNull();
    const kids = await db().select().from(t.students).where(eq(t.students.id, kidIds[0]));
    expect(kids[0]).toMatchObject({ fullName: 'حساب محذوف', loginCodeHash: null });
    expect(await db().select().from(t.certificates).where(eq(t.certificates.studentId, kidIds[0]))).toHaveLength(0);
    const future = await db().select().from(t.sessions).where(and(eq(t.sessions.studentId, kidIds[0]), eq(t.sessions.status, 'scheduled')));
    expect(future.filter((s) => s.startsAt > new Date())).toHaveLength(0);
    // الجلسة القديمة لم تعد صالحة، والرقم نفسه يبدأ حساباً جديداً
    expect((await call(api.me.GET, '/me', { cookie: salmaCookie })).status).toBe(401);
    // المعلمة لا تحذف حسابها بنفسها
    const [sara] = await db().select().from(t.users).where(eq(t.users.email, 'sara.teacher@example.com'));
    const r = await call(api.me.DELETE, '/me', { method: 'DELETE', cookie: await cookieFor(sara.id), body: { confirm: 'احذف حسابي' } });
    expect(r.json.code).toBe('ask_admin');
  });
});

import { ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { PlainShell } from '@/components/shell/PlainShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Card } from '@/components/ui/Card';
import { IS_LIVE } from '@/lib/data';
import { ReLogin } from './ReLogin';

export const metadata: Metadata = { title: 'لوحة الإدارة', robots: { index: false } };

type State = {
  who: string;
  home: string;
  /** لا مدير عام في النظام بعد: مرحلة التشغيل الأول */
  setup: boolean;
  configured: boolean;
  listed: boolean;
  /** البريد المسجّل في ADMIN_EMAILS مخفيّاً جزئياً */
  hints: string[];
};

const mask = (email: string) => {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 3)}${local.length > 3 ? '•••' : ''}@${domain}`;
};

async function load(): Promise<State | null> {
  if (!IS_LIVE) return null;
  await connection();
  const [{ cookies }, { viewerFromToken }, { SESSION_COOKIE }, { homeFor }, { isStaff }, { adminEmails, isAdminEmail }, { asSystem }, { userRoles }, { eq, count }] =
    await Promise.all([
      import('next/headers'),
      import('@/server/api/route'),
      import('@/server/auth/session'),
      import('@/server/auth/users'),
      import('@/lib/domain/permissions'),
      import('@/server/env'),
      import('@/server/db/client'),
      import('@/server/db/schema'),
      import('drizzle-orm'),
    ]);
  const viewer = await viewerFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!viewer) redirect('/login');
  if (isStaff(viewer.roles)) redirect('/admin');
  const [{ n }] = await asSystem(null, (tx) => tx.select({ n: count() }).from(userRoles).where(eq(userRoles.role, 'super_admin')));
  const emails = adminEmails();
  return {
    who: viewer.user.email ?? viewer.user.phone ?? 'حساب بلا بريد',
    home: viewer.roles.length ? homeFor(viewer.roles) : '/onboarding',
    setup: n === 0,
    configured: emails.length > 0,
    listed: isAdminEmail(viewer.user.email),
    hints: n === 0 ? emails.map(mask) : [],
  };
}

export default async function AdminDenied() {
  const s = await load();
  return (
    <PlainShell>
      <WaveHeader back="/" title="لوحة الإدارة" />
      <main className="space-y-4 px-5 pt-4 pb-10">
        <Card className="space-y-3 p-5">
          <ShieldAlert className="mx-auto size-12 text-warning" strokeWidth={1.5} aria-hidden />
          <p className="text-center text-lg font-bold text-ink">هذا الحساب ليس من الإدارة</p>
          {s && (
            <p className="text-center text-sm text-muted">
              أنتِ داخلة الآن بـ <bdi dir="ltr" className="font-bold text-ink">{s.who}</bdi>
            </p>
          )}
        </Card>

        {s?.setup ? (
          <Card className="space-y-3 p-5 text-sm leading-7 text-ink">
            <p className="font-bold">التشغيل الأول: لم يُعيَّن مدير عام بعد</p>
            {!s.configured ? (
              <p>
                متغير <code dir="ltr">ADMIN_EMAILS</code> غير موجود في إعدادات الموقع. أضيفيه في Vercel ← Settings ← Environment Variables ببريد الأكاديمية، ثم
                Deployments ← Redeploy، ثم سجّلي الدخول من جديد.
              </p>
            ) : !s.listed ? (
              <>
                <p>
                  هذا البريد غير مكتوب في <code dir="ltr">ADMIN_EMAILS</code>. المكتوب هناك:
                </p>
                <ul className="list-disc ps-5" dir="ltr">
                  {s.hints.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                <p>سجّلي الخروج وادخلي بالبريد نفسه، أو صحّحي القيمة في Vercel ثم Redeploy.</p>
              </>
            ) : (
              <p>البريد مكتوب في ADMIN_EMAILS، والدور يُمنح عند الدخول. سجّلي الخروج وادخلي من جديد بالبريد نفسه.</p>
            )}
            <ReLogin />
          </Card>
        ) : (
          <Card className="space-y-3 p-5 text-sm leading-7 text-muted">
            <p>الصلاحيات يمنحها المدير العام. إن كنتِ من فريق الأكاديمية فاطلبيها منه، أو ادخلي بحساب الإدارة.</p>
            <ReLogin />
          </Card>
        )}

        <p className="text-center text-sm">
          <Link href={s?.home ?? '/'} className="font-bold text-brand underline">
            العودة لصفحتي
          </Link>
        </p>
      </main>
    </PlainShell>
  );
}

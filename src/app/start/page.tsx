import { redirect } from 'next/navigation';
import { IS_LIVE } from '@/lib/data';
import { GoLogin } from './GoLogin';

// مدخل تطبيق أندرويد: المستخدم المسجّل إلى شاشته، وغيره إلى الدخول
export default async function Start() {
  if (IS_LIVE) {
    const [{ cookies }, { viewerFromToken }, { SESSION_COOKIE }, { homeFor }] = await Promise.all([
      import('next/headers'),
      import('@/server/api/route'),
      import('@/server/auth/session'),
      import('@/server/auth/users'),
    ]);
    const viewer = await viewerFromToken((await cookies()).get(SESSION_COOKIE)?.value);
    redirect(viewer ? homeFor(viewer.roles) : '/login');
  }
  return <GoLogin />;
}

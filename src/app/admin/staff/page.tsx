import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';
import { IS_LIVE } from '@/lib/data';
import type { StaffRow } from '@/server/services/manage';
import { StaffEditor } from './StaffEditor';

export const metadata: Metadata = { title: 'فريق الإدارة' };

const DEMO_STAFF: StaffRow[] = [
  { id: 'demo-1', email: 'admin@example.com', phone: null, name: 'منيرة العتيبي', lastLoginAt: new Date().toISOString(), roles: ['super_admin'] },
  { id: 'demo-2', email: 'finance@example.com', phone: null, name: '', lastLoginAt: null, roles: ['finance'] },
];

async function load(): Promise<{ staff: StaffRow[]; me: string } | 'forbidden'> {
  if (!IS_LIVE) return { staff: DEMO_STAFF, me: 'demo-1' };
  const { requireViewer } = await import('@/server/dataset');
  const viewer = await requireViewer('admin');
  const { can } = await import('@/lib/domain/permissions');
  if (!can(viewer.roles, 'roles.manage')) return 'forbidden';
  const { listStaff } = await import('@/server/services/manage');
  return { staff: await listStaff(viewer), me: viewer.userId };
}

export default async function AdminStaff() {
  const data = await load();
  if (data === 'forbidden') {
    return <Card className="p-6 text-center text-sm text-muted">إدارة الفريق للمدير العام وحده.</Card>;
  }
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-ink">فريق الإدارة</h1>
        <p className="mt-1 text-sm text-muted">
          أضيفي بريد العضو واختاري أدواره. يدخل بالبريد نفسه (برمز يصله أو بحساب Google) فيجد لوحة الإدارة بصلاحياته، ويُسجَّل كل تغيير في سجل التدقيق.
        </p>
      </div>
      <StaffEditor staff={data.staff} me={data.me} />
    </>
  );
}

import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';
import { IS_LIVE } from '@/lib/data';
import type { CouponRow } from '@/server/services/manage';
import { CouponsEditor } from './CouponsEditor';

export const metadata: Metadata = { title: 'كوبونات الخصم' };

const DEMO_COUPONS: CouponRow[] = [
  { id: 'demo-1', code: 'MAAB20', percent: 20, endsOn: '2027-06-30', maxUses: 100, maxUsesPerUser: 1, active: true, used: 14 },
  { id: 'demo-2', code: 'NANI90', percent: 90, endsOn: '2027-01-31', maxUses: 5, maxUsesPerUser: 1, active: true, used: 2 },
];

async function load(): Promise<CouponRow[] | 'forbidden'> {
  if (!IS_LIVE) return DEMO_COUPONS;
  const { requireViewer } = await import('@/server/dataset');
  const viewer = await requireViewer('admin');
  const { can } = await import('@/lib/domain/permissions');
  if (!can(viewer.roles, 'prices.manage')) return 'forbidden';
  const { listCoupons } = await import('@/server/services/manage');
  return listCoupons(viewer);
}

export default async function AdminCoupons() {
  const coupons = await load();
  if (coupons === 'forbidden') {
    return <Card className="p-6 text-center text-sm text-muted">الكوبونات للمالية والمدير العام.</Card>;
  }
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-ink">كوبونات الخصم</h1>
        <p className="mt-1 text-sm text-muted">يكتب ولي الأمر الرمز عند شراء الباقة فيُخصم من السعر. كوبون 100% يفعّل الباقة مباشرة بلا تحويل.</p>
      </div>
      <CouponsEditor coupons={coupons} />
    </>
  );
}

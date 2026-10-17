import type { Metadata } from 'next';
import Link from 'next/link';
import { PlainShell } from '@/components/shell/PlainShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Card } from '@/components/ui/Card';
import { DeleteAccountForm } from './DeleteAccountForm';

export const metadata: Metadata = { title: 'حذف الحساب' };

/** صفحة حذف الحساب: من داخل التطبيق، ورابطها في Google Play لمن حذف التطبيق */
export default function DeleteAccount() {
  return (
    <PlainShell>
      <WaveHeader back="/" title="حذف الحساب" />
      <main className="space-y-4 px-5 pt-4 pb-10">
        <Card className="space-y-3 p-5 text-sm leading-7 text-ink">
          <p className="font-bold">ماذا يحدث عند الحذف؟</p>
          <ul className="list-disc space-y-1 ps-5 text-muted">
            <li>يُمحى اسمك وجوالك وبريدك، ورموز دخول أبنائك، وإشعارات أجهزتك.</li>
            <li>تُحذف ملفات أبنائك وشهاداتهم، وتُلغى حصصهم القادمة.</li>
            <li>تبقى سجلات الدفع مجهولة الهوية لأن الأنظمة المالية توجب حفظها، دون ما يدل عليك.</li>
            <li>الحذف نهائي ولا يمكن استرجاعه. الرصيد المتبقي في الباقة لا يُسترد تلقائياً؛ راسلي الدعم قبل الحذف إن أردتِ استرداده.</li>
          </ul>
        </Card>
        <Card className="p-5">
          <DeleteAccountForm />
        </Card>
        <p className="text-center text-xs leading-6 text-muted">
          لا تستطيعين الدخول؟ راسلي الدعم من صفحة{' '}
          <Link href="/legal/cancellation" className="font-bold text-brand underline">
            سياسات الحصص والدعم
          </Link>{' '}
          برقمك أو بريدك المسجّل، ويُحذف الحساب خلال 7 أيام.
        </p>
      </main>
    </PlainShell>
  );
}

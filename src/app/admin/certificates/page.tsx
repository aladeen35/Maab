import type { Metadata } from 'next';
import { CertificateList } from '@/components/certificate/CertificateList';
import { Card } from '@/components/ui/Card';
import { dataset } from '@/lib/data';
import { students as demoStudents } from '@/lib/demo/data';
import { IssueCertificateForm, RevokeList } from './CertificateAdmin';

export const metadata: Metadata = { title: 'الشهادات' };

export default async function AdminCertificates() {
  const d = await dataset('admin');
  const demo = d.mode === 'demo' ? demoStudents.map((s) => ({ id: s.id, name: s.fullName, gender: s.gender })) : null;
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-ink">الشهادات</h1>
        <p className="mt-1 text-sm text-muted">
          شهادة الجزء والختمة تصدر تلقائياً من تقرير المعلمة عند اكتمال الحفظ. هنا تصدرين شهادة إتمام دورة، أو تلغين شهادة صدرت بالخطأ.
        </p>
      </div>
      <Card className="p-4">
        <IssueCertificateForm demoStudents={demo} />
      </Card>
      <CertificateList items={d.certificates} empty="لم تصدر شهادات بعد." />
      {d.certificates.some((c) => !c.revokedAt) && <RevokeList items={d.certificates.filter((c) => !c.revokedAt).map((c) => ({ id: c.id, label: `${c.title} — ${c.studentName}` }))} />}
    </>
  );
}

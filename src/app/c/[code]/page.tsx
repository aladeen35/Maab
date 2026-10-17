import { BadgeCheck, CircleX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { LogoHorizontal } from '@/components/brand/Brand';
import { CertificateActions } from '@/components/certificate/CertificateActions';
import { CertificateView } from '@/components/certificate/CertificateView';
import { BASE } from '@/lib/base';
import { IS_LIVE, LIVE_PROBE } from '@/lib/data';
import { certificates as demoCertificates } from '@/lib/demo/data';
import type { Certificate } from '@/lib/types';

// صفحة الشهادة العامة: رمزها غير قابل للتخمين، فيشاركها أهل الطالب بالرابط،
// ومن يمسح رمز QR المطبوع يتحقق من صحتها. لا تُفهرس في محركات البحث.
export const metadata: Metadata = { title: 'شهادة إتمام', robots: { index: false, follow: false } };

const DEMO_ORIGIN = process.env.MAAB_DEMO_ORIGIN ?? 'https://aladeen35.github.io';

export async function generateStaticParams() {
  return IS_LIVE ? [{ code: LIVE_PROBE }] : demoCertificates.map((c) => ({ code: c.code }));
}

async function load(code: string): Promise<{ c: Certificate | null; url: string }> {
  if (IS_LIVE) {
    await connection();
    const [{ verifyCertificate }, { env }] = await Promise.all([import('@/server/services/certificates'), import('@/server/env')]);
    return { c: await verifyCertificate(code), url: `${env().APP_URL}/c/${code}` };
  }
  return { c: demoCertificates.find((x) => x.code === code) ?? null, url: `${DEMO_ORIGIN}${BASE}/c/${code}/` };
}

export default async function CertificatePage({ params }: PageProps<'/c/[code]'>) {
  const { code } = await params;
  const { c, url } = await load(code);
  if (!c) notFound();
  const valid = !c.revokedAt;
  return (
    <main className="min-h-dvh bg-page px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-10 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl space-y-4 print:max-w-none print:space-y-0">
        <header className="flex items-center justify-between gap-3 print:hidden">
          <Link href="/" aria-label="مآب">
            <LogoHorizontal />
          </Link>
          {valid ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/12 px-2.5 py-1 text-xs font-bold text-success">
              <BadgeCheck className="size-4" aria-hidden />
              شهادة موثّقة
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-danger/10 px-2.5 py-1 text-xs font-bold text-danger">
              <CircleX className="size-4" aria-hidden />
              شهادة ملغاة
            </span>
          )}
        </header>

        <CertificateView c={c} verifyUrl={url} />

        <CertificateActions title={`${c.title} — ${c.studentName}`} url={url} />
        <p className="text-center text-xs leading-6 text-muted print:hidden">
          {valid
            ? `صادرة من أكاديمية مآب برقم ${c.serial}. الرمز المطبوع على الشهادة يفتح هذه الصفحة للتحقق منها.`
            : `أُلغيت هذه الشهادة${c.revokeReason ? `: ${c.revokeReason}` : ''}.`}
          <br />
          للحفظ: «حفظ PDF أو طباعة» ثم اختاري «حفظ بتنسيق PDF» واتجاه الورقة أفقي.
        </p>
      </div>
    </main>
  );
}

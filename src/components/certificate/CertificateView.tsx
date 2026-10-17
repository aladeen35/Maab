import QRCode from 'qrcode';
import { asset } from '@/lib/base';
import type { Certificate } from '@/lib/types';

/** إطار نوبي: مثلثات بألوان البيوت النوبية وأخضر مآب وذهبه (كإطار الشرافة) */
function NubianRow({ flip = false }: { flip?: boolean }) {
  const colors = ['#0e3d31', '#c9a35f', '#2f5b8a', '#a8452f'];
  return (
    <svg aria-hidden viewBox="0 0 400 8" preserveAspectRatio="none" className="block h-[1.6cqw] w-full">
      {Array.from({ length: 40 }, (_, i) => {
        const x = i * 10;
        const d = flip ? `M${x} 0 L${x + 5} 8 L${x + 10} 0 Z` : `M${x} 8 L${x + 5} 0 L${x + 10} 8 Z`;
        return <path key={i} d={d} fill={colors[i % colors.length]} />;
      })}
    </svg>
  );
}

const gregorian = (d: Date) => new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(d);
const hijri = (d: Date) => new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(d);

/**
 * الشهادة بنسبة ورقة A4 أفقية: المقاسات بوحدات عرض الحاوية (cqw) فتبقى
 * متناسقة على الجوال وفي الطباعة. ألوانها ثابتة لا تتأثر بالوضع الليلي.
 */
export async function CertificateView({ c, verifyUrl }: { c: Certificate; verifyUrl: string }) {
  const qr = await QRCode.toString(verifyUrl, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0e3d31', light: '#0000' } });
  const issued = new Date(c.issuedAt);
  return (
    <article
      dir="rtl"
      aria-label={`شهادة: ${c.title} — ${c.studentName}`}
      className="certificate-sheet @container relative aspect-[297/210] w-full overflow-hidden rounded-[1.2cqw] bg-[#fbf6ea] text-[#0e3d31] shadow-card print:rounded-none print:shadow-none"
    >
      <div className="absolute inset-x-0 top-0">
        <NubianRow />
      </div>
      <div className="absolute inset-x-0 bottom-0">
        <NubianRow flip />
      </div>
      {/* الإطار الذهبي المزدوج */}
      <div aria-hidden className="absolute inset-[3.2cqw] rounded-[0.8cqw] border-[0.35cqw] border-[#c9a35f]" />
      <div aria-hidden className="absolute inset-[4.1cqw] rounded-[0.5cqw] border-[0.12cqw] border-[#c9a35f]/70" />
      {/* زخرفة خفيفة خلف النص */}
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(201,163,95,0.16),transparent_55%)]" />

      <div className="relative flex h-full flex-col items-center px-[9cqw] pt-[6cqw] pb-[6.2cqw] text-center">
        <div className="flex items-center gap-[1.4cqw]">
          {/* eslint-disable-next-line @next/next/no-img-element -- يُطبع كما هو دون تحسين الصور */}
          <img src={asset('/brand/logo-mark.png')} alt="" className="size-[7cqw] rounded-[1.4cqw]" />
          <div className="text-start">
            <p className="font-display text-[2.6cqw] leading-[1.25] font-bold">أكاديمية مآب</p>
            <p className="text-[1.35cqw] leading-[1.4] text-[#7a5c28]">لتحفيظ القرآن الكريم عن بُعد</p>
          </div>
        </div>

        <h1 className="mt-[1.6cqw] font-display text-[5.6cqw] leading-[1.15] font-bold">شهادة إتمام</h1>
        <p className="mt-[0.4cqw] text-[1.9cqw] font-bold text-[#7a5c28]">{c.title}</p>

        <p className="mt-[1.8cqw] text-[1.6cqw]">تشهد أكاديمية مآب بأنّ</p>
        <p className="mt-[0.4cqw] font-display text-[4.6cqw] leading-[1.25] font-bold">{c.studentName}</p>
        <span aria-hidden className="mt-[0.4cqw] block h-[0.25cqw] w-[26cqw] rounded-full bg-gradient-to-l from-transparent via-[#c9a35f] to-transparent" />

        <p className="mt-[1.5cqw] max-w-[70cqw] text-[1.75cqw] leading-[1.75]">{c.body}</p>
        {c.mastery !== null && (
          <p className="mt-[0.6cqw] text-[1.6cqw] font-bold">
            بنسبة إتقان <span className="tabular">{c.mastery.toLocaleString('en-US', { maximumFractionDigits: 1 })}%</span>
          </p>
        )}

        <div className="mt-auto grid w-full grid-cols-3 items-end gap-[2cqw] text-[1.3cqw] leading-[1.6]">
          <div className="text-center">
            {c.teacherName && (
              <>
                <p className="text-[#7a5c28]">المعلمة</p>
                <p className="font-display text-[1.9cqw] font-bold">{c.teacherName}</p>
              </>
            )}
          </div>
          <div className="text-center">
            <p className="text-[#7a5c28]">تاريخ الإصدار</p>
            <p className="font-bold">{hijri(issued)}</p>
            <p>{gregorian(issued)}</p>
          </div>
          <div className="flex items-end justify-center gap-[1cqw]">
            <div className="text-start text-[1.1cqw] leading-[1.5]">
              <p className="text-[#7a5c28]">الرقم</p>
              <p dir="ltr" className="tabular font-bold">{c.serial}</p>
              <p className="text-[#7a5c28]">للتحقق امسحي الرمز</p>
            </div>
            <div className="size-[8.5cqw] shrink-0 rounded-[0.6cqw] bg-white p-[0.6cqw]" dangerouslySetInnerHTML={{ __html: qr }} />
          </div>
        </div>
      </div>

      {c.revokedAt && (
        <div className="absolute inset-0 grid place-items-center bg-[#fbf6ea]/40">
          <p className="-rotate-12 rounded-[1cqw] border-[0.5cqw] border-[#a8452f] px-[3cqw] py-[1cqw] font-display text-[6cqw] font-bold text-[#a8452f]">ملغاة</p>
        </div>
      )}
    </article>
  );
}

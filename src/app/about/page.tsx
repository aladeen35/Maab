import { ExternalLink, Heart, Mail, Play, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { LogoFull } from '@/components/brand/Brand';
import { PlainShell } from '@/components/shell/PlainShell';
import { WaveHeader } from '@/components/shell/WaveHeader';
import { Card, SectionTitle } from '@/components/ui/Card';
import { CopyButton } from '@/components/ui/CopyButton';
import { ListRow } from '@/components/ui/ListRow';
import { asset } from '@/lib/base';
import pkg from '../../../package.json';

export const metadata: Metadata = { title: 'عن المطور والمنظومة' };

// Shared "about the developer" content for Albushra apps, in Maab's design، بتصميم مآب
const SITE = 'https://albushra.app/';
const PLAY = 'https://play.google.com/store/apps/details?id=sa.mushaf.albushra';
const EMAIL = 'aladeen35@gmail.com';

const stats = [
  { n: 23, label: 'منتجًا رقميًا' },
  { n: 18, label: 'تطبيق أندرويد' },
  { n: 7, label: 'لعبة' },
  { n: 15, label: 'تطبيق ويب' },
];

const external = 'flex min-h-12 items-center justify-center gap-2 rounded-ctl px-4 text-[15px] font-bold transition-colors';

export default function About() {
  return (
    <PlainShell>
      <WaveHeader title="عن المطور والمنظومة" back="/" />
      <main className="space-y-6 px-5">
        <Card className="p-5 text-center">
          <Image
            src={asset('/brand/albushra.webp')}
            alt="شعار البشري للتكنولوجيا"
            width={96}
            height={96}
            className="mx-auto size-24 rounded-full bg-brand-deep p-2 ring-2 ring-gold/60"
          />
          <h1 className="mt-3 font-display text-2xl font-bold text-brand">البشري للتكنولوجيا</h1>
          <p className="text-sm text-muted" dir="ltr">
            Albushra Technology
          </p>
          <p className="mt-3 inline-flex rounded-full border border-gold/50 bg-gold/10 px-4 py-1.5 text-sm font-bold text-gold-text">
            تطوير وإشراف: م. علاء الدين البشري
          </p>
          <p className="mt-4 flex items-start gap-3 rounded-ctl bg-field p-3 text-start text-[15px] leading-7 font-bold text-ink">
            <Heart className="mt-1 size-5 shrink-0 fill-current text-danger" aria-hidden />
            صدقة جارية عن الوالد أ. البشري محمد الحسن — رحمه الله
          </p>
          <p className="mt-4 text-[15px] leading-7 text-muted">
            تصميم وبناء وتشغيل تطبيقات ويب وأندرويد عربية أصيلة: من قارئ القرآن الكريم إلى منصات التعليم، وشبكة المتبرعين بالدم، وألعاب
            التراث والأسرة، وأدوات الجودة وسلامة الغذاء.
          </p>
        </Card>

        <section className="space-y-3">
          <SectionTitle>عن هذا التطبيق</SectionTitle>
          <Card className="flex items-center gap-4 p-4">
            <LogoFull size={64} className="shrink-0 drop-shadow-none" />
            <div className="min-w-0">
              <p className="font-bold text-ink">أكاديمية مآب لتحفيظ القرآن الكريم</p>
              <p className="text-sm leading-6 text-muted">تحفيظ عن بُعد للأطفال والنساء بمعلمات فقط</p>
              <p className="tabular text-xs text-muted" dir="ltr">
                v{pkg.version}
              </p>
            </div>
          </Card>
          <p className="text-center text-xs text-muted">جزء من منظومة البشري للتكنولوجيا</p>
        </section>

        <section className="space-y-3">
          <SectionTitle>التطبيقات والموقع الرسمي</SectionTitle>
          <a href={SITE} target="_blank" rel="noopener" className={`${external} bg-brand text-on-brand hover:bg-brand-soft`}>
            <ExternalLink className="size-5" aria-hidden />
            زيارة موقع وتطبيقات البشرى (Albushra.app)
          </a>
          <a href={PLAY} target="_blank" rel="noopener" className={`${external} border border-gold text-brand hover:bg-gold/10`}>
            <Play className="size-5 fill-current" aria-hidden />
            Google Play
          </a>
          <Card className="flex min-h-14 items-center gap-3 px-4 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">رابط الموقع والتحميل المباشر</p>
              <p className="truncate font-bold text-ink" dir="ltr">
                albushra.app
              </p>
            </div>
            <CopyButton value={SITE} label="رابط الموقع" className="h-11 px-3.5" />
          </Card>
        </section>

        <section className="space-y-3">
          <SectionTitle>مؤشرات منظومة البشري</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {stats.map((s) => (
              <Card key={s.label} className="p-3 text-center">
                <p className="tabular text-2xl font-bold text-brand">{s.n}</p>
                <p className="text-xs text-muted">{s.label}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle>الخصوصية والتواصل</SectionTitle>
          <ListRow href="/legal/privacy" icon={<ShieldCheck className="size-5" />} label="سياسة الخصوصية" sub="كيف نحفظ بياناتك وبيانات أبنائك" />
          <a href={`mailto:${EMAIL}`} className="flex min-h-15 items-center gap-3 rounded-card bg-card px-3.5 py-2.5 shadow-card transition hover:bg-field">
            <span className="grid size-10 shrink-0 place-items-center rounded-ctl bg-brand/8 text-brand" aria-hidden>
              <Mail className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-ink">راسلنا</span>
              <span className="block truncate text-xs text-muted" dir="ltr">
                {EMAIL}
              </span>
            </span>
          </a>
        </section>

        <p className="text-center text-xs text-muted">
          © 2026 البشري للتكنولوجيا ·{' '}
          <a href={SITE} className="font-semibold text-brand underline" dir="ltr">
            albushra.app
          </a>
        </p>
      </main>
    </PlainShell>
  );
}

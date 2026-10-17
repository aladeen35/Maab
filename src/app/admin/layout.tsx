import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { LogoHorizontal } from '@/components/brand/Brand';
import { IS_LIVE } from '@/lib/data';
import { AdminNav } from './AdminNav';

const DEMO_SHELL = { name: 'منيرة العتيبي', role: 'المشرفة الأكاديمية', badges: { payments: 6, applications: 3 } };

export const metadata: Metadata = { title: { default: 'الإدارة', template: '%s · إدارة مآب' } };

/** لوحات الإدارة تتّسع على الحاسوب بشريط جانبي أخضر داكن (القسم 16) */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const shell = IS_LIVE ? await (await import('@/server/dataset')).adminShell() : DEMO_SHELL;
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 bg-brand-deep p-5 text-on-hero lg:flex">
        <div aria-hidden className="maab-pattern pointer-events-none absolute inset-0" />
        <div className="relative">
          <LogoHorizontal tone="hero" />
        </div>
        <div className="relative flex-1">
          <AdminNav variant="side" badges={shell.badges} />
        </div>
        <div className="relative rounded-ctl bg-white/6 p-3 text-xs">
          <p className="font-bold">{shell.name}</p>
          <p className="text-on-hero/70">{shell.role}</p>
          <p className="mt-2 flex items-center gap-1 text-gold">
            <ShieldCheck className="size-3.5" aria-hidden />
            تنتهي الجلسة بعد 30 دقيقة خمول
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="maab-hero relative isolate space-y-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 lg:hidden">
          <div aria-hidden className="maab-pattern absolute inset-0 -z-10" />
          <LogoHorizontal tone="hero" />
          <AdminNav variant="top" badges={shell.badges} />
        </header>
        <main className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

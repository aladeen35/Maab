import { CircleAlert, CircleCheck, CircleDashed } from 'lucide-react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { Card, SectionTitle } from '@/components/ui/Card';
import { CopyButton } from '@/components/ui/CopyButton';
import { IS_LIVE } from '@/lib/data';
import type { SystemStatus } from '@/server/services/system';
import { DEMO_STATUS } from './demo';
import { GoogleMeetCard, PaymentAccountsEditor, PushTestButton } from './SettingsPanels';

export const metadata: Metadata = { title: 'الإعدادات' };

const JOB_LABEL: Record<string, string> = {
  outbox: 'روابط الحصص والرسائل',
  reminders: 'تذكير الحصص',
  'orders.expire': 'إلغاء الطلبات غير المدفوعة',
  'subscriptions.expire': 'انتهاء الباقات',
  'reports.late': 'التقارير المتأخرة',
  cleanup: 'التنظيف اليومي',
};

function ago(iso: string, now: number): string {
  const min = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'قبل أقل من دقيقة';
  if (min < 60) return `قبل ${min} دقيقة`;
  const h = Math.round(min / 60);
  return h < 48 ? `قبل ${h} ساعة` : `قبل ${Math.round(h / 24)} يوماً`;
}

function Row({ ok, warn, label, children }: { ok: boolean; warn?: boolean; label: string; children: ReactNode }) {
  const Icon = ok ? CircleCheck : warn ? CircleDashed : CircleAlert;
  return (
    <li className="flex gap-3 py-3">
      <Icon className={ok ? 'mt-0.5 size-5 shrink-0 text-success' : warn ? 'mt-0.5 size-5 shrink-0 text-muted' : 'mt-0.5 size-5 shrink-0 text-danger'} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{label}</p>
        <div className="mt-0.5 text-xs leading-5 text-muted">{children}</div>
      </div>
    </li>
  );
}

async function load(): Promise<SystemStatus | 'forbidden'> {
  if (!IS_LIVE) return { ...DEMO_STATUS, tick: { at: new Date(Date.now() - 40_000).toISOString(), ok: true } };
  const { requireViewer } = await import('@/server/dataset');
  const viewer = await requireViewer('admin');
  const { can } = await import('@/lib/domain/permissions');
  if (!can(viewer.roles, 'settings.manage')) return 'forbidden';
  const { systemStatus } = await import('@/server/services/system');
  return systemStatus(viewer);
}

export default async function AdminSettings() {
  const s = await load();
  const now = new Date().getTime();
  if (s === 'forbidden') {
    return (
      <Card className="p-6 text-center text-sm text-muted">الإعدادات للمدير العام وحده.</Card>
    );
  }
  const tickOk = Boolean(s.tick && now - new Date(s.tick.at).getTime() < 5 * 60_000);
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold text-ink">الإعدادات</h1>
        <p className="mt-1 text-sm text-muted">حالة التشغيل، وربط Google للحصص، وحسابات استلام التحويلات.</p>
      </div>

      <Card className="p-4">
        <SectionTitle>حالة التشغيل</SectionTitle>
        <ul className="divide-y divide-line">
          <Row ok label="قاعدة البيانات">متصلة.</Row>
          <Row ok={tickOk} label="نبضة المهام كل دقيقة">
            {s.tick ? (
              <>آخر نبضة {ago(s.tick.at, now)}{tickOk ? '.' : '؛ النبضة متوقفة: أعيدي النشر من Vercel ليُعاد ضبطها، وتأكدي من تفعيل pg_cron وpg_net في Supabase.'}</>
            ) : (
              'لم تصل نبضة بعد. تُضبط تلقائياً عند النشر على Vercel؛ إن مرت دقائق بلا نبضة فراجعي سجل البناء.'
            )}
          </Row>
          <Row ok={s.email.ready} label="البريد (رموز الدخول والإشعارات)">
            {s.email.ready ? <>يُرسل من <bdi dir="ltr">{s.email.from.match(/<([^>]+)>/)?.[1] ?? s.email.from}</bdi>.</> : 'غير مفعّل: أضيفي GMAIL_USER وGMAIL_APP_PASSWORD في Vercel.'}
          </Row>
          <Row ok={s.login.google} label="الدخول بحساب Google">
            {s.login.google ? 'مفعّل.' : 'غير مفعّل: أضيفي GOOGLE_CLIENT_ID في Vercel.'}
          </Row>
          <Row ok={s.whatsapp} warn={!s.whatsapp} label="واتساب (اختياري لاحقاً)">
            {s.whatsapp ? 'مفعّل للدخول برقم الجوال.' : 'غير مفعّل، فالدخول برقم الجوال مخفي. يُفعَّل لاحقاً بحساب WhatsApp Cloud API.'}
          </Row>
          <Row ok label="تخزين الملفات">
            {s.storage === 'supabase' ? 'Supabase Storage (مساحات خاصة).' : s.storage === 'db' ? 'داخل قاعدة البيانات (مناسب للتجربة).' : 'على قرص الخادم.'}
          </Row>
        </ul>
        {s.jobs.length > 0 && (
          <details className="mt-2 text-xs text-muted">
            <summary className="cursor-pointer font-bold text-brand">آخر تشغيل لكل مهمة</summary>
            <ul className="mt-2 space-y-1">
              {s.jobs.map((j) => (
                <li key={j.name} className="flex justify-between gap-2">
                  <span>{JOB_LABEL[j.name] ?? j.name}</span>
                  <span className={j.ok === false ? 'text-danger' : ''}>{j.ok === false ? `فشل: ${j.error}` : ago(j.at, now)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="mt-3 border-t border-line pt-3">
          <PushTestButton />
        </div>
      </Card>

      <Suspense fallback={<Card className="h-40 p-4" />}>
        <GoogleMeetCard google={s.google} />
      </Suspense>

      <Card className="space-y-2 p-4">
        <SectionTitle>روابط للنسخ في Google Cloud</SectionTitle>
        <p className="text-xs leading-5 text-muted">تُلصق في بيانات اعتماد OAuth (Web client) كما هي.</p>
        <div className="flex items-center justify-between gap-2 rounded-ctl bg-field px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] text-muted">Authorized JavaScript origins</p>
            <bdi dir="ltr" className="block truncate text-sm font-semibold text-ink">{s.google.origin}</bdi>
          </div>
          <CopyButton value={s.google.origin} label="الرابط" />
        </div>
        <div className="flex items-center justify-between gap-2 rounded-ctl bg-field px-3 py-2">
          <div className="min-w-0">
            <p className="text-[11px] text-muted">Authorized redirect URIs</p>
            <bdi dir="ltr" className="block truncate text-sm font-semibold text-ink">{s.google.redirectUri}</bdi>
          </div>
          <CopyButton value={s.google.redirectUri} label="الرابط" />
        </div>
      </Card>

      <PaymentAccountsEditor accounts={s.accounts} />
    </>
  );
}

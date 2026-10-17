'use client';

import { BellRing, CircleCheck, Link2, Plus, RefreshCw, Unplug, Video } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { SelectField, TextArea, TextField } from '@/components/ui/Field';
import { api, errorText, IS_LIVE } from '@/lib/api';
import { enablePush } from '@/lib/push';
import type { SystemStatus } from '@/server/services/system';

const GOOGLE_RESULT: Record<string, { tone: 'success' | 'danger'; text: string }> = {
  connected: { tone: 'success', text: 'رُبط حساب Google. جرّبي «رابط تجريبي» للتأكد.' },
  denied: { tone: 'danger', text: 'أُلغيت الموافقة في Google، فلم يُربط الحساب.' },
  expired: { tone: 'danger', text: 'انتهت مهلة الربط، أعيدي المحاولة.' },
  no_refresh: { tone: 'danger', text: 'لم تُرسل Google رمز التحديث: أزيلي وصول «مآب» من إعدادات حساب Google (الأمان ← تطبيقات الجهات الخارجية) ثم أعيدي الربط.' },
  failed: { tone: 'danger', text: 'تعذّر الربط. تأكدي أن رابط الرجوع أدناه مضاف في Google Cloud كما هو.' },
};

export function GoogleMeetCard({ google }: { google: SystemStatus['google'] }) {
  const router = useRouter();
  const result = GOOGLE_RESULT[useSearchParams().get('google') ?? ''];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string; url?: string }>();

  async function call(path: string, method: 'POST' | 'DELETE', done: (r: Record<string, unknown>) => string, url?: (r: Record<string, unknown>) => string) {
    if (!IS_LIVE) return setMessage({ tone: 'success', text: 'نسخة العرض: يعمل هذا في النسخة الحية.' });
    setBusy(true);
    setMessage(undefined);
    try {
      const r = await api<Record<string, unknown>>(path, { method });
      setMessage({ tone: 'success', text: done(r), url: url?.(r) });
      router.refresh();
    } catch (e) {
      setMessage({ tone: 'danger', text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <SectionTitle action={google.connected ? <Badge tone="success">مربوط</Badge> : <Badge tone="gold">غير مربوط</Badge>}>Google Meet للحصص</SectionTitle>
      <p className="text-xs leading-5 text-muted">
        تُنشأ غرفة Meet لكل حصة من حساب الأكاديمية، مفتوحة لمن معه الرابط فلا تنتظر المعلمة أو الطالب قبول الدخول. الرابط لا يُرسل لأحد، ويظهر زر «ادخل الحصة» قبل الموعد بعشر دقائق.
      </p>
      {result && <p className={result.tone === 'success' ? 'rounded-ctl bg-success/10 p-3 text-sm text-success' : 'rounded-ctl bg-danger/8 p-3 text-sm text-danger'}>{result.text}</p>}
      {!google.configured ? (
        <p className="rounded-ctl bg-warning/10 p-3 text-sm text-warning">أضيفي GOOGLE_CLIENT_ID وGOOGLE_CLIENT_SECRET في متغيرات Vercel ثم أعيدي النشر.</p>
      ) : google.connected ? (
        <>
          <p className="text-sm text-ink">
            الحساب: <bdi dir="ltr" className="font-bold">{google.email ?? '—'}</bdi>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => call('/admin/google/test', 'POST', (r) => (r.provider === 'google_meet_api' ? 'أُنشئت غرفة Meet مفتوحة.' : 'أُنشئ موعد تقويم بغرفة Meet (فعّلي Meet API لغرف مفتوحة).'), (r) => String(r.joinUrl))}>
              <Video className="size-4" aria-hidden />
              رابط تجريبي
            </Button>
            <Button size="sm" variant="soft" disabled={busy} onClick={() => call('/admin/meetings/regenerate', 'POST', (r) => (r.queued ? `سيُعاد إنشاء ${r.queued} رابطاً خلال دقيقة.` : 'لا روابط تجريبية في الحصص القادمة.'))}>
              <RefreshCw className="size-4" aria-hidden />
              تحديث روابط الحصص القادمة
            </Button>
            <Button size="sm" variant="danger" disabled={busy} onClick={() => confirm('فصل حساب Google؟ لن تُنشأ روابط جديدة للحصص حتى يُعاد الربط.') && call('/admin/google/connect', 'DELETE', () => 'فُصل الحساب.')}>
              <Unplug className="size-4" aria-hidden />
              فصل
            </Button>
          </div>
        </>
      ) : (
        <a href="/api/v1/admin/google/connect" className="inline-flex h-10 items-center gap-2 rounded-ctl bg-brand px-4 text-sm font-bold text-on-brand">
          <Link2 className="size-4" aria-hidden />
          ربط حساب Google الخاص بالأكاديمية
        </a>
      )}
      {message && (
        <p className={message.tone === 'success' ? 'rounded-ctl bg-success/10 p-3 text-sm text-success' : 'rounded-ctl bg-danger/8 p-3 text-sm text-danger'}>
          {message.text}{' '}
          {message.url && (
            <a href={message.url} target="_blank" rel="noreferrer" className="font-bold underline">
              افتحي الرابط
            </a>
          )}
        </p>
      )}
    </Card>
  );
}

type Account = SystemStatus['accounts'][number];

const METHODS: { value: Account['method']; label: string; currency: Account['currency'] }[] = [
  { value: 'bank_transfer_sa', label: 'تحويل بنكي سعودي', currency: 'SAR' },
  { value: 'sudan_transfer', label: 'بنكك أو بنك سوداني', currency: 'SDG' },
  { value: 'international_transfer', label: 'تحويل دولي', currency: 'USD' },
];

const EMPTY: Omit<Account, 'id'> = { method: 'bank_transfer_sa', currency: 'SAR', title: '', bankName: '', accountName: '', accountNumber: '', instructions: '', active: true };

function AccountForm({ initial, onDone }: { initial: Account | null; onDone: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<Omit<Account, 'id'>>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const id = initial?.id ?? 'new';
  return (
    <form
      className="space-y-3 rounded-ctl border border-line p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!IS_LIVE) return onDone();
        setBusy(true);
        setError(undefined);
        try {
          await api(initial ? `/admin/payment-accounts/${initial.id}` : '/admin/payment-accounts', { method: initial ? 'PUT' : 'POST', body: f });
          router.refresh();
          onDone();
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <SelectField
        id={`m-${id}`}
        label="طريقة الدفع"
        value={f.method}
        onChange={(e) => {
          const m = METHODS.find((x) => x.value === e.target.value)!;
          setF((x) => ({ ...x, method: m.value, currency: m.currency, title: x.title || m.label }));
        }}
      >
        {METHODS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label} ({m.currency})
          </option>
        ))}
      </SelectField>
      <TextField id={`t-${id}`} label="العنوان الظاهر لولي الأمر" value={f.title} onChange={set('title')} required />
      <TextField id={`b-${id}`} label="البنك" placeholder="مثال: بنك الخرطوم — بنكك" value={f.bankName} onChange={set('bankName')} required />
      <TextField id={`n-${id}`} label="اسم صاحب الحساب" value={f.accountName} onChange={set('accountName')} required />
      <TextField id={`a-${id}`} label="رقم الحساب أو الآيبان" dir="ltr" className="[&_input]:text-left" value={f.accountNumber} onChange={set('accountNumber')} required />
      <TextArea id={`i-${id}`} label="تعليمات التحويل" value={f.instructions} onChange={set('instructions')} />
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} className="size-4 accent-[rgb(var(--brand))]" />
        يظهر عند الدفع
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          حفظ
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}

export function PaymentAccountsEditor({ accounts }: { accounts: Account[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Card className="space-y-3 p-4">
      <SectionTitle
        action={
          <Button size="xs" variant="soft" onClick={() => setEditing('new')}>
            <Plus className="size-3.5" aria-hidden />
            حساب
          </Button>
        }
      >
        حسابات الاستلام
      </SectionTitle>
      <p className="text-xs leading-5 text-muted">تظهر لولي الأمر عند الدفع حسب عملته. استبدلي البيانات التجريبية بحساباتك قبل التجربة الحقيقية.</p>
      {editing === 'new' && <AccountForm initial={null} onDone={() => setEditing(null)} />}
      <ul className="space-y-2">
        {accounts.map((a) =>
          editing === a.id ? (
            <li key={a.id}>
              <AccountForm initial={a} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={a.id} className="flex items-start gap-3 rounded-ctl bg-field p-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-bold text-ink">
                  {a.title} <span className="text-xs text-muted">({a.currency})</span> {!a.active && <Badge>مخفي</Badge>}
                </p>
                <p className="text-muted">
                  {a.bankName} — {a.accountName}
                </p>
                <bdi dir="ltr" className="tabular block text-ink">
                  {a.accountNumber}
                </bdi>
                {a.instructions.includes('تجريبية') && <p className="mt-1 text-xs font-semibold text-warning">بيانات تجريبية، عدّليها</p>}
              </div>
              <Button size="xs" variant="ghost" onClick={() => setEditing(a.id)}>
                تعديل
              </Button>
            </li>
          ),
        )}
      </ul>
    </Card>
  );
}

/** تفعيل إشعارات هذا الجهاز وإرسال إشعار تجريبي */
export function PushTestButton() {
  const [state, setState] = useState<{ tone: 'success' | 'danger'; text: string }>();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="soft"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setState(undefined);
          try {
            if (!IS_LIVE) throw new Error('إشعارات الجهاز تعمل في النسخة الحية.');
            await enablePush();
            const r = await api<{ sent: number }>('/push/test', { method: 'POST' });
            setState({ tone: 'success', text: r.sent ? 'أُرسل إشعار تجريبي لهذا الجهاز.' : 'لا جهاز مفعّل للإشعارات بعد.' });
          } catch (e) {
            setState({ tone: 'danger', text: e instanceof Error && !('code' in e) ? e.message : errorText(e) });
          } finally {
            setBusy(false);
          }
        }}
      >
        <BellRing className="size-4" aria-hidden />
        تفعيل إشعارات هذا الجهاز وتجربتها
      </Button>
      {state && (
        <p className={state.tone === 'success' ? 'flex items-center gap-1.5 text-xs text-success' : 'text-xs text-danger'}>
          {state.tone === 'success' && <CircleCheck className="size-3.5" aria-hidden />}
          {state.text}
        </p>
      )}
    </div>
  );
}

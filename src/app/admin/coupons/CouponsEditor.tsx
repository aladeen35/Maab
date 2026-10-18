'use client';

import { Plus, TicketPercent } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { CopyButton } from '@/components/ui/CopyButton';
import { TextField } from '@/components/ui/Field';
import { api, errorText, IS_LIVE } from '@/lib/api';
import type { CouponRow } from '@/server/services/manage';

type Form = { code: string; percent: string; endsOn: string; maxUses: string; maxUsesPerUser: string; active: boolean };

const inYear = () => new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);

function CouponForm({ initial, onDone }: { initial: CouponRow | null; onDone: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(
    initial
      ? { code: initial.code, percent: String(initial.percent ?? ''), endsOn: initial.endsOn, maxUses: initial.maxUses ? String(initial.maxUses) : '', maxUsesPerUser: String(initial.maxUsesPerUser), active: initial.active }
      : { code: '', percent: '', endsOn: inYear(), maxUses: '', maxUsesPerUser: '1', active: true },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
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
          const body = {
            code: f.code.trim().toUpperCase(),
            percent: Number(f.percent),
            endsOn: f.endsOn || null,
            maxUses: f.maxUses ? Number(f.maxUses) : null,
            maxUsesPerUser: Number(f.maxUsesPerUser) || 1,
            active: f.active,
          };
          await api(initial ? `/admin/coupons/${initial.id}` : '/admin/coupons', { method: initial ? 'PUT' : 'POST', body });
          router.refresh();
          onDone();
        } catch (err) {
          setError(errorText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id={`c-${id}`}
          label="الرمز"
          hint="حروف إنجليزية وأرقام، مثل MAAB20"
          dir="ltr"
          className="[&_input]:text-left [&_input]:uppercase"
          value={f.code}
          onChange={(e) => setF((x) => ({ ...x, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))}
          minLength={3}
          maxLength={30}
          required
        />
        <TextField id={`p-${id}`} label="نسبة الخصم %" type="number" inputMode="numeric" min={1} max={100} value={f.percent} onChange={set('percent')} required />
        <TextField id={`e-${id}`} label="ينتهي في" type="date" value={f.endsOn} onChange={set('endsOn')} required />
        <TextField id={`m-${id}`} label="عدد مرات الاستخدام الكلي" hint="فارغ = بلا حد" type="number" inputMode="numeric" min={1} value={f.maxUses} onChange={set('maxUses')} />
        <TextField id={`u-${id}`} label="مرات الاستخدام لكل أسرة" type="number" inputMode="numeric" min={1} max={100} value={f.maxUsesPerUser} onChange={set('maxUsesPerUser')} required />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} className="size-4 accent-[rgb(var(--brand))]" />
        مفعّل
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

export function CouponsEditor({ coupons }: { coupons: CouponRow[] }) {
  const [editing, setEditing] = useState<string | null>(coupons.length ? null : 'new');
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card className="space-y-3 p-4">
      <SectionTitle
        action={
          <Button size="xs" variant="soft" onClick={() => setEditing('new')}>
            <Plus className="size-3.5" aria-hidden />
            كوبون
          </Button>
        }
      >
        الكوبونات
      </SectionTitle>
      {editing === 'new' && <CouponForm initial={null} onDone={() => setEditing(null)} />}
      {coupons.length === 0 && editing !== 'new' && <p className="text-sm text-muted">لا كوبونات بعد.</p>}
      <ul className="space-y-2">
        {coupons.map((c) => {
          const expired = c.endsOn < today;
          const full = c.maxUses != null && c.used >= c.maxUses;
          return editing === c.id ? (
            <li key={c.id}>
              <CouponForm initial={c} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={c.id} className="flex items-start gap-3 rounded-ctl bg-field p-3">
              <TicketPercent className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden />
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
                  <bdi dir="ltr" className="tabular">{c.code}</bdi>
                  <span className="text-brand">خصم {c.percent ?? '—'}%</span>
                  {!c.active ? <Badge>موقوف</Badge> : expired ? <Badge tone="danger">منتهٍ</Badge> : full ? <Badge tone="warning">اكتمل</Badge> : <Badge tone="success">فعّال</Badge>}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  استُخدم {c.used}
                  {c.maxUses != null ? ` من ${c.maxUses}` : ''} · {c.maxUsesPerUser === 1 ? 'مرة لكل أسرة' : `${c.maxUsesPerUser} مرات لكل أسرة`} · حتى <span className="tabular">{c.endsOn}</span>
                </p>
              </div>
              <CopyButton value={c.code} label="الرمز" />
              <Button size="xs" variant="ghost" onClick={() => setEditing(c.id)}>
                تعديل
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

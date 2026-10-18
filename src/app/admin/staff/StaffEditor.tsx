'use client';

import { UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { TextField } from '@/components/ui/Field';
import { api, errorText, IS_LIVE } from '@/lib/api';
import { ROLES, STAFF_ROLE_HELP, type Role } from '@/lib/domain/permissions';
import type { StaffRow } from '@/server/services/manage';

const ORDER: Role[] = ['super_admin', 'supervisor', 'finance', 'support'];

function StaffForm({ initial, onDone }: { initial: StaffRow | null; onDone: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState(initial?.email ?? '');
  const [roles, setRoles] = useState<Role[]>(initial?.roles.filter((r) => ORDER.includes(r)) ?? ['supervisor']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const id = initial?.id ?? 'new';

  async function save(next: Role[]) {
    if (!IS_LIVE) return onDone();
    setBusy(true);
    setError(undefined);
    try {
      await api('/admin/staff', { method: 'POST', body: { email: email.trim(), roles: next } });
      router.refresh();
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-3 rounded-ctl border border-line p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!roles.length) return setError('اختاري دوراً واحداً على الأقل، أو استعملي «إزالة من الفريق».');
        void save(roles);
      }}
    >
      <TextField
        id={`s-${id}`}
        label="البريد الإلكتروني"
        type="email"
        dir="ltr"
        className="[&_input]:text-left"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        readOnly={Boolean(initial)}
        required
      />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-bold text-ink">الأدوار</legend>
        {ORDER.map((r) => (
          <label key={r} className="flex items-start gap-2 rounded-ctl bg-field p-2.5 text-sm">
            <input
              type="checkbox"
              checked={roles.includes(r)}
              onChange={(e) => setRoles((x) => (e.target.checked ? [...x, r] : x.filter((y) => y !== r)))}
              className="mt-0.5 size-4 accent-[rgb(var(--brand))]"
            />
            <span>
              <span className="font-bold text-ink">{ROLES[r]}</span>
              <span className="block text-xs text-muted">{STAFF_ROLE_HELP[r]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          حفظ
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          إلغاء
        </Button>
        {initial && (
          <Button size="sm" variant="danger" className="ms-auto" disabled={busy} onClick={() => confirm(`إزالة ${initial.email} من فريق الإدارة؟`) && save([])}>
            إزالة من الفريق
          </Button>
        )}
      </div>
    </form>
  );
}

export function StaffEditor({ staff, me }: { staff: StaffRow[]; me: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Card className="space-y-3 p-4">
      <SectionTitle
        action={
          <Button size="xs" variant="soft" onClick={() => setEditing('new')}>
            <UserPlus className="size-3.5" aria-hidden />
            عضو
          </Button>
        }
      >
        الأعضاء
      </SectionTitle>
      {editing === 'new' && <StaffForm initial={null} onDone={() => setEditing(null)} />}
      <ul className="space-y-2">
        {staff.map((s) =>
          editing === s.id ? (
            <li key={s.id}>
              <StaffForm initial={s} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={s.id} className="flex items-start gap-3 rounded-ctl bg-field p-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-bold text-ink">
                  {s.name || 'لم يدخل بعد'} {s.id === me && <span className="text-xs font-normal text-muted">(أنتِ)</span>}
                </p>
                <bdi dir="ltr" className="block truncate text-muted">
                  {s.email ?? s.phone}
                </bdi>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {s.roles.filter((r) => ORDER.includes(r)).map((r) => (
                    <Badge key={r} tone={r === 'super_admin' ? 'gold' : 'brand'}>
                      {ROLES[r]}
                    </Badge>
                  ))}
                </div>
              </div>
              {s.email && (
                <Button size="xs" variant="ghost" onClick={() => setEditing(s.id)}>
                  تعديل
                </Button>
              )}
            </li>
          ),
        )}
      </ul>
    </Card>
  );
}

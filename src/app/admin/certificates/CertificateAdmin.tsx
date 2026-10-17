'use client';

import { Award } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/Card';
import { SelectField, TextArea, TextField } from '@/components/ui/Field';
import { api, errorText, IS_LIVE } from '@/lib/api';

type Pick = { id: string; name: string; gender: 'female' | 'male' };

const PRESETS = ['دورة أحكام التجويد', 'دورة أحكام النون الساكنة والتنوين', 'دورة مخارج الحروف', 'الدورة الصيفية للحفظ'];

const bodyFor = (title: string, gender: 'female' | 'male' | undefined) =>
  title ? `${gender === 'male' ? 'أتمّ الطالب' : 'أتمّت الطالبة'} ${title} بنجاح، تحت إشراف أكاديمية مآب لتحفيظ القرآن الكريم.` : '';

export function IssueCertificateForm({ demoStudents }: { demoStudents: Pick[] | null }) {
  const router = useRouter();
  const [students, setStudents] = useState<Pick[]>(demoStudents ?? []);
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState(PRESETS[0]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; code?: string }>();

  useEffect(() => {
    if (!IS_LIVE) return;
    api<{ id: string; fullName: string; gender: 'female' | 'male' }[]>('/students')
      .then((rows) => setStudents(rows.map((r) => ({ id: r.id, name: r.fullName, gender: r.gender }))))
      .catch(() => setStudents([]));
  }, []);

  const gender = students.find((s) => s.id === studentId)?.gender;
  const shownBody = body || bodyFor(title, gender);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!studentId) return setResult({ ok: false, text: 'اختاري الطالب أو الطالبة' });
        if (!IS_LIVE) return setResult({ ok: true, text: 'نسخة العرض: تصدر الشهادة في النسخة الحية.', code: 'MHD7TJW5QN' });
        setBusy(true);
        setResult(undefined);
        try {
          const r = await api<{ code: string; serial: string }>('/certificates', { body: { studentId, title: title.trim(), body: shownBody.trim() } });
          setResult({ ok: true, text: `صدرت الشهادة ${r.serial} ووصل إشعارها للأسرة.`, code: r.code });
          setBody('');
          router.refresh();
        } catch (err) {
          setResult({ ok: false, text: errorText(err) });
        } finally {
          setBusy(false);
        }
      }}
    >
      <SectionTitle>إصدار شهادة إتمام دورة</SectionTitle>
      <SelectField id="cert-student" label="الطالب أو الطالبة" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
        <option value="">— اختاري —</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </SelectField>
      <TextField id="cert-title" label="اسم الدورة" list="cert-presets" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <datalist id="cert-presets">
        {PRESETS.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <TextArea id="cert-body" label="نص الشهادة" value={shownBody} onChange={(e) => setBody(e.target.value)} hint="يظهر تحت اسم الطالب في الشهادة." />
      {result && (
        <p className={result.ok ? 'rounded-ctl bg-success/10 p-3 text-sm text-success' : 'rounded-ctl bg-danger/8 p-3 text-sm text-danger'}>
          {result.text}{' '}
          {result.code && (
            <a href={`/c/${result.code}`} className="font-bold underline">
              افتحي الشهادة
            </a>
          )}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        <Award className="size-5" aria-hidden />
        إصدار الشهادة
      </Button>
    </form>
  );
}

export function RevokeList({ items }: { items: { id: string; label: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  return (
    <details className="rounded-card bg-card p-4 text-sm shadow-card">
      <summary className="cursor-pointer font-bold text-danger">إلغاء شهادة صدرت بالخطأ</summary>
      <ul className="mt-3 space-y-2">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-ink">{c.label}</span>
            <Button
              size="xs"
              variant="danger"
              onClick={async () => {
                const reason = prompt('سبب الإلغاء (يظهر في صفحة التحقق):');
                if (!reason || reason.trim().length < 5) return;
                if (!IS_LIVE) return;
                try {
                  await api(`/certificates/${c.id}/revoke`, { body: { reason } });
                  router.refresh();
                } catch (e) {
                  setError(errorText(e));
                }
              }}
            >
              إلغاء
            </Button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-danger">{error}</p>}
    </details>
  );
}

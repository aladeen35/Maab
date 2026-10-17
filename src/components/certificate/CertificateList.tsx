import { Award, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { Card, SectionTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Chip';
import { fmtDayMonth } from '@/lib/format';
import type { Certificate } from '@/lib/types';

/** قائمة شهادات الطالب، كل واحدة تفتح صفحتها للحفظ والمشاركة */
export function CertificateList({ items, empty }: { items: Certificate[]; empty?: string }) {
  if (!items.length && !empty) return null;
  return (
    <section className="space-y-3">
      <SectionTitle>الشهادات</SectionTitle>
      {!items.length ? (
        <Card className="p-4 text-sm leading-6 text-muted">{empty}</Card>
      ) : (
        <Card className="divide-y divide-line">
          {items.map((c) => (
            <Link key={c.id} href={`/c/${c.code}`} className="flex items-center gap-3 px-4 py-3 hover:bg-field">
              <span className="grid size-10 shrink-0 place-items-center rounded-ctl bg-gold/16 text-gold-text" aria-hidden>
                <Award className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">{c.title}</span>
                <span className="block text-xs text-muted">
                  {fmtDayMonth(new Date(c.issuedAt))} · <bdi dir="ltr">{c.serial}</bdi>
                </span>
              </span>
              {c.revokedAt ? <Badge tone="danger">ملغاة</Badge> : <Badge tone="gold">افتحي</Badge>}
              <ChevronLeft className="size-4 text-muted" aria-hidden />
            </Link>
          ))}
        </Card>
      )}
    </section>
  );
}

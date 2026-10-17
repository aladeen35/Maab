'use client';

import { Printer, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

/** حفظ الشهادة PDF أو طباعتها، ومشاركة رابطها (واتساب وغيره) */
export function CertificateActions({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap justify-center gap-2 print:hidden">
      <Button onClick={() => window.print()}>
        <Printer className="size-5" aria-hidden />
        حفظ PDF أو طباعة
      </Button>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            if (navigator.share) return await navigator.share({ title, text: `${title} — أكاديمية مآب`, url });
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {}
        }}
      >
        <Share2 className="size-5" aria-hidden />
        {copied ? 'نُسخ الرابط' : 'مشاركة'}
      </Button>
    </div>
  );
}

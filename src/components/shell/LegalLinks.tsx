import Link from 'next/link';
import { cn } from '@/lib/cn';

/** روابط تذييل الصفحات العامة: سياسة الخصوصية وصفحة المطور (هدف لمس 44px) */
export function LegalLinks({ tone = 'page', className }: { tone?: 'page' | 'hero'; className?: string }) {
  const link = cn(
    'inline-flex min-h-11 items-center px-2 text-xs font-semibold underline-offset-4 hover:underline',
    tone === 'hero' ? 'text-on-hero/75' : 'text-muted',
  );
  return (
    <nav aria-label="روابط عامة" className={cn('flex items-center justify-center gap-1', className)}>
      <Link href="/legal/privacy" className={link}>
        سياسة الخصوصية
      </Link>
      <span aria-hidden className={tone === 'hero' ? 'text-on-hero/40' : 'text-line'}>
        ·
      </span>
      <Link href="/about" className={link}>
        عن المطور والمنظومة
      </Link>
    </nav>
  );
}

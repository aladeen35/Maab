'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** نسخة العرض الثابتة: تحويل من المتصفح لصفحة الدخول */
export function GoLogin() {
  const router = useRouter();
  useEffect(() => router.replace('/login'), [router]);
  return (
    <p className="p-8 text-center text-sm">
      <Link href="/login" className="font-bold text-brand underline">
        تسجيل الدخول
      </Link>
    </p>
  );
}

'use client';

import { LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { api, IS_LIVE } from '@/lib/api';

/** إنهاء الجلسة ثم صفحة الدخول: الدور الإداري يُمنح عند الدخول */
export function ReLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      block
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        if (IS_LIVE) await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        router.push('/login');
        router.refresh();
      }}
    >
      <LogIn className="size-5" aria-hidden />
      تسجيل الخروج والدخول من جديد
    </Button>
  );
}

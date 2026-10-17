'use client';

import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { api, ApiFailure, errorText, IS_LIVE } from '@/lib/api';

const PHRASE = 'احذف حسابي';

export function DeleteAccountForm() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return <p className="text-center text-sm font-bold text-success">حُذف الحساب. في أمان الله.</p>;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (text.trim() !== PHRASE) return setError(`اكتبي «${PHRASE}» للتأكيد`);
        if (!IS_LIVE) return setDone(true);
        setBusy(true);
        setError(undefined);
        try {
          await api('/me', { method: 'DELETE', body: { confirm: PHRASE } });
          setDone(true);
          setTimeout(() => router.push('/'), 1500);
        } catch (err) {
          if (err instanceof ApiFailure && err.status === 401) setNeedLogin(true);
          setError(errorText(err));
          setBusy(false);
        }
      }}
    >
      <TextField id="confirm" label={`للتأكيد اكتبي: ${PHRASE}`} value={text} onChange={(e) => (setText(e.target.value), setError(undefined))} error={error} autoComplete="off" />
      {needLogin && (
        <Link href="/login" className="block text-center text-sm font-bold text-brand underline">
          سجّلي الدخول أولاً ثم عودي لهذه الصفحة من «حسابي»
        </Link>
      )}
      <Button type="submit" variant="danger" block disabled={busy}>
        <Trash2 className="size-5" aria-hidden />
        حذف الحساب نهائياً
      </Button>
    </form>
  );
}

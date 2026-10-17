'use client';

import { BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IS_LIVE } from '@/lib/api';
import { enablePush, pushEnabled, pushSupported } from '@/lib/push';

/** دعوة لتفعيل إشعارات الجهاز (تذكير الحصص والتقارير)، تختفي بعد التفعيل */
export function EnablePush() {
  const [state, setState] = useState<'hidden' | 'offer' | 'busy' | 'done' | 'error'>('hidden');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!IS_LIVE || !pushSupported()) return;
    let alive = true;
    pushEnabled().then((on) => alive && setState(on ? 'hidden' : 'offer'));
    return () => {
      alive = false;
    };
  }, []);

  if (state === 'hidden') return null;
  if (state === 'done') return <p className="rounded-card bg-success/10 p-3 text-center text-sm font-semibold text-success">تمام، تصلك الإشعارات على هذا الجهاز.</p>;
  return (
    <div className="flex items-center gap-3 rounded-card bg-gold/12 p-3.5">
      <BellRing className="size-6 shrink-0 text-gold-text" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold text-ink">فعّلي إشعارات الجهاز</p>
        <p className="text-xs leading-5 text-muted">{error ?? 'تذكير قبل الحصة، والتقرير فور كتابته، واعتماد الدفع.'}</p>
      </div>
      <button
        type="button"
        disabled={state === 'busy'}
        className="h-9 shrink-0 rounded-ctl bg-brand px-3.5 text-sm font-bold text-on-brand disabled:opacity-50"
        onClick={async () => {
          setState('busy');
          try {
            await enablePush();
            setState('done');
          } catch (e) {
            setError(e instanceof Error ? e.message : 'تعذّر التفعيل');
            setState('error');
          }
        }}
      >
        تفعيل
      </button>
    </div>
  );
}

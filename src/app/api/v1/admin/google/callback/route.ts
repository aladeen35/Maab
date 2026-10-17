import { route } from '@/server/api/route';
import { checkState, exchangeCode, saveConnection, STATE_COOKIE } from '@/server/services/google';
import { ApiError } from '@/server/api/http';

// عودة Google بعد الموافقة: يُتحقق من الحالة ثم يُحفظ رمز التحديث مشفّراً،
// وتعود المديرة لصفحة الإعدادات برسالة النتيجة
export const GET = route({ can: 'settings.manage' }, async (ctx) => {
  const back = (status: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `/admin/settings?google=${status}`, 'Cache-Control': 'no-store', 'Set-Cookie': `${STATE_COOKIE}=; Path=/api/v1/admin/google; Max-Age=0` },
    });
  const q = ctx.url.searchParams;
  if (q.get('error')) return back('denied');
  const nonce = ctx.req.headers.get('cookie')?.match(new RegExp(`${STATE_COOKIE}=([^;]+)`))?.[1];
  if (!checkState(q.get('state') ?? '', nonce, ctx.viewer.userId)) return back('expired');
  try {
    await saveConnection(ctx.viewer, await exchangeCode(q.get('code') ?? ''), ctx.ip);
    return back('connected');
  } catch (e) {
    return back(e instanceof ApiError && e.code === 'google_no_refresh' ? 'no_refresh' : 'failed');
  }
});

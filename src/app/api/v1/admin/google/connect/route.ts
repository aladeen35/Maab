import { ApiError } from '@/server/api/http';
import { route } from '@/server/api/route';
import { isProduction } from '@/server/env';
import { authUrl, disconnect, googleConfigured, newState, STATE_COOKIE } from '@/server/services/google';

// يبدأ ربط حساب Google للحصص: تحويل لصفحة موافقة Google
export const GET = route({ can: 'settings.manage' }, async (ctx) => {
  if (!googleConfigured()) throw new ApiError(503, 'google_not_configured', 'أضيفي GOOGLE_CLIENT_ID وGOOGLE_CLIENT_SECRET في إعدادات الاستضافة أولاً');
  const { state, nonce } = newState(ctx.viewer.userId);
  ctx.headers.append('Set-Cookie', `${STATE_COOKIE}=${nonce}; Path=/api/v1/admin/google; HttpOnly; SameSite=Lax; Max-Age=600${isProduction() ? '; Secure' : ''}`);
  return new Response(null, { status: 302, headers: { Location: authUrl(state), 'Cache-Control': 'no-store' } });
});

// فصل الحساب وإلغاء إذنه
export const DELETE = route({ can: 'settings.manage' }, async (ctx) => {
  await disconnect(ctx.viewer, ctx.ip);
  return { connected: false };
});

import { route } from '@/server/api/route';
import { S } from '@/server/api/contract';
import { clearSessionCookie } from '@/server/auth/session';
import { deleteAccount, getMe, updateMe } from '@/server/services/account';

export const GET = route({}, async ({ viewer }) => getMe(viewer));

export const PATCH = route({}, async (ctx) => updateMe(ctx.viewer, await ctx.json(S.mePatch)));

// حذف الحساب نهائياً بعد تأكيد مكتوب، ثم إنهاء الجلسة
export const DELETE = route({ limit: { max: 5, windowSec: 600 } }, async (ctx) => {
  await ctx.json(S.accountDelete);
  const out = await deleteAccount(ctx.viewer, ctx.ip);
  ctx.headers.append('Set-Cookie', clearSessionCookie());
  return out;
});

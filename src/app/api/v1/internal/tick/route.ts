import { ApiError } from '@/server/api/http';
import { route } from '@/server/api/route';
import { verifyCronSecret } from '@/server/auth/cron';
import { runDue } from '@/server/scheduler';

// نبضة المهام كل دقيقة (pg_cron في Supabase)؛ مهلة Vercel المجانية حتى 60 ثانية
export const maxDuration = 60;

export const POST = route({ auth: 'public', limit: { max: 10, windowSec: 60 } }, async (ctx) => {
  if (!verifyCronSecret(ctx.req.headers.get('authorization'))) throw new ApiError(401, 'unauthorized', 'نبضة غير موقّعة');
  return { ranAt: new Date().toISOString(), jobs: await runDue() };
});

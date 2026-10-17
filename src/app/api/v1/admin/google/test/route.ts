import { route } from '@/server/api/route';
import { asSystem } from '@/server/db/client';
import { audit } from '@/server/services/audit';
import { testMeeting } from '@/server/services/meetings';

// رابط Meet تجريبي للتأكد من أن الربط يعمل قبل الحصص الحقيقية
export const POST = route({ can: 'settings.manage', limit: { max: 10, windowSec: 600 } }, (ctx) =>
  asSystem(ctx.viewer.userId, async (tx) => {
    const out = await testMeeting(tx);
    await audit(tx, ctx.viewer, { action: 'meetings.test', entity: 'meetings', after: out }, ctx.ip);
    return out;
  }),
);

import { route } from '@/server/api/route';
import { asSystem } from '@/server/db/client';
import { sendPush } from '@/server/services/push';

// إشعار تجريبي فوري لأجهزة المستخدم نفسه
export const POST = route({ limit: { max: 5, windowSec: 300 } }, async (ctx) => ({
  sent: await asSystem(ctx.viewer.userId, (tx) =>
    sendPush(tx, ctx.viewer.userId, { title: 'مآب', body: 'تمام، الإشعارات تصل لهذا الجهاز.', url: '/', tag: 'test' }),
  ),
}));

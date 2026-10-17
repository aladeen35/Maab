import { S } from '@/server/api/contract';
import { route } from '@/server/api/route';
import { subscribe, unsubscribe } from '@/server/services/push';

export const POST = route({}, async (ctx) => subscribe(ctx.viewer, await ctx.json(S.pushSubscribe), ctx.userAgent));
export const DELETE = route({}, async (ctx) => unsubscribe(ctx.viewer, (await ctx.json(S.pushUnsubscribe)).endpoint));

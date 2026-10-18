import { S } from '@/server/api/contract';
import { route } from '@/server/api/route';
import { saveCoupon } from '@/server/services/manage';

export const PUT = route<{ id: string }>({ can: 'prices.manage' }, async (ctx) => saveCoupon(ctx.viewer, ctx.params.id, await ctx.json(S.coupon), ctx.ip));

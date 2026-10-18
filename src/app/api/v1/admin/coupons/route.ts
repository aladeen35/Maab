import { S } from '@/server/api/contract';
import { route } from '@/server/api/route';
import { listCoupons, saveCoupon } from '@/server/services/manage';

export const GET = route({ can: 'prices.manage' }, (ctx) => listCoupons(ctx.viewer));
export const POST = route({ can: 'prices.manage' }, async (ctx) => saveCoupon(ctx.viewer, null, await ctx.json(S.coupon), ctx.ip));

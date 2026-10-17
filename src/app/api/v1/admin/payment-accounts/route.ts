import { S } from '@/server/api/contract';
import { route } from '@/server/api/route';
import { savePaymentAccount } from '@/server/services/system';

export const POST = route({ can: 'prices.manage' }, async (ctx) => savePaymentAccount(ctx.viewer, null, await ctx.json(S.paymentAccount), ctx.ip));

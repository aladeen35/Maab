import { S } from '@/server/api/contract';
import { route } from '@/server/api/route';
import { savePaymentAccount } from '@/server/services/system';

export const PUT = route<{ id: string }>({ can: 'prices.manage' }, async (ctx) => savePaymentAccount(ctx.viewer, ctx.params.id, await ctx.json(S.paymentAccount), ctx.ip));

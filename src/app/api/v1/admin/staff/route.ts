import { S } from '@/server/api/contract';
import { route } from '@/server/api/route';
import { listStaff, setStaffRoles } from '@/server/services/manage';

export const GET = route({ can: 'roles.manage' }, (ctx) => listStaff(ctx.viewer));
export const POST = route({ can: 'roles.manage' }, async (ctx) => setStaffRoles(ctx.viewer, await ctx.json(S.staff), ctx.ip));

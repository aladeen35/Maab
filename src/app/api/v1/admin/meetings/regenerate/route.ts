import { route } from '@/server/api/route';
import { regenerateMockLinks } from '@/server/services/system';

export const POST = route({ can: 'settings.manage' }, (ctx) => regenerateMockLinks(ctx.viewer, ctx.ip));

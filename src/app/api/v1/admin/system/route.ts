import { route } from '@/server/api/route';
import { systemStatus } from '@/server/services/system';

export const GET = route({ can: 'settings.manage' }, (ctx) => systemStatus(ctx.viewer));

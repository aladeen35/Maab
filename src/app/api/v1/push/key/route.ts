import { route } from '@/server/api/route';
import { vapid } from '@/server/services/push';

export const GET = route({ auth: 'public' }, async () => ({ publicKey: (await vapid()).publicKey }));

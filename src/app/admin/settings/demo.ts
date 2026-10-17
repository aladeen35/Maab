import type { SystemStatus } from '@/server/services/system';
import { PAYMENT_ACCOUNTS } from '@/lib/demo/data';

/** حالة تشغيل تجريبية لنسخة العرض */
export const DEMO_STATUS: SystemStatus = {
  appUrl: 'https://maab-academy.vercel.app',
  login: { phone: false, email: true, google: true },
  email: { ready: true, from: 'مآب <maab.academy@gmail.com>' },
  whatsapp: false,
  storage: 'db',
  tick: null,
  jobs: [],
  google: {
    configured: true,
    connected: false,
    email: null,
    scopes: [],
    redirectUri: 'https://maab-academy.vercel.app/api/v1/admin/google/callback',
    origin: 'https://maab-academy.vercel.app',
  },
  accounts: PAYMENT_ACCOUNTS.map((a, i) => ({
    id: `demo-${i}`,
    method: a.method as SystemStatus['accounts'][number]['method'],
    currency: a.currency,
    title: a.title,
    bankName: a.bankName,
    accountName: a.accountName,
    accountNumber: a.accountNumber,
    instructions: a.instructions,
    active: true,
  })),
};

// طرق الدخول والقنوات المتاحة فعلاً: القناة تُعرض فقط إن ضُبط مزوّدها، فلا
// يُطلب رمز على واتساب وهو غير مفعّل. في التطوير والاختبار يكفي سائق console.
import type { OtpChannel } from '@/lib/domain/market';
import { env, isProduction } from '../env';

export function channelReady(channel: OtpChannel): boolean {
  const e = env();
  const dev = !isProduction();
  if (channel === 'whatsapp') return e.WHATSAPP_DRIVER === 'meta' ? Boolean(e.WHATSAPP_TOKEN && e.WHATSAPP_PHONE_ID) : dev;
  if (channel === 'sms') return e.SMS_DRIVER === 'unifonic' ? Boolean(e.UNIFONIC_APP_SID) : dev;
  return e.EMAIL_DRIVER === 'smtp' || dev;
}

export type LoginMethods = { phone: boolean; email: boolean; google: boolean };

export function loginMethods(): LoginMethods {
  return {
    phone: channelReady('whatsapp') || channelReady('sms'),
    email: channelReady('email'),
    google: Boolean(env().GOOGLE_CLIENT_ID),
  };
}

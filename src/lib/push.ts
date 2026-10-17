// تفعيل إشعارات الجهاز من المتصفح أو تطبيق أندرويد: إذن الإشعارات ثم
// اشتراك Web Push بالمفتاح العام للخادم.
import { api } from './api';

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('هذا الجهاز لا يدعم الإشعارات من المتصفح.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('لم يُسمح بالإشعارات. فعّليها من إعدادات التطبيق أو المتصفح.');
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await api<{ publicKey: string }>('/push/key');
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await api('/push/subscriptions', { body: { endpoint: json.endpoint, keys: json.keys } });
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(await reg?.pushManager.getSubscription());
}

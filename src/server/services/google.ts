// ربط حساب Google الخاص بالأكاديمية من لوحة الإدارة (OAuth بالخادم): يمنح
// التطبيق إنشاء غرف Meet ومواعيد التقويم باسم الأكاديمية، ويُحفظ رمز التحديث
// مشفّراً في القاعدة. يكفي ضبط GOOGLE_CLIENT_ID وGOOGLE_CLIENT_SECRET.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ApiError } from '../api/http';
import type { Viewer } from '../api/route';
import { asSystem } from '../db/client';
import { authSecret, env } from '../env';
import { audit } from './audit';
import { deleteIntegration, googleMeetLink, seal, setIntegration } from './integrations';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  // إنشاء غرف Meet مفتوحة لمن معه الرابط (لا يلزم قبول الدخول من صاحب الحساب)
  'https://www.googleapis.com/auth/meetings.space.created',
  // احتياط: موعد تقويم بغرفة Meet إن لم تُفعَّل Meet API في المشروع
  'https://www.googleapis.com/auth/calendar.events',
];

export const STATE_COOKIE = 'maab_google_state';

export const redirectUri = () => `${env().APP_URL}/api/v1/admin/google/callback`;

export function googleConfigured(): boolean {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
}

const sign = (v: string) => createHmac('sha256', authSecret()).update(`google-state:${v}`).digest('base64url');

/** حالة OAuth موقّعة مربوطة بالمستخدم وبكوكيز المتصفح، صالحة 10 دقائق */
export function newState(userId: string): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString('base64url');
  const payload = `${userId}.${Math.floor(Date.now() / 1000) + 600}.${nonce}`;
  return { state: `${payload}.${sign(payload)}`, nonce };
}

export function checkState(state: string, nonce: string | undefined, userId: string): boolean {
  const parts = state.split('.');
  if (parts.length !== 4 || !nonce) return false;
  const [uid, exp, n, sig] = parts;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(`${uid}.${exp}.${n}`));
  return a.length === b.length && timingSafeEqual(a, b) && uid === userId && n === nonce && Number(exp) * 1000 > Date.now();
}

export function authUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: env().GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    // يضمن رمز تحديث جديداً حتى لو رُبط الحساب من قبل
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string };

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const e = env();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ code, client_id: e.GOOGLE_CLIENT_ID!, client_secret: e.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri(), grant_type: 'authorization_code' }),
  });
  if (!res.ok) throw new ApiError(502, 'google_exchange', `رفضت Google الربط (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as TokenResponse;
}

/** بريد الحساب من id_token القادم مباشرة من Google عبر TLS */
function emailOf(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8')) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export async function saveConnection(viewer: Viewer, tokens: TokenResponse, ip?: string | null) {
  if (!tokens.refresh_token) throw new ApiError(400, 'google_no_refresh', 'لم تُرسل Google رمز التحديث؛ أزيلي وصول التطبيق من حساب Google ثم أعيدي الربط');
  const scopes = (tokens.scope ?? '').split(' ').filter(Boolean);
  const email = emailOf(tokens.id_token);
  await asSystem(viewer.userId, async (tx) => {
    await setIntegration(tx, 'google_meet', { email, refreshToken: seal(tokens.refresh_token!), scopes, connectedAt: new Date().toISOString() }, viewer.userId);
    await audit(tx, viewer, { action: 'integration.google.connect', entity: 'integrations', entityId: 'google_meet', after: { email, scopes } }, ip);
  });
  return { email, scopes };
}

export async function disconnect(viewer: Viewer, ip?: string | null) {
  const link = await googleMeetLink();
  if (link) {
    // إلغاء الإذن لدى Google أيضاً؛ فشله لا يمنع الفصل محلياً
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(link.refreshToken)}`, { method: 'POST' }).catch(() => null);
  }
  await asSystem(viewer.userId, async (tx) => {
    await deleteIntegration(tx, 'google_meet');
    await audit(tx, viewer, { action: 'integration.google.disconnect', entity: 'integrations', entityId: 'google_meet' }, ip);
  });
}

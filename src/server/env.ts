// إعدادات الخادم من متغيرات البيئة — الأسرار هنا فقط، لا في الكود ولا في القاعدة.
import { z } from 'zod';

const DEV_SECRET = 'dev-only-secret-change-me-0123456789abcdef';

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  MAAB_DATA: z.enum(['demo', 'db']).optional(),
  AUTH_SECRET: z.string().min(32).default(DEV_SECRET),
  WHATSAPP_DRIVER: z.enum(['console', 'meta']).default('console'),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_ID: z.string().optional(),
  WHATSAPP_TEMPLATE: z.string().default('maab_otp'),
  SMS_DRIVER: z.enum(['console', 'unifonic']).default('console'),
  UNIFONIC_APP_SID: z.string().optional(),
  UNIFONIC_SENDER: z.string().default('MAAB'),
  EMAIL_DRIVER: z.enum(['console', 'smtp']).optional(),
  SMTP_URL: z.string().optional(),
  /** بديل SMTP_URL المجاني: حساب Gmail بكلمة مرور تطبيق (500 رسالة يومياً) */
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  /** بريد من يُمنح دور المدير العام عند أول دخول (مفصولة بفواصل) */
  ADMIN_EMAILS: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  MEETING_PROVIDER: z.enum(['mock', 'google']).default('mock'),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  STORAGE_DRIVER: z.enum(['local', 'supabase', 'db']).optional(),
  STORAGE_DIR: z.string().default('.storage'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  APP_URL: z.string().optional(),
});

type Raw = z.infer<typeof schema>;

export type Env = Omit<Raw, 'EMAIL_DRIVER' | 'EMAIL_FROM' | 'STORAGE_DRIVER' | 'APP_URL'> & {
  EMAIL_DRIVER: 'console' | 'smtp';
  EMAIL_FROM: string;
  STORAGE_DRIVER: 'local' | 'supabase' | 'db';
  APP_URL: string;
};

let cached: Env | undefined;

/** مشروع Supabase من رابط مجمّع الاتصالات (المستخدم postgres.<ref>) فلا يُطلب عنوانه منفصلاً */
export function supabaseUrlFrom(databaseUrl: string | undefined): string | undefined {
  if (!databaseUrl) return undefined;
  try {
    const u = new URL(databaseUrl);
    const ref = decodeURIComponent(u.username).match(/^postgres\.([a-z0-9]{10,})$/)?.[1] ?? u.hostname.match(/^db\.([a-z0-9]{10,})\.supabase\.co$/)?.[1];
    return ref ? `https://${ref}.supabase.co` : undefined;
  } catch {
    return undefined;
  }
}

/**
 * القيم المستنتجة تقلّل ما يُضبط يدوياً في الاستضافة المجانية: البريد عبر
 * Gmail إن وُجد حسابه، والتخزين في القاعدة على Vercel (لا قرص دائم فيها)،
 * ورابط التطبيق من رابط Vercel الدائم.
 */
export function resolveEnv(source: Record<string, string | undefined>): Env {
  const raw = schema.parse(source);
  const smtp = Boolean(raw.SMTP_URL || (raw.GMAIL_USER && raw.GMAIL_APP_PASSWORD));
  const supabaseUrl = raw.SUPABASE_URL || supabaseUrlFrom(raw.DATABASE_URL);
  const vercelUrl = source.VERCEL_PROJECT_PRODUCTION_URL || source.VERCEL_URL;
  return {
    ...raw,
    EMAIL_DRIVER: raw.EMAIL_DRIVER ?? (smtp ? 'smtp' : 'console'),
    EMAIL_FROM: raw.EMAIL_FROM ?? (raw.GMAIL_USER ? `مآب <${raw.GMAIL_USER}>` : 'مآب <no-reply@example.com>'),
    SUPABASE_URL: supabaseUrl,
    STORAGE_DRIVER: raw.STORAGE_DRIVER ?? (raw.SUPABASE_SERVICE_ROLE_KEY && supabaseUrl ? 'supabase' : source.VERCEL ? 'db' : 'local'),
    APP_URL: (raw.APP_URL || (vercelUrl ? `https://${vercelUrl}` : 'http://localhost:3000')).replace(/\/+$/, ''),
  };
}

export function env(): Env {
  cached ??= resolveEnv(process.env);
  return cached;
}

/**
 * صيغة موحّدة للمقارنة: أحرف صغيرة بلا علامات اقتباس، ونقاط Gmail في الاسم
 * لا أثر لها (maab.academy وmaabacademy صندوق واحد). جزء «+» يبقى فارقاً
 * لأنه يميّز حسابات التجربة في الصندوق نفسه.
 */
export function normalizeEmail(email: string): string {
  const clean = email.trim().toLowerCase().replace(/["'<>]/g, '');
  const [local, domain] = clean.split('@');
  if (!domain) return clean;
  return domain === 'gmail.com' || domain === 'googlemail.com' ? `${local.replace(/\./g, '')}@gmail.com` : clean;
}

/** قائمة بريد المديرين الأوائل بصيغة المقارنة */
export function adminEmails(): string[] {
  return (env().ADMIN_EMAILS ?? '')
    .split(/[,;\s]+/)
    .map(normalizeEmail)
    .filter((e) => e.includes('@'));
}

export const isAdminEmail = (email: string | null | undefined) => Boolean(email) && adminEmails().includes(normalizeEmail(email!));

/** بيانات العرض إن طُلبت صراحةً أو غابت قاعدة البيانات */
export function usingDemoData(): boolean {
  const e = env();
  return e.MAAB_DATA === 'demo' || (!e.MAAB_DATA && !e.DATABASE_URL);
}

export const isProduction = () => process.env.NODE_ENV === 'production';

/** سرّ التوقيع؛ القيمة الافتراضية للتطوير لا تُقبل في التشغيل الفعلي */
export function authSecret(): string {
  const secret = env().AUTH_SECRET;
  if (secret === DEV_SECRET && isProduction() && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('AUTH_SECRET غير مضبوط: أضيفي سراً عشوائياً من 32 حرفاً على الأقل في متغيرات الاستضافة');
  }
  return secret;
}

import { describe, expect, it } from 'vitest';
import { resolveEnv, supabaseUrlFrom } from './env';

describe('الإعدادات المستنتجة للتشغيل المجاني', () => {
  it('مشروع Supabase من رابط مجمّع الاتصالات أو الاتصال المباشر', () => {
    expect(supabaseUrlFrom('postgresql://postgres.abcdefghijklmnop:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres')).toBe('https://abcdefghijklmnop.supabase.co');
    expect(supabaseUrlFrom('postgresql://postgres:pw@db.abcdefghijklmnop.supabase.co:5432/postgres')).toBe('https://abcdefghijklmnop.supabase.co');
    expect(supabaseUrlFrom('postgres://maab:maab@localhost:5432/maab')).toBeUndefined();
  });

  it('على Vercel: التخزين في القاعدة، ورابط التطبيق من رابط المشروع، والبريد عبر Gmail', () => {
    const e = resolveEnv({ VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'maab-x.vercel.app', GMAIL_USER: 'maab.academy@gmail.com', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' });
    expect(e).toMatchObject({ STORAGE_DRIVER: 'db', APP_URL: 'https://maab-x.vercel.app', EMAIL_DRIVER: 'smtp', EMAIL_FROM: 'مآب <maab.academy@gmail.com>' });
  });

  it('مفتاح Supabase يحوّل التخزين لـSupabase Storage، والقيم الصريحة تغلب', () => {
    const e = resolveEnv({ VERCEL: '1', DATABASE_URL: 'postgresql://postgres.abcdefghijklmnop:pw@aws-0-eu-central-1.pooler.supabase.com:6543/postgres', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x' });
    expect(e.STORAGE_DRIVER).toBe('supabase');
    expect(e.SUPABASE_URL).toBe('https://abcdefghijklmnop.supabase.co');
    expect(resolveEnv({ STORAGE_DRIVER: 'local', APP_URL: 'https://maab.example/' }).APP_URL).toBe('https://maab.example');
    expect(resolveEnv({}).EMAIL_DRIVER).toBe('console');
  });
});

describe('مطابقة بريد المدير الأول', () => {
  it('نقاط Gmail وحالة الأحرف والاقتباس لا تؤثر، و«+» يبقى فارقاً', async () => {
    const { normalizeEmail } = await import('./env');
    expect(normalizeEmail(' "Maab.Academy@Gmail.com" ')).toBe('maabacademy@gmail.com');
    expect(normalizeEmail('maabacademy@googlemail.com')).toBe('maabacademy@gmail.com');
    expect(normalizeEmail('maab.academy+parent@gmail.com')).toBe('maabacademy+parent@gmail.com');
    expect(normalizeEmail('Info.Maab@Example.com')).toBe('info.maab@example.com');
  });
});

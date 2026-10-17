/*
 * تجهيز قاعدة البيانات عند كل نشر على Vercel (npm run vercel-build يشغّله قبل
 * البناء)، فلا يحتاج التشغيل المجاني حاسوباً ولا أوامر يدوية:
 *   1) ملفات الترحيل  2) البيانات المرجعية (السور والآيات والباقات والقوالب)
 *   3) مساحات التخزين في Supabase إن وُجد مفتاحها  4) نبضة المهام كل دقيقة
 *      عبر pg_cron وpg_net تستدعي /api/v1/internal/tick
 * كل خطوة آمنة للتكرار. الأخطاء تظهر بالعربية في سجل البناء على Vercel.
 */
import { spawnSync } from 'node:child_process';
import postgres from 'postgres';
import { authSecret, env } from '../../src/server/env';
import { cronSecret } from '../../src/server/auth/cron';
import { ensureBuckets } from '../../src/server/services/files';

const onVercel = Boolean(process.env.VERCEL);

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

/** مجمّع Supabase: وضع المعاملات (6543) للتطبيق، ووضع الجلسة (5432) للترحيل */
export function sessionModeUrl(url: string): string {
  const u = new URL(url);
  if (u.hostname.endsWith('pooler.supabase.com') && u.port === '6543') u.port = '5432';
  return u.toString();
}

function run(script: string, extraEnv: Record<string, string>) {
  const r = spawnSync('npx', ['tsx', script], { stdio: 'inherit', env: { ...process.env, ...extraEnv } });
  if (r.status !== 0) fail(`تعذّر تشغيل ${script} — راجعي الخطأ أعلاه`);
}

async function scheduleTick(dbUrl: string, appUrl: string) {
  const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe('create extension if not exists pg_cron with schema pg_catalog');
    await sql.unsafe('create extension if not exists pg_net with schema extensions');
    const command = `select net.http_post(
      url := ${literal(`${appUrl}/api/v1/internal/tick`)},
      headers := jsonb_build_object('Authorization', ${literal(`Bearer ${cronSecret()}`)}, 'Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    )`;
    await sql`select cron.schedule('maab-tick', '* * * * *', ${command})`;
    console.log(`✓ نبضة المهام كل دقيقة ← ${appUrl}/api/v1/internal/tick`);
  } catch (e) {
    console.warn(`! لم تُضبط نبضة المهام تلقائياً (${(e as Error).message}). التذكيرات وروابط الحصص تحتاجها؛ راجعي دليل التشغيل.`);
  } finally {
    await sql.end();
  }
}

const literal = (v: string) => `'${v.replace(/'/g, "''")}'`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (onVercel) fail('DATABASE_URL غير مضبوط في Vercel: انسخي رابط Transaction pooler من Supabase (Connect) وضعيه في Environment Variables');
    console.log('— لا قاعدة بيانات: تخطّي التجهيز');
    return;
  }
  if (onVercel && (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32)) {
    fail('AUTH_SECRET غير مضبوط أو أقصر من 32 حرفاً: أضيفي سراً عشوائياً في Environment Variables');
  }
  authSecret();
  const direct = sessionModeUrl(url);

  run('scripts/db/migrate.ts', { DATABASE_URL: direct });
  run('scripts/db/seed.ts', { DATABASE_URL: direct });

  const buckets = await ensureBuckets();
  if (env().STORAGE_DRIVER === 'supabase') console.log(`✓ التخزين في Supabase Storage${buckets.length ? ` (أُنشئت: ${buckets.join('، ')})` : ''}`);
  else console.log(`✓ التخزين: ${env().STORAGE_DRIVER === 'db' ? 'داخل قاعدة البيانات' : 'محلي'}`);

  const appUrl = env().APP_URL;
  if (appUrl.startsWith('https://')) await scheduleTick(direct, appUrl);
  else console.log('— رابط التطبيق محلي: نبضة المهام تُشغَّل بـ npm run worker');
}

main().catch((e) => fail((e as Error).message));

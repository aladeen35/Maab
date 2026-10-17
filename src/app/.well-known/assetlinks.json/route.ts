import { ANDROID_FINGERPRINTS, ANDROID_PACKAGE } from '@/lib/android';

// ربط التطبيق بالموقع (Digital Asset Links): بدونه يظهر شريط المتصفح أعلى التطبيق
export const dynamic = 'force-static';

export function GET() {
  const extra = (process.env.ANDROID_CERT_SHA256 ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return Response.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: [...new Set([...ANDROID_FINGERPRINTS, ...extra])] },
    },
  ]);
}

import { notFound } from '@/server/api/http';
import { route } from '@/server/api/route';
import { verifyCertificate } from '@/server/services/certificates';

// التحقق العام من شهادة برمزها (من رمز QR المطبوع عليها)
export const GET = route<{ code: string }>({ auth: 'public', limit: { max: 30, windowSec: 60 } }, async (ctx) => {
  const c = await verifyCertificate(ctx.params.code);
  if (!c) throw notFound('الشهادة');
  return { serial: c.serial, title: c.title, studentName: c.studentName, teacherName: c.teacherName, issuedAt: c.issuedAt, valid: !c.revokedAt, revokedAt: c.revokedAt };
});

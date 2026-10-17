// شهادات الإتمام: تلقائية عند إتمام جزء كامل أو ختم القرآن (من تقرير المعلمة
// نفسه)، ويدوية من الإشراف لإتمام دورة. تُحفظ نصوصها وقت الإصدار، ولكل شهادة
// رقم تسلسلي ورمز عام غير قابل للتخمين تُفتح به صفحة التحقق والطباعة.
import { randomInt } from 'node:crypto';
import { and, avg, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { can } from '@/lib/domain/permissions';
import type { Certificate } from '@/lib/types';
import { ayahIndex, juzInfo, TOTAL_AYAHS } from '@/lib/quran';
import { JUZ_NAMES, juzOrdinal } from '@/lib/quran/names';
import { badRequest, conflict, forbidden, notFound } from '../api/http';
import type { Viewer } from '../api/route';
import { asSystem, asUser, type Tx } from '../db/client';
import { certificates, guardians, guardianStudents, memorizedRanges, quranAyahs, reportSegments, sessionReports, students, teachers } from '../db/schema';
import { audit } from './audit';
import { notify } from './notifications';

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const newCode = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

const serial = sql<string>`'MAAB-C-' || extract(year from now())::int || '-' || lpad(nextval('certificate_serial_seq')::text, 5, '0')`;

export type CertificateKind = (typeof certificates.$inferSelect)['kind'];

export const juzTitle = (juz: number) => `إتمام حفظ ${juzOrdinal(juz, 'gen')}`;

async function familyOf(tx: Tx, studentId: string, studentUser: string | null) {
  const rows = await tx
    .select({ id: guardians.userId })
    .from(guardianStudents)
    .innerJoin(guardians, eq(guardians.id, guardianStudents.guardianId))
    .where(eq(guardianStudents.studentId, studentId));
  return [...rows.map((r) => r.id), ...(studentUser ? [studentUser] : [])];
}

/** متوسط إتقان المقاطع الجديدة المحتسبة في النطاق (أو كل المحفوظ) */
async function masteryIn(tx: Tx, studentId: string, from?: number, to?: number): Promise<number | null> {
  const [row] = await tx
    .select({ v: avg(reportSegments.mastery) })
    .from(reportSegments)
    .innerJoin(sessionReports, eq(sessionReports.id, reportSegments.reportId))
    .where(
      and(
        eq(sessionReports.studentId, studentId),
        eq(reportSegments.counted, true),
        from !== undefined ? gte(reportSegments.fromAyah, from) : undefined,
        to !== undefined ? lte(reportSegments.toAyah, to) : undefined,
      ),
    );
  return row?.v === null || row?.v === undefined ? null : Math.round(Number(row.v) * 100) / 100;
}

async function studentWithTeacher(tx: Tx, studentId: string) {
  const [row] = await tx
    .select({ s: students, teacher: teachers.displayName })
    .from(students)
    .leftJoin(teachers, eq(teachers.id, students.teacherId))
    .where(and(eq(students.id, studentId), isNull(students.deletedAt)));
  return row ?? null;
}

const verbFor = (gender: 'female' | 'male') => (gender === 'female' ? 'أتمّت الطالبة' : 'أتمّ الطالب');

/**
 * يُستدعى من تقرير الحصة داخل معاملته: شهادة الجزء عند اكتماله، والختمة عند
 * اكتمال الأجزاء كلها. الفهرس الفريد يمنع تكرارها إن عُدّل التقرير.
 */
export async function issueAuto(tx: Tx, studentId: string, juzList: number[]): Promise<string[]> {
  const st = await studentWithTeacher(tx, studentId);
  if (!st || !juzList.length) return [];
  const issued: { code: string; title: string }[] = [];
  const insert = async (kind: CertificateKind, juz: number | null, title: string, body: string, mastery: number | null) => {
    const code = newCode();
    const rows = await tx
      .insert(certificates)
      .values({ serial, code, studentId, teacherId: st.s.teacherId, kind, juz, title, body, studentName: st.s.fullName, teacherName: st.teacher, mastery })
      .onConflictDoNothing()
      .returning({ code: certificates.code });
    if (rows.length) issued.push({ code, title });
  };

  for (const juz of juzList) {
    const info = juzInfo(juz);
    const body = `${verbFor(st.s.gender)} حفظ ${juzOrdinal(juz, 'gen')} (جزء ${JUZ_NAMES[juz - 1]}) كاملاً${st.teacher ? ` بإشراف المعلمة ${st.teacher}` : ''}.`;
    await insert('juz', juz, juzTitle(juz), body, await masteryIn(tx, studentId, ayahIndex(info.from), ayahIndex(info.to)));
  }

  const [{ n }] = await tx
    .select({ n: sql<number>`count(distinct ${quranAyahs.id})::int` })
    .from(memorizedRanges)
    .innerJoin(quranAyahs, and(gte(quranAyahs.id, memorizedRanges.fromAyah), lte(quranAyahs.id, memorizedRanges.toAyah)))
    .where(eq(memorizedRanges.studentId, studentId));
  if (n >= TOTAL_AYAHS) {
    const body = `${verbFor(st.s.gender)} حفظ القرآن الكريم كاملاً${st.teacher ? ` بإشراف المعلمة ${st.teacher}` : ''}، جعله الله حجةً له ورفعةً في الدنيا والآخرة.`;
    await insert('khatm', null, 'ختم القرآن الكريم حفظاً', body, await masteryIn(tx, studentId));
  }

  if (issued.length) {
    const family = await familyOf(tx, studentId, st.s.userId);
    for (const c of issued) {
      await notify(tx, { userIds: family, event: 'certificate_issued', vars: { title: c.title, student: st.s.displayName }, data: { studentId, code: c.code } });
    }
  }
  return issued.map((c) => c.code);
}

/** شهادة إتمام دورة يصدرها الإشراف (تجويد، دورة صيفية، …) */
export async function issueCourse(viewer: Viewer, input: { studentId: string; title: string; body: string }, ip?: string | null) {
  if (!can(viewer.roles, 'certificates.issue')) throw forbidden();
  return asSystem(viewer.userId, async (tx) => {
    const st = await studentWithTeacher(tx, input.studentId);
    if (!st) throw notFound('الطالب');
    const code = newCode();
    const [row] = await tx
      .insert(certificates)
      .values({ serial, code, studentId: st.s.id, teacherId: st.s.teacherId, kind: 'course', title: input.title, body: input.body, studentName: st.s.fullName, teacherName: st.teacher, issuedBy: viewer.userId })
      .returning();
    await notify(tx, { userIds: await familyOf(tx, st.s.id, st.s.userId), event: 'certificate_issued', vars: { title: input.title, student: st.s.displayName }, data: { studentId: st.s.id, code } });
    await audit(tx, viewer, { action: 'certificate.issue', entity: 'certificates', entityId: row.id, after: { serial: row.serial, title: row.title, studentId: st.s.id } }, ip);
    return { id: row.id, serial: row.serial, code };
  });
}

export async function revokeCertificate(viewer: Viewer, id: string, reason: string, ip?: string | null) {
  if (!can(viewer.roles, 'certificates.issue')) throw forbidden();
  return asSystem(viewer.userId, async (tx) => {
    const [c] = await tx.select().from(certificates).where(eq(certificates.id, id)).for('update');
    if (!c) throw notFound('الشهادة');
    if (c.revokedAt) throw conflict('already_revoked', 'الشهادة ملغاة من قبل');
    if (reason.trim().length < 5) throw badRequest('reason_required', 'اذكري سبب الإلغاء');
    await tx.update(certificates).set({ revokedAt: new Date(), revokedBy: viewer.userId, revokeReason: reason.trim() }).where(eq(certificates.id, id));
    await audit(tx, viewer, { action: 'certificate.revoke', entity: 'certificates', entityId: id, before: { serial: c.serial }, reason }, ip);
    return { id, revoked: true };
  });
}

export type CertificateCard = Certificate;

const card = (c: typeof certificates.$inferSelect): CertificateCard => ({
  id: c.id,
  serial: c.serial,
  code: c.code,
  kind: c.kind,
  juz: c.juz,
  title: c.title,
  body: c.body,
  studentId: c.studentId,
  studentName: c.studentName,
  teacherName: c.teacherName,
  mastery: c.mastery,
  issuedAt: c.issuedAt.toISOString(),
  revokedAt: c.revokedAt?.toISOString() ?? null,
  revokeReason: c.revokeReason,
});

/** شهادات من يراهم المستخدم (RLS): الأسرة لأبنائها، والمعلمة لطلابها، والإشراف للجميع */
export async function listCertificates(viewer: Viewer, studentIds?: string[], tx?: Tx) {
  const read = async (t: Tx) =>
    (
      await t
        .select()
        .from(certificates)
        .where(studentIds ? inArray(certificates.studentId, studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']) : undefined)
        .orderBy(desc(certificates.issuedAt))
        .limit(200)
    ).map(card);
  return tx ? read(tx) : asUser(viewer.userId, read);
}

/** التحقق العام برمز الشهادة: لا يكشف إلا ما في الشهادة نفسها */
export async function verifyCertificate(code: string): Promise<CertificateCard | null> {
  const clean = code.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (clean.length !== 10) return null;
  const [c] = await asSystem(null, (tx) => tx.select().from(certificates).where(eq(certificates.code, clean)));
  return c ? card(c) : null;
}

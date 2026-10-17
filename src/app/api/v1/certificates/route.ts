import { z } from 'zod';
import { S } from '@/server/api/contract';
import { route } from '@/server/api/route';
import { issueCourse, listCertificates } from '@/server/services/certificates';

const query = z.object({ studentId: z.uuid().optional() });

export const GET = route({}, async (ctx) => {
  const { studentId } = ctx.query(query);
  return listCertificates(ctx.viewer, studentId ? [studentId] : undefined);
});

export const POST = route({ can: 'certificates.issue' }, async (ctx) => issueCourse(ctx.viewer, await ctx.json(S.certificateIssue), ctx.ip));

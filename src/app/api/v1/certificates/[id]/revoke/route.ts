import { S } from '@/server/api/contract';
import { route } from '@/server/api/route';
import { revokeCertificate } from '@/server/services/certificates';

export const POST = route<{ id: string }>({ can: 'certificates.issue' }, async (ctx) =>
  revokeCertificate(ctx.viewer, ctx.params.id, (await ctx.json(S.certificateRevoke)).reason, ctx.ip),
);

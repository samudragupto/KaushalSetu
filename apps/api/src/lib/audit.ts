import { prisma } from '../db';
import type { AuthClaims } from '../auth';

// Every reveal of personal data is written here before the data leaves the server.
export async function writeAudit(actor: AuthClaims | { role: string; sub?: string; name?: string }, action: string, targetTraineeId?: string | null, reason?: string | null) {
  await prisma.auditLog.create({
    data: {
      actorRole: actor.role,
      actorId: actor.sub ?? null,
      actorName: actor.name ?? null,
      action,
      targetTraineeId: targetTraineeId ?? null,
      reason: reason ?? null,
    },
  });
}

import type { AdapterMode } from '@kaushalsetu/shared';
import { prisma } from '../db';
import { stableUnit } from '../lib/rng';
import { bumpVersion } from '../lib/version';

// EPFO has no public API for this use case. The production design (README, Production Roadmap)
// is a scheduled UAN-based match against ECR contribution data under a data-sharing MoU. This
// simulator emits the same signal: it verifies a deterministic 30% of pending placements that
// have reached six months of tenure and reports the ECR wage.
export const epfoMode = (): AdapterMode => 'DEMO';

export interface EpfoRun {
  checked: number;
  verified: number;
  wageUpdates: number;
}

export async function runEpfoSignals(opts: { traineeIds?: string[]; now?: Date; minTenureDays?: number } = {}): Promise<EpfoRun> {
  const now = opts.now ?? new Date();
  const minTenure = opts.minTenureDays ?? 150;
  const pending = await prisma.employmentRecord.findMany({
    where: {
      status: 'PENDING_VERIFICATION',
      endDate: null,
      startDate: { lte: new Date(now.getTime() - minTenure * 86_400_000) },
      ...(opts.traineeIds ? { traineeId: { in: opts.traineeIds } } : {}),
    },
    include: { employer: true },
  });
  let verified = 0;
  let wageUpdates = 0;
  for (const rec of pending) {
    if (!rec.employer.gstinValid || stableUnit(`${rec.id}:epfo`) >= 0.3) continue;
    const ecrWage = Math.round((rec.monthlyWage * (1 + stableUnit(`${rec.id}:wage`) * 0.08)) / 100) * 100;
    await prisma.employmentRecord.update({
      where: { id: rec.id },
      data: {
        status: 'VERIFIED',
        verificationMethod: 'EPFO_SIM',
        verifiedAt: now,
        monthlyWage: Math.max(ecrWage, rec.monthlyWage),
        evidence: { uan: `1010${Math.floor(stableUnit(rec.id) * 1e8)}`, establishment: rec.employer.name, ecrWage, contributionMonths: 6, signal: 'EPFO Signal Simulator' },
      },
    });
    verified++;
    if (ecrWage > rec.monthlyWage) {
      await prisma.outcomeEvent.create({
        data: { traineeId: rec.traineeId, eventType: 'WAGE_CHANGE', occurredAt: now, source: 'EPFO_SIM', payload: { wage: ecrWage, previous: rec.monthlyWage, basis: 'ECR wage' } },
      });
      wageUpdates++;
    }
  }
  if (verified) bumpVersion();
  return { checked: pending.length, verified, wageUpdates };
}

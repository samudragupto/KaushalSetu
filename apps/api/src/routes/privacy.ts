import { Router } from 'express';
import { maskId } from '@kaushalsetu/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth';
import { asyncHandler } from '../lib/http';
import { getDataset } from '../services/dataset';

export const privacyRouter = Router();

privacyRouter.get(
  '/consent',
  requireAuth('GOVT'),
  asyncHandler(async (_req, res) => {
    const ds = await getDataset();
    const total = ds.trainees.length;
    const count = (fn: (t: (typeof ds.trainees)[number]) => boolean) => ds.trainees.filter(fn).length;
    const [ledger, ledgerSize, withdrawals] = await Promise.all([
      prisma.consentRecord.findMany({ orderBy: { capturedAt: 'desc' }, take: 40, include: { trainee: { select: { unifiedId: true } } } }),
      prisma.consentRecord.count(),
      prisma.consentRecord.count({ where: { granted: false, channel: 'PORTAL' } }),
    ]);
    res.json({
      total,
      ledgerSize,
      withdrawalsViaPortal: withdrawals,
      scopes: [
        { scope: 'employmentTracking', label: 'Employment tracking', granted: count((t) => t.consentEmployment) },
        { scope: 'wageTracking', label: 'Wage tracking', granted: count((t) => t.consentWage) },
        { scope: 'publicAggregates', label: 'Public aggregates', granted: count((t) => t.consentPublic) },
      ],
      ledger: ledger.map((c) => ({ id: c.id, trainee: maskId(c.trainee.unifiedId), scope: c.scope, granted: c.granted, channel: c.channel, capturedAt: c.capturedAt, sourceIp: c.sourceIp ? c.sourceIp.replace(/\.\d+$/, '.x') : null })),
    });
  }),
);

privacyRouter.get(
  '/audit',
  requireAuth('GOVT'),
  asyncHandler(async (_req, res) => {
    const logs = await prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 100, include: { trainee: { select: { unifiedId: true } } } });
    res.json(logs.map((l) => ({ id: l.id, actorRole: l.actorRole, actorName: l.actorName, action: l.action, reason: l.reason, trainee: l.trainee ? maskId(l.trainee.unifiedId) : null, timestamp: l.timestamp })));
  }),
);

import { Router } from 'express';
import { z } from 'zod';
import { foldOutcomes, maskPhone } from '@kaushalsetu/shared';
import { prisma } from '../db';
import { webBaseUrl } from '../env';
import { auth, requireAuth } from '../auth';
import { HttpError, asyncHandler, parse } from '../lib/http';
import { RULE_TEXT } from '../services/fraud';
import { getDataset } from '../services/dataset';
import { computeKpis, filterTrainees, skillGaps } from '../services/analytics';
import { createVerificationLink } from '../services/outcomes';

export const providerRouter = Router();
providerRouter.use(requireAuth('PROVIDER'));

function providerId(req: Parameters<typeof auth>[0]): string {
  const id = auth(req).providerId;
  if (!id) throw new HttpError(403, 'This account is not linked to a training provider.');
  return id;
}

providerRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const id = providerId(req);
    const provider = await prisma.provider.findUnique({ where: { id } });
    if (!provider) throw new HttpError(404, 'Provider not found');
    const ds = await getDataset();
    const now = new Date();
    const mine = filterTrainees(ds, { provider: id }, now);
    const kpis = computeKpis(mine, now);
    const state = computeKpis(filterTrainees(ds, {}, now), now);
    const reasons = new Map<string, number>();
    for (const t of mine) for (const e of t.events) if ((e.eventType === 'ATTRITION' || e.eventType === 'UNEMPLOYED') && e.attritionReason) reasons.set(e.attritionReason, (reasons.get(e.attritionReason) ?? 0) + 1);
    const totalReasons = [...reasons.values()].reduce((a, b) => a + b, 0);
    const courseCodes = [...new Set(mine.map((t) => t.courseCode))];
    const gaps = (await skillGaps({ district: provider.district })).filter((g) => courseCodes.includes(g.courseCode)).slice(0, 6);
    const alerts = await prisma.integrityAlert.findMany({ where: { providerId: id, status: 'OPEN' } });
    res.json({
      provider,
      kpis,
      state,
      reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count, pct: totalReasons ? count / totalReasons : 0 })).sort((a, b) => b.count - a.count),
      skillGaps: gaps,
      alerts: alerts.map((a) => ({ id: a.id, title: a.title, detail: a.detail, severity: a.severity, ruleText: RULE_TEXT[a.rule] })),
    });
  }),
);

providerRouter.get(
  '/trainees',
  asyncHandler(async (req, res) => {
    const id = providerId(req);
    const q = parse(z.object({ search: z.string().max(40).optional(), status: z.string().max(20).optional() }), req.query);
    const trainees = await prisma.trainee.findMany({
      where: {
        enrollments: { some: { providerId: id } },
        ...(q.search ? { OR: [{ fullName: { contains: q.search, mode: 'insensitive' } }, { unifiedId: { contains: q.search.toUpperCase() } }] } : {}),
      },
      include: {
        enrollments: { include: { course: true }, take: 1 },
        outcomeEvents: { orderBy: { occurredAt: 'asc' } },
        followUps: true,
        employmentRecords: { orderBy: { startDate: 'desc' }, take: 1 },
      },
    });
    const now = new Date();
    const rows = trainees
      .map((t) => {
        const s = foldOutcomes(t.outcomeEvents, now);
        const milestones: Record<string, string | null> = { MONTH_3: null, MONTH_6: null, MONTH_12: null, MONTH_24: null };
        for (const f of t.followUps) milestones[f.milestone] = f.status;
        return {
          id: t.id,
          name: t.fullName,
          unifiedId: t.unifiedId,
          maskedPhone: maskPhone(t.phonePrimary),
          course: t.enrollments[0]?.course.name ?? '',
          batchEnd: t.enrollments[0]?.batchEnd ?? null,
          status: s.status,
          wage: s.wage,
          employer: s.employerName,
          milestones,
          verification: t.employmentRecords[0]?.status ?? null,
        };
      })
      .filter((r) => !q.status || r.status === q.status)
      .sort((a, b) => (b.batchEnd?.getTime() ?? 0) - (a.batchEnd?.getTime() ?? 0));
    res.json(rows);
  }),
);

providerRouter.get(
  '/verifications',
  asyncHandler(async (req, res) => {
    const id = providerId(req);
    const records = await prisma.employmentRecord.findMany({
      // Claims older than 180 days without an employer response are handled by the EPFO match and
      // agent calls instead of the link, so they are left out of this working list.
      where: { status: 'PENDING_VERIFICATION', createdAt: { gte: new Date(Date.now() - 180 * 86_400_000) }, trainee: { enrollments: { some: { providerId: id } } } },
      include: { employer: true, trainee: true, tokens: { where: { usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(
      records.map((r) => ({
        id: r.id,
        trainee: r.trainee.fullName,
        unifiedId: r.trainee.unifiedId,
        employer: r.employer.name,
        gstinOnRecord: !r.employer.gstin.startsWith('UNREG-'),
        designation: r.designation,
        monthlyWage: r.monthlyWage,
        createdAt: r.createdAt,
        ageDays: Math.floor((Date.now() - r.createdAt.getTime()) / 86_400_000),
        link: r.tokens[0] ? `${webBaseUrl}/verify/${r.tokens[0].token}` : null,
      })),
    );
  }),
);

providerRouter.post(
  '/verifications/:recordId/link',
  asyncHandler(async (req, res) => {
    const id = providerId(req);
    const record = await prisma.employmentRecord.findFirst({ where: { id: req.params.recordId, trainee: { enrollments: { some: { providerId: id } } } } });
    if (!record) throw new HttpError(404, 'Record not found for your institute.');
    if (record.status !== 'PENDING_VERIFICATION') throw new HttpError(409, 'This record has already been decided.');
    res.json({ link: await createVerificationLink(record.id) });
  }),
);

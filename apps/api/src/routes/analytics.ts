import { Router, type Request } from 'express';
import { z } from 'zod';
import { AGE_BANDS, COURSES, DISTRICTS, SECTORS, SOCIAL_CATEGORY_LABELS, maskName, type DashboardFilters, type FilterOptions } from '@kaushalsetu/shared';
import { prisma } from '../db';
import { requireAuth } from '../auth';
import { HttpError, asyncHandler, parse } from '../lib/http';
import { adapterStatuses } from '../adapters';
import { summarizeSkillGaps } from '../adapters/llm';
import { RULE_TEXT } from '../services/fraud';
import { getDataset } from '../services/dataset';
import { computeKpis, dashboard, filterTrainees, leagueTable, resolveAsOf, skillGaps } from '../services/analytics';

export const analyticsRouter = Router();

const filterSchema = z.object({
  district: z.string().max(60).optional(),
  sector: z.string().max(60).optional(),
  course: z.string().max(20).optional(),
  provider: z.string().max(40).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  socialCategory: z.enum(['SC', 'ST', 'OBC', 'OPEN', 'EWS']).optional(),
  ageBand: z.enum(AGE_BANDS).optional(),
  cohortMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function readFilters(req: Request): DashboardFilters {
  const raw = Object.fromEntries(Object.entries(req.query).filter(([, v]) => typeof v === 'string' && v !== ''));
  return parse(filterSchema, raw);
}

analyticsRouter.get(
  '/meta/filters',
  requireAuth('GOVT', 'PROVIDER', 'AGENT'),
  asyncHandler(async (_req, res) => {
    const ds = await getDataset();
    const months = new Set<string>();
    let min = Date.now();
    for (const t of ds.trainees) {
      months.add(t.batchEnd.toISOString().slice(0, 7));
      min = Math.min(min, t.batchEnd.getTime());
    }
    const today = new Date().toISOString().slice(0, 7);
    const options: FilterOptions = {
      districts: DISTRICTS.map((d) => d.name).sort(),
      sectors: SECTORS.map((s) => s.name),
      courses: COURSES.map((c) => ({ code: c.code, name: c.name, sector: c.sector })),
      providers: ds.providers.map((p) => ({ id: p.id, name: p.name, district: p.district })).sort((a, b) => a.name.localeCompare(b.name)),
      genders: ['MALE', 'FEMALE', 'OTHER'],
      socialCategories: Object.keys(SOCIAL_CATEGORY_LABELS),
      ageBands: [...AGE_BANDS],
      cohortMonths: [...months].filter((m) => m <= today).sort().reverse(),
      minDate: new Date(min).toISOString().slice(0, 10),
      maxDate: new Date().toISOString().slice(0, 10),
    };
    res.json(options);
  }),
);

analyticsRouter.get('/meta/adapters', requireAuth(), (_req, res) => {
  res.json(adapterStatuses());
});

analyticsRouter.get(
  '/analytics/dashboard',
  requireAuth('GOVT'),
  asyncHandler(async (req, res) => {
    res.json(await dashboard(readFilters(req)));
  }),
);

analyticsRouter.get(
  '/analytics/league',
  requireAuth('GOVT'),
  asyncHandler(async (req, res) => {
    res.json(await leagueTable(readFilters(req)));
  }),
);

analyticsRouter.get(
  '/analytics/skill-gaps',
  requireAuth('GOVT', 'PROVIDER'),
  asyncHandler(async (req, res) => {
    res.json(await skillGaps(readFilters(req)));
  }),
);

analyticsRouter.get(
  '/analytics/skill-gaps/summary',
  requireAuth('GOVT'),
  asyncHandler(async (req, res) => {
    const filters = readFilters(req);
    const rows = await skillGaps(filters);
    const course = filters.course ? COURSES.find((c) => c.code === filters.course)?.name : undefined;
    res.json(await summarizeSkillGaps(rows, { district: filters.district, sector: filters.sector, course }));
  }),
);

analyticsRouter.get(
  '/analytics/alerts',
  requireAuth('GOVT'),
  asyncHandler(async (_req, res) => {
    const alerts = await prisma.integrityAlert.findMany({
      where: { status: 'OPEN' },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      include: { provider: { select: { id: true, name: true } }, employer: { select: { name: true, gstin: true, gstinValid: true } } },
    });
    res.json(alerts.map((a) => ({ ...a, ruleText: RULE_TEXT[a.rule] })));
  }),
);

// Provider drill-down for the league table: scorecard, alerts with rule explanations, and the
// employment records behind them (trainee identity masked).
analyticsRouter.get(
  '/analytics/providers/:id',
  requireAuth('GOVT'),
  asyncHandler(async (req, res) => {
    const provider = await prisma.provider.findUnique({ where: { id: req.params.id } });
    if (!provider) throw new HttpError(404, 'Provider not found');
    const ds = await getDataset();
    const asOf = resolveAsOf(typeof req.query.asOf === 'string' ? req.query.asOf : undefined);
    const mine = filterTrainees(ds, { provider: provider.id }, asOf);
    const kpis = computeKpis(mine, asOf);
    const state = computeKpis(filterTrainees(ds, {}, asOf), asOf);
    const [alerts, records] = await Promise.all([
      prisma.integrityAlert.findMany({ where: { providerId: provider.id, status: 'OPEN' }, include: { employer: true }, orderBy: { severity: 'asc' } }),
      prisma.employmentRecord.findMany({
        where: { trainee: { enrollments: { some: { providerId: provider.id } } } },
        include: { employer: true, trainee: { select: { id: true, fullName: true, unifiedId: true, district: true } } },
        orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      }),
    ]);
    const flaggedRecordIds = new Set(alerts.map((a) => a.employmentRecordId).filter(Boolean));
    res.json({
      provider,
      kpis,
      state,
      alerts: alerts.map((a) => ({ id: a.id, rule: a.rule, title: a.title, severity: a.severity, detail: a.detail, metrics: a.metrics, ruleText: RULE_TEXT[a.rule], employer: a.employer ? { name: a.employer.name, gstin: a.employer.gstin, gstinValid: a.employer.gstinValid } : null, createdAt: a.createdAt })),
      records: records.map((r) => ({
        id: r.id,
        trainee: { id: r.trainee.id, maskedName: maskName(r.trainee.fullName), maskedId: r.trainee.unifiedId.replace(/\d{4}$/, 'xxxx'), district: r.trainee.district },
        employer: { name: r.employer.name, gstin: r.employer.gstin, gstinValid: r.employer.gstinValid },
        designation: r.designation,
        monthlyWage: r.monthlyWage,
        startDate: r.startDate,
        status: r.status,
        verificationMethod: r.verificationMethod,
        verifiedAt: r.verifiedAt,
        rejectedAt: r.rejectedAt,
        rejectionReason: r.rejectionReason,
        flagged: flaggedRecordIds.has(r.id),
      })),
    });
  }),
);

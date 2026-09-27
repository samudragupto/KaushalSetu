import { Router } from 'express';
import { DISTRICTS, SECTORS } from '@kaushalsetu/shared';
import { prisma } from '../db';
import { env } from '../env';
import { asyncHandler } from '../lib/http';
import { adapterStatuses } from '../adapters';
import { getDataset } from '../services/dataset';
import { computeKpis } from '../services/analytics';

export const publicRouter = Router();

export const PERSONA_STORIES: Record<string, string> = {
  'MH-NSK-100101': 'CNC operator from Government ITI Nashik, placed at a Chakan auto-components plant. His Month-6 check-in is the live demo.',
  'MH-PUN-100102': 'Bridal makeup graduate running her own studio in Hadapsar. Udyam registered; income reported every six months.',
  'MH-JLG-100103': 'Sai Vocational Institute trainee whose claimed placement was rejected by the employer.',
  'MH-CSN-100104': 'Automotive technician who did not answer two Month-6 messages. Now in the field agent queue.',
  'MH-NGP-100105': 'Full-stack web graduate in Nagpur, not placed. Reported a React.js gap.',
  'MH-PUN-100106': 'Solar PV installer with wage growth confirmed by EPFO signals.',
  'MH-JAL-100107': 'Retail associate who left her job after relocating to Pune.',
  'MH-MSU-100108': 'Automotive technician who switched employers for a 44% raise.',
  'MH-LAT-100109': 'GST accounts apprentice converted to a full-time role.',
  'MH-GAD-100110': 'Electrician running a repair shop in Aheri, Gadchiroli.',
  'MH-THN-100111': 'F&B steward who withdrew wage-tracking consent through the portal.',
  'MH-KOP-100112': 'Welder whose reported wage of ₹61,000 tripped the wage-outlier rule.',
};

publicRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    res.json({ demoMode: env.DEMO_MODE, adapters: adapterStatuses() });
  }),
);

publicRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const ds = await getDataset();
    const k = computeKpis(ds.trainees, new Date());
    const districts = new Set(ds.trainees.map((t) => t.district));
    const since = Date.now() - 30 * 86_400_000;
    let answered = 0;
    let sent = 0;
    for (const t of ds.trainees)
      for (const f of t.followUps) {
        if (!f.sentAt || f.sentAt.getTime() < since) continue;
        sent++;
        if (f.respondedAt) answered++;
      }
    res.json({
      traineesTracked: ds.trainees.length,
      verificationRate: k.verificationRate.value,
      districtsCovered: districts.size,
      providers: ds.providers.length,
      followUpsSent30d: sent,
      followUpsAnswered30d: answered,
    });
  }),
);

publicRouter.get(
  '/personas',
  asyncHandler(async (_req, res) => {
    if (!env.DEMO_MODE) {
      res.json([]);
      return;
    }
    const personas = await prisma.trainee.findMany({
      where: { isPersona: true },
      orderBy: { unifiedId: 'asc' },
      include: { enrollments: { include: { course: true, provider: true }, take: 1 } },
    });
    res.json(
      personas.map((p) => ({
        id: p.id,
        name: p.fullName,
        unifiedId: p.unifiedId,
        district: p.district,
        course: p.enrollments[0]?.course.name ?? '',
        provider: p.enrollments[0]?.provider.name ?? '',
        story: PERSONA_STORIES[p.unifiedId] ?? '',
      })),
    );
  }),
);

// Anonymised aggregates for public release: only trainees who consented to public aggregates,
// and any cell with fewer than 10 people is suppressed.
publicRouter.get(
  '/aggregates',
  asyncHandler(async (_req, res) => {
    const ds = await getDataset();
    const asOf = new Date();
    const consenting = ds.trainees.filter((t) => t.consentPublic);
    const MIN_CELL = 10;
    const cell = (value: number | null, denominator: number) => (denominator >= MIN_CELL ? value : null);
    const state = computeKpis(consenting, asOf);
    const districts = DISTRICTS.map((d) => {
      const list = consenting.filter((t) => t.district === d.name);
      const k = computeKpis(list, asOf);
      return {
        district: d.name,
        division: d.division,
        trainees: list.length >= MIN_CELL ? list.length : null,
        placementRate: cell(k.placementRate90.value, k.placementRate90.denominator),
        retention6: cell(k.retention6.value, k.retention6.denominator),
        medianWage: cell(k.medianWage.value, k.medianWage.denominator),
      };
    });
    const sectors = SECTORS.map((s) => {
      const k = computeKpis(consenting.filter((t) => t.sector === s.name), asOf);
      return {
        sector: s.name,
        placementRate: cell(k.placementRate90.value, k.placementRate90.denominator),
        retention6: cell(k.retention6.value, k.retention6.denominator),
        medianWage: cell(k.medianWage.value, k.medianWage.denominator),
      };
    });
    res.json({
      asOf: asOf.toISOString(),
      minCellSize: MIN_CELL,
      consentingTrainees: consenting.length,
      excludedForConsent: ds.trainees.length - consenting.length,
      state: {
        placementRate: state.placementRate90.value,
        retention6: state.retention6.value,
        medianWage: state.medianWage.value,
        selfEmploymentShare: state.selfEmploymentShare.value,
      },
      districts,
      sectors,
      suppressedCells: districts.filter((d) => d.placementRate === null).length,
    });
  }),
);

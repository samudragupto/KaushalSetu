import { COURSES } from '@kaushalsetu/shared';
import { prisma } from '../db';
import { bumpVersion } from '../lib/version';
import { DAY_MS, median } from '../lib/stats';

export interface SweepResult {
  ranAt: string;
  open: number;
  created: number;
  resolved: number;
  byRule: Record<string, number>;
}

interface AlertDraft {
  key: string;
  rule: 'PLACEMENT_VERIFICATION_GAP' | 'WAGE_OUTLIER' | 'EMPLOYER_CONCENTRATION' | 'REJECTION_CLUSTER';
  severity: 'HIGH' | 'MEDIUM';
  title: string;
  detail: string;
  metrics: Record<string, number | string>;
  providerId?: string;
  employerId?: string;
  employmentRecordId?: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export const RULE_TEXT: Record<AlertDraft['rule'], string> = {
  PLACEMENT_VERIFICATION_GAP: 'Provider claims more than 70% placement while fewer than 40% of its employment records are independently verified.',
  WAGE_OUTLIER: 'Reported monthly wage is more than twice the median wage for the course sector.',
  EMPLOYER_CONCENTRATION: 'More than 15 trainees from one provider are linked to the same employer within a 30-day window.',
  REJECTION_CLUSTER: 'Employers have rejected at least 3 claimed placements from this provider, and rejections exceed 15% of employer responses.',
};

// Integrity rules engine. Idempotent: alerts are upserted by a stable key, and alerts whose
// condition no longer holds are marked RESOLVED.
export async function runFraudSweep(now: Date = new Date()): Promise<SweepResult> {
  const courseSector = new Map(COURSES.map((c) => [c.code, c.sector]));
  const courseName = new Map(COURSES.map((c) => [c.code, c.name]));

  const [providers, enrollments, records, placementEvents] = await Promise.all([
    prisma.provider.findMany({ select: { id: true, name: true } }),
    prisma.enrollment.findMany({ select: { traineeId: true, providerId: true, batchEnd: true, course: { select: { code: true } } } }),
    prisma.employmentRecord.findMany({
      select: { id: true, traineeId: true, employerId: true, monthlyWage: true, startDate: true, status: true, designation: true, employer: { select: { name: true } } },
    }),
    prisma.outcomeEvent.findMany({
      where: { eventType: { in: ['PLACED', 'SELF_EMPLOYED', 'APPRENTICE'] } },
      select: { traineeId: true },
      distinct: ['traineeId'],
    }),
  ]);

  const providerName = new Map(providers.map((p) => [p.id, p.name]));
  const enrollmentByTrainee = new Map(enrollments.map((e) => [e.traineeId, e]));
  const placedSet = new Set(placementEvents.map((e) => e.traineeId));
  const drafts: AlertDraft[] = [];

  // Rule 1: placement claimed vs verification.
  const completedCutoff = now.getTime() - 60 * DAY_MS;
  const perProvider = new Map<string, { completed: number; placed: number; records: number; verified: number; rejected: number; decided: number }>();
  for (const p of providers) perProvider.set(p.id, { completed: 0, placed: 0, records: 0, verified: 0, rejected: 0, decided: 0 });
  for (const e of enrollments) {
    if (e.batchEnd.getTime() > completedCutoff) continue;
    const s = perProvider.get(e.providerId);
    if (!s) continue;
    s.completed += 1;
    if (placedSet.has(e.traineeId)) s.placed += 1;
  }
  for (const r of records) {
    const enr = enrollmentByTrainee.get(r.traineeId);
    if (!enr) continue;
    const s = perProvider.get(enr.providerId);
    if (!s) continue;
    s.records += 1;
    if (r.status === 'VERIFIED') s.verified += 1;
    if (r.status === 'REJECTED') s.rejected += 1;
    if (r.status !== 'PENDING_VERIFICATION') s.decided += 1;
  }
  for (const [providerId, s] of perProvider) {
    const name = providerName.get(providerId) ?? 'Provider';
    const placement = s.completed ? s.placed / s.completed : 0;
    const verification = s.records ? s.verified / s.records : 0;
    if (s.completed >= 20 && s.records >= 10 && placement > 0.7 && verification < 0.4) {
      drafts.push({
        key: `R1:${providerId}`,
        rule: 'PLACEMENT_VERIFICATION_GAP',
        severity: 'HIGH',
        title: 'Verify placements',
        detail: `${name} claims ${pct(placement)} placement across ${s.completed} completed trainees, but only ${s.verified} of ${s.records} employment records (${pct(verification)}) are verified.`,
        metrics: { claimedPlacement: Math.round(placement * 1000) / 10, verificationRate: Math.round(verification * 1000) / 10, records: s.records },
        providerId,
      });
    }
    const rejectionShare = s.decided ? s.rejected / s.decided : 0;
    if (s.rejected >= 3 && rejectionShare > 0.15) {
      drafts.push({
        key: `R4:${providerId}`,
        rule: 'REJECTION_CLUSTER',
        severity: 'HIGH',
        title: 'Investigate provider',
        detail: `${s.rejected} of ${s.decided} employer responses for ${name} rejected the claimed placement (${pct(rejectionShare)}).`,
        metrics: { rejected: s.rejected, decided: s.decided },
        providerId,
      });
    }
  }

  // Rule 2: wage outliers against the course-sector median of all non-rejected records.
  const wagesBySector = new Map<string, number[]>();
  const recordSector = new Map<string, string>();
  for (const r of records) {
    const enr = enrollmentByTrainee.get(r.traineeId);
    const sector = enr ? courseSector.get(enr.course.code) : undefined;
    if (!sector) continue;
    recordSector.set(r.id, sector);
    if (r.status === 'REJECTED') continue;
    const list = wagesBySector.get(sector) ?? [];
    list.push(r.monthlyWage);
    wagesBySector.set(sector, list);
  }
  const sectorMedian = new Map<string, number>();
  for (const [sector, list] of wagesBySector) sectorMedian.set(sector, median(list) ?? 0);
  for (const r of records) {
    if (r.status === 'REJECTED') continue;
    const sector = recordSector.get(r.id);
    const med = sector ? sectorMedian.get(sector) : undefined;
    if (!sector || !med || r.monthlyWage <= 2 * med) continue;
    const enr = enrollmentByTrainee.get(r.traineeId);
    drafts.push({
      key: `R2:${r.id}`,
      rule: 'WAGE_OUTLIER',
      severity: 'MEDIUM',
      title: 'Wage outlier — review',
      detail: `${rupees(r.monthlyWage)} per month reported for ${r.designation} at ${r.employer.name}; ${sector} median is ${rupees(med)} (${(r.monthlyWage / med).toFixed(1)}x).`,
      metrics: { wage: r.monthlyWage, sectorMedian: med, course: enr ? courseName.get(enr.course.code) ?? '' : '' },
      providerId: enr?.providerId,
      employerId: r.employerId,
      employmentRecordId: r.id,
    });
  }

  // Rule 3: employer concentration within 30 days per provider.
  const groups = new Map<string, { providerId: string; employerId: string; employerName: string; dates: number[] }>();
  for (const r of records) {
    const enr = enrollmentByTrainee.get(r.traineeId);
    if (!enr) continue;
    const key = `${enr.providerId}:${r.employerId}`;
    const g = groups.get(key) ?? { providerId: enr.providerId, employerId: r.employerId, employerName: r.employer.name, dates: [] };
    g.dates.push(r.startDate.getTime());
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    if (g.dates.length <= 15) continue;
    const dates = g.dates.sort((a, b) => a - b);
    let best = 0;
    let bestSpan = 0;
    let lo = 0;
    for (let hi = 0; hi < dates.length; hi++) {
      while (dates[hi] - dates[lo] > 30 * DAY_MS) lo++;
      if (hi - lo + 1 > best) {
        best = hi - lo + 1;
        bestSpan = Math.round((dates[hi] - dates[lo]) / DAY_MS);
      }
    }
    if (best > 15) {
      drafts.push({
        key: `R3:${g.providerId}:${g.employerId}`,
        rule: 'EMPLOYER_CONCENTRATION',
        severity: 'HIGH',
        title: 'Employer concentration',
        detail: `${best} trainees from ${providerName.get(g.providerId)} were linked to ${g.employerName} within ${bestSpan} days.`,
        metrics: { trainees: best, windowDays: bestSpan },
        providerId: g.providerId,
        employerId: g.employerId,
      });
    }
  }

  const existing = await prisma.integrityAlert.findMany({ select: { key: true, status: true } });
  const existingOpen = new Set(existing.filter((a) => a.status === 'OPEN').map((a) => a.key));
  const existingAll = new Set(existing.map((a) => a.key));
  let created = 0;
  for (const d of drafts) {
    if (!existingAll.has(d.key)) created++;
    await prisma.integrityAlert.upsert({
      where: { key: d.key },
      create: { ...d, metrics: d.metrics, createdAt: now, lastSeenAt: now },
      update: { status: 'OPEN', title: d.title, detail: d.detail, metrics: d.metrics, severity: d.severity, lastSeenAt: now },
    });
  }
  const keys = new Set(drafts.map((d) => d.key));
  const toResolve = [...existingOpen].filter((k) => !keys.has(k));
  if (toResolve.length) {
    await prisma.integrityAlert.updateMany({ where: { key: { in: toResolve } }, data: { status: 'RESOLVED' } });
  }
  bumpVersion();
  const byRule: Record<string, number> = {};
  for (const d of drafts) byRule[d.rule] = (byRule[d.rule] ?? 0) + 1;
  return { ranAt: now.toISOString(), open: drafts.length, created, resolved: toResolve.length, byRule };
}

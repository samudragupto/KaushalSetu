import {
  ATTRITION_REASON_LABELS,
  COURSE_BY_CODE,
  DISTRICTS,
  SECTORS,
  SKILL_BY_KEY,
  foldOutcomes,
  isWorking,
  type DashboardFilters,
  type DashboardPayload,
  type DistrictMetric,
  type KpiSet,
  type KpiValue,
  type LeagueRow,
  type ReasonSlice,
  type RetentionSeries,
  type SkillGapRow,
} from '@kaushalsetu/shared';
import { DAY_MS, median, ratio } from '../lib/stats';
import { getDataset, type Dataset, type DTrainee } from './dataset';

const MONTH_MS = 30.4 * DAY_MS;

export function resolveAsOf(asOf?: string): Date {
  if (asOf && /^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    const d = new Date(`${asOf}T23:59:59.000Z`);
    if (!Number.isNaN(d.getTime()) && d.getTime() <= Date.now()) return d;
  }
  return new Date();
}

function ageBand(dob: Date, at: Date): string {
  const age = (at.getTime() - dob.getTime()) / (365.25 * DAY_MS);
  if (age < 22) return '18-21';
  if (age < 26) return '22-25';
  if (age < 31) return '26-30';
  return '31+';
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function filterTrainees(ds: Dataset, f: DashboardFilters, asOf: Date, skip: (keyof DashboardFilters)[] = []): DTrainee[] {
  const use = (k: keyof DashboardFilters) => !skip.includes(k) && !!f[k];
  return ds.trainees.filter((t) => {
    if (t.batchStart.getTime() > asOf.getTime()) return false;
    if (use('district') && t.district !== f.district) return false;
    if (use('sector') && t.sector !== f.sector) return false;
    if (use('course') && t.courseCode !== f.course) return false;
    if (use('provider') && t.providerId !== f.provider) return false;
    if (use('gender') && t.gender !== f.gender) return false;
    if (use('socialCategory') && t.socialCategory !== f.socialCategory) return false;
    if (use('ageBand') && ageBand(t.dob, asOf) !== f.ageBand) return false;
    if (use('cohortMonth') && monthKey(t.batchEnd) !== f.cohortMonth) return false;
    return true;
  });
}

const kpi = (numerator: number, denominator: number, value?: number | null): KpiValue => ({
  value: value !== undefined ? value : ratio(numerator, denominator),
  numerator,
  denominator,
});

export function computeKpis(list: DTrainee[], asOf: Date): KpiSet {
  const t = asOf.getTime();
  let eligible90 = 0;
  let placed90 = 0;
  let base6 = 0;
  let kept6 = 0;
  const wages: number[] = [];
  const growth: number[] = [];
  let working = 0;
  let self = 0;
  let records = 0;
  let verified = 0;
  let completed = 0;

  for (const tr of list) {
    const end = tr.batchEnd.getTime();
    if (end <= t) completed++;
    if (end <= t - 90 * DAY_MS) {
      eligible90++;
      const s90 = foldOutcomes(tr.events, new Date(end + 90 * DAY_MS));
      if (s90.firstPlacedAt) placed90++;
    }
    const now = foldOutcomes(tr.events, asOf);
    if (now.firstPlacedAt) {
      const first = now.firstPlacedAt.getTime();
      if (first + 6 * MONTH_MS <= t) {
        base6++;
        if (isWorking(foldOutcomes(tr.events, new Date(first + 6 * MONTH_MS)).status)) kept6++;
      }
      if (tr.consentWage && first + 12 * MONTH_MS <= t && now.startWage) {
        const s12 = foldOutcomes(tr.events, new Date(first + 12 * MONTH_MS));
        if (s12.status === 'EMPLOYED' && s12.wage) growth.push(s12.wage / now.startWage - 1);
      }
    }
    if (isWorking(now.status)) {
      working++;
      if (now.status === 'SELF_EMPLOYED') self++;
      if (now.status === 'EMPLOYED' && tr.consentWage && now.wage) wages.push(now.wage);
    }
    for (const r of tr.records) {
      if (r.createdAt.getTime() > t) continue;
      records++;
      if (r.verifiedAt && r.verifiedAt.getTime() <= t && r.status === 'VERIFIED') verified++;
    }
  }
  return {
    placementRate90: kpi(placed90, eligible90),
    retention6: kpi(kept6, base6),
    medianWage: kpi(wages.length, wages.length, median(wages)),
    wageGrowth12: kpi(growth.length, growth.length, median(growth)),
    selfEmploymentShare: kpi(self, working),
    verificationRate: kpi(verified, records),
    traineesInScope: list.length,
    completedTraining: completed,
  };
}

function retentionSeries(list: DTrainee[], asOf: Date, sector: string, short: string): RetentionSeries {
  const t = asOf.getTime();
  const placed = list
    .map((tr) => ({ tr, first: foldOutcomes(tr.events, asOf).firstPlacedAt }))
    .filter((x): x is { tr: DTrainee; first: Date } => x.first !== null);
  const points = [0, 3, 6, 12, 24].map((m) => {
    if (m === 0) return { month: 0, label: 'Placed', value: placed.length ? 1 : null, base: placed.length };
    const base = placed.filter((x) => x.first.getTime() + m * MONTH_MS <= t);
    const kept = base.filter((x) => isWorking(foldOutcomes(x.tr.events, new Date(x.first.getTime() + m * MONTH_MS)).status));
    return { month: m, label: `${m}m`, value: base.length >= 5 ? kept.length / base.length : null, base: base.length };
  });
  return { sector, short, points };
}

function reasonSlices(list: DTrainee[], asOf: Date, eventTypes: string[]): ReasonSlice[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const tr of list) {
    for (const e of tr.events) {
      if (e.occurredAt.getTime() > asOf.getTime()) break;
      if (!eventTypes.includes(e.eventType) || !e.attritionReason) continue;
      counts.set(e.attritionReason, (counts.get(e.attritionReason) ?? 0) + 1);
      total++;
    }
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, label: ATTRITION_REASON_LABELS[reason] ?? reason, count, pct: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}

function districtMetrics(list: DTrainee[], asOf: Date): DistrictMetric[] {
  const groups = new Map<string, DTrainee[]>();
  for (const d of DISTRICTS) groups.set(d.name, []);
  for (const tr of list) groups.get(tr.district)?.push(tr);
  return [...groups.entries()].map(([district, trs]) => {
    const k = computeKpis(trs, asOf);
    return {
      district,
      trainees: trs.length,
      placementRate: k.placementRate90.denominator >= 5 ? k.placementRate90.value : null,
      retention6: k.retention6.denominator >= 5 ? k.retention6.value : null,
      medianWage: k.medianWage.value,
      verificationRate: k.verificationRate.denominator >= 5 ? k.verificationRate.value : null,
    };
  });
}

function withDelta(k: KpiSet, state: KpiSet): KpiSet {
  const keys = ['placementRate90', 'retention6', 'medianWage', 'wageGrowth12', 'selfEmploymentShare', 'verificationRate'] as const;
  const out = { ...k };
  for (const key of keys) {
    const a = k[key].value;
    const b = state[key].value;
    out[key] = { ...k[key], deltaVsState: a !== null && b !== null ? a - b : null };
  }
  return out;
}

const resultCache = new Map<string, { stamp: number; value: unknown }>();

async function cached<T>(name: string, filters: DashboardFilters, compute: (ds: Dataset) => T | Promise<T>): Promise<T> {
  const ds = await getDataset();
  const key = `${name}:${JSON.stringify(filters)}:${filters.asOf ? '' : new Date().toISOString().slice(0, 13)}`;
  const hit = resultCache.get(key);
  if (hit && hit.stamp === ds.builtAt.getTime()) return hit.value as T;
  const value = await compute(ds);
  if (resultCache.size > 400) resultCache.clear();
  resultCache.set(key, { stamp: ds.builtAt.getTime(), value });
  return value;
}

export function dashboard(filters: DashboardFilters): Promise<DashboardPayload> {
  return cached('dashboard', filters, (ds) => {
    const asOf = resolveAsOf(filters.asOf);
    const list = filterTrainees(ds, filters, asOf);
    const stateList = filterTrainees(ds, {}, asOf);
    const stateKpis = computeKpis(stateList, asOf);
    const kpis = withDelta(computeKpis(list, asOf), stateKpis);
    const mapList = filterTrainees(ds, filters, asOf, ['district']);
    const sectors = filters.sector ? SECTORS.filter((s) => s.name === filters.sector) : SECTORS;
    const retention = sectors.map((s) => retentionSeries(list.filter((t) => t.sector === s.name), asOf, s.name, s.short));
    const weekStart = asOf.getTime() - 7 * DAY_MS;
    let sent = 0;
    let responded = 0;
    for (const tr of list) {
      for (const f of tr.followUps) {
        if (!f.sentAt || f.sentAt.getTime() < weekStart || f.sentAt.getTime() > asOf.getTime()) continue;
        sent++;
        if (f.respondedAt && f.respondedAt.getTime() <= asOf.getTime()) responded++;
      }
    }
    return {
      asOf: asOf.toISOString(),
      filters,
      kpis,
      stateKpis,
      districts: districtMetrics(mapList, asOf),
      retention,
      retentionOverall: retentionSeries(list, asOf, 'All sectors', 'All'),
      reasons: reasonSlices(list, asOf, ['ATTRITION']),
      nonPlacementReasons: reasonSlices(list, asOf, ['UNEMPLOYED']),
      dataVersion: ds.version,
      weeklyPulse: { sent, responded, district: filters.district ?? null },
    };
  });
}

export function leagueTable(filters: DashboardFilters): Promise<LeagueRow[]> {
  return cached('league', filters, (ds) => {
    const asOf = resolveAsOf(filters.asOf);
    const list = filterTrainees(ds, filters, asOf, ['provider']);
    const byProvider = new Map<string, DTrainee[]>();
    for (const t of list) {
      const arr = byProvider.get(t.providerId) ?? [];
      arr.push(t);
      byProvider.set(t.providerId, arr);
    }
    const rows: LeagueRow[] = [];
    for (const [providerId, trs] of byProvider) {
      const p = ds.providerById.get(providerId);
      if (!p) continue;
      const k = computeKpis(trs, asOf);
      const flags = ds.alerts.filter((a) => a.providerId === providerId && a.rule !== 'WAGE_OUTLIER').map((a) => ({ rule: a.rule, title: a.title, severity: a.severity }));
      const outliers = ds.alerts.filter((a) => a.providerId === providerId && a.rule === 'WAGE_OUTLIER').length;
      if (outliers) flags.push({ rule: 'WAGE_OUTLIER', title: outliers > 1 ? `${outliers} wage outliers` : 'Wage outlier', severity: 'MEDIUM' });
      rows.push({
        providerId,
        name: p.name,
        type: p.type,
        district: p.district,
        trainees: trs.length,
        placementRate: k.placementRate90.value,
        verifiedRate: k.verificationRate.value,
        retention6: k.retention6.value,
        medianWage: k.medianWage.value,
        flags,
      });
    }
    return rows.sort((a, b) => b.flags.length - a.flags.length || (b.placementRate ?? 0) - (a.placementRate ?? 0));
  });
}

export function skillGaps(filters: DashboardFilters): Promise<SkillGapRow[]> {
  return cached('skillgaps', filters, (ds) => {
    const asOf = resolveAsOf(filters.asOf);
    const notWorking = new Map<string, number>();
    for (const t of ds.trainees) {
      if (t.batchEnd.getTime() > asOf.getTime()) continue;
      const s = foldOutcomes(t.events, asOf);
      if (s.status !== 'UNEMPLOYED') continue;
      const key = `${t.district}|${t.courseCode}`;
      notWorking.set(key, (notWorking.get(key) ?? 0) + 1);
    }
    const rows: SkillGapRow[] = [];
    for (const s of ds.signals) {
      const course = COURSE_BY_CODE[s.courseCode];
      if (!course) continue;
      if (filters.district && s.district !== filters.district) continue;
      if (filters.course && s.courseCode !== filters.course) continue;
      if (filters.sector && course.sector !== filters.sector) continue;
      const cohortSize = Math.max(notWorking.get(`${s.district}|${s.courseCode}`) ?? 0, s.severity);
      rows.push({
        skillKey: s.skill,
        skill: SKILL_BY_KEY[s.skill]?.label ?? s.skill,
        district: s.district,
        courseCode: s.courseCode,
        courseName: course.name,
        sector: course.sector,
        mentions: s.severity,
        cohortSize,
        share: cohortSize ? s.severity / cohortSize : 0,
        quotes: s.quotes,
      });
    }
    return rows.sort((a, b) => b.mentions - a.mentions || b.share - a.share).slice(0, 25);
  });
}

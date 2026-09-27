import { COURSES } from '@kaushalsetu/shared';
import { prisma } from '../db';
import { dataVersion } from '../lib/version';

// In-memory analytical snapshot. 3,200 trainees and their event histories fit comfortably in
// memory; the snapshot is rebuilt only when a write bumps the data version, so the dashboard's
// 5-second poll costs a cache lookup rather than a database scan.

export interface DEvent {
  eventType: string;
  occurredAt: Date;
  payload: unknown;
  attritionReason: string | null;
}

export interface DRecord {
  id: string;
  status: string;
  createdAt: Date;
  verifiedAt: Date | null;
  rejectedAt: Date | null;
  monthlyWage: number;
  employerId: string;
}

export interface DFollowUp {
  status: string;
  sentAt: Date | null;
  respondedAt: Date | null;
}

export interface DTrainee {
  id: string;
  unifiedId: string;
  district: string;
  gender: string;
  socialCategory: string;
  dob: Date;
  courseCode: string;
  courseName: string;
  sector: string;
  providerId: string;
  batchStart: Date;
  batchEnd: Date;
  events: DEvent[];
  records: DRecord[];
  followUps: DFollowUp[];
  consentEmployment: boolean;
  consentWage: boolean;
  consentPublic: boolean;
}

export interface DProvider {
  id: string;
  name: string;
  type: string;
  district: string;
}

export interface DAlert {
  id: string;
  rule: string;
  title: string;
  severity: string;
  detail: string;
  providerId: string | null;
  employmentRecordId: string | null;
}

export interface DSignal {
  skill: string;
  district: string;
  courseCode: string;
  severity: number;
  quotes: string[];
}

export interface Dataset {
  version: number;
  builtAt: Date;
  trainees: DTrainee[];
  providers: DProvider[];
  providerById: Map<string, DProvider>;
  alerts: DAlert[];
  signals: DSignal[];
}

let cached: Dataset | null = null;
let building: Promise<Dataset> | null = null;

async function build(version: number): Promise<Dataset> {
  const [trainees, enrollments, courses, events, records, followUps, consents, providers, alerts, signals] = await Promise.all([
    prisma.trainee.findMany({ select: { id: true, unifiedId: true, district: true, gender: true, socialCategory: true, dob: true } }),
    prisma.enrollment.findMany({ select: { traineeId: true, courseId: true, providerId: true, batchStart: true, batchEnd: true }, orderBy: { batchEnd: 'asc' } }),
    prisma.course.findMany({ select: { id: true, code: true, name: true, sector: true } }),
    prisma.outcomeEvent.findMany({ select: { traineeId: true, eventType: true, occurredAt: true, payload: true, attritionReason: true }, orderBy: { occurredAt: 'asc' } }),
    prisma.employmentRecord.findMany({ select: { id: true, traineeId: true, status: true, createdAt: true, verifiedAt: true, rejectedAt: true, monthlyWage: true, employerId: true } }),
    prisma.followUp.findMany({ where: { sentAt: { not: null } }, select: { traineeId: true, status: true, sentAt: true, respondedAt: true } }),
    prisma.consentRecord.findMany({ select: { traineeId: true, scope: true, granted: true, capturedAt: true }, orderBy: { capturedAt: 'asc' } }),
    prisma.provider.findMany({ select: { id: true, name: true, type: true, district: true } }),
    prisma.integrityAlert.findMany({ where: { status: 'OPEN' }, select: { id: true, rule: true, title: true, severity: true, detail: true, providerId: true, employmentRecordId: true } }),
    prisma.skillGapSignal.findMany(),
  ]);

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const enrollmentByTrainee = new Map<string, (typeof enrollments)[number]>();
  for (const e of enrollments) enrollmentByTrainee.set(e.traineeId, e);

  const byTrainee = new Map<string, DTrainee>();
  const list: DTrainee[] = [];
  for (const t of trainees) {
    const enr = enrollmentByTrainee.get(t.id);
    if (!enr) continue;
    const course = courseById.get(enr.courseId);
    if (!course) continue;
    const d: DTrainee = {
      id: t.id,
      unifiedId: t.unifiedId,
      district: t.district,
      gender: t.gender,
      socialCategory: t.socialCategory,
      dob: t.dob,
      courseCode: course.code,
      courseName: course.name,
      sector: course.sector,
      providerId: enr.providerId,
      batchStart: enr.batchStart,
      batchEnd: enr.batchEnd,
      events: [],
      records: [],
      followUps: [],
      consentEmployment: true,
      consentWage: true,
      consentPublic: true,
    };
    byTrainee.set(t.id, d);
    list.push(d);
  }
  for (const e of events) byTrainee.get(e.traineeId)?.events.push({ eventType: e.eventType, occurredAt: e.occurredAt, payload: e.payload, attritionReason: e.attritionReason });
  for (const r of records) byTrainee.get(r.traineeId)?.records.push(r);
  for (const f of followUps) byTrainee.get(f.traineeId)?.followUps.push({ status: f.status, sentAt: f.sentAt, respondedAt: f.respondedAt });
  for (const c of consents) {
    const t = byTrainee.get(c.traineeId);
    if (!t) continue;
    if (c.scope === 'employmentTracking') t.consentEmployment = c.granted;
    if (c.scope === 'wageTracking') t.consentWage = c.granted;
    if (c.scope === 'publicAggregates') t.consentPublic = c.granted;
  }
  const codeByCourseId = new Map(courses.map((c) => [c.id, c.code]));
  return {
    version,
    builtAt: new Date(),
    trainees: list,
    providers,
    providerById: new Map(providers.map((p) => [p.id, p])),
    alerts,
    signals: signals.map((s) => ({ skill: s.extractedSkill, district: s.district, courseCode: codeByCourseId.get(s.courseId) ?? '', severity: s.severity, quotes: s.sampleQuotes })),
  };
}

export async function getDataset(): Promise<Dataset> {
  const version = dataVersion();
  // Rebuild on any write (version bump) and at least once a minute, so changes made outside
  // this process (for example a reseed) also show up.
  if (cached && cached.version === version && Date.now() - cached.builtAt.getTime() < 60_000) return cached;
  if (!building) {
    building = build(version).finally(() => {
      building = null;
    });
  }
  const ds = await building;
  cached = ds;
  return ds;
}

export const COURSE_NAME = new Map(COURSES.map((c) => [c.code, c.name]));

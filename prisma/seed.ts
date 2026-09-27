// Deterministic seed for KaushalSetu. Every random draw comes from one seeded generator
// (seed "sih26135"), so the same data is produced on every run. Dates are laid out relative
// to the day the seed runs, so the longitudinal views always end "today".
//
// Run: npm run db:seed   (wipes and reseeds)   or   npm run db:reset (migrate reset + seed)
import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  COURSE_BY_CODE,
  DESIGNATIONS_BY_COURSE,
  DISTRICTS,
  DISTRICT_BY_NAME,
  MILESTONE_DAYS,
  SECTORS,
  SECTOR_BY_NAME,
  extractSkills,
  foldOutcomes,
  gstinChecksum,
  isWorking,
} from '../packages/shared/src';
import {
  AGENT_NOTES,
  EMPLOYER_NOUNS,
  EMPLOYER_PREFIXES,
  EMPLOYER_SUFFIX,
  FEMALE_NAMES,
  INDUSTRIAL_HUBS,
  MALE_NAMES,
  PROVIDERS,
  SKILL_QUOTES,
  SURNAMES,
} from './seed-data';
import { runFraudSweep } from '../apps/api/src/services/fraud';

const prisma = new PrismaClient();

// ---------------------------------------------------------------- deterministic RNG
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(xmur3('sih26135')());
const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const uniform = (a: number, b: number) => a + rand() * (b - a);
const chance = (p: number) => rand() < p;
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function weighted<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
function normal(): number {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
let idCounter = 0;
const newId = (prefix: string) => `${prefix}${(++idCounter).toString(36).padStart(7, '0')}`;

// ---------------------------------------------------------------- dates
const DAY = 86_400_000;
const now = new Date();
const TODAY = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6, 0, 0));
const daysAgo = (n: number) => new Date(TODAY.getTime() - n * DAY);
const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const withHour = (d: Date) => new Date(d.getTime() + int(0, 9) * 3_600_000 + int(0, 59) * 60_000);
const MONTH = 30.4;
const notFuture = (d: Date) => d.getTime() <= TODAY.getTime() + 8 * 3_600_000;

// ---------------------------------------------------------------- row buffers
type Row = Record<string, unknown>;
const rows = {
  trainees: [] as Row[],
  consents: [] as Row[],
  enrollments: [] as Row[],
  employers: [] as Row[],
  records: [] as Row[],
  events: [] as Row[],
  followUps: [] as Row[],
  agentTasks: [] as Row[],
  sessions: [] as Row[],
  messages: [] as Row[],
  evidence: [] as Row[],
};

// ---------------------------------------------------------------- reference entities
const courseIds = new Map<string, string>();
const providerIds = new Map<string, string>();
const providerSeedById = new Map<string, (typeof PROVIDERS)[number]>();

interface EmployerRow {
  id: string;
  name: string;
  gstin: string;
  gstinValid: boolean;
  district: string;
  sector: string;
  employeeCount: number;
}
const employers: EmployerRow[] = [];
const employerNames = new Set<string>();

function makePan(name: string, entity: string): string {
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const first = name.replace(/[^A-Z]/gi, '').toUpperCase()[0] ?? 'K';
  return `${pick(L.split(''))}${pick(L.split(''))}${pick(L.split(''))}${entity}${first}${String(int(1000, 9999))}${pick(L.split(''))}`;
}
function makeGstin(name: string, entity: string, validChecksum = true): string {
  const base = `27${makePan(name, entity)}1Z`;
  const check = gstinChecksum(base);
  if (validChecksum) return base + check;
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return base + chars[(chars.indexOf(check) + 7) % 36];
}
function addEmployer(name: string, sector: string, district: string, opts: { valid?: boolean; cancelled?: boolean; size?: number } = {}): EmployerRow {
  const entity = name.includes('Pvt Ltd') ? 'C' : name.includes('LLP') ? 'F' : 'P';
  const invalidChecksum = opts.valid === false && !opts.cancelled;
  const e: EmployerRow = {
    id: newId('emp'),
    name,
    gstin: makeGstin(name, entity, !invalidChecksum),
    gstinValid: opts.valid !== false,
    district,
    sector,
    employeeCount: opts.size ?? int(12, 1800),
  };
  employers.push(e);
  employerNames.add(name);
  return e;
}

function generateEmployers() {
  const counts: Record<string, number> = {
    'Capital Goods & Manufacturing': 70,
    'Electrical & Green Energy': 35,
    Automotive: 40,
    Retail: 45,
    'IT-ITeS': 40,
    'Beauty & Wellness': 25,
    BFSI: 30,
    'Tourism & Hospitality': 35,
  };
  const districtNames = DISTRICTS.map((d) => d.name);
  const districtWeights = DISTRICTS.map((d) => d.weight);
  for (const [sector, count] of Object.entries(counts)) {
    let made = 0;
    let guard = 0;
    while (made < count && guard < 5000) {
      guard++;
      const suffix = pick(EMPLOYER_SUFFIX);
      const name = `${pick(EMPLOYER_PREFIXES)} ${pick(EMPLOYER_NOUNS[sector])}${suffix ? ` ${suffix}` : ''}`;
      if (employerNames.has(name)) continue;
      const hubs = INDUSTRIAL_HUBS[sector];
      const district = hubs && chance(0.7) ? pick(hubs) : weighted(districtNames, districtWeights);
      addEmployer(name, sector, district);
      made++;
    }
  }
}

function pickEmployer(sector: string, district: string): EmployerRow {
  const pool = employers.filter((e) => e.sector === sector && e.gstinValid);
  const division = DISTRICT_BY_NAME[district]?.division;
  const r = rand();
  if (r < 0.55) {
    const local = pool.filter((e) => e.district === district);
    if (local.length) return pick(local);
  }
  if (r < 0.85) {
    const regional = pool.filter((e) => DISTRICT_BY_NAME[e.district]?.division === division);
    if (regional.length) return pick(regional);
  }
  return pick(pool);
}

// ---------------------------------------------------------------- trainee builders
const usedIds = new Set<string>();
function unifiedId(district: string, fixed?: number): string {
  const code = DISTRICT_BY_NAME[district].code;
  let n = fixed ?? int(200000, 999999);
  while (usedIds.has(`${code}-${n}`)) n = int(200000, 999999);
  usedIds.add(`${code}-${n}`);
  return `MH-${code}-${n}`;
}
function phone(): string {
  return `${pick(['9', '9', '8', '7'])}${String(int(100000000, 999999999))}`;
}

interface TraineeCtx {
  id: string;
  district: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  courseCode: string;
  providerId: string;
  providerQuality: number;
  batchStart: Date;
  batchEnd: Date;
  certified: boolean;
  consentEmployment: boolean;
  events: { eventType: string; occurredAt: Date; payload: Record<string, unknown> }[];
  firstName: string;
}

interface TraineeInput {
  fullName?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  district: string;
  providerName: string;
  courseCode: string;
  batchEnd: Date;
  socialCategory?: string;
  dob?: Date;
  unifiedNumber?: number;
  certified?: boolean;
  isPersona?: boolean;
  consents?: { employment: boolean; wage: boolean; public: boolean };
  phonePrimary?: string;
}

function createTrainee(input: TraineeInput): TraineeCtx {
  const gender = input.gender ?? (chance(0.44) ? 'FEMALE' : chance(0.985) ? 'MALE' : 'OTHER');
  const first = gender === 'FEMALE' ? pick(FEMALE_NAMES) : pick(MALE_NAMES);
  const fullName = input.fullName ?? `${first} ${pick(SURNAMES)}`;
  const course = COURSE_BY_CODE[input.courseCode];
  const batchEnd = input.batchEnd;
  const batchStart = plusDays(batchEnd, -Math.round(course.durationHours / 5) - int(5, 20));
  const ageAtEnd = 18 + Math.min(20, Math.floor(Math.abs(normal()) * 4.2));
  const dob = input.dob ?? plusDays(batchEnd, -Math.round(ageAtEnd * 365.25) - int(0, 360));
  const attendance = Math.round(uniform(66, 98) * 10) / 10;
  const score = Math.round(uniform(42, 95) * 10) / 10;
  const certified = input.certified ?? (attendance >= 70 && score >= 50);
  const primary = input.phonePrimary ?? phone();
  const alternate = chance(0.45) ? phone() : null;
  const id = newId('trn');
  const providerId = providerIds.get(input.providerName);
  if (!providerId) throw new Error(`Unknown provider ${input.providerName}`);
  const [firstName, lastName] = fullName.split(' ');
  rows.trainees.push({
    id,
    unifiedId: unifiedId(input.district, input.unifiedNumber),
    fullName,
    dob,
    gender,
    socialCategory: input.socialCategory ?? weighted(['OBC', 'OPEN', 'SC', 'ST', 'EWS'], [38, 24, 16, 11, 11]),
    district: input.district,
    phonePrimary: primary,
    phoneAlternate: alternate,
    whatsappNumber: chance(0.85) || !alternate ? primary : alternate,
    email: chance(0.35) ? `${firstName.toLowerCase()}.${(lastName ?? 'k').toLowerCase()}${int(10, 99)}@gmail.com` : null,
    preferredLang: chance(0.78) ? 'mr' : chance(0.6) ? 'hi' : 'en',
    isPersona: input.isPersona ?? false,
    createdAt: batchStart,
  });
  rows.enrollments.push({
    id: newId('enr'),
    traineeId: id,
    courseId: courseIds.get(input.courseCode),
    providerId,
    batchStart,
    batchEnd,
    attendancePct: attendance,
    assessmentScore: score,
    certified,
  });
  const consents = input.consents ?? { employment: chance(0.97), wage: chance(0.93), public: chance(0.9) };
  const consentAt = withHour(batchStart);
  rows.consents.push(
    { id: newId('con'), traineeId: id, granted: consents.employment, scope: 'employmentTracking', capturedAt: consentAt, channel: 'ENROLMENT_FORM', sourceIp: null },
    { id: newId('con'), traineeId: id, granted: consents.wage, scope: 'wageTracking', capturedAt: consentAt, channel: 'ENROLMENT_FORM', sourceIp: null },
    { id: newId('con'), traineeId: id, granted: consents.public, scope: 'publicAggregates', capturedAt: consentAt, channel: 'ENROLMENT_FORM', sourceIp: null },
  );
  const provider = providerSeedById.get(providerId);
  return {
    id,
    district: input.district,
    gender,
    courseCode: input.courseCode,
    providerId,
    providerQuality: provider?.quality ?? 1,
    batchStart,
    batchEnd,
    certified,
    consentEmployment: consents.employment,
    events: [],
    firstName: fullName.split(' ')[0],
  };
}

// ---------------------------------------------------------------- outcome helpers
type Source = 'TRAINER_REPORT' | 'BOT' | 'EMPLOYER_VERIFIED' | 'EPFO_SIM' | 'AGENT_CALL';
type Verification = 'auto' | 'EMPLOYER_LINK' | 'EPFO_SIM' | 'REJECTED' | 'PENDING';

function pushEvent(t: TraineeCtx, eventType: string, at: Date, source: Source, payload: Record<string, unknown>, reason?: string) {
  const occurredAt = withHour(at);
  t.events.push({ eventType, occurredAt, payload });
  rows.events.push({ id: newId('evt'), traineeId: t.id, eventType, occurredAt, source, payload, attritionReason: reason ?? null, createdAt: occurredAt });
}

function addRecord(t: TraineeCtx, employer: EmployerRow, designation: string, wage: number, start: Date, verification: Verification, rejectionReason?: string): Row {
  const createdAt = withHour(plusDays(start, int(1, 12)));
  const rec: Row = {
    id: newId('rec'),
    traineeId: t.id,
    employerId: employer.id,
    designation,
    monthlyWage: wage,
    startDate: start,
    endDate: null,
    status: 'PENDING_VERIFICATION',
    verificationMethod: null,
    verifiedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    evidence: {},
    createdAt: notFuture(createdAt) ? createdAt : TODAY,
  };
  let mode = verification;
  if (mode === 'auto') {
    const age = (TODAY.getTime() - start.getTime()) / DAY;
    const r = rand();
    if (age < 25) mode = r < 0.25 ? 'EMPLOYER_LINK' : 'PENDING';
    else mode = r < 0.21 ? 'EPFO_SIM' : r < 0.67 ? 'EMPLOYER_LINK' : r < 0.69 ? 'REJECTED' : 'PENDING';
  }
  if (mode === 'EPFO_SIM') {
    const at = plusDays(start, int(35, 70));
    if (notFuture(at)) {
      Object.assign(rec, { status: 'VERIFIED', verificationMethod: 'EPFO_SIM', verifiedAt: withHour(at), evidence: { uan: `1010${int(10000000, 99999999)}`, establishmentId: `MHPUN${int(1000000, 9999999)}`, contributionMonths: int(1, 3) } });
    }
  } else if (mode === 'EMPLOYER_LINK') {
    const at = plusDays(rec.createdAt as Date, int(1, 12));
    if (notFuture(at)) Object.assign(rec, { status: 'VERIFIED', verificationMethod: 'EMPLOYER_LINK', verifiedAt: withHour(at), evidence: { approvedBy: 'HR desk', otpVerified: true } });
  } else if (mode === 'REJECTED') {
    const at = plusDays(rec.createdAt as Date, int(2, 15));
    if (notFuture(at)) {
      Object.assign(rec, {
        status: 'REJECTED',
        verificationMethod: 'EMPLOYER_LINK',
        rejectedAt: withHour(at),
        rejectionReason: rejectionReason ?? pick(['Person did not join after offer.', 'Designation and wage do not match our records.', 'No such employee on our rolls.']),
      });
    }
  }
  rows.records.push(rec);
  return rec;
}

function closeRecord(rec: Row | null, at: Date) {
  if (rec) rec.endDate = at;
}

function roundWage(w: number) {
  return Math.round(w / 500) * 500;
}

const METRO = new Set(['Mumbai City', 'Mumbai Suburban', 'Thane', 'Pune']);
const REMOTE = new Set(['Gadchiroli', 'Nandurbar', 'Washim', 'Hingoli', 'Gondia', 'Bhandara', 'Dharashiv', 'Sindhudurg']);
function wageFactor(district: string) {
  return METRO.has(district) ? 1.12 : REMOTE.has(district) ? 0.9 : 1;
}

function startingWage(sectorName: string, district: string): number {
  const s = SECTOR_BY_NAME[sectorName];
  const w = s.wageMedian * wageFactor(district) * Math.exp(normal() * 0.16);
  return roundWage(Math.min(s.wageMax, Math.max(s.wageMin, w)));
}

function attritionMonths(curve: [number, number][]): number | null {
  const u = rand();
  let prev: [number, number] = [0, 0];
  for (const point of curve) {
    if (u <= point[1]) {
      const span = point[1] - prev[1];
      return prev[0] + ((u - prev[1]) / span) * (point[0] - prev[0]);
    }
    prev = point;
  }
  return null;
}
const GENERIC_CURVE: [number, number][] = [[3, 0.19], [6, 0.46], [12, 0.62], [24, 0.71], [36, 0.76]];
const NASHIK_CNC_CURVE: [number, number][] = [[3, 0.24], [6, 0.56], [12, 0.8], [24, 0.85], [36, 0.87]];
const ATTRITION_REASONS = ['LOW_WAGE', 'RELOCATION', 'WORKING_CONDITIONS', 'SKILL_MISMATCH', 'FAMILY', 'HEALTH', 'OTHER'];
const ATTRITION_WEIGHTS = [32, 21, 17, 14, 8, 4, 4];
const NONPLACE_WEIGHTS = [22, 12, 6, 32, 17, 5, 6];

function skillQuote(courseCode: string, favour?: string): { quote: string; skills: string[] } {
  const course = COURSE_BY_CODE[courseCode];
  const key = favour && chance(0.8) ? favour : pick(course.gapSkills);
  const quote = pick(SKILL_QUOTES[key] ?? SKILL_QUOTES.spoken_english);
  const skills = extractSkills(quote);
  return { quote, skills: skills.length ? skills : [key] };
}

function isNashikCnc(t: TraineeCtx) {
  return t.district === 'Nashik' && (t.courseCode === 'CSC/Q0110' || t.courseCode === 'CSC/Q0415');
}

function simulateGeneric(t: TraineeCtx) {
  const course = COURSE_BY_CODE[t.courseCode];
  const sector = SECTOR_BY_NAME[course.sector];
  const end = t.batchEnd;
  const nashikCnc = isNashikCnc(t);
  const nagpurIt = t.district === 'Nagpur' && sector.name === 'IT-ITeS';

  if (!t.certified && chance(0.35)) {
    pushEvent(t, 'DROPPED_OUT', plusDays(end, -int(10, 40)), 'TRAINER_REPORT', { stage: 'Before final assessment' });
    return;
  }
  let pPlace = 1.24 * sector.placementRate * t.providerQuality * (t.certified ? 1 : 0.72) * (REMOTE.has(t.district) ? 0.9 : 1);
  if (nagpurIt) pPlace *= 0.7;
  const placed = chance(pPlace);
  if (!placed) {
    const at = plusDays(end, 90 + int(0, 20));
    if (!notFuture(at)) return;
    const weights = nagpurIt ? [10, 8, 4, 62, 10, 3, 3] : NONPLACE_WEIGHTS;
    const reason = weighted(ATTRITION_REASONS, weights);
    const payload: Record<string, unknown> = { stage: 'Not placed after training' };
    if (reason === 'SKILL_MISMATCH' && chance(0.8)) Object.assign(payload, skillQuote(t.courseCode, nagpurIt ? 'react' : undefined));
    pushEvent(t, 'UNEMPLOYED', at, pick(['BOT', 'BOT', 'AGENT_CALL', 'TRAINER_REPORT'] as Source[]), payload, reason);
    return;
  }
  const delay = chance(0.88) ? int(7, 86) : int(92, 150);
  const placedAt = plusDays(end, delay);
  if (!notFuture(placedAt)) return;

  const r = rand();
  if (r < sector.selfEmploymentShare) {
    simulateSelfEmployed(t, placedAt, sector.name);
    return;
  }
  if (r < sector.selfEmploymentShare + 0.06) {
    const est = pickEmployer(sector.name, t.district);
    pushEvent(t, 'APPRENTICE', placedAt, 'TRAINER_REPORT', { establishment: est.name, employerId: est.id, stipend: roundWage(uniform(7000, 11000)) });
    const conv = plusDays(placedAt, 365);
    if (notFuture(conv) && chance(0.6)) {
      const wage = startingWage(sector.name, t.district);
      const designation = DESIGNATIONS_BY_COURSE[t.courseCode][0];
      pushEvent(t, 'PLACED', conv, 'BOT', { employerId: est.id, employerName: est.name, designation, wage, afterApprenticeship: true });
      addRecord(t, est, designation, wage, conv, 'auto');
    }
    return;
  }
  simulateWageJob(t, placedAt, sector.name, nashikCnc);
}

function simulateWageJob(t: TraineeCtx, placedAt: Date, sectorName: string, nashikCnc: boolean) {
  let employer = pickEmployer(sectorName, t.district);
  let wage = startingWage(sectorName, t.district);
  const designations = DESIGNATIONS_BY_COURSE[t.courseCode];
  const designation = chance(0.8) ? designations[0] : designations[1];
  const source = weighted<Source>(['TRAINER_REPORT', 'BOT', 'AGENT_CALL'], [55, 35, 10]);
  pushEvent(t, 'PLACED', placedAt, source, { employerId: employer.id, employerName: employer.name, designation, wage });
  let record: Row | null = addRecord(t, employer, designation, wage, placedAt, 'auto');

  const months = attritionMonths(nashikCnc ? NASHIK_CNC_CURVE : GENERIC_CURVE);
  const attritionAt = months === null ? null : plusDays(placedAt, Math.round(months * MONTH));
  const stillThere = (d: Date) => notFuture(d) && (attritionAt === null || d < attritionAt);

  // Occasional direct job switch with a raise.
  let switchAt: Date | null = null;
  if (chance(0.08)) {
    const candidate = plusDays(placedAt, Math.round(uniform(7, 20) * MONTH));
    if (stillThere(candidate)) switchAt = candidate;
  }
  for (const [m, p, lo, hi] of [[6, 0.72, 0.05, 0.12], [12, 0.7, 0.06, 0.15], [24, 0.55, 0.05, 0.12]] as const) {
    const at = plusDays(placedAt, Math.round(m * MONTH) + int(-10, 10));
    if (switchAt && at > switchAt && m === 12) {
      const next = pickEmployer(sectorName, t.district);
      const newWage = roundWage(wage * uniform(1.1, 1.25));
      pushEvent(t, 'JOB_SWITCH', switchAt, weighted<Source>(['BOT', 'EPFO_SIM', 'AGENT_CALL'], [60, 25, 15]), { employerId: next.id, employerName: next.name, designation: designations[1], wage: newWage, previousEmployer: employer.name });
      closeRecord(record, switchAt);
      record = addRecord(t, next, designations[1], newWage, switchAt, 'auto');
      employer = next;
      wage = newWage;
    }
    if (stillThere(at) && chance(p)) {
      const previous = wage;
      wage = roundWage(wage * uniform(1 + lo, 1 + hi));
      if (wage > previous) {
        pushEvent(t, 'WAGE_CHANGE', at, weighted<Source>(['BOT', 'EPFO_SIM', 'EMPLOYER_VERIFIED'], [60, 25, 15]), { wage, previous });
        if (record) record.monthlyWage = wage;
      }
    }
  }
  if (attritionAt && notFuture(attritionAt)) {
    const reason = nashikCnc ? weighted(ATTRITION_REASONS, [22, 12, 12, 42, 6, 3, 3]) : weighted(ATTRITION_REASONS, ATTRITION_WEIGHTS);
    const payload: Record<string, unknown> = { employerName: employer.name, tenureMonths: Math.round(months ?? 0) };
    if (reason === 'SKILL_MISMATCH' && chance(0.75)) Object.assign(payload, skillQuote(t.courseCode, nashikCnc ? 'cnc_5axis' : undefined));
    pushEvent(t, 'ATTRITION', attritionAt, pick(['BOT', 'BOT', 'AGENT_CALL', 'EPFO_SIM'] as Source[]), payload, reason);
    closeRecord(record, attritionAt);
    record = null;
    const back = plusDays(attritionAt, int(45, 150));
    if (chance(0.12) && notFuture(back)) {
      const next = pickEmployer(sectorName, t.district);
      const w = roundWage(wage * uniform(0.95, 1.1));
      pushEvent(t, 'PLACED', back, 'BOT', { employerId: next.id, employerName: next.name, designation: designations[0], wage: w, reEmployed: true });
      addRecord(t, next, designations[0], w, back, 'auto');
    }
  }
}

function simulateSelfEmployed(t: TraineeCtx, at: Date, sectorName: string) {
  const businessType = sectorName === 'Beauty & Wellness' ? 'shop' : weighted(['shop', 'freelance', 'gig'], [45, 35, 20]);
  let income = roundWage(uniform(6500, 13000));
  const payload: Record<string, unknown> = { businessType, income };
  if (chance(0.45)) payload.udyam = `UDYAM-MH-${String(int(1, 36)).padStart(2, '0')}-${String(int(1, 9999999)).padStart(7, '0')}`;
  pushEvent(t, 'SELF_EMPLOYED', at, weighted<Source>(['BOT', 'TRAINER_REPORT', 'AGENT_CALL'], [60, 25, 15]), payload);
  const closeMonths = chance(0.32) ? uniform(2, 14) : null;
  for (const m of [6, 12, 24]) {
    const d = plusDays(at, Math.round(m * MONTH));
    if (!notFuture(d) || (closeMonths !== null && m > closeMonths)) break;
    if (chance(0.6)) {
      const previous = income;
      income = roundWage(income * uniform(1.08, 1.4));
      pushEvent(t, 'WAGE_CHANGE', d, 'BOT', { income, previous, selfEmployed: true });
    }
  }
  if (closeMonths !== null) {
    const d = plusDays(at, Math.round(closeMonths * MONTH));
    if (notFuture(d)) pushEvent(t, 'ATTRITION', d, 'BOT', { businessClosed: true }, weighted(['LOW_WAGE', 'FAMILY', 'RELOCATION', 'HEALTH'], [55, 25, 12, 8]));
  }
}

// ---------------------------------------------------------------- follow-ups
function statusSummary(t: TraineeCtx, at: Date) {
  const state = foldOutcomes(t.events, at);
  return { status: state.status, wage: state.wage, employer: state.employerName };
}

function scheduleFollowUps(t: TraineeCtx, opts: { escalateRecent?: boolean; forceMilestone?: { milestone: string; status: string } } = {}) {
  if (!t.consentEmployment) return;
  let scheduledNext = false;
  for (const milestone of ['MONTH_3', 'MONTH_6', 'MONTH_12', 'MONTH_24']) {
    const due = plusDays(t.batchEnd, MILESTONE_DAYS[milestone]);
    const age = (TODAY.getTime() - due.getTime()) / DAY;
    if (age < -0.5) {
      if (!scheduledNext) {
        rows.followUps.push({ id: newId('fup'), traineeId: t.id, milestone, channel: 'WHATSAPP', status: 'SCHEDULED', attempts: 0, responses: {}, dueAt: due, sentAt: null, respondedAt: null, createdAt: t.batchEnd });
        scheduledNext = true;
      }
      continue;
    }
    const id = newId('fup');
    const sentAt = withHour(due);
    const snapshot = statusSummary(t, due);
    const escalateP = age < 21 ? 0.1 : 0.13;
    const escalated = opts.escalateRecent === false ? false : chance(escalateP);
    if (age < 2) {
      rows.followUps.push({ id, traineeId: t.id, milestone, channel: 'WHATSAPP', status: 'SENT', attempts: 1, responses: {}, dueAt: due, sentAt, respondedAt: null, createdAt: sentAt });
      continue;
    }
    if (escalated) {
      const resolved = age >= 21;
      rows.followUps.push({ id, traineeId: t.id, milestone, channel: 'WHATSAPP', status: 'ESCALATED', attempts: 2, responses: resolved ? { ...snapshot, via: 'AGENT' } : {}, dueAt: due, sentAt, respondedAt: null, createdAt: sentAt });
      const taskCreated = plusDays(sentAt, 2 + int(0, 1));
      const taskRow: Row = {
        id: newId('tsk'),
        followUpId: id,
        traineeId: t.id,
        assignedTo: null,
        status: resolved ? 'RESOLVED' : 'QUEUED',
        callNotes: resolved ? pick(AGENT_NOTES) : null,
        resolvedOutcome: resolved ? snapshot : Prisma.DbNull,
        createdAt: notFuture(taskCreated) ? taskCreated : TODAY,
        openedAt: resolved ? plusDays(taskCreated, int(0, 2)) : null,
        resolvedAt: resolved ? withHour(plusDays(taskCreated, int(1, 4))) : null,
      };
      rows.agentTasks.push(taskRow);
      continue;
    }
    rows.followUps.push({
      id,
      traineeId: t.id,
      milestone,
      channel: chance(0.9) ? 'WHATSAPP' : 'SMS',
      status: 'RESPONDED',
      attempts: chance(0.8) ? 1 : 2,
      responses: snapshot,
      dueAt: due,
      sentAt,
      respondedAt: new Date(sentAt.getTime() + int(1, 70) * 3_600_000),
      createdAt: sentAt,
    });
  }
}

// ---------------------------------------------------------------- personas
interface PersonaRef {
  key: string;
  ctx: TraineeCtx;
}
const personas: PersonaRef[] = [];
const SAMPLE_QUOTES_FIRST: { skill: string; district: string; courseCode: string; quote: string }[] = [];

function botTranscript(t: TraineeCtx, followUpId: string, start: Date, lines: [dir: 'IN' | 'OUT', body: string, buttons?: { id: string; label: string }[]][]) {
  const sessionId = newId('ses');
  rows.sessions.push({ id: sessionId, traineeId: t.id, followUpId, state: 'DONE', lang: 'mr', context: {}, active: false, createdAt: start, updatedAt: start });
  let ts = start.getTime();
  for (const [direction, body, buttons] of lines) {
    ts += int(20, 140) * 1000;
    rows.messages.push({ id: newId('msg'), sessionId, direction, body, buttons: buttons ?? [], meta: {}, createdAt: new Date(ts), readAt: new Date(ts + 5000) });
  }
}

function buildPersonas() {
  const cohortEnd = daysAgo(178);

  // 1. Ramesh Pawar: Nashik CNC cohort, live Month-6 demo.
  const ramesh = createTrainee({ fullName: 'Ramesh Pawar', gender: 'MALE', district: 'Nashik', providerName: 'Government ITI Nashik', courseCode: 'CSC/Q0110', batchEnd: cohortEnd, socialCategory: 'OBC', dob: new Date(Date.UTC(2002, 2, 14)), unifiedNumber: 100101, certified: true, isPersona: true, consents: { employment: true, wage: true, public: true }, phonePrimary: '9822041187' });
  const chakan = employers.find((e) => e.name === 'Indrayani Auto Stampings Pvt Ltd')!;
  const rPlaced = plusDays(cohortEnd, 21);
  pushEvent(ramesh, 'PLACED', rPlaced, 'TRAINER_REPORT', { employerId: chakan.id, employerName: chakan.name, designation: 'CNC Operator', wage: 15500 });
  addRecord(ramesh, chakan, 'CNC Operator', 15500, rPlaced, 'EMPLOYER_LINK');
  const rM3 = plusDays(cohortEnd, 90);
  const rFollow = newId('fup');
  const rameshQuote = 'सध्या काम चालू आहे, पण प्लांटमध्ये नवीन 5-axis CNC मशीन आल्या आहेत. आम्हाला ITI मध्ये फक्त 2-axis लेथ शिकवला. 5-axis प्रोग्रामिंग शिकलो नाही तर पुढे पगारवाढ मिळणार नाही.';
  rows.followUps.push({ id: rFollow, traineeId: ramesh.id, milestone: 'MONTH_3', channel: 'WHATSAPP', status: 'RESPONDED', attempts: 1, responses: { status: 'EMPLOYED', wage: 15500, employer: chakan.name, skillGapQuote: rameshQuote, skills: extractSkills(rameshQuote) }, dueAt: rM3, sentAt: withHour(rM3), respondedAt: plusDays(rM3, 0.1), createdAt: rM3 });
  rows.followUps.push({ id: newId('fup'), traineeId: ramesh.id, milestone: 'MONTH_6', channel: 'WHATSAPP', status: 'SCHEDULED', attempts: 0, responses: {}, dueAt: plusDays(cohortEnd, 180), sentAt: null, respondedAt: null, createdAt: cohortEnd });
  botTranscript(ramesh, rFollow, plusDays(rM3, 0.05), [
    ['OUT', 'नमस्कार Ramesh! मी कौशल्यसेतू, महाराष्ट्र शासन कौशल्य विकास विभागाचा सहाय्यक. तुमचे "CNC Machine Operator (Turning)" प्रशिक्षण पूर्ण होऊन 3 महिने झाले. सध्या तुम्ही काय करत आहात?', [{ id: 's_job', label: 'नोकरी' }, { id: 's_self', label: 'स्वयंरोजगार' }, { id: 's_appr', label: 'अप्रेंटिसशिप' }, { id: 's_none', label: 'सध्या काम नाही' }]],
    ['IN', 'नोकरी'],
    ['OUT', 'तुमच्या कंपनीचे / आस्थापनेचे नाव काय आहे?'],
    ['IN', 'Indrayani Auto Stampings, Chakan'],
    ['OUT', 'तुमचे पद (designation) काय आहे?'],
    ['IN', 'CNC Operator'],
    ['OUT', 'तुमचा सध्याचा मासिक पगार किती आहे? रक्कम अंकांमध्ये लिहा किंवा पर्याय निवडा.'],
    ['IN', '15500'],
    ['OUT', 'कृपया तपासा:\nIndrayani Auto Stampings Pvt Ltd\nCNC Operator\n₹15,500 प्रति महिना\nही माहिती बरोबर आहे का?', [{ id: 'c_yes', label: 'होय, बरोबर' }, { id: 'c_edit', label: 'बदल करायचा आहे' }]],
    ['IN', 'होय, बरोबर'],
    ['OUT', 'कामावर एखादे कौशल्य कमी पडते असे वाटते का? असल्यास तुमच्या शब्दांत लिहा, नसल्यास "काही नाही" निवडा.', [{ id: 'k_skip', label: 'काही नाही' }]],
    ['IN', rameshQuote],
    ['OUT', 'धन्यवाद! तुमची नोंद झाली आहे. पडताळणीनंतर ती "सत्यापित" म्हणून दिसेल.'],
  ]);
  SAMPLE_QUOTES_FIRST.push({ skill: 'cnc_5axis', district: 'Nashik', courseCode: 'CSC/Q0110', quote: rameshQuote });
  personas.push({ key: 'ramesh', ctx: ramesh });

  // 2. Sneha Patil: self-employed bridal studio, Pune.
  const sEnd = daysAgo(Math.round(16 * MONTH));
  const sneha = createTrainee({ fullName: 'Sneha Patil', gender: 'FEMALE', district: 'Pune', providerName: 'PMKK Hadapsar, Pune', courseCode: 'BWS/Q0301', batchEnd: sEnd, socialCategory: 'OBC', dob: new Date(Date.UTC(2000, 7, 22)), unifiedNumber: 100102, certified: true, isPersona: true, consents: { employment: true, wage: true, public: true } });
  const sStart = plusDays(sEnd, 40);
  pushEvent(sneha, 'SELF_EMPLOYED', sStart, 'BOT', { businessType: 'shop', businessName: 'Sneha Bridal Studio and Boutique, Hadapsar', udyam: 'UDYAM-MH-26-0184532', income: 8500 });
  pushEvent(sneha, 'WAGE_CHANGE', plusDays(sStart, Math.round(6 * MONTH)), 'BOT', { income: 14000, previous: 8500, selfEmployed: true });
  pushEvent(sneha, 'WAGE_CHANGE', plusDays(sStart, Math.round(12 * MONTH)), 'BOT', { income: 21000, previous: 14000, selfEmployed: true });
  scheduleFollowUps(sneha, { escalateRecent: false });
  rows.evidence.push({ id: newId('evd'), traineeId: sneha.id, kind: 'UDYAM_CERTIFICATE', fileName: 'udyam-certificate-sneha-patil.svg', mimeType: 'image/svg+xml', sizeBytes: 0, storage: 'INLINE', path: null, data: udyamCertificateSvg('SNEHA BRIDAL STUDIO AND BOUTIQUE', 'UDYAM-MH-26-0184532', sStart), createdAt: plusDays(sStart, 3) });
  personas.push({ key: 'sneha', ctx: sneha });

  // 3. Pooja Wagh: Sai Vocational fake placement (rejected by employer).
  const pEnd = daysAgo(150);
  const pooja = createTrainee({ fullName: 'Pooja Wagh', gender: 'FEMALE', district: 'Jalgaon', providerName: 'Sai Vocational Institute, Jalgaon', courseCode: 'RAS/Q0104', batchEnd: pEnd, socialCategory: 'SC', unifiedNumber: 100103, certified: true, isPersona: true, consents: { employment: true, wage: true, public: true } });
  const samarth = employers.find((e) => e.name === 'Shree Samarth Industrial Services')!;
  const poStart = daysAgo(118);
  pushEvent(pooja, 'PLACED', poStart, 'TRAINER_REPORT', { employerId: samarth.id, employerName: samarth.name, designation: 'Sales Associate', wage: 11000 });
  const poRec = addRecord(pooja, samarth, 'Sales Associate', 11000, poStart, 'PENDING');
  Object.assign(poRec, { status: 'REJECTED', verificationMethod: 'EMPLOYER_LINK', rejectedAt: withHour(daysAgo(96)), rejectionReason: 'No such employee on our rolls. We supply security staff only and have never hired retail associates from this institute.' });
  pushEvent(pooja, 'UNEMPLOYED', daysAgo(90), 'AGENT_CALL', { stage: 'Agent call after rejected verification', note: 'Trainee says she was asked to sign a placement letter on the last day of training but never joined any company.' }, 'OTHER');
  scheduleFollowUps(pooja, { escalateRecent: false });
  personas.push({ key: 'pooja', ctx: pooja });

  // 4. Sunil Jadhav: non-responder, escalated to the agent queue.
  const suEnd = daysAgo(186);
  const sunil = createTrainee({ fullName: 'Sunil Jadhav', gender: 'MALE', district: 'Chhatrapati Sambhajinagar', providerName: 'Government ITI Chhatrapati Sambhajinagar', courseCode: 'ASC/Q1411', batchEnd: suEnd, socialCategory: 'ST', unifiedNumber: 100104, certified: true, isPersona: true, consents: { employment: true, wage: true, public: true } });
  const suEmp = pickEmployer('Automotive', 'Chhatrapati Sambhajinagar');
  pushEvent(sunil, 'PLACED', plusDays(suEnd, 30), 'TRAINER_REPORT', { employerId: suEmp.id, employerName: suEmp.name, designation: 'Service Technician', wage: 13500 });
  addRecord(sunil, suEmp, 'Service Technician', 13500, plusDays(suEnd, 30), 'PENDING');
  const suM3 = plusDays(suEnd, 90);
  rows.followUps.push({ id: newId('fup'), traineeId: sunil.id, milestone: 'MONTH_3', channel: 'WHATSAPP', status: 'RESPONDED', attempts: 2, responses: { status: 'EMPLOYED', wage: 13500, employer: suEmp.name }, dueAt: suM3, sentAt: withHour(suM3), respondedAt: plusDays(suM3, 2), createdAt: suM3 });
  const suM6 = plusDays(suEnd, 180);
  const suFollow = newId('fup');
  rows.followUps.push({ id: suFollow, traineeId: sunil.id, milestone: 'MONTH_6', channel: 'WHATSAPP', status: 'ESCALATED', attempts: 2, responses: {}, dueAt: suM6, sentAt: withHour(suM6), respondedAt: null, createdAt: suM6 });
  rows.agentTasks.push({ id: newId('tsk'), followUpId: suFollow, traineeId: sunil.id, assignedTo: null, status: 'QUEUED', callNotes: null, resolvedOutcome: Prisma.DbNull, createdAt: withHour(daysAgo(4)), openedAt: null, resolvedAt: null });
  personas.push({ key: 'sunil', ctx: sunil });

  // 5. Priya Deshmukh: Nagpur full-stack, not placed, React.js gap.
  const prEnd = daysAgo(Math.round(8 * MONTH));
  const priya = createTrainee({ fullName: 'Priya Deshmukh', gender: 'FEMALE', district: 'Nagpur', providerName: 'Vidarbha Institute of IT, Nagpur', courseCode: 'SSC/Q0503', batchEnd: prEnd, socialCategory: 'OPEN', unifiedNumber: 100105, certified: true, isPersona: true, consents: { employment: true, wage: true, public: true } });
  const prQuote = 'सगळ्या कंपन्या React.js विचारतात, कोर्समध्ये नव्हते. Git पण विचारलं.';
  pushEvent(priya, 'UNEMPLOYED', plusDays(prEnd, 95), 'BOT', { stage: 'Not placed after training', quote: prQuote, skills: extractSkills(prQuote) }, 'SKILL_MISMATCH');
  scheduleFollowUps(priya, { escalateRecent: false });
  personas.push({ key: 'priya', ctx: priya });

  // 6. Akash More: solar installer, EPFO-verified wage growth.
  const aEnd = daysAgo(Math.round(20 * MONTH));
  const akash = createTrainee({ fullName: 'Akash More', gender: 'MALE', district: 'Pune', providerName: 'Bharati Polytechnic Skills Wing, Pune', courseCode: 'SGJ/Q0101', batchEnd: aEnd, socialCategory: 'OBC', unifiedNumber: 100106, certified: true, isPersona: true, consents: { employment: true, wage: true, public: true } });
  const solar = employers.find((e) => e.name === 'Sahyadri Solar Energy Solutions Pvt Ltd')!;
  const aStart = plusDays(aEnd, 25);
  pushEvent(akash, 'PLACED', aStart, 'BOT', { employerId: solar.id, employerName: solar.name, designation: 'Solar Technician', wage: 14500 });
  const aRec = addRecord(akash, solar, 'Solar Technician', 14500, aStart, 'EPFO_SIM');
  pushEvent(akash, 'WAGE_CHANGE', plusDays(aStart, Math.round(6 * MONTH)), 'EPFO_SIM', { wage: 16000, previous: 14500 });
  pushEvent(akash, 'WAGE_CHANGE', plusDays(aStart, Math.round(12 * MONTH)), 'EPFO_SIM', { wage: 18500, previous: 16000 });
  aRec.monthlyWage = 18500;
  scheduleFollowUps(akash, { escalateRecent: false });
  personas.push({ key: 'akash', ctx: akash });

  // 7. Kavita Shinde: retail, attrition due to relocation after marriage.
  const kEnd = daysAgo(Math.round(14 * MONTH));
  const kavita = createTrainee({ fullName: 'Kavita Shinde', gender: 'FEMALE', district: 'Jalna', providerName: 'PMKK Jalna', courseCode: 'RAS/Q0104', batchEnd: kEnd, socialCategory: 'OBC', unifiedNumber: 100107, certified: true, isPersona: true, consents: { employment: true, wage: true, public: true } });
  const ajanta = employers.find((e) => e.name === 'Ajanta Super Bazaar')!;
  const kStart = plusDays(kEnd, 18);
  pushEvent(kavita, 'PLACED', kStart, 'TRAINER_REPORT', { employerId: ajanta.id, employerName: ajanta.name, designation: 'Sales Associate', wage: 10500 });
  const kRec = addRecord(kavita, ajanta, 'Sales Associate', 10500, kStart, 'EMPLOYER_LINK');
  const kLeft = plusDays(kStart, Math.round(7 * MONTH));
  pushEvent(kavita, 'ATTRITION', kLeft, 'BOT', { employerName: ajanta.name, note: 'Moved to Pune after marriage; looking for retail work in Hadapsar.' }, 'RELOCATION');
  closeRecord(kRec, kLeft);
  scheduleFollowUps(kavita, { escalateRecent: false });
  personas.push({ key: 'kavita', ctx: kavita });

  // 8. Imran Shaikh: automotive, job switch with a wage jump.
  const iEnd = daysAgo(Math.round(22 * MONTH));
  const imran = createTrainee({ fullName: 'Imran Shaikh', gender: 'MALE', district: 'Mumbai Suburban', providerName: 'Government ITI Borivali', courseCode: 'ASC/Q1411', batchEnd: iEnd, socialCategory: 'OBC', unifiedNumber: 100108, certified: true, isPersona: true, consents: { employment: true, wage: true, public: true } });
  const meghdoot = employers.find((e) => e.name === 'Meghdoot Motors Pvt Ltd')!;
  const konkanAuto = employers.find((e) => e.name === 'Konkan Automobiles Pvt Ltd')!;
  const iStart = plusDays(iEnd, 20);
  pushEvent(imran, 'PLACED', iStart, 'BOT', { employerId: meghdoot.id, employerName: meghdoot.name, designation: 'Service Technician', wage: 13500 });
  const iRec = addRecord(imran, meghdoot, 'Service Technician', 13500, iStart, 'EMPLOYER_LINK');
  const iSwitch = plusDays(iStart, Math.round(10 * MONTH));
  pushEvent(imran, 'JOB_SWITCH', iSwitch, 'EPFO_SIM', { employerId: konkanAuto.id, employerName: konkanAuto.name, designation: 'Senior Technician', wage: 19500, previousEmployer: meghdoot.name });
  closeRecord(iRec, iSwitch);
  const iRec2 = addRecord(imran, konkanAuto, 'Senior Technician', 19500, iSwitch, 'EPFO_SIM');
  pushEvent(imran, 'WAGE_CHANGE', plusDays(iStart, Math.round(18 * MONTH)), 'EPFO_SIM', { wage: 21500, previous: 19500 });
  iRec2.monthlyWage = 21500;
  scheduleFollowUps(imran, { escalateRecent: false });
  personas.push({ key: 'imran', ctx: imran });

  // 9. Swati Kamble: apprenticeship converted to a job.
  const swEnd = daysAgo(Math.round(13 * MONTH));
  const swati = createTrainee({ fullName: 'Swati Kamble', gender: 'FEMALE', district: 'Latur', providerName: 'Rajarshi Shahu Skill Centre, Latur', courseCode: 'BSC/Q8101', batchEnd: swEnd, socialCategory: 'SC', unifiedNumber: 100109, certified: true, isPersona: true, consents: { employment: true, wage: true, public: true } });
  const purna = employers.find((e) => e.name === 'Purna Tax Consultants')!;
  const swStart = plusDays(swEnd, 20);
  pushEvent(swati, 'APPRENTICE', swStart, 'TRAINER_REPORT', { establishment: purna.name, employerId: purna.id, stipend: 9000 });
  const swJob = plusDays(swStart, 365);
  pushEvent(swati, 'PLACED', swJob, 'BOT', { employerId: purna.id, employerName: purna.name, designation: 'Accounts Assistant', wage: 14000, afterApprenticeship: true });
  addRecord(swati, purna, 'Accounts Assistant', 14000, swJob, 'PENDING');
  scheduleFollowUps(swati, { escalateRecent: false });
  personas.push({ key: 'swati', ctx: swati });

  // 10. Vijay Gaikwad: electrician running a repair shop in Gadchiroli.
  const vEnd = daysAgo(Math.round(11 * MONTH));
  const vijay = createTrainee({ fullName: 'Vijay Gaikwad', gender: 'MALE', district: 'Gadchiroli', providerName: 'Government ITI Gadchiroli', courseCode: 'PSS/Q0101', batchEnd: vEnd, socialCategory: 'ST', unifiedNumber: 100110, certified: true, isPersona: true, consents: { employment: true, wage: true, public: true } });
  pushEvent(vijay, 'SELF_EMPLOYED', plusDays(vEnd, 60), 'AGENT_CALL', { businessType: 'shop', businessName: 'Vijay Electricals and Repairs, Aheri', income: 9000 });
  pushEvent(vijay, 'WAGE_CHANGE', plusDays(vEnd, 60 + Math.round(6 * MONTH)), 'BOT', { income: 11500, previous: 9000, selfEmployed: true });
  scheduleFollowUps(vijay, { escalateRecent: false });
  personas.push({ key: 'vijay', ctx: vijay });

  // 11. Rohini Bhosale: withdrew wage and public-aggregate consent through the portal.
  const roEnd = daysAgo(Math.round(10 * MONTH));
  const rohini = createTrainee({ fullName: 'Rohini Bhosale', gender: 'FEMALE', district: 'Thane', providerName: 'Konkan Hospitality Institute, Thane', courseCode: 'THC/Q0301', batchEnd: roEnd, socialCategory: 'OPEN', unifiedNumber: 100111, certified: true, isPersona: true, consents: { employment: true, wage: true, public: true } });
  const varad = employers.find((e) => e.name === 'Varad Residency')!;
  pushEvent(rohini, 'PLACED', plusDays(roEnd, 15), 'BOT', { employerId: varad.id, employerName: varad.name, designation: 'F&B Steward', wage: 12500 });
  addRecord(rohini, varad, 'F&B Steward', 12500, plusDays(roEnd, 15), 'EMPLOYER_LINK');
  rows.consents.push(
    { id: newId('con'), traineeId: rohini.id, granted: false, scope: 'wageTracking', capturedAt: withHour(daysAgo(62)), channel: 'PORTAL', sourceIp: '49.36.112.18' },
    { id: newId('con'), traineeId: rohini.id, granted: false, scope: 'publicAggregates', capturedAt: withHour(daysAgo(62)), channel: 'PORTAL', sourceIp: '49.36.112.18' },
  );
  scheduleFollowUps(rohini, { escalateRecent: false });
  personas.push({ key: 'rohini', ctx: rohini });

  // 12. Mahesh Kale: welder with an implausible reported wage.
  const mEnd = daysAgo(Math.round(4 * MONTH));
  const mahesh = createTrainee({ fullName: 'Mahesh Kale', gender: 'MALE', district: 'Kolhapur', providerName: 'Panchganga Skills Institute, Ichalkaranji', courseCode: 'CSC/Q0204', batchEnd: mEnd, socialCategory: 'OBC', unifiedNumber: 100112, certified: true, isPersona: true, consents: { employment: true, wage: true, public: true } });
  const krishna = employers.find((e) => e.name === 'Krishna Fabricators')!;
  pushEvent(mahesh, 'PLACED', plusDays(mEnd, 12), 'TRAINER_REPORT', { employerId: krishna.id, employerName: krishna.name, designation: 'Welder', wage: 61000 });
  addRecord(mahesh, krishna, 'Welder', 61000, plusDays(mEnd, 12), 'PENDING');
  scheduleFollowUps(mahesh, { escalateRecent: false });
  personas.push({ key: 'mahesh', ctx: mahesh });

  return cohortEnd;
}

function udyamCertificateSvg(name: string, number: string, date: Date): string {
  const d = date.toISOString().slice(0, 10);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#ffffff" stroke="#0F766E" stroke-width="6"/><text x="300" y="60" font-family="sans-serif" font-size="22" text-anchor="middle" fill="#0F172A">UDYAM REGISTRATION CERTIFICATE</text><text x="300" y="90" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#6B7280">Ministry of Micro, Small and Medium Enterprises (specimen for demo)</text><text x="60" y="160" font-family="monospace" font-size="16" fill="#111827">Registration No: ${number}</text><text x="60" y="200" font-family="sans-serif" font-size="16" fill="#111827">Enterprise: ${name}</text><text x="60" y="240" font-family="sans-serif" font-size="16" fill="#111827">Type: Micro, Services</text><text x="60" y="280" font-family="sans-serif" font-size="16" fill="#111827">Date of registration: ${d}</text><text x="60" y="320" font-family="sans-serif" font-size="16" fill="#111827">District: Pune, Maharashtra</text></svg>`;
  return Buffer.from(svg).toString('base64');
}

// ---------------------------------------------------------------- Sai Vocational fake-placement cluster
function buildSaiCluster() {
  const samarth = employers.find((e) => e.name === 'Shree Samarth Industrial Services')!;
  const mauli = employers.find((e) => e.name === 'Mauli Manpower Solutions')!;
  const omkar = employers.find((e) => e.name === 'Omkar Facility Services')!;
  const sai = PROVIDERS.find((p) => p.name.startsWith('Sai Vocational'))!;
  let samarthCount = 0;
  let rejected = 0;
  for (let i = 0; i < 70; i++) {
    const district = chance(0.8) ? 'Jalgaon' : pick(['Dhule', 'Nandurbar', 'Buldhana']);
    const courseCode = pick(sai.courses);
    const batchEnd = samarthCount < 19 && i < 30 ? daysAgo(int(128, 140)) : daysAgo(int(70, 320));
    const t = createTrainee({ district, providerName: sai.name, courseCode, batchEnd });
    scheduleFollowUpsLater.push(t);
    if (!chance(0.9)) {
      const at = plusDays(batchEnd, 95);
      if (notFuture(at)) pushEvent(t, 'UNEMPLOYED', at, 'TRAINER_REPORT', { stage: 'Not placed after training' }, 'FAMILY');
      continue;
    }
    let employer: EmployerRow;
    let start: Date;
    if (samarthCount < 19 && i < 30) {
      employer = samarth;
      start = daysAgo(int(96, 120));
      samarthCount++;
    } else {
      employer = chance(0.3) ? mauli : chance(0.2) ? omkar : pickEmployer(COURSE_BY_CODE[courseCode].sector, 'Jalgaon');
      start = plusDays(batchEnd, int(8, 30));
    }
    if (!notFuture(start)) continue;
    const wage = startingWage(COURSE_BY_CODE[courseCode].sector, 'Jalgaon');
    const designation = DESIGNATIONS_BY_COURSE[courseCode][0];
    pushEvent(t, 'PLACED', start, 'TRAINER_REPORT', { employerId: employer.id, employerName: employer.name, designation, wage });
    const mode: Verification = rejected < 5 && employer.id === samarth.id && chance(0.5) ? 'REJECTED' : chance(0.16) ? 'EMPLOYER_LINK' : 'PENDING';
    if (mode === 'REJECTED') rejected++;
    addRecord(t, employer, designation, wage, start, mode, mode === 'REJECTED' ? 'No such employee on our rolls.' : undefined);
  }
}
const scheduleFollowUpsLater: TraineeCtx[] = [];

// ---------------------------------------------------------------- main
async function wipe() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "BotMessage","BotSession","VerificationToken","EvidenceFile","IntegrityAlert","AgentTask","FollowUp","OutcomeEvent","EmploymentRecord","Enrollment","ConsentRecord","AuditLog","SkillGapSignal","OtpChallenge","User","Trainee","Employer","Course","Provider" CASCADE`);
}

async function insert<T>(label: string, data: Row[], fn: (chunk: Row[]) => Promise<T>) {
  for (let i = 0; i < data.length; i += 1000) await fn(data.slice(i, i + 1000));
  console.info(`  ${label.padEnd(20)} ${data.length}`);
}

async function main() {
  const started = Date.now();
  console.info('KaushalSetu seed (seed=sih26135)');
  await wipe();

  for (const c of Object.values(COURSE_BY_CODE)) courseIds.set(c.code, newId('crs'));
  for (const p of PROVIDERS) {
    const id = newId('prv');
    providerIds.set(p.name, id);
    providerSeedById.set(id, p);
  }

  // Named employers used by personas and the fraud cluster, then the generated pool.
  addEmployer('Indrayani Auto Stampings Pvt Ltd', 'Capital Goods & Manufacturing', 'Pune', { size: 1450 });
  addEmployer('Sahyadri Solar Energy Solutions Pvt Ltd', 'Electrical & Green Energy', 'Pune', { size: 210 });
  addEmployer('Ajanta Super Bazaar', 'Retail', 'Chhatrapati Sambhajinagar', { size: 85 });
  addEmployer('Meghdoot Motors Pvt Ltd', 'Automotive', 'Mumbai Suburban', { size: 160 });
  addEmployer('Konkan Automobiles Pvt Ltd', 'Automotive', 'Thane', { size: 340 });
  addEmployer('Purna Tax Consultants', 'BFSI', 'Latur', { size: 18 });
  addEmployer('Varad Residency', 'Tourism & Hospitality', 'Thane', { size: 120 });
  addEmployer('Krishna Fabricators', 'Capital Goods & Manufacturing', 'Kolhapur', { size: 45 });
  addEmployer('Godavari Precision Components Pvt Ltd', 'Capital Goods & Manufacturing', 'Nashik', { size: 620 });
  addEmployer('Satpur Engineering Works', 'Capital Goods & Manufacturing', 'Nashik', { size: 140 });
  addEmployer('Shree Samarth Industrial Services', 'Capital Goods & Manufacturing', 'Jalgaon', { valid: false, size: 22 });
  addEmployer('Mauli Manpower Solutions', 'Retail', 'Jalgaon', { valid: false, cancelled: true, size: 15 });
  addEmployer('Omkar Facility Services', 'Retail', 'Dhule', { valid: false, size: 30 });
  addEmployer('Jay Malhar Traders', 'Capital Goods & Manufacturing', 'Nashik', { valid: false, cancelled: true, size: 9 });
  generateEmployers();

  const cohortEnd = buildPersonas();
  buildSaiCluster();

  // Nashik CNC demo cohort (same batch as Ramesh): Month-6 follow-up due in two days.
  const demoCohort: TraineeCtx[] = [];
  for (let i = 0; i < 21; i++) {
    const t = createTrainee({ district: 'Nashik', gender: chance(0.9) ? 'MALE' : 'FEMALE', providerName: 'Government ITI Nashik', courseCode: 'CSC/Q0110', batchEnd: cohortEnd });
    simulateGeneric(t);
    demoCohort.push(t);
  }

  // General population.
  const districtNames = DISTRICTS.map((d) => d.name);
  const districtWeights = DISTRICTS.map((d) => d.weight);
  const generalProviders = PROVIDERS.filter((p) => !p.name.startsWith('Sai Vocational'));
  const target = 3200;
  const general: TraineeCtx[] = [];
  const current = () => rows.trainees.length;
  while (current() < target) {
    const district = weighted(districtNames, districtWeights);
    const division = DISTRICT_BY_NAME[district].division;
    let candidates = generalProviders.filter((p) => p.district === district);
    if (!candidates.length || chance(0.12)) candidates = generalProviders.filter((p) => DISTRICT_BY_NAME[p.district].division === division);
    const provider = pick(candidates);
    const gender = chance(0.44) ? 'FEMALE' : chance(0.985) ? 'MALE' : 'OTHER';
    const courseWeights = provider.courses.map((code) => {
      const sector = COURSE_BY_CODE[code].sector;
      if (gender === 'FEMALE') return ({ 'Beauty & Wellness': 3, Retail: 1.6, BFSI: 1.6, 'IT-ITeS': 1.3, 'Tourism & Hospitality': 1.1, 'Electrical & Green Energy': 0.35, 'Capital Goods & Manufacturing': 0.25, Automotive: 0.2 } as Record<string, number>)[sector] ?? 1;
      if (provider.district === 'Nashik' && (code === 'CSC/Q0110' || code === 'CSC/Q0415')) return 3;
      return sector === 'Beauty & Wellness' ? 0.12 : 1;
    });
    const courseCode = weighted(provider.courses, courseWeights);
    const batchEnd = daysAgo(int(12, 905));
    const t = createTrainee({ district, gender, providerName: provider.name, courseCode, batchEnd });
    simulateGeneric(t);
    general.push(t);
  }

  // Planted wage outliers besides Mahesh.
  let planted = 0;
  for (const rec of rows.records) {
    if (planted >= 3) break;
    const t = general.find((g) => g.id === rec.traineeId);
    if (!t || rec.status !== 'PENDING_VERIFICATION' || rec.endDate) continue;
    const sector = SECTOR_BY_NAME[COURSE_BY_CODE[t.courseCode].sector];
    if (!['IT-ITeS', 'Retail', 'Automotive'].includes(sector.name)) continue;
    rec.monthlyWage = roundWage(sector.wageMedian * uniform(2.3, 2.9));
    planted++;
  }

  for (const t of [...demoCohort, ...general, ...scheduleFollowUpsLater]) {
    t.events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    scheduleFollowUps(t);
  }
  // Demo cohort: Month-6 stays SCHEDULED for the live trigger; Month-3 answered by most.
  for (const f of rows.followUps) {
    const t = demoCohort.find((d) => d.id === f.traineeId);
    if (!t) continue;
    if (f.milestone === 'MONTH_6') Object.assign(f, { status: 'SCHEDULED', attempts: 0, sentAt: null, respondedAt: null, responses: {} });
  }
  // Late consent withdrawals (about 2%) recorded through the portal.
  for (const t of general) {
    if (chance(0.02)) rows.consents.push({ id: newId('con'), traineeId: t.id, granted: false, scope: 'wageTracking', capturedAt: withHour(daysAgo(int(5, 200))), channel: 'PORTAL', sourceIp: `106.${int(192, 223)}.${int(0, 255)}.${int(1, 254)}` });
  }

  // ---- write
  await insert('providers', PROVIDERS.map((p) => ({ id: providerIds.get(p.name), name: p.name, type: p.type, district: p.district, contact: `principal.${p.district.toLowerCase().replace(/[^a-z]/g, '')}@skills-mh.example.in` })), (c) => prisma.provider.createMany({ data: c as Prisma.ProviderCreateManyInput[] }));
  await insert('courses', Object.values(COURSE_BY_CODE).map((c) => ({ id: courseIds.get(c.code), code: c.code, name: c.name, nsqfLevel: c.nsqfLevel, sector: c.sector, durationHours: c.durationHours, skills: c.skills })), (c) => prisma.course.createMany({ data: c as Prisma.CourseCreateManyInput[] }));
  await insert('employers', employers as unknown as Row[], (c) => prisma.employer.createMany({ data: c as Prisma.EmployerCreateManyInput[] }));
  await insert('trainees', rows.trainees, (c) => prisma.trainee.createMany({ data: c as Prisma.TraineeCreateManyInput[] }));
  await insert('consent records', rows.consents, (c) => prisma.consentRecord.createMany({ data: c as Prisma.ConsentRecordCreateManyInput[] }));
  await insert('enrollments', rows.enrollments, (c) => prisma.enrollment.createMany({ data: c as Prisma.EnrollmentCreateManyInput[] }));
  await insert('employment records', rows.records, (c) => prisma.employmentRecord.createMany({ data: c as Prisma.EmploymentRecordCreateManyInput[] }));
  await insert('outcome events', rows.events, (c) => prisma.outcomeEvent.createMany({ data: c as Prisma.OutcomeEventCreateManyInput[] }));
  await insert('follow-ups', rows.followUps, (c) => prisma.followUp.createMany({ data: c as Prisma.FollowUpCreateManyInput[] }));

  const passwordHash = await bcrypt.hash('demo@2025', 10);
  const users = [
    { id: newId('usr'), role: 'GOVT', name: 'Vikas Deshpande', title: 'Secretary, Skill Development and Entrepreneurship', email: 'secretary@skills.mh.example.in', passwordHash, providerId: null },
    { id: newId('usr'), role: 'PROVIDER', name: 'Meena Joshi', title: 'Principal, Government ITI Nashik', email: 'principal.iti.nashik@skills.mh.example.in', passwordHash, providerId: providerIds.get('Government ITI Nashik') },
    { id: newId('usr'), role: 'AGENT', name: 'Rahul Sonawane', title: 'Field Agent, Nashik Division', email: 'agent.nashik@skills.mh.example.in', passwordHash, providerId: null },
    { id: newId('usr'), role: 'AGENT', name: 'Shabana Pathan', title: 'Field Agent, Chhatrapati Sambhajinagar Division', email: 'agent.csn@skills.mh.example.in', passwordHash, providerId: null },
  ];
  await insert('users', users, (c) => prisma.user.createMany({ data: c as Prisma.UserCreateManyInput[] }));
  const secondAgent = users[3].id;
  for (const task of rows.agentTasks) if (task.status === 'RESOLVED') task.assignedTo = chance(0.5) ? users[2].id : secondAgent;
  await insert('agent tasks', rows.agentTasks, (c) => prisma.agentTask.createMany({ data: c as Prisma.AgentTaskCreateManyInput[] }));
  await insert('bot sessions', rows.sessions, (c) => prisma.botSession.createMany({ data: c as Prisma.BotSessionCreateManyInput[] }));
  await insert('bot messages', rows.messages, (c) => prisma.botMessage.createMany({ data: c as Prisma.BotMessageCreateManyInput[] }));
  for (const e of rows.evidence) e.sizeBytes = Math.round(((e.data as string).length * 3) / 4);
  await insert('evidence files', rows.evidence, (c) => prisma.evidenceFile.createMany({ data: c as Prisma.EvidenceFileCreateManyInput[] }));

  // Skill-gap signals aggregated from quotes in outcome events and follow-up replies.
  const traineeInfo = new Map<string, { district: string; courseCode: string }>();
  for (const t of rows.trainees) traineeInfo.set(t.id as string, { district: t.district as string, courseCode: '' });
  for (const e of rows.enrollments) {
    const info = traineeInfo.get(e.traineeId as string);
    if (info) info.courseCode = [...courseIds.entries()].find(([, id]) => id === e.courseId)?.[0] ?? '';
  }
  const signals = new Map<string, { skill: string; district: string; courseCode: string; count: number; quotes: string[] }>();
  const addSignal = (skill: string, district: string, courseCode: string, quote: string, front = false) => {
    const key = `${skill}|${district}|${courseCode}`;
    const s = signals.get(key) ?? { skill, district, courseCode, count: 0, quotes: [] };
    s.count++;
    if (front) s.quotes.unshift(quote);
    else if (s.quotes.length < 6 && !s.quotes.includes(quote)) s.quotes.push(quote);
    signals.set(key, s);
  };
  for (const ev of rows.events) {
    const payload = ev.payload as { quote?: string; skills?: string[] };
    if (!payload.quote || !payload.skills) continue;
    const info = traineeInfo.get(ev.traineeId as string);
    if (!info) continue;
    for (const skill of payload.skills) addSignal(skill, info.district, info.courseCode, payload.quote);
  }
  for (const q of SAMPLE_QUOTES_FIRST) for (const skill of extractSkills(q.quote)) addSignal(skill, q.district, q.courseCode, q.quote, skill === q.skill);
  await insert(
    'skill-gap signals',
    [...signals.values()].map((s) => ({ id: newId('sgs'), extractedSkill: s.skill, district: s.district, courseId: courseIds.get(s.courseCode), severity: s.count, sampleQuotes: s.quotes.slice(0, 6) })),
    (c) => prisma.skillGapSignal.createMany({ data: c as Prisma.SkillGapSignalCreateManyInput[] }),
  );

  const sweep = await runFraudSweep(TODAY);
  console.info(`  integrity alerts     ${sweep.open} (${Object.entries(sweep.byRule).map(([k, v]) => `${k}=${v}`).join(', ')})`);

  // Calibration report.
  const all = [...general, ...demoCohort];
  const completed = all.filter((t) => t.batchEnd.getTime() <= TODAY.getTime() - 90 * DAY);
  const placed90 = completed.filter((t) => {
    const s = foldOutcomes(t.events, plusDays(t.batchEnd, 90));
    return s.firstPlacedAt !== null;
  });
  const retention = (m: number) => {
    const base = all.filter((t) => {
      const s = foldOutcomes(t.events, TODAY);
      return s.firstPlacedAt && s.firstPlacedAt.getTime() + m * MONTH * DAY <= TODAY.getTime();
    });
    const kept = base.filter((t) => {
      const first = foldOutcomes(t.events, TODAY).firstPlacedAt!;
      return isWorking(foldOutcomes(t.events, plusDays(first, m * MONTH)).status);
    });
    return `${Math.round((kept.length / base.length) * 100)}%`;
  };
  console.info(`  calibration: placement(90d) ${Math.round((placed90.length / completed.length) * 100)}%, retention 3m ${retention(3)}, 6m ${retention(6)}, 12m ${retention(12)}`);
  console.info(`  sectors: ${SECTORS.length}, done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

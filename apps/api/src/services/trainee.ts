import { BRIDGE_COURSES, COURSE_BY_CODE, SKILL_BY_KEY, extractSkills, foldOutcomes } from '@kaushalsetu/shared';
import { prisma } from '../db';
import { HttpError } from '../lib/http';
import { glossToEnglish } from '../adapters/bhashini';

export interface TimelineItem {
  at: string;
  kind: string;
  title: string;
  detail: string;
  source: string;
}

// Full trainee profile with a merged timeline. Callers decide whether and how to mask it, and
// must write the AuditLog entry before returning it to staff.
export async function traineeDetail(id: string) {
  const t = await prisma.trainee.findUnique({
    where: { id },
    include: {
      enrollments: { include: { course: true, provider: true }, orderBy: { batchEnd: 'desc' } },
      outcomeEvents: { orderBy: { occurredAt: 'asc' } },
      employmentRecords: { include: { employer: true }, orderBy: { startDate: 'asc' } },
      followUps: { orderBy: { dueAt: 'asc' } },
      consents: { orderBy: { capturedAt: 'asc' } },
      evidence: { select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true, storage: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!t) throw new HttpError(404, 'Trainee not found');
  const enr = t.enrollments[0];
  const timeline: TimelineItem[] = [];
  for (const e of t.enrollments) {
    timeline.push({ at: e.batchStart.toISOString(), kind: 'TRAINING_START', title: `Started ${e.course.name}`, detail: `${e.provider.name} · NSQF level ${e.course.nsqfLevel}`, source: 'ENROLMENT' });
    timeline.push({
      at: e.batchEnd.toISOString(),
      kind: 'TRAINING_END',
      title: e.certified ? 'Completed training and certified' : 'Completed training, not certified',
      detail: `Attendance ${e.attendancePct}% · Assessment ${e.assessmentScore}%`,
      source: 'ENROLMENT',
    });
  }
  const labels: Record<string, string> = {
    PLACED: 'Placed in a job',
    SELF_EMPLOYED: 'Started self-employment',
    APPRENTICE: 'Started apprenticeship',
    UNEMPLOYED: 'Reported not working',
    JOB_SWITCH: 'Switched job',
    WAGE_CHANGE: 'Income changed',
    DROPPED_OUT: 'Dropped out of training',
    ATTRITION: 'Left work',
  };
  for (const e of t.outcomeEvents) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    const bits: string[] = [];
    if (typeof p.employerName === 'string') bits.push(p.employerName);
    if (typeof p.businessName === 'string') bits.push(p.businessName);
    if (typeof p.establishment === 'string') bits.push(p.establishment);
    if (typeof p.designation === 'string') bits.push(p.designation);
    const amount = (p.wage ?? p.income ?? p.stipend) as number | undefined;
    if (typeof amount === 'number') bits.push(`₹${amount.toLocaleString('en-IN')} per month`);
    if (typeof p.previous === 'number') bits.push(`from ₹${p.previous.toLocaleString('en-IN')}`);
    if (e.attritionReason) bits.push(`Reason: ${e.attritionReason.replace(/_/g, ' ').toLowerCase()}`);
    if (typeof p.quote === 'string') bits.push(`"${p.quote}"`);
    if (typeof p.note === 'string') bits.push(p.note);
    timeline.push({ at: e.occurredAt.toISOString(), kind: e.eventType, title: labels[e.eventType] ?? e.eventType, detail: bits.join(' · '), source: e.source });
  }
  for (const r of t.employmentRecords) {
    if (r.verifiedAt) timeline.push({ at: r.verifiedAt.toISOString(), kind: 'VERIFIED', title: `Employment verified (${r.verificationMethod === 'EPFO_SIM' ? 'EPFO signal' : r.verificationMethod === 'AGENT' ? 'agent call' : 'employer link'})`, detail: `${r.employer.name} · ₹${r.monthlyWage.toLocaleString('en-IN')}`, source: r.verificationMethod ?? '' });
    if (r.rejectedAt) timeline.push({ at: r.rejectedAt.toISOString(), kind: 'REJECTED', title: 'Employer rejected the claimed placement', detail: `${r.employer.name}${r.rejectionReason ? ` · ${r.rejectionReason}` : ''}`, source: 'EMPLOYER_LINK' });
  }
  for (const f of t.followUps) {
    if (f.status === 'SCHEDULED') continue;
    const r = (f.responses ?? {}) as Record<string, unknown>;
    if (typeof r.skillGapQuote === 'string') timeline.push({ at: (f.respondedAt ?? f.dueAt).toISOString(), kind: 'SKILL_GAP', title: 'Reported a skill gap at work', detail: `"${r.skillGapQuote}"`, source: 'BOT' });
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at));

  const state = foldOutcomes(t.outcomeEvents, new Date());
  const latestConsent = (scope: string) => [...t.consents].reverse().find((c) => c.scope === scope)?.granted ?? false;

  const quotes: string[] = [];
  for (const e of t.outcomeEvents) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    if (typeof p.quote === 'string') quotes.push(p.quote);
  }
  for (const f of t.followUps) {
    const r = (f.responses ?? {}) as Record<string, unknown>;
    if (typeof r.skillGapQuote === 'string') quotes.push(r.skillGapQuote);
  }
  const reportedSkills = [...new Set(quotes.flatMap((q) => extractSkills(q)))];
  const courseGaps = enr ? COURSE_BY_CODE[enr.course.code]?.gapSkills ?? [] : [];
  const recommended = [...reportedSkills, ...courseGaps.filter((k) => !reportedSkills.includes(k))]
    .map((key) => {
      const b = BRIDGE_COURSES.find((x) => x.skillKey === key);
      return b ? { ...b, skill: SKILL_BY_KEY[key]?.label ?? key, reportedByYou: reportedSkills.includes(key) } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 4);

  const glosses: Record<string, string> = {};
  for (const q of quotes) {
    const g = await glossToEnglish(q);
    if (g) glosses[q] = g;
  }

  return {
    id: t.id,
    unifiedId: t.unifiedId,
    fullName: t.fullName,
    dob: t.dob,
    gender: t.gender,
    socialCategory: t.socialCategory,
    district: t.district,
    phonePrimary: t.phonePrimary,
    phoneAlternate: t.phoneAlternate,
    whatsappNumber: t.whatsappNumber,
    email: t.email,
    preferredLang: t.preferredLang,
    upskillOptIn: t.upskillOptIn,
    course: enr ? { code: enr.course.code, name: enr.course.name, sector: enr.course.sector, nsqfLevel: enr.course.nsqfLevel } : null,
    provider: enr ? { id: enr.provider.id, name: enr.provider.name, district: enr.provider.district } : null,
    batchStart: enr?.batchStart ?? null,
    batchEnd: enr?.batchEnd ?? null,
    currentStatus: state.status,
    currentWage: state.wage,
    currentEmployer: state.employerName,
    timeline,
    followUps: t.followUps.map((f) => ({ id: f.id, milestone: f.milestone, status: f.status, dueAt: f.dueAt, sentAt: f.sentAt, respondedAt: f.respondedAt, attempts: f.attempts })),
    employmentRecords: t.employmentRecords.map((r) => ({ id: r.id, employer: r.employer.name, designation: r.designation, monthlyWage: r.monthlyWage, startDate: r.startDate, endDate: r.endDate, status: r.status, verificationMethod: r.verificationMethod })),
    consents: {
      employmentTracking: latestConsent('employmentTracking'),
      wageTracking: latestConsent('wageTracking'),
      publicAggregates: latestConsent('publicAggregates'),
    },
    consentLedger: [...t.consents].reverse().map((c) => ({ id: c.id, scope: c.scope, granted: c.granted, capturedAt: c.capturedAt, channel: c.channel })),
    evidence: t.evidence,
    recommendations: recommended,
    reportedSkills: reportedSkills.map((k) => SKILL_BY_KEY[k]?.label ?? k),
    glosses,
  };
}

export type TraineeDetail = Awaited<ReturnType<typeof traineeDetail>>;

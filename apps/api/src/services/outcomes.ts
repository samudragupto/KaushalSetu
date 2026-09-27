import { extractSkills, foldOutcomes } from '@kaushalsetu/shared';
import type { OutcomeSource, AttritionReason } from '@prisma/client';
import { prisma } from '../db';
import { webBaseUrl } from '../env';
import { token } from '../lib/rng';
import { bumpVersion } from '../lib/version';

// Write paths shared by the WhatsApp bot and the agent console, so both channels produce the
// same outcome events, employment records and skill-gap signals.

async function currentState(traineeId: string) {
  const events = await prisma.outcomeEvent.findMany({ where: { traineeId }, orderBy: { occurredAt: 'asc' } });
  return foldOutcomes(events, new Date());
}

async function traineeCourse(traineeId: string) {
  const enrollment = await prisma.enrollment.findFirst({ where: { traineeId }, orderBy: { batchEnd: 'desc' }, include: { course: true } });
  return enrollment;
}

function titleCase(s: string) {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

export async function resolveEmployer(name: string, traineeId: string, employerId?: string | null) {
  if (employerId) {
    const e = await prisma.employer.findUnique({ where: { id: employerId } });
    if (e) return e;
  }
  const clean = name.trim();
  const firstWords = clean.split(/[\s,]+/).slice(0, 2).join(' ');
  const match =
    (await prisma.employer.findFirst({ where: { name: { equals: clean, mode: 'insensitive' } } })) ??
    (firstWords.length >= 5 ? await prisma.employer.findFirst({ where: { name: { startsWith: firstWords, mode: 'insensitive' } } }) : null);
  if (match) return match;
  const [trainee, enrollment] = await Promise.all([prisma.trainee.findUnique({ where: { id: traineeId } }), traineeCourse(traineeId)]);
  return prisma.employer.create({
    data: {
      name: titleCase(clean),
      gstin: `UNREG-${token(6)}`,
      gstinValid: false,
      district: trainee?.district ?? 'Pune',
      sector: enrollment?.course.sector ?? 'Retail',
      employeeCount: 0,
    },
  });
}

export async function createVerificationLink(employmentRecordId: string): Promise<string> {
  const t = token(16);
  await prisma.verificationToken.create({
    data: { token: t, employmentRecordId, expiresAt: new Date(Date.now() + 14 * 86_400_000) },
  });
  return `${webBaseUrl}/verify/${t}`;
}

export interface JobInput {
  traineeId: string;
  employerName: string;
  employerId?: string | null;
  designation: string;
  wage: number;
  source: OutcomeSource;
  method?: 'EMPLOYER_LINK' | 'AGENT';
}

export async function commitJob(input: JobInput): Promise<{ recordId: string; verificationUrl: string; eventType: string }> {
  const employer = await resolveEmployer(input.employerName, input.traineeId, input.employerId);
  const state = await currentState(input.traineeId);
  const now = new Date();
  const open = await prisma.employmentRecord.findFirst({ where: { traineeId: input.traineeId, endDate: null, status: { not: 'REJECTED' } }, orderBy: { startDate: 'desc' } });
  let recordId: string;
  let eventType: string;

  if (state.status === 'EMPLOYED' && open && open.employerId === employer.id) {
    eventType = 'WAGE_CHANGE';
    const previous = open.monthlyWage;
    await prisma.outcomeEvent.create({ data: { traineeId: input.traineeId, eventType: 'WAGE_CHANGE', occurredAt: now, source: input.source, payload: { wage: input.wage, previous, designation: input.designation } } });
    const updated = await prisma.employmentRecord.update({
      where: { id: open.id },
      data: {
        monthlyWage: input.wage,
        designation: input.designation,
        status: 'PENDING_VERIFICATION',
        verificationMethod: null,
        verifiedAt: null,
        evidence: { previousWage: previous, wageUpdateReportedAt: now.toISOString(), reportedVia: input.source },
      },
    });
    recordId = updated.id;
  } else {
    eventType = state.status === 'EMPLOYED' ? 'JOB_SWITCH' : 'PLACED';
    if (open) await prisma.employmentRecord.update({ where: { id: open.id }, data: { endDate: now } });
    await prisma.outcomeEvent.create({
      data: {
        traineeId: input.traineeId,
        eventType: eventType as 'PLACED' | 'JOB_SWITCH',
        occurredAt: now,
        source: input.source,
        payload: { employerId: employer.id, employerName: employer.name, designation: input.designation, wage: input.wage, ...(open ? { previousEmployerId: open.employerId } : {}) },
      },
    });
    const created = await prisma.employmentRecord.create({
      data: { traineeId: input.traineeId, employerId: employer.id, designation: input.designation, monthlyWage: input.wage, startDate: now, status: 'PENDING_VERIFICATION', evidence: { reportedVia: input.source } },
    });
    recordId = created.id;
  }
  const verificationUrl = await createVerificationLink(recordId);
  bumpVersion();
  return { recordId, verificationUrl, eventType };
}

export async function commitSelfEmployment(input: { traineeId: string; businessType: string; income: number; udyam?: string | null; businessName?: string | null; source: OutcomeSource }) {
  const state = await currentState(input.traineeId);
  const now = new Date();
  if (state.status === 'SELF_EMPLOYED') {
    await prisma.outcomeEvent.create({ data: { traineeId: input.traineeId, eventType: 'WAGE_CHANGE', occurredAt: now, source: input.source, payload: { income: input.income, previous: state.wage, selfEmployed: true, ...(input.udyam ? { udyam: input.udyam } : {}) } } });
  } else {
    const open = await prisma.employmentRecord.findFirst({ where: { traineeId: input.traineeId, endDate: null } });
    if (open) await prisma.employmentRecord.update({ where: { id: open.id }, data: { endDate: now } });
    await prisma.outcomeEvent.create({
      data: { traineeId: input.traineeId, eventType: 'SELF_EMPLOYED', occurredAt: now, source: input.source, payload: { businessType: input.businessType, income: input.income, udyam: input.udyam ?? null, businessName: input.businessName ?? null } },
    });
  }
  bumpVersion();
}

export async function commitApprenticeship(input: { traineeId: string; establishment: string; stipend: number; source: OutcomeSource }) {
  const employer = await resolveEmployer(input.establishment, input.traineeId);
  await prisma.outcomeEvent.create({
    data: { traineeId: input.traineeId, eventType: 'APPRENTICE', occurredAt: new Date(), source: input.source, payload: { establishment: employer.name, employerId: employer.id, stipend: input.stipend } },
  });
  bumpVersion();
}

export async function commitNotWorking(input: { traineeId: string; reason: AttritionReason; text?: string | null; source: OutcomeSource }) {
  const state = await currentState(input.traineeId);
  const now = new Date();
  const wasWorking = state.status === 'EMPLOYED' || state.status === 'SELF_EMPLOYED' || state.status === 'APPRENTICE';
  const skills = input.text ? extractSkills(input.text) : [];
  const open = await prisma.employmentRecord.findFirst({ where: { traineeId: input.traineeId, endDate: null } });
  if (open) await prisma.employmentRecord.update({ where: { id: open.id }, data: { endDate: now } });
  await prisma.outcomeEvent.create({
    data: {
      traineeId: input.traineeId,
      eventType: wasWorking ? 'ATTRITION' : 'UNEMPLOYED',
      occurredAt: now,
      source: input.source,
      attritionReason: input.reason,
      payload: { ...(input.text ? { quote: input.text, skills } : {}), ...(state.employerName ? { employerName: state.employerName } : {}) },
    },
  });
  if (input.text) await recordSkillGap(input.traineeId, input.text);
  bumpVersion();
  return { skills };
}

// Extracts taxonomy skills from free text and folds them into SkillGapSignal aggregates.
export async function recordSkillGap(traineeId: string, text: string): Promise<string[]> {
  const skills = extractSkills(text);
  if (!skills.length) return [];
  const [trainee, enrollment] = await Promise.all([prisma.trainee.findUnique({ where: { id: traineeId } }), traineeCourse(traineeId)]);
  if (!trainee || !enrollment) return skills;
  for (const skill of skills) {
    const existing = await prisma.skillGapSignal.findUnique({ where: { extractedSkill_district_courseId: { extractedSkill: skill, district: trainee.district, courseId: enrollment.courseId } } });
    if (existing) {
      const quotes = [text, ...existing.sampleQuotes.filter((q) => q !== text)].slice(0, 6);
      await prisma.skillGapSignal.update({ where: { id: existing.id }, data: { severity: existing.severity + 1, sampleQuotes: quotes } });
    } else {
      await prisma.skillGapSignal.create({ data: { extractedSkill: skill, district: trainee.district, courseId: enrollment.courseId, severity: 1, sampleQuotes: [text] } });
    }
  }
  bumpVersion();
  return skills;
}

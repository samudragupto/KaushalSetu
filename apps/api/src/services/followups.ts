import { foldOutcomes } from '@kaushalsetu/shared';
import { prisma } from '../db';
import { stableUnit } from '../lib/rng';
import { bumpVersion } from '../lib/version';
import { runEpfoSignals } from '../adapters/epfo';
import { handleInbound, startFollowUp } from './bot';

const HOUR = 3_600_000;

// Replies used when the console simulates the Nashik CNC cohort answering.
const SKILL_QUOTES_DEMO = [
  'कंपनीत नवीन 5-axis CNC मशीन आल्या, आम्हाला फक्त 2-axis लेथ शिकवला होता.',
  '५-अक्ष मशीनवर काम येत नाही म्हणून सुपरवायझरने दुसऱ्या लाईनवर टाकले.',
  'Chakan madhe sagle 5-axis VMC var kaam magtat, training madhe te navhta.',
  'आमच्या शॉपमध्ये Siemens control आहे, आम्ही फक्त Fanuc शिकलो.',
  'Mastercam शिकायला हवं होतं, कंपनी प्रोग्रामिंग करणाऱ्यांनाच ठेवते.',
];
export const REPLY_WINDOW_HOURS = 48;

// ------------------------------------------------------------------ scheduler (node-cron)
// 1. Sends check-ins whose milestone is due. 2. Re-sends once after 48 h without a reply.
// 3. Escalates to the agent queue after a second silent window.
export async function runScheduler(now = new Date()) {
  const due = await prisma.followUp.findMany({
    where: { status: 'SCHEDULED', dueAt: { lte: now }, trainee: { consents: { some: {} } } },
    take: 200,
    orderBy: { dueAt: 'asc' },
    select: { id: true, traineeId: true },
  });
  let sent = 0;
  for (const f of due) {
    const consent = await prisma.consentRecord.findFirst({ where: { traineeId: f.traineeId, scope: 'employmentTracking' }, orderBy: { capturedAt: 'desc' } });
    if (!consent?.granted) continue;
    await startFollowUp(f.id);
    sent++;
  }
  const stale = await prisma.followUp.findMany({
    where: { status: 'SENT', sentAt: { lte: new Date(now.getTime() - REPLY_WINDOW_HOURS * HOUR) } },
    take: 200,
    select: { id: true, attempts: true },
  });
  let reminders = 0;
  let escalated = 0;
  for (const f of stale) {
    if (f.attempts < 2) {
      await startFollowUp(f.id, { reminder: true });
      reminders++;
    } else {
      await escalate(f.id);
      escalated++;
    }
  }
  return { sent, reminders, escalated };
}

export async function escalate(followUpId: string) {
  const fu = await prisma.followUp.update({ where: { id: followUpId }, data: { status: 'ESCALATED' } });
  const existing = await prisma.agentTask.findFirst({ where: { followUpId, status: { in: ['QUEUED', 'IN_CALL'] } } });
  if (!existing) await prisma.agentTask.create({ data: { followUpId, traineeId: fu.traineeId, status: 'QUEUED' } });
  await prisma.botSession.updateMany({ where: { followUpId, active: true }, data: { active: false } });
  bumpVersion();
}

// ------------------------------------------------------------------ simulation console
// The demo cohort: Government ITI Nashik, CNC Machine Operator, Month-6 check-in.
async function cohortFollowUps(statuses?: ('SCHEDULED' | 'SENT' | 'RESPONDED' | 'ESCALATED')[]) {
  const now = Date.now();
  return prisma.followUp.findMany({
    where: {
      milestone: 'MONTH_6',
      dueAt: { gte: new Date(now - 30 * 86_400_000), lte: new Date(now + 30 * 86_400_000) },
      ...(statuses ? { status: { in: statuses } } : {}),
      trainee: {
        district: 'Nashik',
        enrollments: { some: { provider: { name: 'Government ITI Nashik' }, course: { code: 'CSC/Q0110' } } },
      },
    },
    include: { trainee: { select: { id: true, fullName: true, isPersona: true } } },
    orderBy: { trainee: { fullName: 'asc' } },
  });
}

export async function cohortStatus() {
  const all = await cohortFollowUps();
  const counts = { SCHEDULED: 0, SENT: 0, RESPONDED: 0, ESCALATED: 0 } as Record<string, number>;
  for (const f of all) counts[f.status]++;
  const ramesh = all.find((f) => f.trainee.fullName === 'Ramesh Pawar');
  let verificationUrl: string | null = null;
  if (ramesh) {
    const msg = await prisma.botMessage.findFirst({
      where: { session: { traineeId: ramesh.traineeId }, direction: 'OUT', meta: { path: ['kind'], equals: 'verification' } },
      orderBy: { createdAt: 'desc' },
    });
    const meta = msg?.meta as { verificationUrl?: string } | undefined;
    verificationUrl = meta?.verificationUrl ?? null;
  }
  return {
    cohort: 'Government ITI Nashik · CNC Machine Operator · Month 6',
    total: all.length,
    counts,
    ramesh: ramesh ? { traineeId: ramesh.traineeId, status: ramesh.status, verificationUrl } : null,
  };
}

export async function triggerCohort() {
  const list = await cohortFollowUps();
  for (const f of list) {
    await prisma.agentTask.deleteMany({ where: { followUpId: f.id, status: { in: ['QUEUED', 'IN_CALL'] } } });
    await prisma.followUp.update({ where: { id: f.id }, data: { status: 'SCHEDULED', attempts: 0, respondedAt: null, responses: {} } });
    await startFollowUp(f.id);
  }
  return { sent: list.length, message: `Month-6 check-in sent to ${list.length} trainees of the Nashik CNC cohort on WhatsApp.` };
}

// Drives the real bot engine with deterministic replies for everyone in the cohort except the
// scripted personas (Ramesh is answered live during the demo).
export async function simulateReplies() {
  const pending = await cohortFollowUps(['SENT']);
  let replied = 0;
  let silent = 0;
  for (const f of pending) {
    if (f.trainee.isPersona) continue;
    const u = stableUnit(`${f.id}:${f.attempts}:reply`);
    if (u >= 0.72) {
      silent++;
      continue;
    }
    const [events, openRecord] = await Promise.all([
      prisma.outcomeEvent.findMany({ where: { traineeId: f.traineeId }, orderBy: { occurredAt: 'asc' } }),
      prisma.employmentRecord.findFirst({ where: { traineeId: f.traineeId, endDate: null, status: { not: 'REJECTED' } }, orderBy: { startDate: 'desc' } }),
    ]);
    const state = foldOutcomes(events, new Date());
    const say = (input: { buttonId?: string; text?: string }) => handleInbound(f.traineeId, input);
    if (state.status === 'EMPLOYED' && openRecord) {
      const raise = 1 + stableUnit(`${f.id}:raise`) * 0.14;
      const wage = Math.round((openRecord.monthlyWage * raise) / 500) * 500;
      await say({ buttonId: 's_job' });
      await say({ buttonId: 'e_same' });
      await say({ buttonId: 'd_0' });
      await say({ text: String(wage) });
      await say({ buttonId: 'c_yes' });
      if (stableUnit(`${f.id}:gap`) < 0.35) await say({ text: SKILL_QUOTES_DEMO[Math.floor(stableUnit(f.id) * SKILL_QUOTES_DEMO.length)] });
      else await say({ buttonId: 'k_skip' });
    } else {
      await say({ buttonId: 's_none' });
      await say({ buttonId: stableUnit(`${f.id}:why`) < 0.55 ? 'r_skills' : 'r_low_wage' });
      await say({ text: SKILL_QUOTES_DEMO[Math.floor(stableUnit(`${f.id}:q`) * SKILL_QUOTES_DEMO.length)] });
    }
    replied++;
  }
  return { replied, silent, message: `${replied} trainees replied on WhatsApp; ${silent} have not answered yet.` };
}

// Compresses time: every silent check-in moves one step (reminder, then escalation to the
// agent queue), and the EPFO signal simulator runs for the cohort.
export async function advanceMilestone() {
  const pending = await cohortFollowUps(['SENT']);
  let reminders = 0;
  let escalated = 0;
  for (const f of pending) {
    if (f.trainee.fullName === 'Ramesh Pawar') continue;
    if (f.attempts < 2) {
      await startFollowUp(f.id, { reminder: true });
      reminders++;
    } else {
      await escalate(f.id);
      escalated++;
    }
  }
  const cohort = await cohortFollowUps();
  const epfo = await runEpfoSignals({ traineeIds: cohort.map((f) => f.traineeId), minTenureDays: 120 });
  return {
    reminders,
    escalated,
    epfoVerified: epfo.verified,
    message: `Reply window closed: ${reminders} reminders sent, ${escalated} escalated to the agent call queue, ${epfo.verified} placements verified by EPFO signal.`,
  };
}

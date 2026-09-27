import {
  BOT_BUTTONS,
  BOT_INPUT_KIND,
  BOT_TEXT,
  DESIGNATIONS_BY_COURSE,
  INCOME_BANDS,
  MILESTONE_DAYS,
  NW_REASON_TO_ENUM,
  UDYAM_PATTERN,
  WAGE_BANDS,
  fillTemplate,
  foldOutcomes,
  type BotState,
  type ChatButton,
  type ChatSession,
  type Lang,
} from '@kaushalsetu/shared';
import type { AttritionReason, Prisma } from '@prisma/client';
import { prisma } from '../db';
import { HttpError } from '../lib/http';
import { bumpVersion } from '../lib/version';
import { sendWhatsApp } from '../adapters/whatsapp';
import { signToken } from '../auth';
import { commitApprenticeship, commitJob, commitNotWorking, commitSelfEmployment, recordSkillGap } from './outcomes';

// WhatsApp follow-up bot. A per-trainee state machine persisted in BotSession; every inbound
// reply advances the state and writes outcomes through services/outcomes.ts. The same engine
// serves the in-app simulator (DEMO) and the WhatsApp Cloud API webhook (LIVE).

interface Ctx {
  milestone?: string;
  months?: number;
  previousEmployerName?: string | null;
  previousEmployerId?: string | null;
  employerName?: string;
  employerId?: string | null;
  designation?: string;
  wage?: number;
  businessType?: string;
  udyam?: string | null;
  income?: number;
  establishment?: string;
  reason?: string;
  courseCode?: string;
  courseName?: string;
  firstName?: string;
  verificationUrl?: string;
}

type Session = { id: string; traineeId: string; followUpId: string | null; state: string; lang: string; context: Prisma.JsonValue };

const LANGS: Lang[] = ['mr', 'hi', 'en'];
const asLang = (l: string): Lang => (LANGS.includes(l as Lang) ? (l as Lang) : 'mr');
const ctxOf = (s: Session): Ctx => (s.context && typeof s.context === 'object' ? (s.context as Ctx) : {});

function formatInr(n: number, lang: Lang) {
  return n.toLocaleString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { maximumFractionDigits: 0 }).replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));
}

function nextCheckIn(ctx: Ctx, lang: Lang, batchEnd: Date | null): string {
  const order = ['MONTH_3', 'MONTH_6', 'MONTH_12', 'MONTH_24'];
  const idx = order.indexOf(ctx.milestone ?? '');
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
  if (!next || !batchEnd) return lang === 'en' ? 'the next scheduled round' : lang === 'hi' ? 'अगले निर्धारित दौर' : 'पुढील नियोजित फेरी';
  const date = new Date(batchEnd.getTime() + MILESTONE_DAYS[next] * 86_400_000);
  return date.toLocaleDateString(lang === 'en' ? 'en-IN' : `${lang}-IN`, { month: 'long', year: 'numeric' });
}

function buttonsFor(state: BotState, lang: Lang, ctx: Ctx): ChatButton[] {
  const b = (ids: string[]) => ids.map((id) => ({ id, label: BOT_BUTTONS[lang][id] ?? id }));
  switch (state) {
    case 'ASK_STATUS':
      return b(['s_job', 's_self', 's_appr', 's_none']);
    case 'JOB_EMPLOYER':
      return ctx.previousEmployerName ? [{ id: 'e_same', label: ctx.previousEmployerName }] : [];
    case 'JOB_DESIGNATION':
      return (DESIGNATIONS_BY_COURSE[ctx.courseCode ?? ''] ?? []).map((label, i) => ({ id: `d_${i}`, label }));
    case 'JOB_WAGE':
      return b(WAGE_BANDS.map((w) => w.id));
    case 'JOB_CONFIRM':
      return b(['c_yes', 'c_edit']);
    case 'JOB_SKILLS':
    case 'NW_SKILLS':
      return b(['k_skip']);
    case 'SELF_TYPE':
      return b(['t_shop', 't_freelance', 't_gig']);
    case 'SELF_UDYAM':
      return b(['u_skip']);
    case 'SELF_INCOME':
      return b(INCOME_BANDS.map((i) => i.id));
    case 'SELF_PROOF':
      return b(['p_later']);
    case 'APPR_STIPEND':
      return [
        { id: 'st_7000', label: '₹7,000' },
        { id: 'st_9000', label: '₹9,000' },
        { id: 'st_12000', label: '₹12,000' },
      ];
    case 'NW_REASON':
      return b(Object.keys(NW_REASON_TO_ENUM));
    default:
      return [];
  }
}

const PROMPT_KEY: Partial<Record<BotState, keyof (typeof BOT_TEXT)['en']>> = {
  ASK_STATUS: 'greeting',
  JOB_EMPLOYER: 'askEmployer',
  JOB_DESIGNATION: 'askDesignation',
  JOB_WAGE: 'askWage',
  JOB_CONFIRM: 'confirmJob',
  JOB_SKILLS: 'askJobSkills',
  SELF_TYPE: 'askSelfType',
  SELF_UDYAM: 'askUdyam',
  SELF_INCOME: 'askIncome',
  SELF_PROOF: 'askProof',
  APPR_ESTABLISHMENT: 'askApprEstablishment',
  APPR_STIPEND: 'askStipend',
  NW_REASON: 'askReason',
  NW_SKILLS: 'askSkills',
  DONE: 'closed',
};

async function say(session: Session, key: keyof (typeof BOT_TEXT)['en'], buttons: ChatButton[] = [], meta: Record<string, unknown> = {}) {
  const lang = asLang(session.lang);
  const ctx = ctxOf(session);
  const enr = await prisma.enrollment.findFirst({ where: { traineeId: session.traineeId }, orderBy: { batchEnd: 'desc' } });
  const body = fillTemplate(BOT_TEXT[lang][key], {
    name: ctx.firstName ?? '',
    course: ctx.courseName ?? '',
    months: ctx.months ?? 0,
    employer: ctx.employerName ?? '',
    designation: ctx.designation ?? '',
    wage: formatInr(ctx.wage ?? 0, lang),
    next: nextCheckIn(ctx, lang, enr?.batchEnd ?? null),
  });
  await prisma.botMessage.create({ data: { sessionId: session.id, direction: 'OUT', body, buttons: buttons as unknown as Prisma.InputJsonValue, meta: meta as Prisma.InputJsonValue } });
  const trainee = await prisma.trainee.findUnique({ where: { id: session.traineeId }, select: { whatsappNumber: true } });
  await sendWhatsApp(trainee?.whatsappNumber ?? null, body, buttons);
}

async function prompt(session: Session, state: BotState) {
  const key = PROMPT_KEY[state];
  if (!key) return;
  await say(session, key, buttonsFor(state, asLang(session.lang), ctxOf(session)));
}

async function save(session: Session, state: BotState, ctx: Ctx): Promise<Session> {
  const updated = await prisma.botSession.update({ where: { id: session.id }, data: { state, context: ctx as Prisma.InputJsonValue } });
  return updated;
}

async function markResponded(session: Session, responses: Record<string, unknown>) {
  if (!session.followUpId) return;
  await prisma.followUp.update({ where: { id: session.followUpId }, data: { status: 'RESPONDED', respondedAt: new Date(), responses: { ...responses, via: 'WHATSAPP' } as Prisma.InputJsonValue } });
  const open = await prisma.agentTask.findMany({ where: { followUpId: session.followUpId, status: { in: ['QUEUED', 'IN_CALL'] } } });
  for (const task of open) {
    await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'RESOLVED', resolvedAt: new Date(), callNotes: 'Closed automatically: trainee replied on WhatsApp before the call.', resolvedOutcome: responses as Prisma.InputJsonValue } });
  }
  bumpVersion();
}

// Starts (or re-sends as a reminder) the check-in for a follow-up.
export async function startFollowUp(followUpId: string, opts: { reminder?: boolean } = {}) {
  const fu = await prisma.followUp.findUnique({ where: { id: followUpId }, include: { trainee: true } });
  if (!fu) throw new HttpError(404, 'Follow-up not found');
  const active = await prisma.botSession.findFirst({ where: { traineeId: fu.traineeId, active: true }, orderBy: { createdAt: 'desc' } });
  if (opts.reminder && active && active.followUpId === followUpId && active.state === 'ASK_STATUS') {
    await say(active, 'reminder', buttonsFor('ASK_STATUS', asLang(active.lang), ctxOf(active)));
  } else {
    await prisma.botSession.updateMany({ where: { traineeId: fu.traineeId, active: true }, data: { active: false } });
    const [events, enrollment, openRecord] = await Promise.all([
      prisma.outcomeEvent.findMany({ where: { traineeId: fu.traineeId }, orderBy: { occurredAt: 'asc' } }),
      prisma.enrollment.findFirst({ where: { traineeId: fu.traineeId }, orderBy: { batchEnd: 'desc' }, include: { course: true } }),
      prisma.employmentRecord.findFirst({ where: { traineeId: fu.traineeId, endDate: null, status: { not: 'REJECTED' } }, orderBy: { startDate: 'desc' }, include: { employer: true } }),
    ]);
    const state = foldOutcomes(events, new Date());
    const ctx: Ctx = {
      milestone: fu.milestone,
      months: Math.round(MILESTONE_DAYS[fu.milestone] / 30),
      previousEmployerName: state.status === 'EMPLOYED' ? openRecord?.employer.name ?? state.employerName : null,
      previousEmployerId: state.status === 'EMPLOYED' ? openRecord?.employerId ?? null : null,
      courseCode: enrollment?.course.code,
      courseName: enrollment?.course.name,
      firstName: fu.trainee.fullName.split(' ')[0],
    };
    const session = await prisma.botSession.create({ data: { traineeId: fu.traineeId, followUpId, state: 'ASK_STATUS', lang: fu.trainee.preferredLang, context: ctx as Prisma.InputJsonValue } });
    await say(session, opts.reminder ? 'reminder' : 'greeting', buttonsFor('ASK_STATUS', asLang(session.lang), ctx));
  }
  await prisma.followUp.update({ where: { id: followUpId }, data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } } });
  bumpVersion();
}

function parseAmount(text: string): number | null {
  const t = text.replace(/[,₹\s]/g, '').toLowerCase().replace(/rs\.?/g, '');
  const k = t.match(/^(\d+(?:\.\d+)?)k$/);
  if (k) return Math.round(parseFloat(k[1]) * 1000);
  const n = t.match(/(\d{4,6})/);
  if (!n) return null;
  const v = parseInt(n[1], 10);
  return v >= 2000 && v <= 500000 ? v : null;
}

export interface InboundInput {
  buttonId?: string;
  text?: string;
  evidenceId?: string;
}

export async function handleInbound(traineeId: string, input: InboundInput): Promise<void> {
  let session: Session | null = await prisma.botSession.findFirst({ where: { traineeId, active: true }, orderBy: { createdAt: 'desc' } });
  if (!session) throw new HttpError(409, 'There is no open check-in for this trainee. Trigger a follow-up first.');
  const lang = asLang(session.lang);
  const state = session.state as BotState;
  const ctx = ctxOf(session);
  const lastOut = await prisma.botMessage.findFirst({ where: { sessionId: session.id, direction: 'OUT' }, orderBy: { createdAt: 'desc' } });
  const offered = (Array.isArray(lastOut?.buttons) ? lastOut.buttons : []) as unknown as ChatButton[];

  let buttonId = input.buttonId && offered.some((b) => b.id === input.buttonId) ? input.buttonId : undefined;
  const text = input.text?.trim() ?? '';
  if (!buttonId && text) {
    const byLabel = offered.find((b) => b.label.toLowerCase() === text.toLowerCase());
    const byIndex = /^\d$/.test(text) ? offered[parseInt(text, 10) - 1] : undefined;
    buttonId = byLabel?.id ?? byIndex?.id;
  }
  let evidenceName: string | null = null;
  if (input.evidenceId) {
    const ev = await prisma.evidenceFile.findFirst({ where: { id: input.evidenceId, traineeId } });
    if (!ev) throw new HttpError(404, 'Uploaded file not found');
    evidenceName = ev.fileName;
  }
  const inboundBody = evidenceName ? `[File] ${evidenceName}` : buttonId ? offered.find((b) => b.id === buttonId)?.label ?? text : text;
  if (!inboundBody) throw new HttpError(400, 'Empty message');
  await prisma.botMessage.create({ data: { sessionId: session.id, direction: 'IN', body: inboundBody, meta: { buttonId: buttonId ?? null, evidenceId: input.evidenceId ?? null }, readAt: new Date() } });

  const go = async (next: BotState, patch: Partial<Ctx> = {}) => {
    session = await save(session!, next, { ...ctx, ...patch });
    await prompt(session, next);
  };
  const invalid = async (key: 'pickOption' | 'wageInvalid' | 'udyamInvalid' = 'pickOption') => {
    await say(session!, key, key === 'pickOption' ? offered : []);
  };

  switch (state) {
    case 'ASK_STATUS':
      if (buttonId === 's_job') return go('JOB_EMPLOYER');
      if (buttonId === 's_self') return go('SELF_TYPE');
      if (buttonId === 's_appr') return go('APPR_ESTABLISHMENT');
      if (buttonId === 's_none') return go('NW_REASON');
      return invalid();
    case 'JOB_EMPLOYER':
      if (buttonId === 'e_same') return go('JOB_DESIGNATION', { employerName: ctx.previousEmployerName ?? '', employerId: ctx.previousEmployerId });
      if (text.length >= 2) return go('JOB_DESIGNATION', { employerName: text, employerId: null });
      return invalid();
    case 'JOB_DESIGNATION': {
      const label = buttonId ? offered.find((b) => b.id === buttonId)?.label : text;
      if (label && label.length >= 2) return go('JOB_WAGE', { designation: label });
      return invalid();
    }
    case 'JOB_WAGE': {
      const band = WAGE_BANDS.find((w) => w.id === buttonId);
      const wage = band ? band.value : parseAmount(text);
      if (!wage) return invalid('wageInvalid');
      return go('JOB_CONFIRM', { wage });
    }
    case 'JOB_CONFIRM':
      if (buttonId === 'c_edit') return go('JOB_EMPLOYER');
      if (buttonId === 'c_yes') {
        const result = await commitJob({ traineeId, employerName: ctx.employerName ?? '', employerId: ctx.employerId, designation: ctx.designation ?? '', wage: ctx.wage ?? 0, source: 'BOT' });
        session = await save(session, 'JOB_SKILLS', { ...ctx, verificationUrl: result.verificationUrl });
        await say(session, 'jobDone');
        await say(session, 'verificationSent', [], { kind: 'verification', verificationUrl: result.verificationUrl, recordId: result.recordId });
        await markResponded(session, { status: 'EMPLOYED', employer: ctx.employerName, designation: ctx.designation, wage: ctx.wage, event: result.eventType });
        await prompt(session, 'JOB_SKILLS');
        return;
      }
      return invalid();
    case 'JOB_SKILLS':
      if (buttonId !== 'k_skip' && text) await recordSkillGap(traineeId, text);
      return go('DONE');
    case 'SELF_TYPE': {
      const type = { t_shop: 'shop', t_freelance: 'freelance', t_gig: 'gig' }[buttonId ?? ''];
      if (!type) return invalid();
      return go('SELF_UDYAM', { businessType: type });
    }
    case 'SELF_UDYAM': {
      if (buttonId === 'u_skip') return go('SELF_INCOME', { udyam: null });
      const u = text.toUpperCase().replace(/\s+/g, '');
      if (!UDYAM_PATTERN.test(u)) return invalid('udyamInvalid');
      return go('SELF_INCOME', { udyam: u });
    }
    case 'SELF_INCOME': {
      const band = INCOME_BANDS.find((i) => i.id === buttonId);
      const income = band ? band.value : parseAmount(text);
      if (!income) return invalid();
      await commitSelfEmployment({ traineeId, businessType: ctx.businessType ?? 'shop', income, udyam: ctx.udyam ?? null, source: 'BOT' });
      await markResponded(session, { status: 'SELF_EMPLOYED', businessType: ctx.businessType, income, udyam: ctx.udyam ?? null });
      return go('SELF_PROOF', { income });
    }
    case 'SELF_PROOF':
      if (input.evidenceId) {
        await say(session, 'proofReceived');
        session = await save(session, 'DONE', ctx);
        await say(session, 'selfDone');
        return;
      }
      if (buttonId === 'p_later') {
        session = await save(session, 'DONE', ctx);
        await say(session, 'selfDone');
        return;
      }
      return invalid();
    case 'APPR_ESTABLISHMENT':
      if (text.length >= 2) return go('APPR_STIPEND', { establishment: text });
      return invalid();
    case 'APPR_STIPEND': {
      const stipend = buttonId?.startsWith('st_') ? parseInt(buttonId.slice(3), 10) : parseAmount(text);
      if (!stipend) return invalid('wageInvalid');
      await commitApprenticeship({ traineeId, establishment: ctx.establishment ?? '', stipend, source: 'BOT' });
      await markResponded(session, { status: 'APPRENTICE', establishment: ctx.establishment, stipend });
      session = await save(session, 'DONE', ctx);
      await say(session, 'apprDone');
      return;
    }
    case 'NW_REASON':
      if (!buttonId || !(buttonId in NW_REASON_TO_ENUM)) return invalid();
      return go('NW_SKILLS', { reason: NW_REASON_TO_ENUM[buttonId] });
    case 'NW_SKILLS': {
      const quote = buttonId === 'k_skip' ? null : text || null;
      const result = await commitNotWorking({ traineeId, reason: (ctx.reason ?? 'OTHER') as AttritionReason, text: quote, source: 'BOT' });
      await markResponded(session, { status: 'UNEMPLOYED', reason: ctx.reason, quote, skills: result.skills });
      session = await save(session, 'DONE', ctx);
      await say(session, 'nwDone');
      return;
    }
    case 'DONE':
    default:
      await say(session, 'closed');
  }
}

export async function setLanguage(traineeId: string, lang: Lang) {
  const session = await prisma.botSession.findFirst({ where: { traineeId, active: true }, orderBy: { createdAt: 'desc' } });
  await prisma.trainee.update({ where: { id: traineeId }, data: { preferredLang: lang } });
  if (!session) return;
  const updated = await prisma.botSession.update({ where: { id: session.id }, data: { lang } });
  if (updated.state !== 'DONE') await prompt(updated, updated.state as BotState);
}

export async function getChat(traineeId: string): Promise<ChatSession> {
  const trainee = await prisma.trainee.findUnique({
    where: { id: traineeId },
    include: { enrollments: { include: { course: true }, orderBy: { batchEnd: 'desc' }, take: 1 } },
  });
  if (!trainee) throw new HttpError(404, 'Trainee not found');
  const sessions = await prisma.botSession.findMany({ where: { traineeId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  const latest = await prisma.botSession.findFirst({ where: { traineeId }, orderBy: { createdAt: 'desc' }, include: { followUp: true } });
  await prisma.botMessage.updateMany({ where: { sessionId: { in: sessions.map((s) => s.id) }, direction: 'OUT', readAt: null }, data: { readAt: new Date() } });
  const messages = await prisma.botMessage.findMany({ where: { sessionId: { in: sessions.map((s) => s.id) } }, orderBy: { createdAt: 'asc' } });
  const state = (latest?.state ?? 'DONE') as BotState;
  const inputHint = latest?.active ? BOT_INPUT_KIND[state] : 'closed';
  return {
    sessionId: latest?.id ?? null,
    state,
    lang: asLang(latest?.lang ?? trainee.preferredLang),
    trainee: {
      id: trainee.id,
      name: trainee.fullName,
      unifiedId: trainee.unifiedId,
      district: trainee.district,
      course: trainee.enrollments[0]?.course.name ?? '',
    },
    messages: messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      body: m.body,
      buttons: (Array.isArray(m.buttons) ? m.buttons : []) as unknown as ChatButton[],
      meta: (m.meta && typeof m.meta === 'object' ? m.meta : {}) as Record<string, unknown>,
      createdAt: m.createdAt.toISOString(),
      readAt: m.readAt?.toISOString() ?? null,
    })),
    followUp: latest?.followUp ? { id: latest.followUp.id, milestone: latest.followUp.milestone, status: latest.followUp.status } : null,
    inputHint,
    uploadToken: inputHint === 'upload' ? signToken({ sub: trainee.id, role: 'TRAINEE', name: trainee.fullName }, '2h') : null,
  };
}

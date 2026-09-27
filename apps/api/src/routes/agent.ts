import { Router } from 'express';
import { z } from 'zod';
import { MILESTONE_LABELS, maskId, maskPhone } from '@kaushalsetu/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { auth, requireAuth } from '../auth';
import { HttpError, asyncHandler, parse } from '../lib/http';
import { writeAudit } from '../lib/audit';
import { bumpVersion } from '../lib/version';
import { traineeDetail } from '../services/trainee';
import { commitApprenticeship, commitJob, commitNotWorking, commitSelfEmployment } from '../services/outcomes';

export const agentRouter = Router();
agentRouter.use(requireAuth('AGENT', 'GOVT'));

agentRouter.get(
  '/queue',
  asyncHandler(async (_req, res) => {
    const tasks = await prisma.agentTask.findMany({
      where: { status: { in: ['QUEUED', 'IN_CALL'] } },
      orderBy: { createdAt: 'asc' },
      include: {
        trainee: { include: { enrollments: { include: { course: true, provider: true }, take: 1 } } },
        followUp: true,
        assignee: { select: { name: true } },
      },
    });
    const now = Date.now();
    res.json(
      tasks.map((t) => ({
        id: t.id,
        status: t.status,
        createdAt: t.createdAt,
        ageHours: Math.round((now - t.createdAt.getTime()) / 3_600_000),
        slaBreached: now - t.createdAt.getTime() > 72 * 3_600_000,
        assignee: t.assignee?.name ?? null,
        milestone: t.followUp ? MILESTONE_LABELS[t.followUp.milestone] : 'Ad hoc',
        attempts: t.followUp?.attempts ?? 0,
        trainee: {
          id: t.trainee.id,
          name: t.trainee.fullName,
          maskedId: maskId(t.trainee.unifiedId),
          maskedPhone: maskPhone(t.trainee.phonePrimary),
          district: t.trainee.district,
          course: t.trainee.enrollments[0]?.course.name ?? '',
          provider: t.trainee.enrollments[0]?.provider.name ?? '',
        },
      })),
    );
  }),
);

agentRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [sent, responded, queued, resolved, resolvedToday] = await Promise.all([
      prisma.followUp.count({ where: { sentAt: { gte: since } } }),
      prisma.followUp.count({ where: { sentAt: { gte: since }, status: 'RESPONDED' } }),
      prisma.agentTask.count({ where: { status: { in: ['QUEUED', 'IN_CALL'] } } }),
      prisma.agentTask.findMany({ where: { status: 'RESOLVED', resolvedAt: { gte: since } }, select: { createdAt: true, resolvedAt: true } }),
      prisma.agentTask.count({ where: { status: 'RESOLVED', resolvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);
    const hours = resolved.map((r) => ((r.resolvedAt?.getTime() ?? 0) - r.createdAt.getTime()) / 3_600_000).filter((h) => h >= 0);
    res.json({
      responseRate: sent ? responded / sent : null,
      followUpsSent30d: sent,
      queued,
      resolved30d: resolved.length,
      resolvedToday,
      avgResolutionHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
    });
  }),
);

// Opening a task reveals the phone numbers, so it is logged before the data is returned.
agentRouter.post(
  '/tasks/:id/open',
  asyncHandler(async (req, res) => {
    const claims = auth(req);
    const task = await prisma.agentTask.findUnique({ where: { id: req.params.id }, include: { followUp: true } });
    if (!task) throw new HttpError(404, 'Task not found');
    if (task.status === 'RESOLVED') throw new HttpError(409, 'This task is already resolved.');
    await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'IN_CALL', assignedTo: claims.role === 'AGENT' ? claims.sub : task.assignedTo, openedAt: task.openedAt ?? new Date() } });
    await writeAudit(claims, 'REVEAL_PHONE_FOR_CALL', task.traineeId, `Agent call for ${task.followUp ? MILESTONE_LABELS[task.followUp.milestone] : 'ad hoc'} follow-up`);
    const detail = await traineeDetail(task.traineeId);
    bumpVersion();
    res.json({ task: { id: task.id, status: 'IN_CALL', milestone: task.followUp?.milestone ?? null, createdAt: task.createdAt }, trainee: detail });
  }),
);

agentRouter.post(
  '/tasks/:id/release',
  asyncHandler(async (req, res) => {
    const task = await prisma.agentTask.findUnique({ where: { id: req.params.id } });
    if (!task || task.status === 'RESOLVED') throw new HttpError(404, 'Task not found');
    await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'QUEUED' } });
    res.json({ ok: true });
  }),
);

const resolveSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('JOB'), employerName: z.string().trim().min(2), designation: z.string().trim().min(2), wage: z.coerce.number().int().min(2000).max(500000), notes: z.string().max(1000).optional() }),
  z.object({ outcome: z.literal('SELF'), businessType: z.enum(['shop', 'freelance', 'gig']), income: z.coerce.number().int().min(1000).max(500000), udyam: z.string().regex(/^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/).optional().or(z.literal('')), notes: z.string().max(1000).optional() }),
  z.object({ outcome: z.literal('APPR'), establishment: z.string().trim().min(2), stipend: z.coerce.number().int().min(1000).max(100000), notes: z.string().max(1000).optional() }),
  z.object({ outcome: z.literal('NONE'), reason: z.enum(['LOW_WAGE', 'RELOCATION', 'WORKING_CONDITIONS', 'SKILL_MISMATCH', 'FAMILY', 'HEALTH', 'OTHER']), skillsText: z.string().max(1000).optional(), notes: z.string().max(1000).optional() }),
  z.object({ outcome: z.literal('UNREACHABLE'), notes: z.string().trim().min(5, 'Describe the call attempts.').max(1000) }),
]);

agentRouter.post(
  '/tasks/:id/resolve',
  asyncHandler(async (req, res) => {
    const claims = auth(req);
    const body = parse(resolveSchema, req.body);
    const task = await prisma.agentTask.findUnique({ where: { id: req.params.id } });
    if (!task) throw new HttpError(404, 'Task not found');
    if (task.status === 'RESOLVED') throw new HttpError(409, 'This task is already resolved.');
    const traineeId = task.traineeId;
    let outcome: Record<string, unknown> = { outcome: body.outcome };
    if (body.outcome === 'JOB') {
      const r = await commitJob({ traineeId, employerName: body.employerName, designation: body.designation, wage: body.wage, source: 'AGENT_CALL' });
      outcome = { ...outcome, employer: body.employerName, designation: body.designation, wage: body.wage, verificationUrl: r.verificationUrl };
    } else if (body.outcome === 'SELF') {
      await commitSelfEmployment({ traineeId, businessType: body.businessType, income: body.income, udyam: body.udyam || null, source: 'AGENT_CALL' });
      outcome = { ...outcome, businessType: body.businessType, income: body.income };
    } else if (body.outcome === 'APPR') {
      await commitApprenticeship({ traineeId, establishment: body.establishment, stipend: body.stipend, source: 'AGENT_CALL' });
      outcome = { ...outcome, establishment: body.establishment, stipend: body.stipend };
    } else if (body.outcome === 'NONE') {
      const r = await commitNotWorking({ traineeId, reason: body.reason, text: body.skillsText || null, source: 'AGENT_CALL' });
      outcome = { ...outcome, reason: body.reason, skills: r.skills };
    }
    const now = new Date();
    await prisma.agentTask.update({
      where: { id: task.id },
      data: { status: 'RESOLVED', resolvedAt: now, callNotes: body.notes ?? null, resolvedOutcome: outcome as Prisma.InputJsonValue, assignedTo: claims.role === 'AGENT' ? claims.sub : task.assignedTo },
    });
    if (task.followUpId && body.outcome !== 'UNREACHABLE') {
      await prisma.followUp.update({ where: { id: task.followUpId }, data: { status: 'RESPONDED', respondedAt: now, responses: { ...outcome, via: 'AGENT' } as Prisma.InputJsonValue } });
    }
    bumpVersion();
    res.json({ ok: true, outcome });
  }),
);

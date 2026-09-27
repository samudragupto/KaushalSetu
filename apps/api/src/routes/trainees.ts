import { Router } from 'express';
import { z } from 'zod';
import { foldOutcomes, maskId, maskName, maskPhone } from '@kaushalsetu/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { auth, requireAuth } from '../auth';
import { asyncHandler, parse } from '../lib/http';
import { writeAudit } from '../lib/audit';
import { traineeDetail } from '../services/trainee';

export const traineesRouter = Router();

// Govt list view: identity is masked. Revealing an individual requires a reason and is logged.
traineesRouter.get(
  '/',
  requireAuth('GOVT'),
  asyncHandler(async (req, res) => {
    const q = parse(
      z.object({
        district: z.string().optional(),
        course: z.string().optional(),
        provider: z.string().optional(),
        status: z.enum(['PENDING_VERIFICATION', 'VERIFIED', 'REJECTED']).optional(),
        search: z.string().max(40).optional(),
        page: z.coerce.number().int().min(1).default(1),
      }),
      req.query,
    );
    const where: Prisma.TraineeWhereInput = {
      ...(q.district ? { district: q.district } : {}),
      ...(q.course || q.provider ? { enrollments: { some: { ...(q.course ? { course: { code: q.course } } : {}), ...(q.provider ? { providerId: q.provider } : {}) } } } : {}),
      ...(q.status ? { employmentRecords: { some: { status: q.status } } } : {}),
      ...(q.search ? { unifiedId: { contains: q.search.toUpperCase() } } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.trainee.count({ where }),
      prisma.trainee.findMany({
        where,
        skip: (q.page - 1) * 25,
        take: 25,
        orderBy: { unifiedId: 'asc' },
        include: { enrollments: { include: { course: true, provider: true }, take: 1 }, outcomeEvents: { orderBy: { occurredAt: 'asc' } } },
      }),
    ]);
    res.json({
      total,
      page: q.page,
      pageSize: 25,
      rows: rows.map((t) => ({
        id: t.id,
        maskedName: maskName(t.fullName),
        maskedId: maskId(t.unifiedId),
        maskedPhone: maskPhone(t.phonePrimary),
        district: t.district,
        course: t.enrollments[0]?.course.name ?? '',
        provider: t.enrollments[0]?.provider.name ?? '',
        status: foldOutcomes(t.outcomeEvents, new Date()).status,
      })),
    });
  }),
);

traineesRouter.post(
  '/:id/reveal',
  requireAuth('GOVT'),
  asyncHandler(async (req, res) => {
    const { reason } = parse(z.object({ reason: z.string().trim().min(10, 'State a reason of at least 10 characters.').max(300) }), req.body);
    const detail = await traineeDetail(req.params.id);
    await writeAudit(auth(req), 'REVEAL_TRAINEE_PROFILE', detail.id, reason);
    res.json(detail);
  }),
);

import { Router } from 'express';
import { z } from 'zod';
import { isGstinWellFormed, maskId, maskName, maskPhone } from '@kaushalsetu/shared';
import { prisma } from '../db';
import { env } from '../env';
import { HttpError, asyncHandler, clientIp, parse } from '../lib/http';
import { otp as makeOtp } from '../lib/rng';
import { bumpVersion } from '../lib/version';
import { writeAudit } from '../lib/audit';
import { lookupGstin } from '../adapters/gstin';

// Public employer verification (magic link, no login). Rate limited in app.ts.
export const verifyRouter = Router();

const OTP_TTL_MS = 10 * 60 * 1000;

async function loadToken(token: string) {
  const t = await prisma.verificationToken.findUnique({
    where: { token },
    include: {
      record: {
        include: {
          employer: true,
          trainee: { include: { enrollments: { include: { course: true, provider: true }, orderBy: { batchEnd: 'desc' }, take: 1 } } },
        },
      },
    },
  });
  if (!t) throw new HttpError(404, 'This verification link is not valid. Ask the training provider to resend it.');
  return t;
}

verifyRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const t = await loadToken(req.params.token);
    const r = t.record;
    const enr = r.trainee.enrollments[0];
    const evidence = (r.evidence ?? {}) as Record<string, unknown>;
    const status = t.usedAt ? 'DECIDED' : t.expiresAt.getTime() < Date.now() ? 'EXPIRED' : 'OPEN';
    res.json({
      status,
      demoMode: env.DEMO_MODE,
      expiresAt: t.expiresAt,
      record: {
        designation: r.designation,
        monthlyWage: r.monthlyWage,
        previousWage: typeof evidence.previousWage === 'number' ? evidence.previousWage : null,
        startDate: r.startDate,
        status: r.status,
        rejectionReason: r.rejectionReason,
        decidedAt: r.verifiedAt ?? r.rejectedAt,
      },
      trainee: {
        maskedName: maskName(r.trainee.fullName),
        firstName: r.trainee.fullName.split(' ')[0],
        maskedId: maskId(r.trainee.unifiedId),
        maskedPhone: maskPhone(r.trainee.phonePrimary),
        course: enr?.course.name ?? '',
        provider: enr?.provider.name ?? '',
        batchEnd: enr?.batchEnd ?? null,
      },
      employer: { name: r.employer.name, district: r.employer.district, gstin: r.employer.gstin.startsWith('UNREG-') ? null : r.employer.gstin },
      gstin: await lookupGstin(r.employer.gstin),
    });
  }),
);

verifyRouter.post(
  '/:token/gstin',
  asyncHandler(async (req, res) => {
    await loadToken(req.params.token);
    const { gstin } = parse(z.object({ gstin: z.string().trim().min(1).max(20) }), req.body);
    res.json(await lookupGstin(gstin));
  }),
);

verifyRouter.post(
  '/:token/otp',
  asyncHandler(async (req, res) => {
    const t = await loadToken(req.params.token);
    if (t.usedAt) throw new HttpError(409, 'This claim has already been decided.');
    const code = makeOtp();
    await prisma.verificationToken.update({ where: { id: t.id }, data: { otp: code, otpIssuedAt: new Date() } });
    res.json({
      sent: true,
      channel: 'SMS to the HR contact registered with the employer',
      expiresInSeconds: OTP_TTL_MS / 1000,
      // No SMS gateway is wired in this prototype; in demo mode the OTP is returned for display.
      demoOtp: env.DEMO_MODE ? code : undefined,
    });
  }),
);

verifyRouter.post(
  '/:token/decision',
  asyncHandler(async (req, res) => {
    const body = parse(
      z
        .object({
          otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit OTP.'),
          decision: z.enum(['APPROVE', 'REJECT']),
          reason: z.string().trim().max(400).optional(),
          approverName: z.string().trim().min(2, 'Enter your name.').max(80),
          gstin: z.string().trim().max(20).optional(),
        })
        .refine((v) => v.decision === 'APPROVE' || (v.reason && v.reason.length >= 5), { message: 'Give a reason for rejecting (at least 5 characters).', path: ['reason'] }),
      req.body,
    );
    const t = await loadToken(req.params.token);
    if (t.usedAt) throw new HttpError(409, 'This claim has already been decided.');
    if (t.expiresAt.getTime() < Date.now()) throw new HttpError(410, 'This link has expired. Ask the training provider to resend it.');
    if (!t.otp || !t.otpIssuedAt || Date.now() - t.otpIssuedAt.getTime() > OTP_TTL_MS) throw new HttpError(400, 'Request a new OTP; the previous one has expired.');
    if (t.otp !== body.otp) throw new HttpError(400, 'The OTP does not match.');

    const now = new Date();
    const ip = clientIp(req);
    const prior = (t.record.evidence ?? {}) as Record<string, unknown>;
    const gstin = body.gstin?.toUpperCase();
    if (gstin && t.record.employer.gstin.startsWith('UNREG-') && isGstinWellFormed(gstin)) {
      const clash = await prisma.employer.findUnique({ where: { gstin } });
      if (!clash) await prisma.employer.update({ where: { id: t.record.employerId }, data: { gstin, gstinValid: true } });
    }
    const updated = await prisma.employmentRecord.update({
      where: { id: t.record.id },
      data:
        body.decision === 'APPROVE'
          ? { status: 'VERIFIED', verificationMethod: 'EMPLOYER_LINK', verifiedAt: now, rejectedAt: null, rejectionReason: null, evidence: { ...prior, approvedBy: body.approverName, otpVerified: true, decidedAt: now.toISOString(), ip } }
          : { status: 'REJECTED', verificationMethod: 'EMPLOYER_LINK', rejectedAt: now, verifiedAt: null, rejectionReason: body.reason ?? null, evidence: { ...prior, rejectedBy: body.approverName, otpVerified: true, decidedAt: now.toISOString(), ip } },
    });
    await prisma.verificationToken.update({ where: { id: t.id }, data: { usedAt: now, otp: null } });
    await writeAudit({ role: 'EMPLOYER', name: body.approverName }, body.decision === 'APPROVE' ? 'EMPLOYER_APPROVED_CLAIM' : 'EMPLOYER_REJECTED_CLAIM', t.record.traineeId, body.reason ?? null);
    bumpVersion();
    res.json({ status: updated.status, decidedAt: now.toISOString() });
  }),
);

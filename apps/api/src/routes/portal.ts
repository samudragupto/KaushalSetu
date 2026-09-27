import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { env } from '../env';
import { auth, requireAuth, signToken } from '../auth';
import { HttpError, asyncHandler, clientIp, parse } from '../lib/http';
import { otp as makeOtp } from '../lib/rng';
import { bumpVersion } from '../lib/version';
import { traineeDetail } from '../services/trainee';

// Trainee self-service portal. Sign-in is OTP-lite: Unified ID plus a one-time code sent to the
// registered mobile (shown on screen in demo mode because no SMS gateway is configured).
export const portalRouter = Router();

const unifiedIdSchema = z.string().trim().toUpperCase().regex(/^MH-[A-Z]{3}-\d{6}$/, 'Enter your Unified ID, for example MH-NSK-100101.');

portalRouter.post(
  '/otp',
  asyncHandler(async (req, res) => {
    const { unifiedId } = parse(z.object({ unifiedId: unifiedIdSchema }), req.body);
    const trainee = await prisma.trainee.findUnique({ where: { unifiedId } });
    if (!trainee) throw new HttpError(404, 'No trainee found with this Unified ID.');
    const code = makeOtp();
    await prisma.otpChallenge.create({ data: { subject: unifiedId, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    res.json({ sent: true, to: `+91 xxxxxx${trainee.phonePrimary.slice(-4)}`, demoOtp: env.DEMO_MODE ? code : undefined });
  }),
);

portalRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { unifiedId, otp } = parse(z.object({ unifiedId: unifiedIdSchema, otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') }), req.body);
    const challenge = await prisma.otpChallenge.findFirst({ where: { subject: unifiedId, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    if (!challenge || challenge.code !== otp) throw new HttpError(400, 'The code does not match. Request a new one.');
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } });
    const trainee = await prisma.trainee.findUniqueOrThrow({ where: { unifiedId } });
    res.json({ token: signToken({ sub: trainee.id, role: 'TRAINEE', name: trainee.fullName }, '6h'), user: { id: trainee.id, role: 'TRAINEE', name: trainee.fullName, title: trainee.unifiedId } });
  }),
);

portalRouter.use(requireAuth('TRAINEE'));

portalRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json(await traineeDetail(auth(req).sub));
  }),
);

portalRouter.put(
  '/consent',
  asyncHandler(async (req, res) => {
    const { scope, granted } = parse(z.object({ scope: z.enum(['employmentTracking', 'wageTracking', 'publicAggregates']), granted: z.boolean() }), req.body);
    await prisma.consentRecord.create({ data: { traineeId: auth(req).sub, scope, granted, channel: 'PORTAL', sourceIp: clientIp(req) } });
    bumpVersion();
    res.json(await traineeDetail(auth(req).sub));
  }),
);

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, '').replace(/^91(\d{10})$/, '$1'))
  .refine((v) => /^[6-9]\d{9}$/.test(v), 'Enter a 10-digit Indian mobile number.');

portalRouter.put(
  '/contact',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        phonePrimary: phone,
        phoneAlternate: phone.optional().or(z.literal('').transform(() => undefined)),
        whatsappNumber: phone,
        email: z.string().trim().email('Enter a valid email address.').optional().or(z.literal('').transform(() => undefined)),
        preferredLang: z.enum(['mr', 'hi', 'en']).optional(),
      }),
      req.body,
    );
    await prisma.trainee.update({
      where: { id: auth(req).sub },
      data: { phonePrimary: body.phonePrimary, phoneAlternate: body.phoneAlternate ?? null, whatsappNumber: body.whatsappNumber, email: body.email ?? null, ...(body.preferredLang ? { preferredLang: body.preferredLang } : {}) },
    });
    res.json(await traineeDetail(auth(req).sub));
  }),
);

portalRouter.put(
  '/upskill',
  asyncHandler(async (req, res) => {
    const { optIn } = parse(z.object({ optIn: z.boolean() }), req.body);
    await prisma.trainee.update({ where: { id: auth(req).sub }, data: { upskillOptIn: optIn } });
    res.json(await traineeDetail(auth(req).sub));
  }),
);

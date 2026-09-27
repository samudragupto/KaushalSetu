import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { SessionUser } from '@kaushalsetu/shared';
import { prisma } from '../db';
import { env } from '../env';
import { auth, requireAuth, signToken } from '../auth';
import { HttpError, asyncHandler, parse } from '../lib/http';

export const authRouter = Router();

type UserWithProvider = { id: string; role: 'GOVT' | 'PROVIDER' | 'AGENT'; name: string; title: string; providerId: string | null; provider: { name: string } | null };

function toSession(u: UserWithProvider): SessionUser {
  return { id: u.id, role: u.role, name: u.name, title: u.title, providerId: u.providerId, providerName: u.provider?.name ?? null };
}

function issue(u: UserWithProvider) {
  return { token: signToken({ sub: u.id, role: u.role, name: u.name, providerId: u.providerId }), user: toSession(u) };
}

// One-click demo sign-in for the three seeded roles. Disabled when DEMO_MODE=false.
authRouter.post(
  '/demo',
  asyncHandler(async (req, res) => {
    if (!env.DEMO_MODE) throw new HttpError(404, 'Demo sign-in is disabled on this deployment.');
    const { role } = parse(z.object({ role: z.enum(['GOVT', 'PROVIDER', 'AGENT']) }), req.body);
    const user = await prisma.user.findFirst({ where: { role }, orderBy: { email: 'asc' }, include: { provider: { select: { name: true } } } });
    if (!user) throw new HttpError(503, 'Demo accounts are not seeded. Run npm run db:seed.');
    res.json(issue(user));
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = parse(z.object({ email: z.string().email(), password: z.string().min(1) }), req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { provider: { select: { name: true } } } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Email or password is incorrect.');
    res.json(issue(user));
  }),
);

authRouter.get(
  '/me',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const claims = auth(req);
    if (claims.role === 'TRAINEE') {
      const t = await prisma.trainee.findUnique({ where: { id: claims.sub } });
      if (!t) throw new HttpError(401, 'Sign in again to continue.');
      res.json({ user: { id: t.id, role: 'TRAINEE', name: t.fullName, title: t.unifiedId } satisfies SessionUser });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: claims.sub }, include: { provider: { select: { name: true } } } });
    if (!user) throw new HttpError(401, 'Sign in again to continue.');
    res.json({ user: toSession(user) });
  }),
);

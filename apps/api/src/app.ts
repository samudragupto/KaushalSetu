import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { corsOrigins, env } from './env';
import { prisma } from './db';
import { errorHandler } from './lib/http';
import { dataVersion } from './lib/version';
import { authRouter } from './routes/auth';
import { publicRouter } from './routes/public';
import { analyticsRouter } from './routes/analytics';
import { traineesRouter } from './routes/trainees';
import { privacyRouter } from './routes/privacy';
import { simRouter } from './routes/sim';
import { botRouter } from './routes/bot';
import { verifyRouter } from './routes/verify';
import { agentRouter } from './routes/agent';
import { providerRouter } from './routes/provider';
import { portalRouter } from './routes/portal';
import { uploadsRouter } from './routes/uploads';
import { webhooksRouter } from './routes/webhooks';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Cross-origin: the web app is on Vercel, the API on Render. Explicit allowlist, no wildcard,
  // no credentials (auth travels in the Authorization header).
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        const normalized = origin.replace(/\/$/, '');
        if (corsOrigins.includes(normalized)) return cb(null, true);
        return cb(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    }),
  );
  app.use(express.json({ limit: '3mb' }));

  app.get('/health', async (_req, res) => {
    let db = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'unreachable';
    }
    res.status(db === 'ok' ? 200 : 503).json({ status: db === 'ok' ? 'ok' : 'degraded', db, demoMode: env.DEMO_MODE, dataVersion: dataVersion(), time: new Date().toISOString() });
  });

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Wait a few minutes and try again.' } });
  const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many requests on verification links. Wait a few minutes and try again.' } });

  const api = express.Router();
  api.use('/auth', authLimiter, authRouter);
  api.use('/public', publicRouter);
  api.use('/', analyticsRouter);
  api.use('/trainees', traineesRouter);
  api.use('/privacy', privacyRouter);
  api.use('/sim', simRouter);
  api.use('/bot', botRouter);
  api.use('/verify', verifyLimiter, verifyRouter);
  api.use('/agent', agentRouter);
  api.use('/provider', providerRouter);
  api.use('/portal/otp', authLimiter);
  api.use('/portal/login', authLimiter);
  api.use('/portal', portalRouter);
  api.use('/uploads', uploadsRouter);
  api.use('/webhooks', webhooksRouter);
  api.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  app.use('/api', api);
  app.use((_req, res) => res.status(404).json({ error: 'Not found. This service only serves /api and /health.' }));
  app.use(errorHandler);
  return app;
}

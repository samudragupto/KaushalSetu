import { Router, type NextFunction, type Request, type Response } from 'express';
import { env } from '../env';
import { requireAuth } from '../auth';
import { HttpError, asyncHandler } from '../lib/http';
import { runFraudSweep } from '../services/fraud';
import { advanceMilestone, cohortStatus, simulateReplies, triggerCohort } from '../services/followups';

// Simulation console: compresses the 24-month follow-up lifecycle into a live demo.
export const simRouter = Router();

function demoOnly(_req: Request, _res: Response, next: NextFunction) {
  if (!env.DEMO_MODE) return next(new HttpError(404, 'The simulation console is disabled on this deployment.'));
  next();
}

simRouter.use(demoOnly, requireAuth('GOVT'));

simRouter.get('/status', asyncHandler(async (_req, res) => res.json(await cohortStatus())));
simRouter.post('/trigger-followups', asyncHandler(async (_req, res) => res.json(await triggerCohort())));
simRouter.post('/simulate-replies', asyncHandler(async (_req, res) => res.json(await simulateReplies())));
simRouter.post('/advance-milestone', asyncHandler(async (_req, res) => res.json(await advanceMilestone())));
simRouter.post(
  '/fraud-sweep',
  asyncHandler(async (_req, res) => {
    const r = await runFraudSweep();
    res.json({ ...r, message: `Fraud sweep complete: ${r.open} open alerts (${r.created} new, ${r.resolved} resolved).` });
  }),
);

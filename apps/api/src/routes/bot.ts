import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { env } from '../env';
import { HttpError, asyncHandler, parse } from '../lib/http';
import { getChat, handleInbound, setLanguage } from '../services/bot';

// Endpoints behind the in-app WhatsApp simulator. The simulator stands in for the trainee's
// phone, so these are open in DEMO_MODE only; production traffic arrives via /webhooks/whatsapp.
export const botRouter = Router();

function demoOnly(_req: Request, _res: Response, next: NextFunction) {
  if (!env.DEMO_MODE) return next(new HttpError(404, 'The WhatsApp simulator is disabled on this deployment.'));
  next();
}

botRouter.use(demoOnly);

botRouter.get('/:traineeId', asyncHandler(async (req, res) => res.json(await getChat(req.params.traineeId))));

botRouter.post(
  '/:traineeId/message',
  asyncHandler(async (req, res) => {
    const input = parse(
      z
        .object({ buttonId: z.string().max(40).optional(), text: z.string().max(1000).optional(), evidenceId: z.string().max(40).optional() })
        .refine((v) => v.buttonId || v.text || v.evidenceId, 'Send a button, text or file.'),
      req.body,
    );
    await handleInbound(req.params.traineeId, input);
    res.json(await getChat(req.params.traineeId));
  }),
);

botRouter.post(
  '/:traineeId/lang',
  asyncHandler(async (req, res) => {
    const { lang } = parse(z.object({ lang: z.enum(['mr', 'hi', 'en']) }), req.body);
    await setLanguage(req.params.traineeId, lang);
    res.json(await getChat(req.params.traineeId));
  }),
);

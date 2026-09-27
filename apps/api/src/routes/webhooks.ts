import { Router } from 'express';
import { prisma } from '../db';
import { env } from '../env';
import { asyncHandler } from '../lib/http';
import { handleInbound } from '../services/bot';

// Meta WhatsApp Cloud API webhook (LIVE mode). Inbound replies are matched to trainees by their
// WhatsApp number and fed into the same bot engine the simulator uses.
export const webhooksRouter = Router();

webhooksRouter.get('/whatsapp', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && env.WHATSAPP_VERIFY_TOKEN && req.query['hub.verify_token'] === env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(String(req.query['hub.challenge'] ?? ''));
    return;
  }
  res.sendStatus(403);
});

interface WaMessage {
  from: string;
  type: string;
  text?: { body: string };
  interactive?: { button_reply?: { id: string }; list_reply?: { id: string } };
}

webhooksRouter.post(
  '/whatsapp',
  asyncHandler(async (req, res) => {
    res.sendStatus(200);
    const entries = (req.body?.entry ?? []) as { changes?: { value?: { messages?: WaMessage[] } }[] }[];
    for (const entry of entries)
      for (const change of entry.changes ?? [])
        for (const m of change.value?.messages ?? []) {
          const local = m.from.replace(/^91/, '');
          const trainee = await prisma.trainee.findFirst({ where: { OR: [{ whatsappNumber: local }, { phonePrimary: local }] } });
          if (!trainee) continue;
          const buttonId = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id;
          await handleInbound(trainee.id, buttonId ? { buttonId } : { text: m.text?.body ?? '' }).catch((err) => console.error('WhatsApp inbound failed', err));
        }
  }),
);

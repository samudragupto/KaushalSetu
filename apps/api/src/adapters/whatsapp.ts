import type { AdapterMode, ChatButton } from '@kaushalsetu/shared';
import { env } from '../env';

export const whatsappMode = (): AdapterMode => (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID ? 'LIVE' : 'DEMO');

function buildPayload(recipient: string, body: string, buttons: ChatButton[]) {
  if (buttons.length === 0) return { messaging_product: 'whatsapp', to: recipient, type: 'text', text: { body } };
  if (buttons.length <= 3) {
    return {
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body.slice(0, 1024) },
        action: { buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.label.slice(0, 20) } })) },
      },
    };
  }
  return {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body.slice(0, 1024) },
      action: { button: 'Options', sections: [{ title: 'Choose one', rows: buttons.slice(0, 10).map((b) => ({ id: b.id, title: b.label.slice(0, 24) })) }] },
    },
  };
}

// Sends an outbound bot message through the WhatsApp Cloud API. In DEMO mode the bot engine has
// already stored the message and the in-app simulator renders it, so nothing leaves the server.
export async function sendWhatsApp(to: string | null, body: string, buttons: ChatButton[]): Promise<{ delivered: boolean; channel: AdapterMode }> {
  if (whatsappMode() === 'DEMO' || !to) return { delivered: false, channel: 'DEMO' };
  const recipient = to.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1');
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(recipient, body, buttons)),
      signal: AbortSignal.timeout(8000),
    });
    return { delivered: res.ok, channel: 'LIVE' };
  } catch {
    return { delivered: false, channel: 'LIVE' };
  }
}

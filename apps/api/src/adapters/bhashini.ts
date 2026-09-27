import { QUOTE_GLOSSES, type AdapterMode } from '@kaushalsetu/shared';
import { env } from '../env';

export const bhashiniMode = (): AdapterMode => (env.BHASHINI_API_KEY ? 'LIVE' : 'DEMO');

const cache = new Map<string, string | null>();

// Translates a trainee's free-text reply into English for dashboards. LIVE mode calls the
// Bhashini (Dhruva) inference pipeline; DEMO mode uses pre-translated glosses of known quotes.
// Trainee-facing UI strings never go through here: they ship as en/hi/mr JSON files.
export async function glossToEnglish(text: string, sourceLang: 'mr' | 'hi' = 'mr'): Promise<string | null> {
  if (text in QUOTE_GLOSSES) return QUOTE_GLOSSES[text];
  if (!/[ऀ-ॿ]/.test(text)) return null;
  if (bhashiniMode() === 'DEMO') return null;
  if (cache.has(text)) return cache.get(text) ?? null;
  try {
    const res = await fetch('https://dhruva-api.bhashini.gov.in/services/inference/pipeline', {
      method: 'POST',
      headers: { Authorization: env.BHASHINI_API_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage: sourceLang, targetLanguage: 'en' }, serviceId: 'ai4bharat/indictrans-v2-all-gpu--t4' } }],
        inputData: { input: [{ source: text }] },
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const body = (await res.json()) as { pipelineResponse?: { output?: { target?: string }[] }[] };
    const out = body.pipelineResponse?.[0]?.output?.[0]?.target ?? null;
    cache.set(text, out);
    return out;
  } catch {
    cache.set(text, null);
    return null;
  }
}

import { BRIDGE_COURSES, SECTOR_BY_NAME, type AdapterMode, type AiSummary, type SkillGapRow } from '@kaushalsetu/shared';
import { env } from '../env';

export const llmMode = (): AdapterMode => (env.GEMINI_API_KEY || env.OPENAI_API_KEY ? 'LIVE' : 'DEMO');
export const llmEngine = () => (env.GEMINI_API_KEY ? `Gemini (${env.GEMINI_MODEL})` : env.OPENAI_API_KEY ? `OpenAI (${env.OPENAI_MODEL})` : 'Deterministic taxonomy aggregation');

const cache = new Map<string, { at: number; value: AiSummary }>();
const TTL_MS = 10 * 60 * 1000;

const pct = (x: number) => `${Math.round(x * 100)}%`;

function scopeLabel(scope: { district?: string; sector?: string; course?: string }): string {
  const parts = [scope.course, scope.sector ? SECTOR_BY_NAME[scope.sector]?.short ?? scope.sector : null, scope.district].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Maharashtra';
}

// Deterministic fallback. Produces exactly the same structure as the LLM path.
export function deterministicSummary(rows: SkillGapRow[], scope: { district?: string; sector?: string; course?: string }): AiSummary {
  const generatedAt = new Date().toISOString();
  if (rows.length === 0) {
    return {
      mode: 'DEMO',
      engine: 'Deterministic taxonomy aggregation',
      headline: `No skill-gap mentions recorded yet for ${scopeLabel(scope)}.`,
      bullets: ['Skill gaps are captured when trainees answer the "what skills were missing" question on WhatsApp or during agent calls.'],
      recommendation: 'Keep follow-ups running; signals appear as soon as the first replies arrive.',
      generatedAt,
    };
  }
  const top = rows[0];
  const sectorShort = SECTOR_BY_NAME[top.sector]?.short ?? top.sector;
  const bridge = BRIDGE_COURSES.find((b) => b.skillKey === top.skillKey);
  const bySkill = new Map<string, { skill: string; mentions: number; districts: Set<string> }>();
  for (const r of rows) {
    const s = bySkill.get(r.skillKey) ?? { skill: r.skill, mentions: 0, districts: new Set<string>() };
    s.mentions += r.mentions;
    s.districts.add(r.district);
    bySkill.set(r.skillKey, s);
  }
  const ranked = [...bySkill.values()].sort((a, b) => b.mentions - a.mentions);
  const bullets = [
    `${top.mentions} of ${top.cohortSize} trainees from ${top.courseName}, ${top.district} who are not in work named ${top.skill}.`,
    ...ranked.slice(1, 3).map((s) => `${s.skill}: ${s.mentions} mentions across ${s.districts.size} district${s.districts.size === 1 ? '' : 's'}.`),
  ];
  if (bridge) bullets.push(`Bridge option available: ${bridge.title}, ${bridge.hours} hours (${bridge.mode}).`);
  return {
    mode: 'DEMO',
    engine: 'Deterministic taxonomy aggregation',
    headline: `${pct(top.share)} of ${sectorShort} trainees in ${top.district} who are not working report a ${top.skill} gap — recommend syllabus update.`,
    bullets,
    recommendation: `Add a ${top.skill} module to ${top.courseName} (${top.courseCode}) at providers in ${top.district}${bridge ? `, and offer the ${bridge.hours}-hour bridge course to the affected cohort` : ''}.`,
    generatedAt,
  };
}

async function callGemini(prompt: string): Promise<string | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY ?? '' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return body.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function callOpenAi(prompt: string): Promise<string | null> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: env.OPENAI_MODEL, temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? null;
}

export async function summarizeSkillGaps(rows: SkillGapRow[], scope: { district?: string; sector?: string; course?: string }): Promise<AiSummary> {
  const fallback = deterministicSummary(rows, scope);
  if (llmMode() === 'DEMO' || rows.length === 0) return fallback;
  const key = JSON.stringify({ scope, rows: rows.slice(0, 10).map((r) => [r.skillKey, r.district, r.courseCode, r.mentions, r.cohortSize]) });
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const prompt = [
    'You are an analyst for the Skill Development Department, Government of Maharashtra.',
    'Summarise these post-training skill-gap signals for a senior official. Be specific, numeric and plain; no marketing language.',
    'Return JSON: {"headline": string (one sentence, cite the share and district), "bullets": string[] (2-4 items), "recommendation": string (one concrete syllabus or bridge-course action)}.',
    `Scope: ${scopeLabel(scope)}`,
    'Signals (skill | district | course | mentions | trainees not in work in that cohort | sample quote):',
    ...rows.slice(0, 10).map((r) => `${r.skill} | ${r.district} | ${r.courseName} | ${r.mentions} | ${r.cohortSize} | ${r.quotes[0] ?? ''}`),
  ].join('\n');
  try {
    const text = env.GEMINI_API_KEY ? await callGemini(prompt) : await callOpenAi(prompt);
    if (!text) return fallback;
    const parsed = JSON.parse(text) as { headline?: string; bullets?: string[]; recommendation?: string };
    if (!parsed.headline || !Array.isArray(parsed.bullets) || !parsed.recommendation) return fallback;
    const value: AiSummary = { mode: 'LIVE', engine: llmEngine(), headline: parsed.headline, bullets: parsed.bullets.slice(0, 4), recommendation: parsed.recommendation, generatedAt: new Date().toISOString() };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    return fallback;
  }
}

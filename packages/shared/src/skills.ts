import { SKILL_TAXONOMY } from './catalog';

const ASCII = /[a-z0-9]/;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MATCHERS = SKILL_TAXONOMY.map((entry) => ({
  key: entry.key,
  tests: entry.synonyms.map((syn) => {
    const s = syn.toLowerCase().trim();
    if (ASCII.test(s)) {
      const re = new RegExp(`(^|[^a-z])${escapeRegExp(s)}([^a-z]|$)`, 'i');
      return (text: string) => re.test(text);
    }
    return (text: string) => text.includes(s);
  }),
}));

// Deterministic skill extraction: matches free text (English, Marathi, Hindi or romanised
// Marathi) against the skill taxonomy. Used by the bot, the agent console and the seed.
export function extractSkills(text: string): string[] {
  const lower = text.toLowerCase();
  return MATCHERS.filter((m) => m.tests.some((t) => t(lower))).map((m) => m.key);
}

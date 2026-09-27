import { randomBytes, randomInt } from 'node:crypto';

export function token(bytes = 18): string {
  return randomBytes(bytes).toString('base64url');
}

export function otp(): string {
  return String(randomInt(100000, 999999));
}

// Deterministic 0..1 value from a string, used by simulators so repeated runs agree.
export function stableUnit(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

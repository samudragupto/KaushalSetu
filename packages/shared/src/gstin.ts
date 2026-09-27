// GSTIN structure: 2-digit state code, 10-char PAN, entity number, 'Z', checksum.
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function gstinChecksum(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARSET.indexOf(first14[i]);
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36];
}

export function isGstinWellFormed(gstin: string): boolean {
  const g = gstin.trim().toUpperCase();
  return GSTIN_PATTERN.test(g) && gstinChecksum(g.slice(0, 14)) === g[14];
}

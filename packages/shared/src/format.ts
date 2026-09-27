// Masking helpers used by the API before PII leaves the server.

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `+91 xxxxxx${digits.slice(-4)}`;
}

export function maskName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]}${'*'.repeat(Math.max(2, part.length - 1))}`)
    .join(' ');
}

export function maskId(unifiedId: string): string {
  return unifiedId.replace(/\d{4}$/, 'xxxx');
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

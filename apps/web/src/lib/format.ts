export const pct = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`);

export const inr = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `₹${Math.round(v).toLocaleString('en-IN')}`);

export const num = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Math.round(v).toLocaleString('en-IN'));

export const signedPts = (delta: number | null | undefined) => {
  if (delta === null || delta === undefined) return null;
  const pts = delta * 100;
  return `${pts >= 0 ? '+' : '−'}${Math.abs(pts).toFixed(1)} pts`;
};

export function dateShort(iso: string | Date | null | undefined) {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function timeHM(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function ago(iso: string | Date) {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.floor(ms / 60_000))} min ago`;
  if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} days ago`;
}

export const STATUS_LABEL: Record<string, string> = {
  EMPLOYED: 'Employed',
  SELF_EMPLOYED: 'Self-employed',
  APPRENTICE: 'Apprentice',
  UNEMPLOYED: 'Not working',
  DROPPED_OUT: 'Dropped out',
  AWAITING: 'Awaiting outcome',
  PENDING_VERIFICATION: 'Pending',
  VERIFIED: 'Verified',
  REJECTED: 'Rejected',
  SCHEDULED: 'Scheduled',
  SENT: 'Sent',
  RESPONDED: 'Answered',
  ESCALATED: 'Escalated',
};

export const GENDER_LABEL: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };

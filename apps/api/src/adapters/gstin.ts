import { GSTIN_PATTERN, isGstinWellFormed, type AdapterMode } from '@kaushalsetu/shared';
import { env } from '../env';
import { prisma } from '../db';
import { stableUnit } from '../lib/rng';

export interface GstinLookup {
  gstin: string;
  status: 'ACTIVE' | 'CANCELLED' | 'INVALID' | 'NOT_FOUND' | 'NOT_PROVIDED';
  formatValid: boolean;
  checksumValid: boolean;
  legalName: string | null;
  tradeName: string | null;
  constitution: string | null;
  registeredOn: string | null;
  cancelledOn: string | null;
  stateJurisdiction: string | null;
  message: string;
  source: AdapterMode;
}

export const gstinMode = (): AdapterMode => (env.GSTIN_API_KEY && env.GSTIN_API_URL ? 'LIVE' : 'DEMO');

const CONSTITUTION: Record<string, string> = {
  C: 'Private Limited Company',
  F: 'Limited Liability Partnership',
  P: 'Proprietorship',
};

function isoDaysBefore(seed: string, minDays: number, maxDays: number): string {
  const days = minDays + Math.floor(stableUnit(seed) * (maxDays - minDays));
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function emptyLookup(gstin: string, source: AdapterMode): GstinLookup {
  return {
    gstin,
    status: 'NOT_FOUND',
    formatValid: GSTIN_PATTERN.test(gstin),
    checksumValid: isGstinWellFormed(gstin),
    legalName: null,
    tradeName: null,
    constitution: null,
    registeredOn: null,
    cancelledOn: null,
    stateJurisdiction: null,
    message: '',
    source,
  };
}

// Real lookup through any GST verification API that accepts GET {GSTIN_API_URL}/{gstin} with an
// x-api-key header and returns the GSTN public-search field names (lgnm, tradeNam, sts, rgdt).
async function liveLookup(gstin: string): Promise<GstinLookup | null> {
  try {
    const url = `${(env.GSTIN_API_URL ?? '').replace(/\/$/, '')}/${gstin}`;
    const res = await fetch(url, {
      headers: { 'x-api-key': env.GSTIN_API_KEY ?? '', Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Record<string, unknown>;
    const d = ((body.data as Record<string, unknown> | undefined) ?? body) as Record<string, unknown>;
    const sts = String(d.sts ?? d.status ?? '').toLowerCase();
    const text = (key: string) => (typeof d[key] === 'string' && d[key] ? (d[key] as string) : null);
    return {
      ...emptyLookup(gstin, 'LIVE'),
      status: sts.includes('cancel') ? 'CANCELLED' : sts ? 'ACTIVE' : 'NOT_FOUND',
      legalName: text('lgnm') ?? text('legalName'),
      tradeName: text('tradeNam') ?? text('tradeName'),
      constitution: text('ctb'),
      registeredOn: text('rgdt'),
      cancelledOn: text('cxdt'),
      stateJurisdiction: text('stj'),
      message: 'Fetched from the GST registry.',
    };
  } catch {
    return null;
  }
}

// Demo registry: the Employer table plus deterministic registration metadata.
async function demoLookup(gstin: string): Promise<GstinLookup> {
  const base = emptyLookup(gstin, 'DEMO');
  if (!base.formatValid) return { ...base, status: 'INVALID', message: 'GSTIN does not follow the 15-character GST format.' };
  if (!base.checksumValid) return { ...base, status: 'INVALID', message: 'Checksum character does not match. GSTN could not have issued this number.' };
  const employer = await prisma.employer.findUnique({ where: { gstin } });
  if (!employer) return { ...base, message: 'Well-formed GSTIN, but it is not present in the registry.' };
  const common = {
    legalName: employer.name.toUpperCase(),
    tradeName: employer.name,
    constitution: CONSTITUTION[gstin[5]] ?? 'Proprietorship',
    registeredOn: isoDaysBefore(`${gstin}:reg`, 700, 3800),
    stateJurisdiction: `Maharashtra, ${employer.district}`,
  };
  if (!employer.gstinValid) {
    return {
      ...base,
      ...common,
      status: 'CANCELLED',
      cancelledOn: isoDaysBefore(`${gstin}:cx`, 120, 600),
      message: 'Registration cancelled by the tax officer. Employment claims after this date need field verification.',
    };
  }
  return { ...base, ...common, status: 'ACTIVE', message: 'Active regular taxpayer.' };
}

export async function lookupGstin(raw: string | null | undefined): Promise<GstinLookup> {
  const gstin = (raw ?? '').trim().toUpperCase();
  if (!gstin || gstin.startsWith('UNREG-')) {
    return {
      ...emptyLookup('', gstinMode()),
      status: 'NOT_PROVIDED',
      formatValid: false,
      checksumValid: false,
      message: 'No GSTIN on record for this employer. Enter it below to check the registry.',
    };
  }
  if (gstinMode() === 'LIVE') {
    const live = await liveLookup(gstin);
    if (live) return live;
  }
  return demoLookup(gstin);
}

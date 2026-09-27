// Folds a trainee's outcome events into their status at a point in time. Shared by the
// analytics engine, the seed script and the bot so every surface agrees on "status".

export interface OutcomeLike {
  eventType: string;
  occurredAt: Date;
  payload: unknown;
}

export type OutcomeStatus = 'EMPLOYED' | 'SELF_EMPLOYED' | 'APPRENTICE' | 'UNEMPLOYED' | 'DROPPED_OUT' | 'AWAITING';

export interface OutcomeState {
  status: OutcomeStatus;
  wage: number | null;
  firstPlacedAt: Date | null;
  startWage: number | null;
  employerName: string | null;
}

function num(payload: unknown, key: string): number | null {
  if (payload && typeof payload === 'object' && key in payload) {
    const v = (payload as Record<string, unknown>)[key];
    return typeof v === 'number' ? v : null;
  }
  return null;
}

function str(payload: unknown, key: string): string | null {
  if (payload && typeof payload === 'object' && key in payload) {
    const v = (payload as Record<string, unknown>)[key];
    return typeof v === 'string' ? v : null;
  }
  return null;
}

// `events` must be sorted by occurredAt ascending.
export function foldOutcomes(events: OutcomeLike[], at: Date): OutcomeState {
  const state: OutcomeState = { status: 'AWAITING', wage: null, firstPlacedAt: null, startWage: null, employerName: null };
  const t = at.getTime();
  for (const e of events) {
    if (e.occurredAt.getTime() > t) break;
    switch (e.eventType) {
      case 'PLACED':
      case 'JOB_SWITCH':
        state.status = 'EMPLOYED';
        state.wage = num(e.payload, 'wage');
        state.employerName = str(e.payload, 'employerName');
        break;
      case 'SELF_EMPLOYED':
        state.status = 'SELF_EMPLOYED';
        state.wage = num(e.payload, 'income');
        state.employerName = str(e.payload, 'businessName');
        break;
      case 'APPRENTICE':
        state.status = 'APPRENTICE';
        state.wage = num(e.payload, 'stipend');
        state.employerName = str(e.payload, 'establishment');
        break;
      case 'WAGE_CHANGE': {
        const w = num(e.payload, 'wage') ?? num(e.payload, 'income');
        if (w !== null) state.wage = w;
        break;
      }
      case 'ATTRITION':
      case 'UNEMPLOYED':
        state.status = 'UNEMPLOYED';
        state.wage = null;
        break;
      case 'DROPPED_OUT':
        state.status = 'DROPPED_OUT';
        state.wage = null;
        break;
      default:
        break;
    }
    if (state.firstPlacedAt === null && (state.status === 'EMPLOYED' || state.status === 'SELF_EMPLOYED' || state.status === 'APPRENTICE')) {
      state.firstPlacedAt = e.occurredAt;
      state.startWage = state.wage;
    }
  }
  return state;
}

export function isWorking(status: OutcomeStatus): boolean {
  return status === 'EMPLOYED' || status === 'SELF_EMPLOYED' || status === 'APPRENTICE';
}

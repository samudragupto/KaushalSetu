// DTOs exchanged between apps/api and apps/web.

export type Role = 'GOVT' | 'PROVIDER' | 'AGENT' | 'TRAINEE';
export type AdapterMode = 'LIVE' | 'DEMO';
export type Lang = 'mr' | 'hi' | 'en';

export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  title: string;
  providerId?: string | null;
  providerName?: string | null;
}

export interface AuthResponse {
  token: string;
  user: SessionUser;
}

export interface DashboardFilters {
  district?: string;
  sector?: string;
  course?: string;
  provider?: string;
  gender?: string;
  socialCategory?: string;
  ageBand?: string;
  cohortMonth?: string;
  asOf?: string;
}

export interface KpiValue {
  value: number | null;
  numerator: number;
  denominator: number;
  deltaVsState?: number | null;
}

export interface KpiSet {
  placementRate90: KpiValue;
  retention6: KpiValue;
  medianWage: KpiValue;
  wageGrowth12: KpiValue;
  selfEmploymentShare: KpiValue;
  verificationRate: KpiValue;
  traineesInScope: number;
  completedTraining: number;
}

export interface DistrictMetric {
  district: string;
  trainees: number;
  placementRate: number | null;
  retention6: number | null;
  medianWage: number | null;
  verificationRate: number | null;
}

export interface RetentionPoint {
  month: number;
  label: string;
  value: number | null;
  base: number;
}

export interface RetentionSeries {
  sector: string;
  short: string;
  points: RetentionPoint[];
}

export interface ReasonSlice {
  reason: string;
  label: string;
  count: number;
  pct: number;
}

export interface LeagueRow {
  providerId: string;
  name: string;
  type: string;
  district: string;
  trainees: number;
  placementRate: number | null;
  verifiedRate: number | null;
  retention6: number | null;
  medianWage: number | null;
  flags: { rule: string; title: string; severity: string }[];
}

export interface SkillGapRow {
  skillKey: string;
  skill: string;
  district: string;
  courseCode: string;
  courseName: string;
  sector: string;
  mentions: number;
  cohortSize: number;
  share: number;
  quotes: string[];
}

export interface AiSummary {
  mode: AdapterMode;
  engine: string;
  headline: string;
  bullets: string[];
  recommendation: string;
  generatedAt: string;
}

export interface DashboardPayload {
  asOf: string;
  filters: DashboardFilters;
  kpis: KpiSet;
  stateKpis: KpiSet;
  districts: DistrictMetric[];
  retention: RetentionSeries[];
  retentionOverall: RetentionSeries;
  reasons: ReasonSlice[];
  nonPlacementReasons: ReasonSlice[];
  dataVersion: number;
  weeklyPulse: { sent: number; responded: number; district: string | null };
}

export interface FilterOptions {
  districts: string[];
  sectors: string[];
  courses: { code: string; name: string; sector: string }[];
  providers: { id: string; name: string; district: string }[];
  genders: string[];
  socialCategories: string[];
  ageBands: string[];
  cohortMonths: string[];
  minDate: string;
  maxDate: string;
}

export interface AdapterStatus {
  key: string;
  label: string;
  mode: AdapterMode;
  detail: string;
}

export interface ChatButton {
  id: string;
  label: string;
}

export interface ChatMessage {
  id: string;
  direction: 'IN' | 'OUT';
  body: string;
  buttons: ChatButton[];
  meta: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}

export interface ChatSession {
  sessionId: string | null;
  state: string;
  lang: Lang;
  trainee: { id: string; name: string; unifiedId: string; district: string; course: string };
  messages: ChatMessage[];
  followUp: { id: string; milestone: string; status: string } | null;
  inputHint: 'buttons' | 'text' | 'upload' | 'closed';
  uploadToken: string | null;
}

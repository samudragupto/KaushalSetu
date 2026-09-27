// Response shapes for API endpoints that return the full trainee profile.

export interface TimelineItem {
  at: string;
  kind: string;
  title: string;
  detail: string;
  source: string;
}

export interface BridgeRecommendation {
  skillKey: string;
  title: string;
  hours: number;
  mode: string;
  nsqfLevel: number;
  skill: string;
  reportedByYou: boolean;
}

export interface TraineeDetail {
  id: string;
  unifiedId: string;
  fullName: string;
  dob: string;
  gender: string;
  socialCategory: string;
  district: string;
  phonePrimary: string;
  phoneAlternate: string | null;
  whatsappNumber: string | null;
  email: string | null;
  preferredLang: string;
  upskillOptIn: boolean;
  course: { code: string; name: string; sector: string; nsqfLevel: number } | null;
  provider: { id: string; name: string; district: string } | null;
  batchStart: string | null;
  batchEnd: string | null;
  currentStatus: string;
  currentWage: number | null;
  currentEmployer: string | null;
  timeline: TimelineItem[];
  followUps: { id: string; milestone: string; status: string; dueAt: string; sentAt: string | null; respondedAt: string | null; attempts: number }[];
  employmentRecords: { id: string; employer: string; designation: string; monthlyWage: number; startDate: string; endDate: string | null; status: string; verificationMethod: string | null }[];
  consents: { employmentTracking: boolean; wageTracking: boolean; publicAggregates: boolean };
  consentLedger: { id: string; scope: string; granted: boolean; capturedAt: string; channel: string }[];
  evidence: { id: string; kind: string; fileName: string; mimeType: string; sizeBytes: number; storage: string; createdAt: string }[];
  recommendations: BridgeRecommendation[];
  reportedSkills: string[];
  glosses: Record<string, string>;
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, BadgeCheck, CircleX, FileWarning, Scale } from 'lucide-react';
import type { KpiSet } from '@kaushalsetu/shared';
import { api } from '../../lib/api';
import { dateShort, inr, pct, STATUS_LABEL } from '../../lib/format';
import { Chip, Drawer, ErrorState, Skeleton, STATUS_TONE } from '../ui';
import { DataTable, type Column } from '../ui/DataTable';

interface DrillRecord {
  id: string;
  trainee: { id: string; maskedName: string; maskedId: string; district: string };
  employer: { name: string; gstin: string; gstinValid: boolean };
  designation: string;
  monthlyWage: number;
  startDate: string;
  status: string;
  verificationMethod: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  flagged: boolean;
}

interface Drill {
  provider: { id: string; name: string; type: string; district: string; contact: string };
  kpis: KpiSet;
  state: KpiSet;
  alerts: { id: string; rule: string; title: string; severity: string; detail: string; ruleText: string; employer: { name: string; gstin: string; gstinValid: boolean } | null; createdAt: string }[];
  records: DrillRecord[];
}

function Compare({ label, mine, state, kind = 'pct' }: { label: string; mine: number | null; state: number | null; kind?: 'pct' | 'inr' }) {
  const worse = mine !== null && state !== null && mine < state;
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="text-[12px] text-muted">{label}</p>
      <p className={`num text-lg font-semibold ${worse ? 'text-danger' : 'text-ink'}`}>{kind === 'pct' ? pct(mine, 1) : inr(mine)}</p>
      <p className="num text-[11px] text-muted">State {kind === 'pct' ? pct(state, 1) : inr(state)}</p>
    </div>
  );
}

const RULE_ICON: Record<string, JSX.Element> = {
  PLACEMENT_VERIFICATION_GAP: <Scale className="h-4 w-4" strokeWidth={1.5} />,
  REJECTION_CLUSTER: <CircleX className="h-4 w-4" strokeWidth={1.5} />,
  EMPLOYER_CONCENTRATION: <AlertOctagon className="h-4 w-4" strokeWidth={1.5} />,
  WAGE_OUTLIER: <FileWarning className="h-4 w-4" strokeWidth={1.5} />,
};

export function ProviderDrawer({ providerId, onClose, asOf }: { providerId: string | null; onClose: () => void; asOf?: string }) {
  const q = useQuery({ queryKey: ['provider-drill', providerId, asOf], queryFn: () => api<Drill>(`/analytics/providers/${providerId}`, { query: { asOf } }), enabled: !!providerId, refetchInterval: 5000 });
  const [openRecord, setOpenRecord] = useState<DrillRecord | null>(null);
  const d = q.data;

  const columns: Column<DrillRecord>[] = [
    { key: 'trainee', header: 'Trainee', render: (r) => <div><p className="num text-[13px]">{r.trainee.maskedId}</p><p className="text-[12px] text-muted">{r.trainee.maskedName}</p></div>, sortValue: (r) => r.trainee.maskedId },
    { key: 'employer', header: 'Claimed employer', render: (r) => <div><p className="text-[13px]">{r.employer.name}</p>{!r.employer.gstinValid && <p className="text-[11px] text-danger">GSTIN invalid or cancelled</p>}</div>, sortValue: (r) => r.employer.name },
    { key: 'wage', header: 'Wage', align: 'right', render: (r) => <span className="num">{inr(r.monthlyWage)}</span>, sortValue: (r) => r.monthlyWage },
    { key: 'status', header: 'Status', render: (r) => <Chip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status] ?? r.status}</Chip>, sortValue: (r) => ({ REJECTED: 0, PENDING_VERIFICATION: 1, VERIFIED: 2 })[r.status] ?? 3, csv: (r) => r.status },
  ];

  return (
    <Drawer open={!!providerId} onClose={onClose} width={760} title={d?.provider.name ?? 'Provider'} subtitle={d ? `${d.provider.type === 'PRIVATE' ? 'Private institute' : d.provider.type} · ${d.provider.district}` : 'Loading'}>
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} compact />}
      {!d && !q.isError && (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      )}
      {d && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Compare label="Placement (90 days)" mine={d.kpis.placementRate90.value} state={d.state.placementRate90.value} />
            <Compare label="Verified" mine={d.kpis.verificationRate.value} state={d.state.verificationRate.value} />
            <Compare label="Retention 6m" mine={d.kpis.retention6.value} state={d.state.retention6.value} />
            <Compare label="Median wage" mine={d.kpis.medianWage.value} state={d.state.medianWage.value} kind="inr" />
          </div>

          <div>
            <h3 className="mb-2 text-[13px] font-semibold">Integrity alerts</h3>
            {d.alerts.length === 0 ? (
              <p className="rounded-lg border border-line px-3 py-3 text-[13px] text-muted">No integrity rule has tripped for this provider. Last sweep ran with the nightly job.</p>
            ) : (
              <ul className="space-y-2">
                {d.alerts.map((a) => (
                  <li key={a.id} className={`rounded-lg border p-3 ${a.severity === 'HIGH' ? 'border-[#F7CFCF] bg-danger-50/50' : 'border-[#F6DDB5] bg-warning-50/50'}`}>
                    <div className="flex items-start gap-2.5">
                      <span className={a.severity === 'HIGH' ? 'text-danger' : 'text-warning'}>{RULE_ICON[a.rule]}</span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink">{a.title}</p>
                        <p className="text-[13px] text-ink">{a.detail}</p>
                        <p className="mt-1 text-[12px] text-muted">
                          <span className="font-medium">Rule:</span> {a.ruleText}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-line">
            <div className="border-b border-line px-5 py-3">
              <h3 className="text-[13px] font-semibold">Employment records behind the numbers</h3>
              <p className="text-[12px] text-muted">Trainee identity is masked. Rejected claims are listed first; select one to see why.</p>
            </div>
            <DataTable
              rows={d.records}
              columns={columns}
              rowKey={(r) => r.id}
              exportName={`records-${d.provider.name.replace(/\W+/g, '-').toLowerCase()}`}
              searchText={(r) => `${r.employer.name} ${r.trainee.maskedId} ${r.status}`}
              searchPlaceholder="Search employer or status"
              onRowClick={setOpenRecord}
              initialSort={{ key: 'status', dir: 'asc' }}
              maxHeight={320}
              rowClassName={(r) => (r.status === 'REJECTED' ? 'bg-danger-50/40' : undefined)}
            />
          </div>

          {openRecord && (
            <div className="rounded-lg border border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold">
                    {openRecord.designation} at {openRecord.employer.name}
                  </p>
                  <p className="num text-[12px] text-muted">
                    {openRecord.trainee.maskedId} · claimed from {dateShort(openRecord.startDate)} · {inr(openRecord.monthlyWage)} per month
                  </p>
                </div>
                <Chip tone={STATUS_TONE[openRecord.status]} icon={openRecord.status === 'VERIFIED' ? <BadgeCheck className="h-3 w-3" strokeWidth={1.5} /> : undefined}>
                  {STATUS_LABEL[openRecord.status]}
                </Chip>
              </div>
              <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-1.5 text-[13px]">
                <dt className="text-muted">GSTIN on claim</dt>
                <dd className="num">
                  {openRecord.employer.gstin.startsWith('UNREG-') ? 'Not provided' : openRecord.employer.gstin} {!openRecord.employer.gstinValid && <span className="ml-1 text-danger">fails registry check</span>}
                </dd>
                <dt className="text-muted">Verification</dt>
                <dd>{openRecord.verificationMethod ? openRecord.verificationMethod.replace('_', ' ').toLowerCase() : 'not yet attempted'}</dd>
                {openRecord.rejectedAt && (
                  <>
                    <dt className="text-muted">Rejected on</dt>
                    <dd>{dateShort(openRecord.rejectedAt)}</dd>
                    <dt className="text-muted">Employer said</dt>
                    <dd className="text-danger">{openRecord.rejectionReason}</dd>
                  </>
                )}
              </dl>
              {openRecord.status === 'REJECTED' && (
                <p className="mt-3 rounded-md bg-grid px-3 py-2 text-[12px] text-muted">
                  This rejection counts towards the "Investigate provider" rule. The placement stays in the provider's claimed figure but is excluded from its verified rate, which is how the gap between the two columns in the league table opens up.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

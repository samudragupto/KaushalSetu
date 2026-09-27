import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ClipboardCheck, Copy, ExternalLink, Gauge, GitCompareArrows, Lightbulb, Link2, ShieldAlert, Users } from 'lucide-react';
import { ATTRITION_REASON_LABELS, MILESTONES, type KpiSet, type SkillGapRow } from '@kaushalsetu/shared';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { dateShort, inr, pct, STATUS_LABEL } from '../lib/format';
import { itemVariants, listVariants } from '../lib/motion';
import { PageHeader } from '../components/layout/AppShell';
import { Button, Card, CardHeader, Chip, EmptyState, ErrorState, Skeleton, STATUS_TONE } from '../components/ui';
import { DataTable, type Column } from '../components/ui/DataTable';

interface Overview {
  provider: { id: string; name: string; type: string; district: string };
  kpis: KpiSet;
  state: KpiSet;
  reasons: { reason: string; count: number; pct: number }[];
  skillGaps: SkillGapRow[];
  alerts: { id: string; title: string; detail: string; severity: string; ruleText: string }[];
}

interface TraineeRow {
  id: string;
  name: string;
  unifiedId: string;
  maskedPhone: string | null;
  course: string;
  batchEnd: string | null;
  status: string;
  wage: number | null;
  employer: string | null;
  milestones: Record<string, string | null>;
  verification: string | null;
}

interface PendingRow {
  id: string;
  trainee: string;
  unifiedId: string;
  employer: string;
  gstinOnRecord: boolean;
  designation: string;
  monthlyWage: number;
  createdAt: string;
  ageDays: number;
  link: string | null;
}

const MS_DOT: Record<string, string> = {
  RESPONDED: 'bg-success',
  SENT: 'bg-primary',
  ESCALATED: 'bg-danger',
  SCHEDULED: 'bg-[#D1D5DB]',
};

function ScoreBar({ label, mine, state, kind = 'pct' }: { label: string; mine: number | null; state: number | null; kind?: 'pct' | 'inr' }) {
  const max = kind === 'pct' ? 1 : Math.max(mine ?? 0, state ?? 0) * 1.15 || 1;
  const better = mine !== null && state !== null && mine >= state;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] text-muted">{label}</p>
        <p className={clsx('num text-lg font-semibold', better ? 'text-ink' : 'text-danger')}>{kind === 'pct' ? pct(mine, 1) : inr(mine)}</p>
      </div>
      <div className="relative mt-1.5 h-2 rounded-full bg-grid">
        <motion.div className={clsx('h-2 rounded-full', better ? 'bg-primary' : 'bg-danger')} initial={{ width: 0 }} animate={{ width: `${((mine ?? 0) / max) * 100}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} />
        {state !== null && <span className="absolute -top-1 h-4 w-0.5 rounded bg-navy" style={{ left: `${(state / max) * 100}%` }} title="State average" />}
      </div>
      <p className="num mt-1 text-[11px] text-muted">State average {kind === 'pct' ? pct(state, 1) : inr(state)}</p>
    </div>
  );
}

export default function ProviderDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const overview = useQuery({ queryKey: ['provider-overview'], queryFn: () => api<Overview>('/provider/overview'), refetchInterval: 5000 });
  const trainees = useQuery({ queryKey: ['provider-trainees'], queryFn: () => api<TraineeRow[]>('/provider/trainees'), refetchInterval: 10000 });
  const pending = useQuery({ queryKey: ['provider-pending'], queryFn: () => api<PendingRow[]>('/provider/verifications'), refetchInterval: 5000 });
  const [copied, setCopied] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const makeLink = useMutation({
    mutationFn: (id: string) => api<{ link: string }>(`/provider/verifications/${id}/link`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provider-pending'] }),
  });

  const o = overview.data;
  const copy = async (id: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(id);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      window.prompt('Copy this verification link', link);
    }
  };

  const traineeCols: Column<TraineeRow>[] = [
    { key: 'name', header: 'Trainee', render: (r) => <div><p className="font-medium">{r.name}</p><p className="num text-[12px] text-muted">{r.unifiedId}</p></div>, sortValue: (r) => r.name, csv: (r) => r.name },
    { key: 'course', header: 'Course', render: (r) => <span className="text-[13px]">{r.course}</span>, sortValue: (r) => r.course },
    { key: 'batch', header: 'Batch end', render: (r) => <span className="num text-[13px]">{dateShort(r.batchEnd)}</span>, sortValue: (r) => r.batchEnd ?? '' },
    { key: 'status', header: 'Status', render: (r) => <Chip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Chip>, sortValue: (r) => r.status, csv: (r) => STATUS_LABEL[r.status] },
    { key: 'wage', header: 'Wage', align: 'right', render: (r) => <span className="num">{inr(r.wage)}</span>, sortValue: (r) => r.wage },
    {
      key: 'milestones',
      header: 'Check-ins 3 · 6 · 12 · 24',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {MILESTONES.map((m) => {
            const st = r.milestones[m];
            return <span key={m} title={`${m.replace('MONTH_', 'Month ')}: ${st ? STATUS_LABEL[st] : 'not due'}`} className={clsx('h-2.5 w-2.5 rounded-full', st ? MS_DOT[st] : 'border border-line bg-white')} />;
          })}
        </div>
      ),
      csv: (r) => MILESTONES.map((m) => `${m}:${r.milestones[m] ?? '-'}`).join(' '),
    },
    { key: 'verification', header: 'Placement check', render: (r) => (r.verification ? <Chip tone={STATUS_TONE[r.verification]}>{STATUS_LABEL[r.verification]}</Chip> : <span className="text-[12px] text-muted">—</span>), sortValue: (r) => r.verification ?? '' },
  ];

  const pendingCols: Column<PendingRow>[] = [
    { key: 'trainee', header: 'Trainee', render: (r) => <div><p className="font-medium">{r.trainee}</p><p className="num text-[12px] text-muted">{r.unifiedId}</p></div>, sortValue: (r) => r.trainee },
    { key: 'employer', header: 'Employer', render: (r) => <div><p className="text-[13px]">{r.employer}</p><p className="text-[12px] text-muted">{r.designation}{r.gstinOnRecord ? '' : ' · no GSTIN on record'}</p></div>, sortValue: (r) => r.employer },
    { key: 'wage', header: 'Wage', align: 'right', render: (r) => <span className="num">{inr(r.monthlyWage)}</span>, sortValue: (r) => r.monthlyWage },
    { key: 'age', header: 'Waiting', align: 'right', render: (r) => <span className={clsx('num', r.ageDays > 14 ? 'text-danger' : 'text-ink')}>{r.ageDays} d</span>, sortValue: (r) => r.ageDays },
    {
      key: 'link',
      header: 'Employer link',
      render: (r) =>
        r.link ? (
          <div className="flex gap-1">
            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); copy(r.id, r.link as string); }} icon={<Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}>
              {copied === r.id ? 'Copied' : 'Copy'}
            </Button>
            <a href={new URL(r.link).pathname} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex h-8 items-center rounded-lg border border-line px-2 text-muted transition-colors hover:border-primary-200 hover:text-primary-700" aria-label="Open link">
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
            </a>
          </div>
        ) : (
          <Button size="sm" variant="secondary" loading={makeLink.isPending && makeLink.variables === r.id} onClick={(e) => { e.stopPropagation(); makeLink.mutate(r.id); }} icon={<Link2 className="h-3.5 w-3.5" strokeWidth={1.5} />}>
            Create link
          </Button>
        ),
      csv: (r) => r.link ?? '',
    },
  ];

  const statuses = ['EMPLOYED', 'SELF_EMPLOYED', 'APPRENTICE', 'UNEMPLOYED', 'AWAITING'];
  const rows = statusFilter ? trainees.data?.filter((t) => t.status === statusFilter) : trainees.data;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Institute dashboard" title={o?.provider.name ?? user?.providerName ?? 'Your institute'} subtitle={o ? `${o.kpis.traineesInScope.toLocaleString('en-IN')} trainees tracked · ${o.provider.district} district` : 'Loading your scorecard'} />

      {o && o.alerts.length > 0 && (
        <div className="space-y-2">
          {o.alerts.map((a) => (
            <div key={a.id} className="flex gap-3 rounded-lg border border-[#F7CFCF] bg-danger-50 px-4 py-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-danger" strokeWidth={1.5} />
              <div>
                <p className="text-[13px] font-semibold text-danger">{a.title}</p>
                <p className="text-[13px] text-ink">{a.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader icon={<Gauge className="h-4 w-4" strokeWidth={1.5} />} title="Scorecard against the state average" subtitle="The dark tick marks the Maharashtra average" />
          <div className="space-y-4 p-5">
            {overview.isError && <ErrorState error={overview.error} compact onRetry={() => overview.refetch()} />}
            {!o && !overview.isError && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            {o && (
              <>
                <ScoreBar label="Placement within 90 days" mine={o.kpis.placementRate90.value} state={o.state.placementRate90.value} />
                <ScoreBar label="Placements verified" mine={o.kpis.verificationRate.value} state={o.state.verificationRate.value} />
                <ScoreBar label="Retention at 6 months" mine={o.kpis.retention6.value} state={o.state.retention6.value} />
                <ScoreBar label="Median monthly wage" mine={o.kpis.medianWage.value} state={o.state.medianWage.value} kind="inr" />
              </>
            )}
          </div>
        </Card>
        <Card className="xl:col-span-7">
          <CardHeader icon={<ClipboardCheck className="h-4 w-4" strokeWidth={1.5} />} title="Placements waiting for employer confirmation" subtitle="Share the link with the employer's HR contact. Unverified placements do not count in your verified rate." />
          {pending.isError ? <ErrorState error={pending.error} onRetry={() => pending.refetch()} /> : <DataTable rows={pending.data} columns={pendingCols} rowKey={(r) => r.id} loading={!pending.data} exportName="pending-verifications" maxHeight={330} emptyTitle="Every reported placement has been confirmed" initialSort={{ key: 'age', dir: 'desc' }} />}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader icon={<GitCompareArrows className="h-4 w-4" strokeWidth={1.5} />} title="Why your trainees left or were not placed" />
          <div className="p-5">
            {!o && <Skeleton className="h-40" />}
            {o && o.reasons.length === 0 && <EmptyState title="No attrition or non-placement reported yet" />}
            {o && o.reasons.length > 0 && (
              <motion.ul className="space-y-2.5" variants={listVariants} initial="initial" animate="animate">
                {o.reasons.map((r) => (
                  <motion.li key={r.reason} variants={itemVariants}>
                    <div className="flex justify-between text-[13px]">
                      <span>{ATTRITION_REASON_LABELS[r.reason]}</span>
                      <span className="num">
                        {r.count} · {pct(r.pct)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-grid">
                      <motion.div className="h-1.5 rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${r.pct * 100}%` }} transition={{ duration: 0.7 }} />
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </div>
        </Card>
        <Card className="xl:col-span-7">
          <CardHeader icon={<Lightbulb className="h-4 w-4" strokeWidth={1.5} />} title="Skill gaps your trainees report" subtitle={o ? `Courses you run, ${o.provider.district} district` : undefined} />
          <div className="p-5">
            {!o && <Skeleton className="h-40" />}
            {o && o.skillGaps.length === 0 && <EmptyState title="No skill-gap mentions for your courses yet" />}
            {o && o.skillGaps.length > 0 && (
              <ul className="divide-y divide-grid">
                {o.skillGaps.map((g) => (
                  <li key={`${g.skillKey}${g.courseCode}`} className="py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-medium">{g.skill}</p>
                        <p className="text-[12px] text-muted">{g.courseName}</p>
                      </div>
                      <span className="num text-[12px]">
                        {g.mentions} of {g.cohortSize} not in work
                      </span>
                    </div>
                    {g.quotes[0] && <p className="mt-1 text-[12px] italic text-muted">"{g.quotes[0]}"</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader icon={<Users className="h-4 w-4" strokeWidth={1.5} />} title="Your trainees" subtitle="Outcome and follow-up status by milestone. Dots: green answered, teal sent, red escalated, grey scheduled." />
        {trainees.isError ? (
          <ErrorState error={trainees.error} onRetry={() => trainees.refetch()} />
        ) : (
          <DataTable
            rows={rows}
            columns={traineeCols}
            rowKey={(r) => r.id}
            loading={!trainees.data}
            searchText={(r) => `${r.name} ${r.unifiedId} ${r.course} ${r.employer ?? ''}`}
            searchPlaceholder="Search name, ID, course or employer"
            exportName="institute-trainees"
            maxHeight={520}
            initialSort={{ key: 'batch', dir: 'desc' }}
            toolbar={
              <div className="flex flex-wrap gap-1">
                <Chip active={!statusFilter} onClick={() => setStatusFilter(null)}>
                  All
                </Chip>
                {statuses.map((s) => (
                  <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? null : s)}>
                    {STATUS_LABEL[s]}
                  </Chip>
                ))}
              </div>
            }
          />
        )}
      </Card>
    </div>
  );
}

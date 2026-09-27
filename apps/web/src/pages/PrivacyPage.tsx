import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BookLock, ExternalLink, FileClock, Fingerprint, Globe2, ScrollText } from 'lucide-react';
import { api } from '../lib/api';
import { dateShort, pct } from '../lib/format';
import { itemVariants, listVariants } from '../lib/motion';
import { PageHeader } from '../components/layout/AppShell';
import { Card, CardHeader, Chip, ErrorState, Skeleton } from '../components/ui';
import { DataTable, type Column } from '../components/ui/DataTable';

interface ConsentSummary {
  total: number;
  ledgerSize: number;
  withdrawalsViaPortal: number;
  scopes: { scope: string; label: string; granted: number }[];
  ledger: { id: string; trainee: string; scope: string; granted: boolean; channel: string; capturedAt: string; sourceIp: string | null }[];
}

interface AuditRow {
  id: string;
  actorRole: string;
  actorName: string | null;
  action: string;
  reason: string | null;
  trainee: string | null;
  timestamp: string;
}

const SCOPE_LABEL: Record<string, string> = { employmentTracking: 'Employment follow-up', wageTracking: 'Wage tracking', publicAggregates: 'Public aggregates' };
const ACTION_LABEL: Record<string, string> = {
  REVEAL_TRAINEE_PROFILE: 'Opened trainee record',
  REVEAL_PHONE_FOR_CALL: 'Revealed phone for call',
  VIEW_EVIDENCE_FILE: 'Viewed uploaded proof',
  EMPLOYER_APPROVED_CLAIM: 'Employer approved claim',
  EMPLOYER_REJECTED_CLAIM: 'Employer rejected claim',
};

export default function PrivacyPage() {
  const consent = useQuery({ queryKey: ['privacy-consent'], queryFn: () => api<ConsentSummary>('/privacy/consent'), refetchInterval: 10000 });
  const audit = useQuery({ queryKey: ['privacy-audit'], queryFn: () => api<AuditRow[]>('/privacy/audit'), refetchInterval: 5000 });
  const c = consent.data;

  const ledgerCols: Column<ConsentSummary['ledger'][number]>[] = [
    { key: 'at', header: 'When', render: (r) => <span className="num text-[13px]">{dateShort(r.capturedAt)}</span>, sortValue: (r) => r.capturedAt },
    { key: 'trainee', header: 'Trainee', render: (r) => <span className="num">{r.trainee}</span>, sortValue: (r) => r.trainee },
    { key: 'scope', header: 'Scope', render: (r) => SCOPE_LABEL[r.scope], sortValue: (r) => r.scope, csv: (r) => SCOPE_LABEL[r.scope] },
    { key: 'granted', header: 'Decision', render: (r) => <Chip tone={r.granted ? 'success' : 'warning'}>{r.granted ? 'Granted' : 'Withdrawn'}</Chip>, sortValue: (r) => (r.granted ? 1 : 0), csv: (r) => (r.granted ? 'Granted' : 'Withdrawn') },
    { key: 'channel', header: 'Channel', render: (r) => <span className="text-[13px] capitalize">{r.channel.replace('_', ' ').toLowerCase()}</span>, sortValue: (r) => r.channel },
    { key: 'ip', header: 'Source', render: (r) => <span className="num text-[12px] text-muted">{r.sourceIp ?? '—'}</span>, csv: (r) => r.sourceIp ?? '' },
  ];
  const auditCols: Column<AuditRow>[] = [
    { key: 'at', header: 'When', render: (r) => <span className="num text-[13px]">{new Date(r.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</span>, sortValue: (r) => r.timestamp },
    { key: 'actor', header: 'Who', render: (r) => <div><p className="text-[13px]">{r.actorName ?? '—'}</p><p className="text-[11px] text-muted">{r.actorRole}</p></div>, sortValue: (r) => r.actorName ?? '', csv: (r) => `${r.actorName ?? ''} (${r.actorRole})` },
    { key: 'action', header: 'Action', render: (r) => ACTION_LABEL[r.action] ?? r.action, sortValue: (r) => r.action, csv: (r) => ACTION_LABEL[r.action] ?? r.action },
    { key: 'trainee', header: 'Trainee', render: (r) => <span className="num">{r.trainee ?? '—'}</span>, csv: (r) => r.trainee ?? '' },
    { key: 'reason', header: 'Stated reason', render: (r) => <span className="text-[13px] text-muted">{r.reason ?? '—'}</span>, csv: (r) => r.reason ?? '' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="DPDP Act 2023"
        title="Consent and audit"
        subtitle="Consent is an append-only ledger per trainee and scope. Every reveal of personal data is logged before the data leaves the server."
        actions={
          <a href="/public" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border-2 border-primary bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-600">
            <Globe2 className="h-4 w-4" strokeWidth={1.5} /> What the public sees <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
          </a>
        }
      />
      {consent.isError && <ErrorState error={consent.error} onRetry={() => consent.refetch()} />}
      <motion.div className="grid gap-3 md:grid-cols-4" variants={listVariants} initial="initial" animate="animate">
        {!c && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        {c?.scopes.map((s) => (
          <motion.div key={s.scope} variants={itemVariants}>
            <Card className="p-4" hover>
              <p className="text-[12px] text-muted">{s.label}</p>
              <p className="num mt-1 text-2xl font-semibold">{pct(s.granted / c.total, 1)}</p>
              <div className="mt-2 h-1.5 rounded-full bg-grid">
                <motion.div className="h-1.5 rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${(s.granted / c.total) * 100}%` }} transition={{ duration: 0.7 }} />
              </div>
              <p className="num mt-1.5 text-[11px] text-muted">
                {s.granted.toLocaleString('en-IN')} of {c.total.toLocaleString('en-IN')} trainees consent
              </p>
            </Card>
          </motion.div>
        ))}
        {c && (
          <motion.div variants={itemVariants}>
            <Card className="p-4" hover>
              <p className="text-[12px] text-muted">Ledger entries</p>
              <p className="num mt-1 text-2xl font-semibold">{c.ledgerSize.toLocaleString('en-IN')}</p>
              <p className="num mt-3 text-[11px] text-muted">{c.withdrawalsViaPortal} withdrawals made by trainees in the portal</p>
            </Card>
          </motion.div>
        )}
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader icon={<ScrollText className="h-4 w-4" strokeWidth={1.5} />} title="Consent ledger" subtitle="Latest 40 entries. Rows are never edited; a change of mind is a new row." />
          <DataTable rows={c?.ledger} columns={ledgerCols} rowKey={(r) => r.id} loading={!c} exportName="consent-ledger" maxHeight={420} initialSort={{ key: 'at', dir: 'desc' }} />
        </Card>
        <Card>
          <CardHeader icon={<FileClock className="h-4 w-4" strokeWidth={1.5} />} title="PII access log" subtitle="Record openings, phone reveals and employer decisions" />
          {audit.isError ? <ErrorState error={audit.error} onRetry={() => audit.refetch()} /> : <DataTable rows={audit.data} columns={auditCols} rowKey={(r) => r.id} loading={!audit.data} exportName="pii-audit-log" maxHeight={420} emptyTitle="No personal data has been revealed yet" emptyBody="Open a record in the trainee registry or a task in the call queue to see an entry appear here." initialSort={{ key: 'at', dir: 'desc' }} />}
        </Card>
      </div>

      <Card className="p-5">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: <Fingerprint className="h-4 w-4" strokeWidth={1.5} />, title: 'Masking by role', body: 'Lists show masked names, IDs and phones to the Secretary. Field agents see a phone number only after opening the task they are calling on.' },
            { icon: <BookLock className="h-4 w-4" strokeWidth={1.5} />, title: 'Purpose-bound access', body: 'A full record opens only with a stated reason, stored with the user and time. Employers see first name, masked ID and the claim they are asked about.' },
            { icon: <Globe2 className="h-4 w-4" strokeWidth={1.5} />, title: 'Public release', body: 'Public figures include only trainees who consented to public aggregates, and suppress any cell with fewer than 10 people.' },
          ].map((x) => (
            <div key={x.title}>
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <span className="text-primary">{x.icon}</span>
                {x.title}
              </p>
              <p className="mt-1 text-[13px] leading-5 text-muted">{x.body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

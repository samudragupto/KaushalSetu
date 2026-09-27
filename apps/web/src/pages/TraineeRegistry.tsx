import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, EyeOff, LockKeyhole, UserSearch } from 'lucide-react';
import { api } from '../lib/api';
import { dateShort, STATUS_LABEL } from '../lib/format';
import type { TraineeDetail } from '../lib/types';
import { PageHeader } from '../components/layout/AppShell';
import { Button, Card, Chip, Drawer, ErrorState, Field, Input, Modal, Select, STATUS_TONE } from '../components/ui';
import { DataTable, type Column } from '../components/ui/DataTable';
import { useFilterOptions } from '../components/dashboard/FilterBar';
import { Timeline } from '../components/dashboard/Timeline';

interface Row {
  id: string;
  maskedName: string;
  maskedId: string;
  maskedPhone: string | null;
  district: string;
  course: string;
  provider: string;
  status: string;
}

interface Page {
  total: number;
  page: number;
  pageSize: number;
  rows: Row[];
}

const REASONS = ['Grievance filed by the trainee on Aaple Sarkar', 'Field verification of a flagged placement', 'RTI reply preparation', 'Scheme audit by the Directorate'];

export default function TraineeRegistry() {
  const opts = useFilterOptions();
  const [district, setDistrict] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState<TraineeDetail | null>(null);

  const q = useQuery({
    queryKey: ['registry', district, status, search, page],
    queryFn: () => api<Page>('/trainees', { query: { district, status, search, page } }),
    placeholderData: (p) => p,
  });
  const reveal = useMutation({
    mutationFn: () => api<TraineeDetail>(`/trainees/${target?.id}/reveal`, { method: 'POST', body: { reason } }),
    onSuccess: (d) => {
      setDetail(d);
      setTarget(null);
      setReason('');
    },
  });

  const cols: Column<Row>[] = [
    { key: 'id', header: 'Unified ID', render: (r) => <span className="num">{r.maskedId}</span>, csv: (r) => r.maskedId },
    { key: 'name', header: 'Name', render: (r) => <span className="num text-muted">{r.maskedName}</span>, csv: (r) => r.maskedName },
    { key: 'phone', header: 'Mobile', render: (r) => <span className="num text-muted">{r.maskedPhone}</span>, csv: (r) => r.maskedPhone },
    { key: 'district', header: 'District', render: (r) => r.district, csv: (r) => r.district },
    { key: 'course', header: 'Course', render: (r) => <span className="text-[13px]">{r.course}</span>, csv: (r) => r.course },
    { key: 'status', header: 'Status', render: (r) => <Chip tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Chip>, csv: (r) => STATUS_LABEL[r.status] },
    {
      key: 'reveal',
      header: '',
      align: 'right',
      render: (r) => (
        <Button size="sm" onClick={() => setTarget(r)} icon={<LockKeyhole className="h-3.5 w-3.5" strokeWidth={1.5} />}>
          View record
        </Button>
      ),
      csv: () => '',
    },
  ];

  const data = q.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Individual records" title="Trainee registry" subtitle="Identity is masked in every list. Opening a record requires a stated reason and is written to the audit log." />
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-3">
          <Field label="District" className="w-[180px]">
            <Select value={district} onChange={(e) => { setDistrict(e.target.value); setPage(1); }}>
              <option value="">All districts</option>
              {opts.data?.districts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
          <Field label="Placement check" className="w-[180px]">
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">Any</option>
              <option value="PENDING_VERIFICATION">Pending</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
            </Select>
          </Field>
          <Field label="Unified ID contains" className="w-[200px]">
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="e.g. NSK-1001" className="num" />
          </Field>
          <div className="ml-auto flex items-center gap-2 pb-0.5">
            <span className="num text-[12px] text-muted">{data ? `${data.total.toLocaleString('en-IN')} trainees · page ${data.page} of ${pages}` : ''}</span>
            <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} icon={<ChevronLeft className="h-4 w-4" strokeWidth={1.5} />} aria-label="Previous page" />
            <Button size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} icon={<ChevronRight className="h-4 w-4" strokeWidth={1.5} />} aria-label="Next page" />
          </div>
        </div>
        {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <DataTable rows={data?.rows} columns={cols} rowKey={(r) => r.id} loading={!data} exportName={`trainee-registry-masked-p${page}`} emptyTitle="No trainees match these filters" />}
      </Card>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        title="Why do you need this record?"
        footer={
          <>
            <Button onClick={() => setTarget(null)}>Cancel</Button>
            <Button variant="primary" loading={reveal.isPending} disabled={reason.trim().length < 10} onClick={() => reveal.mutate()} icon={<UserSearch className="h-4 w-4" strokeWidth={1.5} />}>
              Open record
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-muted">
          You are about to see the name, phone numbers and full history of <span className="num text-ink">{target?.maskedId}</span>. This is logged with your name, the time and the reason below.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <Chip key={r} onClick={() => setReason(r)} active={reason === r}>
              {r}
            </Chip>
          ))}
        </div>
        <Field label="Reason (at least 10 characters)" className="mt-3" error={reveal.isError ? (reveal.error as Error).message : null}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="State the purpose" />
        </Field>
      </Modal>

      <Drawer open={!!detail} onClose={() => setDetail(null)} title={detail?.fullName ?? ''} subtitle={detail ? `${detail.unifiedId} · ${detail.district}` : undefined} width={640}>
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 rounded-lg border border-[#FBE3B5] bg-saffron-50 px-3 py-2 text-[12px] text-[#92400E]">
              <EyeOff className="h-4 w-4" strokeWidth={1.5} /> This view was recorded in the audit log.
            </div>
            <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-[13px]">
              <dt className="text-muted">Mobile</dt>
              <dd className="num">+91 {detail.phonePrimary}</dd>
              <dt className="text-muted">WhatsApp</dt>
              <dd className="num">{detail.whatsappNumber ? `+91 ${detail.whatsappNumber}` : '—'}</dd>
              <dt className="text-muted">Date of birth</dt>
              <dd className="num">{dateShort(detail.dob)}</dd>
              <dt className="text-muted">Category</dt>
              <dd>{detail.socialCategory}</dd>
              <dt className="text-muted">Course</dt>
              <dd>{detail.course?.name}</dd>
              <dt className="text-muted">Institute</dt>
              <dd>{detail.provider?.name}</dd>
              <dt className="text-muted">Consent</dt>
              <dd className="flex flex-wrap gap-1">
                <Chip tone={detail.consents.employmentTracking ? 'success' : 'warning'}>Follow-up</Chip>
                <Chip tone={detail.consents.wageTracking ? 'success' : 'warning'}>Wages</Chip>
                <Chip tone={detail.consents.publicAggregates ? 'success' : 'warning'}>Public totals</Chip>
              </dd>
            </dl>
            <div>
              <h3 className="mb-3 text-[13px] font-semibold">Timeline</h3>
              <Timeline items={detail.timeline} glosses={detail.glosses} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

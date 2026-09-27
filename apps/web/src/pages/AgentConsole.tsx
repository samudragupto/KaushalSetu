import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { AlarmClock, CheckCircle2, Clock3, Eye, Headset, Phone, PhoneCall, PhoneOff, Timer, TrendingUp } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { dateShort, inr, pct, STATUS_LABEL } from '../lib/format';
import { itemVariants, listVariants } from '../lib/motion';
import { PageHeader } from '../components/layout/AppShell';
import { Button, Card, CardHeader, Chip, EmptyState, ErrorState, Field, Input, Select, Skeleton, STATUS_TONE } from '../components/ui';
import type { TraineeDetail } from '../lib/types';
import { Timeline } from '../components/dashboard/Timeline';

interface QueueItem {
  id: string;
  status: 'QUEUED' | 'IN_CALL';
  createdAt: string;
  ageHours: number;
  slaBreached: boolean;
  assignee: string | null;
  milestone: string;
  attempts: number;
  trainee: { id: string; name: string; maskedId: string; maskedPhone: string; district: string; course: string; provider: string };
}

interface Stats {
  responseRate: number | null;
  followUpsSent30d: number;
  queued: number;
  resolved30d: number;
  resolvedToday: number;
  avgResolutionHours: number | null;
}

type Outcome = 'JOB' | 'SELF' | 'APPR' | 'NONE' | 'UNREACHABLE';

const OUTCOMES: { key: Outcome; label: string }[] = [
  { key: 'JOB', label: 'Job' },
  { key: 'SELF', label: 'Self-employed' },
  { key: 'APPR', label: 'Apprenticeship' },
  { key: 'NONE', label: 'Not working' },
  { key: 'UNREACHABLE', label: 'Could not reach' },
];

const REASONS = [
  ['LOW_WAGE', 'Low wage'],
  ['RELOCATION', 'Relocation'],
  ['WORKING_CONDITIONS', 'Working conditions'],
  ['SKILL_MISMATCH', 'Skill mismatch'],
  ['FAMILY', 'Family responsibilities'],
  ['HEALTH', 'Health'],
  ['OTHER', 'Other'],
];

function StatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4" hover>
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <p className="num mt-1.5 text-2xl font-semibold">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </Card>
  );
}

function OutcomeForm({ taskId, detail, onDone }: { taskId: string; detail: TraineeDetail; onDone: (msg: string) => void }) {
  const [outcome, setOutcome] = useState<Outcome>('JOB');
  const [f, setF] = useState<Record<string, string>>({ employerName: detail.currentEmployer ?? '', designation: '', wage: detail.currentWage ? String(detail.currentWage) : '', businessType: 'shop', income: '', udyam: '', establishment: '', stipend: '', reason: 'SKILL_MISMATCH', skillsText: '', notes: '' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const qc = useQueryClient();
  const resolve = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { outcome, notes: f.notes || undefined };
      if (outcome === 'JOB') Object.assign(body, { employerName: f.employerName, designation: f.designation, wage: f.wage });
      if (outcome === 'SELF') Object.assign(body, { businessType: f.businessType, income: f.income, udyam: f.udyam });
      if (outcome === 'APPR') Object.assign(body, { establishment: f.establishment, stipend: f.stipend });
      if (outcome === 'NONE') Object.assign(body, { reason: f.reason, skillsText: f.skillsText || undefined });
      return api<{ ok: boolean }>(`/agent/tasks/${taskId}/resolve`, { method: 'POST', body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-queue'] });
      qc.invalidateQueries({ queryKey: ['agent-stats'] });
      onDone(`${detail.fullName}: outcome recorded and task closed.`);
    },
  });
  const err = resolve.error instanceof ApiError ? (resolve.error.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors : undefined;
  const e = (k: string) => err?.[k]?.[0] ?? null;

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        resolve.mutate();
      }}
      className="space-y-3"
    >
      <div className="flex flex-wrap gap-1.5">
        {OUTCOMES.map((o) => (
          <Chip key={o.key} active={outcome === o.key} onClick={() => setOutcome(o.key)}>
            {o.label}
          </Chip>
        ))}
      </div>
      {outcome === 'JOB' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Employer" error={e('employerName')}>
            <Input value={f.employerName} onChange={set('employerName')} placeholder="Company name" />
          </Field>
          <Field label="Designation" error={e('designation')}>
            <Input value={f.designation} onChange={set('designation')} placeholder="e.g. CNC Operator" />
          </Field>
          <Field label="Monthly wage (₹)" error={e('wage')}>
            <Input value={f.wage} onChange={set('wage')} inputMode="numeric" className="num" />
          </Field>
        </div>
      )}
      {outcome === 'SELF' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Business type">
            <Select value={f.businessType} onChange={set('businessType')}>
              <option value="shop">Shop or parlour</option>
              <option value="freelance">Freelance</option>
              <option value="gig">Gig work</option>
            </Select>
          </Field>
          <Field label="Monthly income (₹)" error={e('income')}>
            <Input value={f.income} onChange={set('income')} inputMode="numeric" className="num" />
          </Field>
          <Field label="Udyam number (optional)" error={e('udyam')}>
            <Input value={f.udyam} onChange={set('udyam')} placeholder="UDYAM-MH-26-0012345" className="num" />
          </Field>
        </div>
      )}
      {outcome === 'APPR' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Establishment" error={e('establishment')}>
            <Input value={f.establishment} onChange={set('establishment')} />
          </Field>
          <Field label="Monthly stipend (₹)" error={e('stipend')}>
            <Input value={f.stipend} onChange={set('stipend')} inputMode="numeric" className="num" />
          </Field>
        </div>
      )}
      {outcome === 'NONE' && (
        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          <Field label="Main reason">
            <Select value={f.reason} onChange={set('reason')}>
              {REASONS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Skills the trainee said were missing" hint="Feeds the skill-gap report. Marathi, Hindi or English are all understood.">
            <Input value={f.skillsText} onChange={set('skillsText')} placeholder="e.g. 5-axis CNC programming, spoken English" />
          </Field>
        </div>
      )}
      <Field label={outcome === 'UNREACHABLE' ? 'Call attempts (required)' : 'Call notes'} error={e('notes')}>
        <textarea
          value={f.notes}
          onChange={set('notes')}
          rows={2}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:border-[#cfd3da] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
          placeholder={outcome === 'UNREACHABLE' ? 'Numbers tried, times, who answered' : 'Anything the next caller should know'}
        />
      </Field>
      {resolve.isError && !err && <ErrorState error={resolve.error} compact />}
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={resolve.isPending} icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />}>
          Save outcome and close task
        </Button>
      </div>
    </form>
  );
}

export default function AgentConsole() {
  const qc = useQueryClient();
  const queue = useQuery({ queryKey: ['agent-queue'], queryFn: () => api<QueueItem[]>('/agent/queue'), refetchInterval: 5000 });
  const stats = useQuery({ queryKey: ['agent-stats'], queryFn: () => api<Stats>('/agent/stats'), refetchInterval: 10000 });
  const [active, setActive] = useState<{ taskId: string; detail: TraineeDetail } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const open = useMutation({
    mutationFn: (taskId: string) => api<{ task: { id: string }; trainee: TraineeDetail }>(`/agent/tasks/${taskId}/open`, { method: 'POST' }),
    onSuccess: (res) => {
      setActive({ taskId: res.task.id, detail: res.trainee });
      setFlash(null);
      qc.invalidateQueries({ queryKey: ['agent-queue'] });
    },
  });
  const s = stats.data;
  const d = active?.detail;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Escalated follow-ups" title="Call queue" subtitle="Trainees who did not answer two WhatsApp check-ins, oldest first. Opening a task reveals the phone number and is recorded in the audit log." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<Headset className="h-4 w-4" strokeWidth={1.5} />} label="Waiting in queue" value={s ? String(s.queued) : '—'} sub="escalated check-ins" />
        <StatTile icon={<TrendingUp className="h-4 w-4" strokeWidth={1.5} />} label="WhatsApp response rate" value={s ? pct(s.responseRate, 1) : '—'} sub={s ? `${s.followUpsSent30d.toLocaleString('en-IN')} check-ins, last 30 days` : undefined} />
        <StatTile icon={<Timer className="h-4 w-4" strokeWidth={1.5} />} label="Avg resolution time" value={s?.avgResolutionHours !== null && s?.avgResolutionHours !== undefined ? `${s.avgResolutionHours.toFixed(1)} h` : '—'} sub="escalation to closed call" />
        <StatTile icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />} label="Resolved" value={s ? String(s.resolved30d) : '—'} sub={s ? `${s.resolvedToday} today, 30-day total shown` : undefined} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[400px_1fr]">
        <Card>
          <CardHeader icon={<AlarmClock className="h-4 w-4" strokeWidth={1.5} />} title="Queue" subtitle="Sorted by time since escalation. Red means past the 72-hour SLA." />
          {queue.isError && <ErrorState error={queue.error} onRetry={() => queue.refetch()} />}
          {!queue.data && !queue.isError && (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )}
          {queue.data && queue.data.length === 0 && <EmptyState icon={<CheckCircle2 className="h-5 w-5" strokeWidth={1.5} />} title="Queue is clear" body="Every escalated trainee has been called. New escalations arrive after two unanswered WhatsApp check-ins." />}
          {queue.data && queue.data.length > 0 && (
            <motion.ul className="scrollbar-thin max-h-[640px] divide-y divide-grid overflow-y-auto" variants={listVariants} initial="initial" animate="animate">
              {queue.data.map((item) => (
                <motion.li key={item.id} variants={itemVariants}>
                  <button
                    type="button"
                    onClick={() => open.mutate(item.id)}
                    className={clsx('flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-primary-50/50', active?.taskId === item.id && 'bg-primary-50')}
                  >
                    <span className={clsx('mt-1 h-2 w-2 shrink-0 rounded-full', item.slaBreached ? 'bg-danger' : item.ageHours > 48 ? 'bg-warning' : 'bg-success')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-ink">{item.trainee.name}</span>
                        <span className={clsx('num shrink-0 text-[12px]', item.slaBreached ? 'text-danger' : 'text-muted')}>
                          {item.ageHours < 48 ? `${item.ageHours} h` : `${Math.floor(item.ageHours / 24)} d`}
                        </span>
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        {item.milestone} · {item.trainee.course} · {item.trainee.district}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[12px]">
                        <span className="num text-muted">{item.trainee.maskedPhone}</span>
                        {item.status === 'IN_CALL' && <Chip tone="primary">In call{item.assignee ? ` · ${item.assignee.split(' ')[0]}` : ''}</Chip>}
                      </span>
                    </span>
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </Card>

        <div>
          <AnimatePresence mode="wait">
            {flash && !active && (
              <motion.div key="flash" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4 flex items-center gap-2 rounded-lg border border-[#CDEBD7] bg-success-50 px-4 py-3 text-[13px] text-success">
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} /> {flash}
              </motion.div>
            )}
          </AnimatePresence>
          {open.isPending && <Skeleton className="h-[520px]" />}
          {open.isError && <ErrorState error={open.error} />}
          {!active && !open.isPending && (
            <Card className="flex min-h-[420px] items-center justify-center">
              <EmptyState icon={<PhoneCall className="h-5 w-5" strokeWidth={1.5} />} title="Select a trainee to start a call" body="The full phone number, course history and last known employer appear here. Log what the trainee tells you; it goes through the same pipeline as a WhatsApp reply." />
            </Card>
          )}
          {active && d && !open.isPending && (
            <motion.div key={active.taskId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
                  <div>
                    <p className="text-lg font-semibold">{d.fullName}</p>
                    <p className="num text-[12px] text-muted">
                      {d.unifiedId} · {d.district}
                    </p>
                    <p className="mt-1 text-[13px]">
                      {d.course?.name} · {d.provider?.name}
                    </p>
                  </div>
                  <div className="space-y-1.5 text-right">
                    <a href={`tel:+91${d.phonePrimary}`} className="num inline-flex items-center gap-2 rounded-lg border-2 border-primary bg-primary px-3 py-1.5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-600">
                      <Phone className="h-4 w-4" strokeWidth={1.5} /> +91 {d.phonePrimary}
                    </a>
                    {d.phoneAlternate && (
                      <p className="num flex items-center justify-end gap-1.5 text-[12px] text-muted">
                        <PhoneOff className="h-3 w-3" strokeWidth={1.5} /> Alternate +91 {d.phoneAlternate}
                      </p>
                    )}
                    <p className="flex items-center justify-end gap-1 text-[11px] text-muted">
                      <Eye className="h-3 w-3" strokeWidth={1.5} /> Number reveal logged to audit
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
                  <div>
                    <p className="text-[12px] text-muted">Last known status</p>
                    <Chip tone={STATUS_TONE[d.currentStatus]}>{STATUS_LABEL[d.currentStatus]}</Chip>
                  </div>
                  <div>
                    <p className="text-[12px] text-muted">Last employer</p>
                    <p className="text-[13px]">{d.currentEmployer ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[12px] text-muted">Last wage</p>
                    <p className="num text-[13px]">{inr(d.currentWage)}</p>
                  </div>
                </div>
              </Card>
              <Card>
                <CardHeader title="Log the call outcome" subtitle="Same branches as the WhatsApp bot" />
                <div className="p-5">
                  <OutcomeForm
                    key={active.taskId}
                    taskId={active.taskId}
                    detail={d}
                    onDone={(msg) => {
                      setActive(null);
                      setFlash(msg);
                    }}
                  />
                </div>
              </Card>
              <Card>
                <CardHeader icon={<Clock3 className="h-4 w-4" strokeWidth={1.5} />} title="History" subtitle={`Batch ended ${dateShort(d.batchEnd)}`} />
                <div className="p-5">
                  <Timeline items={d.timeline} glosses={d.glosses} />
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { BadgeCheck, Building2, CircleAlert, CircleCheck, CircleX, KeyRound, Lock, Search, ShieldCheck, UserRound } from 'lucide-react';
import { api, ApiError, fieldError } from '../lib/api';
import { dateShort, inr } from '../lib/format';
import { Logo } from '../components/layout/Logo';
import { Button, Chip, ErrorState, Field, Input, ModeBadge, Skeleton } from '../components/ui';

interface Gstin {
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
  source: 'LIVE' | 'DEMO';
}

interface Verification {
  status: 'OPEN' | 'DECIDED' | 'EXPIRED';
  demoMode: boolean;
  expiresAt: string;
  record: { designation: string; monthlyWage: number; previousWage: number | null; startDate: string; status: string; rejectionReason: string | null; decidedAt: string | null };
  trainee: { maskedName: string; firstName: string; maskedId: string; maskedPhone: string; course: string; provider: string; batchEnd: string | null };
  employer: { name: string; district: string; gstin: string | null };
  gstin: Gstin;
}

const GSTIN_TONE: Record<Gstin['status'], { tone: 'success' | 'danger' | 'warning' | 'neutral'; label: string }> = {
  ACTIVE: { tone: 'success', label: 'Active' },
  CANCELLED: { tone: 'danger', label: 'Cancelled' },
  INVALID: { tone: 'danger', label: 'Invalid' },
  NOT_FOUND: { tone: 'warning', label: 'Not found' },
  NOT_PROVIDED: { tone: 'neutral', label: 'Not on record' },
};

function GstinCard({ g, onCheck, checking }: { g: Gstin; onCheck: (v: string) => void; checking: boolean }) {
  const [value, setValue] = useState(g.gstin);
  const t = GSTIN_TONE[g.status];
  return (
    <div className={clsx('rounded-lg border p-4', g.status === 'ACTIVE' ? 'border-[#CDEBD7] bg-success-50/40' : g.status === 'NOT_PROVIDED' ? 'border-line' : 'border-[#F7CFCF] bg-danger-50/40')}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold">
          <Building2 className="h-4 w-4 text-muted" strokeWidth={1.5} /> GSTIN registry check
        </p>
        <span className="flex items-center gap-1.5">
          <Chip tone={t.tone} icon={g.status === 'ACTIVE' ? <CircleCheck className="h-3 w-3" strokeWidth={1.5} /> : <CircleAlert className="h-3 w-3" strokeWidth={1.5} />}>
            {t.label}
          </Chip>
          <ModeBadge mode={g.source} />
        </span>
      </div>
      {g.gstin && <p className="num mt-2 text-[15px] font-semibold tracking-wide">{g.gstin}</p>}
      {g.legalName && (
        <dl className="mt-2 grid grid-cols-[120px_1fr] gap-y-1 text-[13px]">
          <dt className="text-muted">Legal name</dt>
          <dd>{g.legalName}</dd>
          <dt className="text-muted">Constitution</dt>
          <dd>{g.constitution}</dd>
          <dt className="text-muted">Registered on</dt>
          <dd className="num">{dateShort(g.registeredOn)}</dd>
          {g.cancelledOn && (
            <>
              <dt className="text-muted">Cancelled on</dt>
              <dd className="num text-danger">{dateShort(g.cancelledOn)}</dd>
            </>
          )}
          <dt className="text-muted">Jurisdiction</dt>
          <dd>{g.stateJurisdiction}</dd>
        </dl>
      )}
      <p className={clsx('mt-2 text-[12px]', g.status === 'ACTIVE' ? 'text-success' : g.status === 'NOT_PROVIDED' ? 'text-muted' : 'text-danger')}>{g.message}</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onCheck(value);
        }}
      >
        <Input value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} placeholder="27ABCDE1234F1Z5" maxLength={15} className="num uppercase" aria-label="GSTIN" />
        <Button type="submit" size="md" loading={checking} icon={<Search className="h-4 w-4" strokeWidth={1.5} />}>
          Check
        </Button>
      </form>
    </div>
  );
}

export default function VerifyPage() {
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['verify', token], queryFn: () => api<Verification>(`/verify/${token}`, { auth: 'none' }), retry: false });
  const [gstinOverride, setGstinOverride] = useState<Gstin | null>(null);
  const [otpInfo, setOtpInfo] = useState<{ channel: string; demoOtp?: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const check = useMutation({ mutationFn: (gstin: string) => api<Gstin>(`/verify/${token}/gstin`, { method: 'POST', body: { gstin }, auth: 'none' }), onSuccess: setGstinOverride });
  const sendOtp = useMutation({ mutationFn: () => api<{ channel: string; demoOtp?: string }>(`/verify/${token}/otp`, { method: 'POST', auth: 'none' }), onSuccess: setOtpInfo });
  const decide = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT') =>
      api<{ status: string }>(`/verify/${token}/decision`, {
        method: 'POST',
        auth: 'none',
        body: { otp, decision, approverName: name, reason: decision === 'REJECT' ? reason : undefined, gstin: gstinOverride?.status === 'ACTIVE' ? gstinOverride.gstin : undefined },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['verify', token] }),
  });

  const v = q.data;
  const gstin = gstinOverride ?? v?.gstin;
  const decided = v?.status === 'DECIDED';

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
          <Logo />
          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.5} /> Secure employer verification
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-6">
        {q.isError && (
          <div className="rounded-lg border border-line bg-white p-6 text-center">
            <CircleX className="mx-auto h-8 w-8 text-danger" strokeWidth={1.5} />
            <p className="mt-2 font-semibold">This verification link cannot be opened</p>
            <p className="mt-1 text-sm text-muted">{q.error instanceof ApiError ? q.error.message : 'Please try again later.'}</p>
          </div>
        )}
        {q.isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-40" />
            <Skeleton className="h-48" />
          </div>
        )}
        {v && gstin && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">Skill Development Department, Government of Maharashtra</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.01em]">Please confirm an employment claim</h1>
              <p className="mt-1 text-sm text-muted">
                A trainee from a state-funded skilling programme has named {v.employer.name} as their employer. Your confirmation takes under a minute and is recorded against this link only.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-line bg-white p-4 shadow-card">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <UserRound className="h-4 w-4 text-muted" strokeWidth={1.5} /> Trainee
                </p>
                <dl className="mt-2 grid grid-cols-[110px_1fr] gap-y-1 text-[13px]">
                  <dt className="text-muted">Name</dt>
                  <dd>
                    {v.trainee.firstName} <span className="num text-muted">({v.trainee.maskedName})</span>
                  </dd>
                  <dt className="text-muted">Unified ID</dt>
                  <dd className="num">{v.trainee.maskedId}</dd>
                  <dt className="text-muted">Mobile</dt>
                  <dd className="num">{v.trainee.maskedPhone}</dd>
                  <dt className="text-muted">Trained in</dt>
                  <dd>{v.trainee.course}</dd>
                  <dt className="text-muted">Institute</dt>
                  <dd>{v.trainee.provider}</dd>
                </dl>
                <p className="mt-3 text-[11px] text-muted">Only the details needed to identify the person are shown.</p>
              </div>
              <div className="rounded-lg border border-line bg-white p-4 shadow-card">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <BadgeCheck className="h-4 w-4 text-muted" strokeWidth={1.5} /> What the trainee reported
                </p>
                <dl className="mt-2 grid grid-cols-[110px_1fr] gap-y-1 text-[13px]">
                  <dt className="text-muted">Employer</dt>
                  <dd className="font-medium">{v.employer.name}</dd>
                  <dt className="text-muted">Designation</dt>
                  <dd>{v.record.designation}</dd>
                  <dt className="text-muted">Monthly wage</dt>
                  <dd className="num font-semibold">
                    {inr(v.record.monthlyWage)}
                    {v.record.previousWage !== null && v.record.previousWage !== v.record.monthlyWage && <span className="ml-1 font-normal text-muted">(was {inr(v.record.previousWage)})</span>}
                  </dd>
                  <dt className="text-muted">Working since</dt>
                  <dd className="num">{dateShort(v.record.startDate)}</dd>
                </dl>
                {v.record.previousWage !== null && <p className="mt-3 rounded-md bg-primary-50 px-2 py-1.5 text-[12px] text-primary-700">This is a wage update for an existing employee. Please confirm the new monthly wage.</p>}
              </div>
            </div>

            <GstinCard g={gstin} onCheck={(val) => check.mutate(val)} checking={check.isPending} />
            {check.isError && <ErrorState error={check.error} compact />}

            <AnimatePresence mode="wait">
              {decided ? (
                <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={clsx('rounded-lg border p-5', v.record.status === 'VERIFIED' ? 'border-[#CDEBD7] bg-success-50' : 'border-[#F7CFCF] bg-danger-50')}>
                  <div className="flex items-start gap-3">
                    {v.record.status === 'VERIFIED' ? <CircleCheck className="h-7 w-7 text-success" strokeWidth={1.5} /> : <CircleX className="h-7 w-7 text-danger" strokeWidth={1.5} />}
                    <div>
                      <p className="text-base font-semibold">{v.record.status === 'VERIFIED' ? 'Employment confirmed. Thank you.' : 'Claim rejected. Thank you for flagging it.'}</p>
                      <p className="mt-1 text-[13px] text-ink">
                        Recorded on {dateShort(v.record.decidedAt)}. {v.record.status === 'VERIFIED' ? `${v.trainee.firstName}'s placement now counts as verified in the state dashboard.` : 'The claim is excluded from verified placement and reviewed under the provider integrity rules.'}
                      </p>
                      {v.record.rejectionReason && <p className="mt-1 text-[13px] text-muted">Reason given: {v.record.rejectionReason}</p>}
                    </div>
                  </div>
                </motion.div>
              ) : v.status === 'EXPIRED' ? (
                <motion.div key="expired" className="rounded-lg border border-line bg-white p-5 text-sm text-muted">
                  This link expired on {dateShort(v.expiresAt)}. The training provider can send a fresh one.
                </motion.div>
              ) : (
                <motion.div key="open" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-line bg-white p-4 shadow-card">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold">
                    <ShieldCheck className="h-4 w-4 text-muted" strokeWidth={1.5} /> Confirm with a one-time password
                  </p>
                  {!otpInfo ? (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Button variant="primary" onClick={() => sendOtp.mutate()} loading={sendOtp.isPending} icon={<KeyRound className="h-4 w-4" strokeWidth={1.5} />}>
                        Send OTP to HR contact
                      </Button>
                      <span className="text-[12px] text-muted">The code goes to the HR contact registered with this employer.</span>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <p className="text-[13px] text-muted">OTP sent by {otpInfo.channel}. Valid for 10 minutes.</p>
                      {otpInfo.demoOtp && (
                        <div className="flex items-center gap-2 rounded-lg border border-[#FBE3B5] bg-saffron-50 px-3 py-2">
                          <span className="rounded-full border border-[#FBE3B5] bg-white px-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#B45309]">Demo</span>
                          <span className="text-[13px] text-[#92400E]">No SMS gateway in this prototype. Your OTP is</span>
                          <button type="button" onClick={() => setOtp(otpInfo.demoOtp ?? '')} className="num rounded-md bg-white px-2 py-0.5 text-[15px] font-semibold tracking-[0.2em] text-ink transition-colors hover:bg-[#FFF7E6]" title="Fill the OTP">
                            {otpInfo.demoOtp}
                          </button>
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="6-digit OTP" error={fieldError(decide.error, 'otp')}>
                          <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className="num text-base tracking-[0.3em]" placeholder="••••••" />
                        </Field>
                        <Field label="Your name and role" error={fieldError(decide.error, 'approverName')}>
                          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunita Gore, HR Executive" />
                        </Field>
                      </div>
                      {rejecting && (
                        <Field label="Why are you rejecting this claim?" error={fieldError(decide.error, 'reason')}>
                          <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-line px-3 py-2 text-sm transition-colors hover:border-[#cfd3da] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                            placeholder="For example: this person never worked here, or the wage is incorrect"
                          />
                        </Field>
                      )}
                      {decide.isError && !fieldError(decide.error, 'otp') && !fieldError(decide.error, 'reason') && !fieldError(decide.error, 'approverName') && <ErrorState error={decide.error} compact />}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Button size="lg" variant="success" disabled={otp.length !== 6 || name.trim().length < 2 || rejecting} loading={decide.isPending && decide.variables === 'APPROVE'} onClick={() => decide.mutate('APPROVE')} icon={<CircleCheck className="h-5 w-5" strokeWidth={1.5} />}>
                          Approve
                        </Button>
                        <Button
                          size="lg"
                          variant="danger"
                          disabled={otp.length !== 6 || name.trim().length < 2}
                          loading={decide.isPending && decide.variables === 'REJECT'}
                          onClick={() => (rejecting ? decide.mutate('REJECT') : setRejecting(true))}
                          icon={<CircleX className="h-5 w-5" strokeWidth={1.5} />}
                        >
                          {rejecting ? 'Confirm rejection' : 'Reject'}
                        </Button>
                      </div>
                      {rejecting && (
                        <button type="button" onClick={() => setRejecting(false)} className="text-[12px] text-muted underline-offset-2 hover:text-ink hover:underline">
                          Cancel rejection
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            <p className="text-center text-[11px] text-muted">Link valid until {dateShort(v.expiresAt)}. Decisions are logged with time and network address under the state's data protection policy.</p>
          </div>
        )}
      </main>
    </div>
  );
}

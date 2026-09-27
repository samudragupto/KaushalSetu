import { useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, ChevronDown, Globe2, KeyRound, Landmark, MessageCircle, PhoneCall, UserRound } from 'lucide-react';
import type { Role } from '@kaushalsetu/shared';
import { api, ApiError } from '../lib/api';
import { HOME_BY_ROLE, useAuth } from '../lib/auth';
import { itemVariants, listVariants, useCountUp } from '../lib/motion';
import { Logo } from '../components/layout/Logo';
import { MaharashtraMap } from '../components/charts/MaharashtraMap';
import { Button, Field, Input } from '../components/ui';

interface PublicStats {
  traineesTracked: number;
  verificationRate: number | null;
  districtsCovered: number;
  providers: number;
  followUpsSent30d: number;
  followUpsAnswered30d: number;
}

function Counter({ value, format, label, sub }: { value: number | null | undefined; format: (v: number) => string; label: string; sub?: string }) {
  const v = useCountUp(value ?? null);
  return (
    <div>
      <p className="num text-[30px] font-semibold leading-9 text-white">{v === null ? <span className="text-[#475569]">—</span> : format(v)}</p>
      <p className="mt-1 text-[13px] text-[#CBD5E1]">{label}</p>
      {sub && <p className="text-[11px] text-[#64748B]">{sub}</p>}
    </div>
  );
}

const ROLES: { role: Exclude<Role, 'TRAINEE'>; title: string; who: string; body: string; icon: ReactNode }[] = [
  {
    role: 'GOVT',
    title: 'Secretary, Skill Development',
    who: 'Vikas Deshpande',
    body: 'State outcomes dashboard, district map, provider league table, integrity alerts and skill-gap report.',
    icon: <Landmark className="h-5 w-5" strokeWidth={1.5} />,
  },
  {
    role: 'PROVIDER',
    title: 'Training Provider',
    who: 'Meena Joshi, Principal, Government ITI Nashik',
    body: 'Institute scorecard against the state average, trainee follow-up status and pending employer verifications.',
    icon: <Building2 className="h-5 w-5" strokeWidth={1.5} />,
  },
  {
    role: 'AGENT',
    title: 'Field Agent',
    who: 'Rahul Sonawane, Nashik Division',
    body: 'Call queue of trainees who did not answer two WhatsApp check-ins, with an outcome form for each call.',
    icon: <PhoneCall className="h-5 w-5" strokeWidth={1.5} />,
  },
];

export function LoginPage() {
  const { user, loginDemo, loginPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const stats = useQuery({ queryKey: ['public-stats'], queryFn: () => api<PublicStats>('/public/stats', { auth: 'none' }), refetchInterval: 15_000 });

  if (user) return <Navigate to={from ?? HOME_BY_ROLE[user.role]} replace />;

  const go = async (role: Exclude<Role, 'TRAINEE'>) => {
    setBusy(role);
    setError(null);
    try {
      const u = await loginDemo(role);
      navigate(from && from.startsWith(HOME_BY_ROLE[u.role]) ? from : HOME_BY_ROLE[u.role], { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed.');
      setBusy(null);
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('email');
    setError(null);
    try {
      const u = await loginPassword(email, password);
      navigate(HOME_BY_ROLE[u.role], { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed.');
      setBusy(null);
    }
  };

  const s = stats.data;
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Story panel */}
      <section className="relative flex flex-col overflow-hidden bg-navy px-8 py-8 text-white lg:px-12 lg:py-10">
        <div className="pointer-events-none absolute -right-24 top-16 w-[620px] opacity-90 lg:-right-10">
          <MaharashtraMap variant="outline" height={520} pulse={['Nashik', 'Pune', 'Nagpur', 'Jalgaon']} />
        </div>
        <div className="relative">
          <Logo tone="light" />
        </div>
        <div className="relative mt-14 max-w-md lg:mt-24">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#5EEAD4]">Post-training outcomes · Maharashtra</p>
          <h1 className="mt-3 text-[32px] font-semibold leading-[1.15] tracking-[-0.02em]">What happens to a trainee after the certificate is handed over?</h1>
          <p className="mt-4 text-[15px] leading-6 text-[#CBD5E1]">
            KaushalSetu follows every consenting trainee for 24 months on WhatsApp, has employers confirm placements, and turns the replies into placement, retention, wage and skill-gap figures for each district and institute.
          </p>
        </div>
        <div className="relative mt-10 grid max-w-lg grid-cols-3 gap-6 lg:mt-auto">
          <Counter value={s?.traineesTracked} format={(v) => Math.round(v).toLocaleString('en-IN')} label="Trainees tracked" sub={s ? `${s.providers} institutes` : undefined} />
          <Counter value={s?.verificationRate !== null && s?.verificationRate !== undefined ? s.verificationRate * 100 : null} format={(v) => `${v.toFixed(1)}%`} label="Placements verified" sub="employer or EPFO" />
          <Counter value={s?.districtsCovered} format={(v) => `${Math.round(v)} / 36`} label="Districts covered" />
        </div>
        {s && (
          <p className="relative mt-6 text-[12px] text-[#94A3B8]">
            <span className="num text-[#E2E8F0]">{s.followUpsAnswered30d.toLocaleString('en-IN')}</span> of <span className="num text-[#E2E8F0]">{s.followUpsSent30d.toLocaleString('en-IN')}</span> WhatsApp check-ins answered in the last 30 days.
          </p>
        )}
      </section>

      {/* Role picker */}
      <section className="flex items-center justify-center bg-bg px-6 py-10">
        <div className="w-full max-w-[460px]">
          <h2 className="text-xl font-semibold tracking-[-0.01em]">Choose how you sign in</h2>
          <p className="mt-1 text-sm text-muted">Each card opens a seeded demo account. No password needed.</p>
          <motion.ul className="mt-6 space-y-3" variants={listVariants} initial="initial" animate="animate">
            {ROLES.map((r) => (
              <motion.li key={r.role} variants={itemVariants}>
                <button
                  type="button"
                  onClick={() => go(r.role)}
                  disabled={busy !== null}
                  className="group flex w-full items-start gap-4 rounded-lg border border-line bg-white p-4 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lift disabled:translate-y-0 disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary transition-colors group-hover:bg-primary group-hover:text-white">{r.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-semibold text-ink">{r.title}</span>
                      <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" strokeWidth={1.5} />
                    </span>
                    <span className="block text-[13px] text-primary-700">{busy === r.role ? 'Signing in…' : r.who}</span>
                    <span className="mt-1 block text-[13px] leading-5 text-muted">{r.body}</span>
                  </span>
                </button>
              </motion.li>
            ))}
          </motion.ul>
          {error && <p className="mt-3 rounded-lg border border-[#F7CFCF] bg-danger-50 px-3 py-2 text-[13px] text-danger">{error}</p>}

          <div className="mt-6 rounded-lg border border-line bg-white">
            <button type="button" onClick={() => setShowEmail((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-medium text-ink transition-colors hover:bg-[#FAFBFC]">
              <span className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted" strokeWidth={1.5} /> Sign in with email and password
              </span>
              <ChevronDown className={`h-4 w-4 text-muted transition-transform ${showEmail ? 'rotate-180' : ''}`} strokeWidth={1.5} />
            </button>
            {showEmail && (
              <form onSubmit={submitEmail} className="space-y-3 border-t border-line px-4 py-4">
                <Field label="Official email">
                  <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@skills.mh.example.in" required />
                </Field>
                <Field label="Password" hint="Seeded accounts use the password listed in README.md.">
                  <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Field>
                <Button type="submit" variant="primary" loading={busy === 'email'} className="w-full">
                  Sign in
                </Button>
              </form>
            )}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 text-[12px]">
            <Link to="/portal" className="flex flex-col items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-3 text-center text-muted transition-colors hover:border-primary-200 hover:text-primary-700">
              <UserRound className="h-4 w-4" strokeWidth={1.5} />
              Trainee portal
            </Link>
            <Link to="/sim/whatsapp" className="flex flex-col items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-3 text-center text-muted transition-colors hover:border-primary-200 hover:text-primary-700">
              <MessageCircle className="h-4 w-4" strokeWidth={1.5} />
              WhatsApp simulator
            </Link>
            <Link to="/public" className="flex flex-col items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-3 text-center text-muted transition-colors hover:border-primary-200 hover:text-primary-700">
              <Globe2 className="h-4 w-4" strokeWidth={1.5} />
              Public statistics
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

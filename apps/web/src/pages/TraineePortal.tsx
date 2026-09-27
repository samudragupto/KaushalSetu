import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { BellRing, CheckCircle2, FileUp, GraduationCap, History, KeyRound, Languages, LogOut, Phone, ShieldCheck, Upload } from 'lucide-react';
import { api, ApiError, fieldError, tokenStore } from '../lib/api';
import { dateShort, inr } from '../lib/format';
import { uploadEvidence, type EvidenceKind } from '../lib/upload';
import type { TraineeDetail } from '../lib/types';
import { LANGS, useI18n, type I18nKey } from '../i18n';
import { Logo } from '../components/layout/Logo';
import { Timeline } from '../components/dashboard/Timeline';
import { Button, Chip, ErrorState, Field, Input, Select, Skeleton, STATUS_TONE, Toggle } from '../components/ui';

type Tab = 'timeline' | 'consent' | 'contact' | 'proof' | 'upskill';
type T = (key: I18nKey, vars?: Record<string, string | number>) => string;

interface Persona {
  id: string;
  name: string;
  unifiedId: string;
  district: string;
}

function LanguageSwitch({ lang, setLang }: { lang: string; setLang: (l: 'mr' | 'hi' | 'en') => void }) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-grid p-0.5">
      <Languages className="ml-1.5 h-3.5 w-3.5 text-muted" strokeWidth={1.5} />
      {LANGS.map((l) => (
        <button key={l.code} type="button" onClick={() => setLang(l.code)} className={clsx('rounded-md px-2 py-1 text-[12px] font-medium transition-colors', lang === l.code ? 'bg-white text-primary-700 shadow-card' : 'text-muted hover:text-ink')}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

function SignIn({ t, onSignedIn }: { t: T; onSignedIn: () => void }) {
  const [unifiedId, setUnifiedId] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState<{ to: string; demoOtp?: string } | null>(null);
  const personas = useQuery({ queryKey: ['personas'], queryFn: () => api<Persona[]>('/public/personas', { auth: 'none' }) });
  const request = useMutation({ mutationFn: () => api<{ to: string; demoOtp?: string }>('/portal/otp', { method: 'POST', body: { unifiedId }, auth: 'none' }), onSuccess: setSent });
  const login = useMutation({
    mutationFn: () => api<{ token: string }>('/portal/login', { method: 'POST', body: { unifiedId, otp }, auth: 'none' }),
    onSuccess: (res) => {
      tokenStore.setTrainee(res.token);
      onSignedIn();
    },
  });
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-card">
      <h1 className="text-lg font-semibold">{t('login.title')}</h1>
      {!sent ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate();
          }}
        >
          <Field label={t('login.idLabel')} hint={t('login.idHint')} error={fieldError(request.error, 'unifiedId') ?? (request.error instanceof ApiError && !fieldError(request.error, 'unifiedId') ? request.error.message : null)}>
            <Input value={unifiedId} onChange={(e) => setUnifiedId(e.target.value.toUpperCase())} placeholder="MH-NSK-100101" className="num h-11 text-base" autoCapitalize="characters" />
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={request.isPending} icon={<KeyRound className="h-4 w-4" strokeWidth={1.5} />}>
            {t('login.sendOtp')}
          </Button>
          {personas.data && personas.data.length > 0 && (
            <div className="pt-2">
              <p className="mb-1.5 text-[12px] text-muted">{t('login.demoPick')}</p>
              <div className="flex flex-wrap gap-1.5">
                {personas.data.slice(0, 8).map((p) => (
                  <Chip key={p.id} onClick={() => setUnifiedId(p.unifiedId)} active={unifiedId === p.unifiedId}>
                    {p.name.split(' ')[0]} · {p.district}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </form>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate();
          }}
        >
          <p className="text-[13px] text-muted">{t('login.otpSentTo', { to: sent.to })}</p>
          {sent.demoOtp && (
            <button type="button" onClick={() => setOtp(sent.demoOtp ?? '')} className="flex w-full items-center justify-between rounded-lg border border-[#FBE3B5] bg-saffron-50 px-3 py-2 text-left transition-colors hover:bg-[#FFF3DC]">
              <span className="text-[12px] text-[#92400E]">
                <span className="mr-1.5 rounded-full border border-[#FBE3B5] bg-white px-1.5 text-[10px] font-semibold uppercase tracking-wider">Demo</span>
                {t('login.demoOtp')}
              </span>
              <span className="num text-base font-semibold tracking-[0.25em]">{sent.demoOtp}</span>
            </button>
          )}
          <Field label={t('login.otpLabel')} error={login.error instanceof ApiError ? login.error.message : null}>
            <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" className="num h-11 text-lg tracking-[0.3em]" placeholder="••••••" autoFocus />
          </Field>
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={otp.length !== 6} loading={login.isPending}>
            {t('login.verify')}
          </Button>
          <button type="button" onClick={() => setSent(null)} className="w-full text-center text-[12px] text-muted hover:text-ink">
            {t('login.changeId')}
          </button>
        </form>
      )}
    </div>
  );
}

function ConsentTab({ me, t }: { me: TraineeDetail; t: T }) {
  const qc = useQueryClient();
  const change = useMutation({
    mutationFn: (v: { scope: string; granted: boolean }) => api<TraineeDetail>('/portal/consent', { method: 'PUT', body: v, auth: 'trainee' }),
    onSuccess: (data) => qc.setQueryData(['portal-me'], data),
  });
  const scopes: ('employmentTracking' | 'wageTracking' | 'publicAggregates')[] = ['employmentTracking', 'wageTracking', 'publicAggregates'];
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-white p-4 shadow-card">
        <h2 className="font-semibold">{t('consent.title')}</h2>
        <p className="mt-1 text-[13px] text-muted">{t('consent.intro')}</p>
        <ul className="mt-3 divide-y divide-grid">
          {scopes.map((s) => (
            <li key={s} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-[14px] font-medium">{t(`consent.${s}` as I18nKey)}</p>
                <p className="text-[12px] text-muted">{t(`consent.${s}.help` as I18nKey)}</p>
                <p className={clsx('mt-1 text-[12px] font-medium', me.consents[s] ? 'text-success' : 'text-warning')}>{me.consents[s] ? t('consent.on') : t('consent.off')}</p>
              </div>
              <Toggle checked={me.consents[s]} disabled={change.isPending} onChange={(v) => change.mutate({ scope: s, granted: v })} label={t(`consent.${s}` as I18nKey)} />
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-line bg-white p-4 shadow-card">
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold">
          <History className="h-4 w-4 text-muted" strokeWidth={1.5} /> {t('consent.ledger')}
        </h3>
        <ul className="mt-2 space-y-1.5">
          {me.consentLedger.slice(0, 12).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 text-[12px]">
              <span>
                {t(`consent.${c.scope}` as I18nKey)} · <span className={c.granted ? 'text-success' : 'text-warning'}>{c.granted ? t('consent.on') : t('consent.off')}</span>
              </span>
              <span className="num text-muted">
                {dateShort(c.capturedAt)} · {c.channel.replace('_', ' ').toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ContactTab({ me, t }: { me: TraineeDetail; t: T }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ phonePrimary: me.phonePrimary, phoneAlternate: me.phoneAlternate ?? '', whatsappNumber: me.whatsappNumber ?? me.phonePrimary, email: me.email ?? '' });
  const save = useMutation({ mutationFn: () => api<TraineeDetail>('/portal/contact', { method: 'PUT', body: f, auth: 'trainee' }), onSuccess: (d) => qc.setQueryData(['portal-me'], d) });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  return (
    <form
      className="space-y-3 rounded-lg border border-line bg-white p-4 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="font-semibold">{t('contact.title')}</h2>
      <p className="text-[13px] text-muted">{t('contact.intro')}</p>
      <Field label={t('contact.primary')} error={fieldError(save.error, 'phonePrimary')}>
        <Input value={f.phonePrimary} onChange={set('phonePrimary')} inputMode="tel" className="num h-11" />
      </Field>
      <Field label={t('contact.whatsapp')} error={fieldError(save.error, 'whatsappNumber')}>
        <Input value={f.whatsappNumber} onChange={set('whatsappNumber')} inputMode="tel" className="num h-11" />
      </Field>
      <Field label={t('contact.alternate')} error={fieldError(save.error, 'phoneAlternate')}>
        <Input value={f.phoneAlternate} onChange={set('phoneAlternate')} inputMode="tel" className="num h-11" />
      </Field>
      <Field label={t('contact.email')} error={fieldError(save.error, 'email')}>
        <Input value={f.email} onChange={set('email')} inputMode="email" className="h-11" />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="lg" loading={save.isPending} icon={<Phone className="h-4 w-4" strokeWidth={1.5} />}>
          {t('contact.save')}
        </Button>
        {save.isSuccess && (
          <span className="flex items-center gap-1 text-[13px] text-success">
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} /> {t('contact.saved')}
          </span>
        )}
      </div>
    </form>
  );
}

function ProofTab({ me, t }: { me: TraineeDetail; t: T }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<EvidenceKind>('UDYAM_CERTIFICATE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadEvidence(file, kind, 'trainee');
      await qc.invalidateQueries({ queryKey: ['portal-me'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.generic'));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };
  const view = async (id: string) => {
    const res = await api<{ url: string }>(`/uploads/${id}`, { auth: 'trainee' });
    const w = window.open();
    if (w) w.location.href = res.url;
  };
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-white p-4 shadow-card">
        <h2 className="font-semibold">{t('proof.title')}</h2>
        <p className="mt-1 text-[13px] text-muted">{t('proof.help')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <Field label={t('proof.kind')}>
            <Select value={kind} onChange={(e) => setKind(e.target.value as EvidenceKind)} className="h-11">
              {(['UDYAM_CERTIFICATE', 'SHOP_PHOTO', 'UPI_SUMMARY', 'OTHER'] as const).map((k) => (
                <option key={k} value={k}>
                  {t(`proof.kind.${k}` as I18nKey)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={() => ref.current?.click()} icon={<Upload className="h-4 w-4" strokeWidth={1.5} />}>
              {busy ? t('proof.uploading') : t('proof.choose')}
            </Button>
          </div>
        </div>
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      </div>
      <div className="rounded-lg border border-line bg-white p-4 shadow-card">
        <h3 className="text-[14px] font-semibold">{t('proof.uploaded')}</h3>
        {me.evidence.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">{t('proof.none')}</p>
        ) : (
          <ul className="mt-2 divide-y divide-grid">
            {me.evidence.map((ev) => (
              <li key={ev.id} className="flex items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  <FileUp className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{ev.fileName}</span>
                    <span className="num block text-[11px] text-muted">
                      {t(`proof.kind.${ev.kind}` as I18nKey)} · {Math.max(1, Math.round(ev.sizeBytes / 1024))} KB · {dateShort(ev.createdAt)} · {ev.storage === 'SUPABASE' ? 'Supabase Storage' : 'inline'}
                    </span>
                  </span>
                </span>
                <Button size="sm" onClick={() => view(ev.id)}>
                  {t('proof.view')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function UpskillTab({ me, t }: { me: TraineeDetail; t: T }) {
  const qc = useQueryClient();
  const opt = useMutation({ mutationFn: (optIn: boolean) => api<TraineeDetail>('/portal/upskill', { method: 'PUT', body: { optIn }, auth: 'trainee' }), onSuccess: (d) => qc.setQueryData(['portal-me'], d) });
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-white p-4 shadow-card">
        <h2 className="font-semibold">{t('upskill.title')}</h2>
        <p className="mt-1 text-[13px] text-muted">{t('upskill.help')}</p>
        <ul className="mt-3 space-y-2">
          {me.recommendations.map((r) => (
            <li key={r.skillKey} className={clsx('rounded-lg border p-3', r.reportedByYou ? 'border-[#FBE3B5] bg-saffron-50/50' : 'border-line')}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] font-medium">{r.title}</p>
                <span className="num shrink-0 text-[12px] text-muted">{t('upskill.hours', { hours: r.hours })}</span>
              </div>
              <p className="text-[12px] text-muted">
                NSQF {r.nsqfLevel} · {r.mode}
              </p>
              {r.reportedByYou && (
                <p className="mt-1 text-[12px] font-medium text-[#B45309]">
                  {t('upskill.reported')}: {r.skill}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-white p-4 shadow-card">
        <div>
          <p className="flex items-center gap-1.5 text-[14px] font-medium">
            <BellRing className="h-4 w-4 text-primary" strokeWidth={1.5} /> {t('upskill.optIn')}
          </p>
          {me.upskillOptIn && <p className="mt-1 text-[12px] text-success">{t('upskill.optedIn')}</p>}
        </div>
        <Toggle checked={me.upskillOptIn} onChange={(v) => opt.mutate(v)} label={t('upskill.optIn')} disabled={opt.isPending} />
      </div>
    </div>
  );
}

export default function TraineePortal() {
  const { t, lang, setLang } = useI18n();
  const [signedIn, setSignedIn] = useState(!!tokenStore.getTrainee());
  const [tab, setTab] = useState<Tab>('timeline');
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['portal-me'], queryFn: () => api<TraineeDetail>('/portal/me', { auth: 'trainee' }), enabled: signedIn, retry: false });

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      tokenStore.setTrainee(null);
      setSignedIn(false);
    }
  }, [me.error]);

  const signOut = () => {
    tokenStore.setTrainee(null);
    qc.removeQueries({ queryKey: ['portal-me'] });
    setSignedIn(false);
  };

  const d = me.data;
  const tabs: { key: Tab; label: I18nKey }[] = [
    { key: 'timeline', label: 'nav.timeline' },
    { key: 'consent', label: 'nav.consent' },
    { key: 'contact', label: 'nav.contact' },
    { key: 'proof', label: 'nav.proof' },
    { key: 'upskill', label: 'nav.upskill' },
  ];

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur-0">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2 px-4 py-2.5">
          <Link to="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitch lang={lang} setLang={setLang} />
            {signedIn && (
              <button type="button" onClick={signOut} className="rounded-md p-1.5 text-muted transition-colors hover:bg-grid hover:text-ink" aria-label={t('signout')} title={t('signout')}>
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-xl space-y-4 px-4 py-5">
        {!signedIn && (
          <>
            <p className="text-[13px] text-muted">{t('portal.tagline')}</p>
            <SignIn t={t} onSignedIn={() => setSignedIn(true)} />
            <p className="flex items-center gap-1.5 text-[12px] text-muted">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} /> DPDP Act 2023: you can see, correct and withdraw consent for your data at any time.
            </p>
          </>
        )}
        {signedIn && me.isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-10" />
            <Skeleton className="h-72" />
          </div>
        )}
        {signedIn && me.isError && !(me.error instanceof ApiError && me.error.status === 401) && <ErrorState error={me.error} onRetry={() => me.refetch()} />}
        {signedIn && d && (
          <>
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-line bg-white p-4 shadow-card">
              <p className="text-lg font-semibold">{t('home.hello', { name: d.fullName.split(' ')[0] })}</p>
              <p className="num text-[12px] text-muted">{d.unifiedId}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-muted">{t('home.status')}</span>
                <Chip tone={STATUS_TONE[d.currentStatus]}>{t(`status.${d.currentStatus}` as I18nKey)}</Chip>
              </div>
              {(d.currentEmployer || d.currentWage) && (
                <p className="mt-1 text-[13px]">
                  {d.currentEmployer}
                  {d.currentWage ? <span className="num text-muted"> · {inr(d.currentWage)}</span> : null}
                </p>
              )}
              {d.course && (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
                  <GraduationCap className="h-3.5 w-3.5" strokeWidth={1.5} /> {d.course.name} · {d.provider?.name}
                </p>
              )}
            </motion.div>
            <nav className="scrollbar-thin -mx-4 flex gap-1 overflow-x-auto px-4">
              {tabs.map((tb) => (
                <button key={tb.key} type="button" onClick={() => setTab(tb.key)} className={clsx('shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors', tab === tb.key ? 'border-primary bg-primary text-white' : 'border-line bg-white text-muted hover:border-primary-200 hover:text-ink')}>
                  {t(tb.label)}
                </button>
              ))}
            </nav>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                {tab === 'timeline' && (
                  <div className="rounded-lg border border-line bg-white p-4 shadow-card">
                    <h2 className="mb-4 font-semibold">{t('timeline.title')}</h2>
                    <Timeline items={d.timeline} glosses={lang === 'en' ? d.glosses : {}} titleFor={(it) => (lang === 'en' ? it.title : t(`tl.${it.kind}` as I18nKey))} />
                  </div>
                )}
                {tab === 'consent' && <ConsentTab me={d} t={t} />}
                {tab === 'contact' && <ContactTab me={d} t={t} />}
                {tab === 'proof' && <ProofTab me={d} t={t} />}
                {tab === 'upskill' && <UpskillTab me={d} t={t} />}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </main>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowLeft, BadgeCheck, Check, CheckCheck, ExternalLink, Info, Link2, Loader2, MoreVertical, Paperclip, Phone, SendHorizontal, Video } from 'lucide-react';
import type { ChatMessage, ChatSession, Lang } from '@kaushalsetu/shared';
import { api, ApiError } from '../lib/api';
import { timeHM, STATUS_LABEL } from '../lib/format';
import { LANGS, useI18n } from '../i18n';
import { uploadEvidence } from '../lib/upload';
import { Logo } from '../components/layout/Logo';
import { Chip, Skeleton, STATUS_TONE } from '../components/ui';

// WhatsApp brand colours are used only inside the phone frame so the simulator reads as the
// real channel; the rest of the product keeps the KaushalSetu palette.
const WA = { header: '#008069', out: '#FFFFFF', in: '#D9FDD3', action: '#00A884', tick: '#53BDEB' };

interface Pending {
  id: string;
  body: string;
}

function TypingBubble() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex">
      <div className="flex items-center gap-1 rounded-lg rounded-tl-none bg-white px-3 py-2.5 shadow-[0_1px_0.5px_rgba(11,20,26,.13)]">
        {[0, 1, 2].map((i) => (
          <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-[#8696a0]" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </motion.div>
  );
}

function Ticks({ read }: { read: boolean }) {
  return read ? <CheckCheck className="h-3.5 w-3.5" style={{ color: WA.tick }} strokeWidth={2} /> : <CheckCheck className="h-3.5 w-3.5 text-[#8696a0]" strokeWidth={2} />;
}

function Bubble({ m, active, onButton, disabled }: { m: ChatMessage; active: boolean; onButton: (id: string) => void; disabled: boolean }) {
  const mine = m.direction === 'IN';
  const verificationUrl = typeof m.meta.verificationUrl === 'string' ? m.meta.verificationUrl : null;
  const localPath = verificationUrl ? new URL(verificationUrl).pathname : null;
  return (
    <motion.div initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2 }} className={clsx('flex flex-col', mine ? 'items-end' : 'items-start')}>
      <div
        className={clsx('relative max-w-[82%] rounded-lg px-2.5 pb-1.5 pt-1.5 text-[14.2px] leading-[19px] text-[#111B21] shadow-[0_1px_0.5px_rgba(11,20,26,.13)]', mine ? 'rounded-tr-none' : 'rounded-tl-none')}
        style={{ background: mine ? WA.in : WA.out }}
      >
        {verificationUrl && localPath && (
          <a href={localPath} target="_blank" rel="noreferrer" className="mb-1.5 block rounded-md bg-[#F0F2F5] p-2 transition-colors hover:bg-[#E9EDEF]">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#111B21]">
              <Link2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Employer verification
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-[#667781]">{verificationUrl.replace(/^https?:\/\//, '')}</span>
          </a>
        )}
        <span className="whitespace-pre-line">{m.body}</span>
        <span className="float-right ml-2 mt-1.5 flex translate-y-0.5 items-center gap-0.5 text-[11px] leading-none text-[#667781]">
          {timeHM(m.createdAt)}
          {mine && <Ticks read={!!m.readAt} />}
        </span>
      </div>
      {!mine && m.buttons.length > 0 && (
        <div className="mt-0.5 w-[82%] max-w-[82%] space-y-0.5">
          {m.buttons.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={!active || disabled}
              onClick={() => onButton(b.id)}
              className={clsx(
                'block w-full rounded-lg bg-white px-3 py-2 text-center text-[14px] font-medium shadow-[0_1px_0.5px_rgba(11,20,26,.13)] transition-colors',
                active ? 'hover:bg-[#F5F6F6]' : 'cursor-default opacity-60',
              )}
              style={{ color: active ? WA.action : '#8696a0' }}
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function WhatsAppSim() {
  const { traineeId = '' } = useParams();
  const qc = useQueryClient();
  const { t, lang: uiLang, setLang: setUiLang } = useI18n();
  const chat = useQuery({ queryKey: ['chat', traineeId], queryFn: () => api<ChatSession>(`/bot/${traineeId}`, { auth: 'none' }), refetchInterval: 3000 });
  const [shown, setShown] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const messages = useMemo(() => chat.data?.messages ?? [], [chat.data]);

  // First load shows the history at once; later messages are revealed one by one with a typing
  // indicator, the way a real bot conversation feels.
  useEffect(() => {
    if (!chat.data) return;
    if (shown === null) {
      setShown(messages.length);
      return;
    }
    if (shown > messages.length) {
      setShown(messages.length);
      return;
    }
    if (shown === messages.length) return;
    const next = messages[shown];
    if (next.direction === 'IN') {
      setShown(shown + 1);
      return;
    }
    setTyping(true);
    const delay = Math.min(1100, 450 + next.body.length * 6);
    const timer = setTimeout(() => {
      setTyping(false);
      setShown(shown + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [chat.data, messages, shown]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [shown, typing, pending.length]);

  useEffect(() => {
    if (chat.data?.lang && chat.data.lang !== uiLang) setUiLang(chat.data.lang as Lang);
    // Sync only when the server's language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.data?.lang]);

  const send = useMutation({
    mutationFn: (body: { buttonId?: string; text?: string; evidenceId?: string }) => api<ChatSession>(`/bot/${traineeId}/message`, { method: 'POST', body, auth: 'none' }),
    onMutate: (body) => {
      setError(null);
      const label = body.buttonId ? visible.flatMap((m) => m.buttons).find((b) => b.id === body.buttonId)?.label ?? '' : body.text ?? '';
      if (label) setPending([{ id: `p${Date.now()}`, body: label }]);
      setTyping(true);
    },
    onSuccess: (data) => {
      setPending([]);
      setTyping(false);
      qc.setQueryData(['chat', traineeId], data);
    },
    onError: (err) => {
      setPending([]);
      setTyping(false);
      setError(err instanceof ApiError ? err.message : 'Message not sent.');
    },
  });

  const setLang = useMutation({
    mutationFn: (lang: Lang) => api<ChatSession>(`/bot/${traineeId}/lang`, { method: 'POST', body: { lang }, auth: 'none' }),
    onMutate: (lang) => setUiLang(lang),
    onSuccess: (data) => qc.setQueryData(['chat', traineeId], data),
  });

  const visible = messages.slice(0, shown ?? 0);
  const lastOutIndex = (() => {
    for (let i = visible.length - 1; i >= 0; i--) if (visible[i].direction === 'OUT') return i;
    return -1;
  })();
  const fullyShown = shown === messages.length;
  const hint = chat.data?.inputHint ?? 'closed';
  const canType = hint !== 'closed' && fullyShown && !send.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || !canType) return;
    setText('');
    send.mutate({ text: v });
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !chat.data?.uploadToken) return;
    setUploading(true);
    setError(null);
    try {
      const kind = file.type === 'application/pdf' ? 'UDYAM_CERTIFICATE' : 'SHOP_PHOTO';
      const ev = await uploadEvidence(file, kind, { bearer: chat.data.uploadToken });
      send.mutate({ evidenceId: ev.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const tr = chat.data?.trainee;
  return (
    <div className="min-h-screen bg-[#E9EDEF]">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-6 lg:flex-row lg:items-start lg:justify-center lg:py-10">
        {/* Phone */}
        <div className="shrink-0">
          <p className="mb-2 text-center text-[12px] text-[#54656F]">{tr ? `${tr.name}'s phone` : 'Trainee phone'}</p>
          <div className="relative h-[760px] max-h-[calc(100vh-80px)] min-h-[560px] w-[372px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[44px] border-[10px] border-navy bg-navy shadow-lift">
            <div className="flex h-full flex-col overflow-hidden rounded-[34px] bg-white">
              {/* Status bar */}
              <div className="flex h-7 items-center justify-between px-6 text-[12px] font-semibold text-white" style={{ background: WA.header }}>
                <span className="num">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                <span className="h-4 w-20 rounded-full bg-navy" />
                <span className="flex items-center gap-1">
                  <span className="flex items-end gap-px">
                    {[3, 5, 7, 9].map((h) => (
                      <span key={h} className="w-[3px] rounded-sm bg-white" style={{ height: h }} />
                    ))}
                  </span>
                  <span className="ml-1 h-2.5 w-5 rounded-[3px] border border-white p-px">
                    <span className="block h-full w-3/4 rounded-[1px] bg-white" />
                  </span>
                </span>
              </div>
              {/* Header */}
              <div className="flex items-center gap-2 px-2 py-2 text-white" style={{ background: WA.header }}>
                <Link to="/sim/whatsapp" className="rounded-full p-1 transition-colors hover:bg-white/10" aria-label="Back to chats">
                  <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
                </Link>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
                  <Logo compact />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-[15px] font-semibold leading-5">
                    KaushalSetu <BadgeCheck className="h-4 w-4 fill-[#25D366] text-white" strokeWidth={1.75} />
                  </p>
                  <p className="truncate text-[12px] leading-4 text-white/85">{typing ? 'typing…' : `${t('wa.business')} · ${t('wa.online')}`}</p>
                </div>
                <Video className="h-5 w-5 opacity-90" strokeWidth={1.75} />
                <Phone className="ml-3 h-[18px] w-[18px] opacity-90" strokeWidth={1.75} />
                <MoreVertical className="ml-2 h-5 w-5 opacity-90" strokeWidth={1.75} />
              </div>

              {/* Messages */}
              <div ref={scroller} className="wa-wallpaper scrollbar-thin flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
                <div className="mx-auto mb-2 w-fit rounded-md bg-[#FFEECD] px-2.5 py-1 text-center text-[11.5px] leading-4 text-[#54656F]">
                  Messages from the Government of Maharashtra follow-up service. Replies are used only for scheme improvement, with your consent.
                </div>
                {chat.isLoading && (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-3/4" />
                    <Skeleton className="ml-auto h-8 w-1/3" />
                    <Skeleton className="h-20 w-4/5" />
                  </div>
                )}
                {chat.isError && <p className="mx-auto mt-10 max-w-[260px] rounded-lg bg-white p-3 text-center text-[13px] text-[#54656F]">{(chat.error as Error).message}</p>}
                {chat.data && messages.length === 0 && <p className="mx-auto mt-10 max-w-[260px] rounded-lg bg-white p-3 text-center text-[13px] text-[#54656F]">{t('wa.noSession')}</p>}
                {visible.map((m, i) => {
                  const day = new Date(m.createdAt).toDateString();
                  const showDay = i === 0 || new Date(visible[i - 1].createdAt).toDateString() !== day;
                  return (
                    <div key={m.id} className="space-y-1.5">
                      {showDay && <div className="mx-auto my-1 w-fit rounded-md bg-white/90 px-2.5 py-0.5 text-[11.5px] text-[#54656F] shadow-sm">{day === new Date().toDateString() ? t('wa.today') : new Date(m.createdAt).toLocaleDateString(uiLang === 'en' ? 'en-IN' : `${uiLang}-IN`, { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                      <Bubble m={m} active={i === lastOutIndex && fullyShown && hint !== 'closed'} disabled={send.isPending} onButton={(id) => send.mutate({ buttonId: id })} />
                    </div>
                  );
                })}
                {pending.map((p) => (
                  <div key={p.id} className="flex justify-end">
                    <div className="max-w-[82%] rounded-lg rounded-tr-none px-2.5 py-1.5 text-[14.2px] shadow-[0_1px_0.5px_rgba(11,20,26,.13)]" style={{ background: WA.in }}>
                      {p.body}
                      <span className="float-right ml-2 mt-1.5 flex items-center text-[11px] text-[#667781]">
                        <Check className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                    </div>
                  </div>
                ))}
                <AnimatePresence>{typing && <TypingBubble />}</AnimatePresence>
              </div>

              {/* Composer */}
              <form onSubmit={submit} className="flex items-center gap-2 bg-[#F0F2F5] px-2 py-2">
                {hint === 'closed' ? (
                  <p className="flex-1 py-2 text-center text-[13px] text-[#667781]">{t('wa.closed')}</p>
                ) : (
                  <>
                    <div className="flex flex-1 items-center rounded-full bg-white px-3">
                      <input
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        disabled={!canType}
                        placeholder={t('wa.typeMessage')}
                        className="h-10 flex-1 bg-transparent text-[15px] text-[#111B21] placeholder:text-[#8696a0] focus:outline-none"
                        aria-label="Type a reply"
                      />
                      {hint === 'upload' && (
                        <>
                          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-full p-1.5 text-[#54656F] transition-colors hover:bg-[#F0F2F5]" aria-label={t('wa.attach')} title={t('wa.attach')}>
                            {uploading ? <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} /> : <Paperclip className="h-5 w-5" strokeWidth={1.75} />}
                          </button>
                        </>
                      )}
                    </div>
                    <button type="submit" disabled={!canType || !text.trim()} className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-opacity disabled:opacity-60" style={{ background: WA.action }} aria-label="Send">
                      <SendHorizontal className="h-5 w-5" strokeWidth={1.75} />
                    </button>
                  </>
                )}
              </form>
            </div>
          </div>
        </div>

        {/* Operator notes */}
        <aside className="w-full max-w-[340px] space-y-4 lg:pt-7">
          <div className="rounded-lg border border-line bg-white p-4 shadow-card">
            <p className="text-[11px] font-medium uppercase tracking-wider text-primary">WhatsApp simulator</p>
            {tr ? (
              <>
                <h1 className="mt-1 text-lg font-semibold">{tr.name}</h1>
                <p className="num text-[12px] text-muted">{tr.unifiedId}</p>
                <p className="mt-1 text-[13px] text-ink">
                  {tr.course} · {tr.district}
                </p>
                {chat.data?.followUp && (
                  <div className="mt-3 flex items-center gap-2 text-[12px]">
                    <span className="text-muted">{chat.data.followUp.milestone.replace('MONTH_', 'Month-')} check-in</span>
                    <Chip tone={STATUS_TONE[chat.data.followUp.status]}>{STATUS_LABEL[chat.data.followUp.status]}</Chip>
                  </div>
                )}
              </>
            ) : (
              <Skeleton className="mt-2 h-16" />
            )}
          </div>
          <div className="rounded-lg border border-line bg-white p-4 shadow-card">
            <p className="text-[13px] font-medium">Conversation language</p>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-grid p-1">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLang.mutate(l.code)}
                  className={clsx('rounded-md py-1.5 text-[13px] font-medium transition-colors', uiLang === l.code ? 'bg-white text-primary-700 shadow-card' : 'text-muted hover:text-ink')}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-muted">Marathi by default. Switching re-sends the current question in the chosen language.</p>
          </div>
          <div className="flex gap-2.5 rounded-lg border border-line bg-white p-4 text-[12px] leading-5 text-muted shadow-card">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
            <p>
              This screen stands in for the trainee's phone. Every message comes from the same bot state machine that drives the WhatsApp Cloud API in production. Each reply is written to the database, and the Secretary's dashboard picks it up on its next 5-second refresh.
            </p>
          </div>
          {error && <p className="rounded-lg border border-[#F7CFCF] bg-danger-50 px-3 py-2 text-[13px] text-danger">{error}</p>}
          <Link to="/govt" target="_blank" className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:border-primary-200 hover:text-primary-700">
            Open the Secretary's dashboard <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
          </Link>
        </aside>
      </div>
    </div>
  );
}

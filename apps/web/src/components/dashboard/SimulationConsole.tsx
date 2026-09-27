import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Clapperboard, ExternalLink, FastForward, MessageSquareReply, Minus, Send, ShieldQuestion, BadgeCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { EASE_OUT } from '../../lib/motion';
import { Button } from '../ui';

interface SimStatus {
  cohort: string;
  total: number;
  counts: Record<string, number>;
  ramesh: { traineeId: string; status: string; verificationUrl: string | null } | null;
}

const ACTIONS = [
  { key: 'trigger-followups', label: 'Trigger Month-6 follow-up batch', hint: 'Nashik CNC cohort on WhatsApp', icon: <Send className="h-4 w-4" strokeWidth={1.5} /> },
  { key: 'simulate-replies', label: 'Simulate trainee replies', hint: 'Everyone except Ramesh answers or stays silent', icon: <MessageSquareReply className="h-4 w-4" strokeWidth={1.5} /> },
  { key: 'fraud-sweep', label: 'Run fraud sweep', hint: 'Four integrity rules across all providers', icon: <ShieldQuestion className="h-4 w-4" strokeWidth={1.5} /> },
  { key: 'advance-milestone', label: 'Advance to next milestone', hint: 'Reminders, then escalation; EPFO signals', icon: <FastForward className="h-4 w-4" strokeWidth={1.5} /> },
] as const;

// Director's chair for the live demo: compresses 24 months of follow-up into four buttons.
export function SimulationConsole() {
  const [open, setOpenState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ks.console') === 'open';
    } catch {
      return false;
    }
  });
  const setOpen = (v: boolean) => {
    setOpenState(v);
    try {
      localStorage.setItem('ks.console', v ? 'open' : 'closed');
    } catch {
      // Kept for this tab only.
    }
  };
  const [log, setLog] = useState<{ at: string; text: string }[]>([]);
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['sim-status'], queryFn: () => api<SimStatus>('/sim/status'), refetchInterval: 4000 });
  const run = useMutation({
    mutationFn: (key: string) => api<{ message: string }>(`/sim/${key}`, { method: 'POST' }),
    onSuccess: (res) => {
      setLog((l) => [{ at: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }), text: res.message }, ...l].slice(0, 4));
      qc.invalidateQueries();
    },
    onError: (err) => setLog((l) => [{ at: 'error', text: (err as Error).message }, ...l].slice(0, 4)),
  });
  const s = status.data;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[340px] max-w-[calc(100vw-2rem)]">
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div key="open" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } }} exit={{ opacity: 0, y: 8 }} className="overflow-hidden rounded-lg border border-navy-700 bg-navy text-white shadow-lift">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <span className="flex items-center gap-2 text-[13px] font-semibold">
                <Clapperboard className="h-4 w-4 text-saffron" strokeWidth={1.5} /> Simulation console
              </span>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-[#94A3B8] transition-colors hover:bg-white/10 hover:text-white" aria-label="Minimise console">
                <Minus className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            {s && (
              <div className="border-b border-white/10 px-4 py-2.5">
                <p className="text-[11px] text-[#94A3B8]">{s.cohort}</p>
                <div className="num mt-1 grid grid-cols-4 gap-1 text-center text-[11px]">
                  {(['SCHEDULED', 'SENT', 'RESPONDED', 'ESCALATED'] as const).map((k) => (
                    <div key={k} className="rounded bg-white/5 py-1">
                      <p className="text-[15px] font-semibold text-white">{s.counts[k] ?? 0}</p>
                      <p className="text-[10px] uppercase tracking-wide text-[#94A3B8]">{k === 'RESPONDED' ? 'answered' : k.toLowerCase()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5 px-3 py-3">
              {ACTIONS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  disabled={run.isPending}
                  onClick={() => run.mutate(a.key)}
                  className="flex w-full items-center gap-3 rounded-lg border border-white/10 px-3 py-2 text-left transition-colors hover:border-[#5EEAD4]/40 hover:bg-white/5 disabled:opacity-50"
                >
                  <span className="text-[#5EEAD4]">{a.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{run.isPending && run.variables === a.key ? 'Running…' : a.label}</span>
                    <span className="block truncate text-[11px] text-[#94A3B8]">{a.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            {s?.ramesh && (
              <div className="flex gap-2 border-t border-white/10 px-3 py-3">
                <a href={`/sim/whatsapp/${s.ramesh.traineeId}`} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-2 text-[12px] font-medium transition-colors hover:bg-primary-600">
                  Ramesh on WhatsApp <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                </a>
                {s.ramesh.verificationUrl ? (
                  <a href={new URL(s.ramesh.verificationUrl).pathname} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-saffron/60 px-2 py-2 text-[12px] font-medium text-saffron transition-colors hover:bg-saffron/10">
                    Employer link <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </a>
                ) : (
                  <span className="flex flex-1 items-center justify-center rounded-lg border border-white/10 px-2 py-2 text-center text-[11px] text-[#64748B]">Link appears after Ramesh replies</span>
                )}
              </div>
            )}
            {log.length > 0 && (
              <ul className="space-y-1 border-t border-white/10 px-4 py-2.5">
                {log.map((l, i) => (
                  <li key={i} className="text-[11px] leading-4 text-[#CBD5E1]">
                    <span className="num mr-1.5 text-[#64748B]">{l.at}</span>
                    {l.text}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : (
          <motion.div key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-end">
            <Button variant="primary" onClick={() => setOpen(true)} icon={<Clapperboard className="h-4 w-4" strokeWidth={1.5} />} className="shadow-lift">
              Simulation console
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

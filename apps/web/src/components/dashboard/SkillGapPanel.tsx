import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Quote, Sparkles } from 'lucide-react';
import { QUOTE_GLOSSES, type AiSummary, type DashboardFilters, type SkillGapRow } from '@kaushalsetu/shared';
import { api } from '../../lib/api';
import { itemVariants, listVariants } from '../../lib/motion';
import { EmptyState, ErrorState, ModeBadge, Skeleton } from '../ui';

export function SkillGapPanel({ filters }: { filters: DashboardFilters }) {
  const rows = useQuery({ queryKey: ['skill-gaps', filters], queryFn: () => api<SkillGapRow[]>('/analytics/skill-gaps', { query: { ...filters } }), refetchInterval: 5000, placeholderData: (p) => p });
  const summary = useQuery({ queryKey: ['skill-gap-summary', filters], queryFn: () => api<AiSummary>('/analytics/skill-gaps/summary', { query: { ...filters } }), refetchInterval: 15000, placeholderData: (p) => p });
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-4 p-5">
      <div className="rounded-lg border border-primary-100 bg-primary-50/60 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-primary-700">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} /> AI summary
          </span>
          {summary.data && (
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              {summary.data.engine} <ModeBadge mode={summary.data.mode} />
            </span>
          )}
        </div>
        {summary.isError && <ErrorState error={summary.error} compact onRetry={() => summary.refetch()} />}
        {!summary.data && !summary.isError && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        )}
        {summary.data && (
          <motion.div key={summary.data.headline} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <p className="text-[15px] font-semibold leading-6 text-ink">{summary.data.headline}</p>
            <ul className="mt-2 space-y-1 text-[13px] text-ink">
              {summary.data.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  {b}
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-primary-100 pt-2 text-[13px]">
              <span className="font-semibold text-primary-700">Recommendation: </span>
              {summary.data.recommendation}
            </p>
          </motion.div>
        )}
      </div>

      {rows.isError && <ErrorState error={rows.error} compact onRetry={() => rows.refetch()} />}
      {!rows.data && !rows.isError && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      )}
      {rows.data && rows.data.length === 0 && (
        <EmptyState title="No skill gaps reported in this scope yet" body="Mentions appear here when trainees answer the question on missing skills in the WhatsApp check-in or during an agent call." />
      )}
      {rows.data && rows.data.length > 0 && (
        <motion.ol className="divide-y divide-grid rounded-lg border border-line" variants={listVariants} initial="initial" animate="animate">
          {rows.data.slice(0, 8).map((r, i) => {
            const id = `${r.skillKey}|${r.district}|${r.courseCode}`;
            const isOpen = open === id;
            return (
              <motion.li key={id} variants={itemVariants}>
                <button type="button" onClick={() => setOpen(isOpen ? null : id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#FAFBFC]">
                  <span className="num w-4 text-[11px] text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{r.skill}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {r.district} · {r.courseName}
                    </span>
                  </span>
                  <span className="hidden w-28 sm:block">
                    <span className="block h-1.5 rounded-full bg-grid">
                      <span className="block h-1.5 rounded-full bg-saffron" style={{ width: `${Math.min(100, r.share * 100)}%` }} />
                    </span>
                  </span>
                  <span className="num w-24 text-right text-[12px] text-ink">
                    {r.mentions} of {r.cohortSize}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <ul className="space-y-2 px-10 pb-3">
                        {r.quotes.slice(0, 3).map((q) => (
                          <li key={q} className="flex gap-2 text-[13px]">
                            <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-saffron" strokeWidth={1.5} />
                            <span>
                              <span className="text-ink">{q}</span>
                              {QUOTE_GLOSSES[q] && <span className="block text-[12px] text-muted">{QUOTE_GLOSSES[q]}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </motion.ol>
      )}
    </div>
  );
}

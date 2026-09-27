import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { itemVariants, listVariants } from '../../lib/motion';
import { EmptyState, ErrorState, Skeleton } from '../ui';

interface Alert {
  id: string;
  rule: string;
  title: string;
  severity: string;
  detail: string;
  ruleText: string;
  provider: { id: string; name: string } | null;
  lastSeenAt: string;
}

export function IntegrityAlerts({ onOpenProvider }: { onOpenProvider: (id: string) => void }) {
  const q = useQuery({ queryKey: ['alerts'], queryFn: () => api<Alert[]>('/analytics/alerts'), refetchInterval: 5000 });
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data)
    return (
      <div className="space-y-2 p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  if (q.data.length === 0) return <EmptyState icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.5} />} title="All four integrity rules pass" body="The nightly sweep found no provider or record that needs review." />;
  return (
    <motion.ul className="scrollbar-thin max-h-[440px] space-y-2 overflow-y-auto p-4" variants={listVariants} initial="initial" animate="animate">
      {q.data.map((a) => (
        <motion.li key={a.id} variants={itemVariants}>
          <button
            type="button"
            onClick={() => a.provider && onOpenProvider(a.provider.id)}
            className={`w-full rounded-lg border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift ${a.severity === 'HIGH' ? 'border-[#F7CFCF] bg-danger-50/40' : 'border-line bg-white'}`}
          >
            <div className="flex items-start gap-2">
              <ShieldAlert className={`mt-0.5 h-4 w-4 shrink-0 ${a.severity === 'HIGH' ? 'text-danger' : 'text-warning'}`} strokeWidth={1.5} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">
                  {a.title}
                  {a.provider && <span className="font-normal text-muted"> · {a.provider.name}</span>}
                </p>
                <p className="mt-0.5 text-[12px] leading-5 text-ink">{a.detail}</p>
              </div>
            </div>
          </button>
        </motion.li>
      ))}
    </motion.ul>
  );
}

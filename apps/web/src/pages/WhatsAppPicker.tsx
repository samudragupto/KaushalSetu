import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronRight, MessageCircle } from 'lucide-react';
import { api } from '../lib/api';
import { itemVariants, listVariants } from '../lib/motion';
import { Logo } from '../components/layout/Logo';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';

interface Persona {
  id: string;
  name: string;
  unifiedId: string;
  district: string;
  course: string;
  provider: string;
  story: string;
}

export default function WhatsAppPicker() {
  const q = useQuery({ queryKey: ['personas'], queryFn: () => api<Persona[]>('/public/personas', { auth: 'none' }) });
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link to="/">
            <Logo />
          </Link>
          <span className="text-[12px] text-muted">WhatsApp simulator</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="flex items-center gap-2 text-primary">
          <MessageCircle className="h-5 w-5" strokeWidth={1.5} />
          <p className="text-xs font-medium uppercase tracking-wider">Pick a trainee's phone</p>
        </div>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.01em]">Twelve scripted trainees, one bot engine</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Each persona carries a seeded history. Ramesh Pawar's Month-6 check-in is the live demo: trigger it from the Secretary's simulation console, then answer here.
        </p>
        {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {!q.data && !q.isError && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        )}
        {q.data && q.data.length === 0 && <EmptyState title="The simulator is switched off on this deployment" body="Set DEMO_MODE=true on the API to enable it." />}
        {q.data && q.data.length > 0 && (
          <motion.ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" variants={listVariants} initial="initial" animate="animate">
            {q.data.map((p, i) => (
              <motion.li key={p.id} variants={itemVariants}>
                <Link
                  to={`/sim/whatsapp/${p.id}`}
                  className={`group flex h-full flex-col rounded-lg border bg-white p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift ${i === 0 ? 'border-primary-200' : 'border-line hover:border-primary-200'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink">{p.name}</p>
                      <p className="num text-[12px] text-muted">{p.unifiedId}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary" strokeWidth={1.5} />
                  </div>
                  <p className="mt-2 text-[12px] text-primary-700">
                    {p.course} · {p.district}
                  </p>
                  <p className="mt-1 flex-1 text-[13px] leading-5 text-muted">{p.story}</p>
                  {i === 0 && <span className="mt-3 w-fit rounded-full bg-saffron-50 px-2 py-0.5 text-[11px] font-medium text-[#B45309]">Live demo persona</span>}
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </main>
    </div>
  );
}

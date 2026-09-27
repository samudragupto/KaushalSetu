import clsx from 'clsx';

// Wordmark: an arch (setu, bridge) over three pillars (training, work, growth).
export function Logo({ tone = 'dark', compact = false }: { tone?: 'dark' | 'light'; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill={tone === 'light' ? '#1E293B' : '#0F172A'} />
        <path d="M7 20c4-7 14-7 18 0" fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M9 20v4M16 15.5V24M23 20v4" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {!compact && (
        <span className={clsx('text-[15px] font-semibold tracking-[-0.01em]', tone === 'light' ? 'text-white' : 'text-ink')}>
          Kaushal<span className={tone === 'light' ? 'text-[#5EEAD4]' : 'text-primary'}>Setu</span>
        </span>
      )}
    </span>
  );
}

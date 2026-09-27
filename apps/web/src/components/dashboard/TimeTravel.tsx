import { useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { dateShort } from '../../lib/format';
import { Chip } from '../ui';

function monthsBackFromAsOf(asOf?: string): number {
  if (!asOf) return 0;
  const d = new Date(`${asOf}T00:00:00Z`);
  const now = new Date();
  return Math.max(0, Math.min(24, Math.round((now.getTime() - d.getTime()) / (30.44 * 86_400_000))));
}

function asOfFromMonthsBack(m: number): string | undefined {
  if (m === 0) return undefined;
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - m);
  return d.toISOString().slice(0, 10);
}

// "As-of date" control: every metric on the dashboard is recomputed as if today were that date.
export function TimeTravel({ asOf, onChange }: { asOf?: string; onChange: (asOf: string | undefined) => void }) {
  const [months, setMonths] = useState(monthsBackFromAsOf(asOf));
  useEffect(() => setMonths(monthsBackFromAsOf(asOf)), [asOf]);
  useEffect(() => {
    const target = asOfFromMonthsBack(months);
    if (target === asOf || monthsBackFromAsOf(asOf) === months) return;
    const t = setTimeout(() => onChange(target), 300);
    return () => clearTimeout(t);
  }, [months, asOf, onChange]);

  const label = months === 0 ? 'Today' : dateShort(asOfFromMonthsBack(months) ?? null);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#FBE3B5] bg-saffron-50/60 px-3 py-2">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#92400E]">
        <History className="h-4 w-4" strokeWidth={1.5} /> As-of date
      </span>
      <input
        type="range"
        min={0}
        max={24}
        step={1}
        value={24 - months}
        onChange={(e) => setMonths(24 - Number(e.target.value))}
        className="h-1.5 w-[220px] cursor-pointer accent-[#0F766E]"
        aria-label="Months back in time"
      />
      <span className="num min-w-[92px] text-[13px] font-semibold text-ink">{label}</span>
      {months !== 12 && (
        <Chip onClick={() => setMonths(12)} tone="saffron">
          12 months ago
        </Chip>
      )}
      {months !== 0 && (
        <button type="button" onClick={() => setMonths(0)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-primary-700 transition-colors hover:bg-primary-50">
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to today
        </button>
      )}
      <span className="rounded-full border border-[#FBE3B5] bg-white px-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#B45309]">Demo</span>
    </div>
  );
}

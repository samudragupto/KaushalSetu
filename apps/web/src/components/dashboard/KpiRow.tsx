import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { KpiSet, KpiValue } from '@kaushalsetu/shared';
import { itemVariants, listVariants, useCountUp } from '../../lib/motion';
import { Skeleton } from '../ui';

interface KpiDef {
  key: keyof Omit<KpiSet, 'traineesInScope' | 'completedTraining'>;
  label: string;
  kind: 'pct' | 'inr';
  sub: (k: KpiValue) => string;
  help: string;
}

const DEFS: KpiDef[] = [
  { key: 'placementRate90', label: 'Placement, 90 days', kind: 'pct', sub: (k) => `${k.numerator.toLocaleString('en-IN')} / ${k.denominator.toLocaleString('en-IN')}`, help: 'Share of trainees placed in a job, apprenticeship or self-employment within 90 days of batch end.' },
  { key: 'retention6', label: 'Retention, 6 months', kind: 'pct', sub: (k) => `${k.numerator.toLocaleString('en-IN')} / ${k.denominator.toLocaleString('en-IN')}`, help: 'Of trainees placed at least six months ago, the share still working six months after placement.' },
  { key: 'medianWage', label: 'Median monthly wage', kind: 'inr', sub: (k) => `n = ${k.denominator.toLocaleString('en-IN')}`, help: 'Median current monthly wage of employed trainees who consented to wage tracking.' },
  { key: 'wageGrowth12', label: 'Wage growth, 12 months', kind: 'pct', sub: (k) => `n = ${k.denominator.toLocaleString('en-IN')}`, help: 'Median change between starting wage and wage twelve months after placement.' },
  { key: 'selfEmploymentShare', label: 'Self-employment share', kind: 'pct', sub: (k) => `${k.numerator.toLocaleString('en-IN')} / ${k.denominator.toLocaleString('en-IN')}`, help: 'Share of currently working trainees who run their own business.' },
  { key: 'verificationRate', label: 'Verification rate', kind: 'pct', sub: (k) => `${k.numerator.toLocaleString('en-IN')} / ${k.denominator.toLocaleString('en-IN')}`, help: 'Employment records confirmed by the employer link, EPFO signal or agent call.' },
];

function KpiCard({ def, value, showDelta }: { def: KpiDef; value: KpiValue; showDelta: boolean }) {
  const raw = value.value === null ? null : def.kind === 'pct' ? value.value * 100 : value.value;
  const v = useCountUp(raw);
  const delta = value.deltaVsState;
  const deltaPts = delta === null || delta === undefined ? null : def.kind === 'pct' ? delta * 100 : delta;
  return (
    <motion.div variants={itemVariants} className="group rounded-lg border border-line bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift" title={def.help}>
      <p className="truncate text-[12px] font-medium text-muted">{def.label}</p>
      <p className="num mt-1.5 text-[26px] font-semibold leading-8 text-ink">
        {v === null ? <span className="text-[#C4C8CF]">—</span> : def.kind === 'pct' ? `${v.toFixed(1)}%` : `₹${Math.round(v).toLocaleString('en-IN')}`}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="num truncate text-[11px] text-muted">{value.denominator ? def.sub(value) : 'no trainees in scope yet'}</p>
        {showDelta && deltaPts !== null && Math.abs(deltaPts) >= (def.kind === 'pct' ? 0.05 : 1) && (
          <span
            className={clsx(
              'num inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[11px] font-medium',
              deltaPts > 0 ? 'bg-success-50 text-success' : 'bg-danger-50 text-danger',
            )}
            title="Compared with the Maharashtra average for the same date"
          >
            {deltaPts > 0 ? <ArrowUpRight className="h-3 w-3" strokeWidth={1.5} /> : <ArrowDownRight className="h-3 w-3" strokeWidth={1.5} />}
            {def.kind === 'pct' ? `${Math.abs(deltaPts).toFixed(1)} pts` : `₹${Math.abs(Math.round(deltaPts)).toLocaleString('en-IN')}`}
          </span>
        )}
        {showDelta && deltaPts !== null && Math.abs(deltaPts) < (def.kind === 'pct' ? 0.05 : 1) && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-muted">
            <Minus className="h-3 w-3" strokeWidth={1.5} /> state avg
          </span>
        )}
      </div>
    </motion.div>
  );
}

export function KpiRow({ kpis, filtered }: { kpis: KpiSet | undefined; filtered: boolean }) {
  if (!kpis)
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {DEFS.map((d) => (
          <div key={d.key} className="rounded-lg border border-line bg-surface p-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-3 h-7 w-20" />
            <Skeleton className="mt-3 h-3 w-24" />
          </div>
        ))}
      </div>
    );
  return (
    <motion.div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" variants={listVariants} initial="initial" animate="animate">
      {DEFS.map((d) => (
        <KpiCard key={d.key} def={d} value={kpis[d.key]} showDelta={filtered} />
      ))}
    </motion.div>
  );
}

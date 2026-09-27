import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import type { ReasonSlice } from '@kaushalsetu/shared';
import { itemVariants, listVariants } from '../../lib/motion';
import { EmptyState } from '../ui';

// One hue (teal) at decreasing strength, so rank reads as intensity rather than as category colour.
const SHADES = ['#0F766E', '#2E8A83', '#4F9F99', '#76B6B0', '#9CCBC7', '#C2E0DD', '#D9E2E1'];

function SliceTooltip({ active, payload }: { active?: boolean; payload?: { payload: ReasonSlice }[] }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift">
      <p className="font-medium text-ink">{s.label}</p>
      <p className="num text-muted">
        {s.count.toLocaleString('en-IN')} trainees · {(s.pct * 100).toFixed(1)}%
      </p>
    </div>
  );
}

export function ReasonsDonut({ slices, total }: { slices: ReasonSlice[]; total: number }) {
  if (!slices.length) return <EmptyState title="No reasons recorded in this scope yet" body="Reasons are captured when a trainee tells the bot or a field agent why they left work or are not working." />;
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[200px_1fr]">
      <div className="relative h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="count" nameKey="label" innerRadius={62} outerRadius={92} paddingAngle={1.5} stroke="none" isAnimationActive animationDuration={700}>
              {slices.map((s, i) => (
                <Cell key={s.reason} fill={SHADES[Math.min(i, SHADES.length - 1)]} />
              ))}
            </Pie>
            <Tooltip content={<SliceTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-xl font-semibold">{total.toLocaleString('en-IN')}</span>
          <span className="text-[11px] text-muted">trainees</span>
        </div>
      </div>
      <motion.ol className="space-y-2" variants={listVariants} initial="initial" animate="animate">
        {slices.map((s, i) => (
          <motion.li key={s.reason} variants={itemVariants}>
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="flex items-center gap-2">
                <span className="num w-4 text-[11px] text-muted">{i + 1}</span>
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SHADES[Math.min(i, SHADES.length - 1)] }} />
                <span className="text-ink">{s.label}</span>
              </span>
              <span className="num font-medium text-ink">{(s.pct * 100).toFixed(1)}%</span>
            </div>
            <div className="ml-6 mt-1 h-1 rounded-full bg-grid">
              <motion.div className="h-1 rounded-full" style={{ background: SHADES[Math.min(i, SHADES.length - 1)] }} initial={{ width: 0 }} animate={{ width: `${s.pct * 100}%` }} transition={{ duration: 0.7, ease: 'easeOut' }} />
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RetentionSeries } from '@kaushalsetu/shared';
import { Chip } from '../ui';

const TICK = { fontSize: 11, fill: '#6B7280', fontFamily: 'JetBrains Mono, monospace' };

interface TooltipEntry {
  dataKey: string;
  value: number | null;
  color: string;
  payload: Record<string, number | string | null>;
}

function ChartTooltip({ active, payload, label, highlight }: { active?: boolean; payload?: TooltipEntry[]; label?: string; highlight: string }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.dataKey === 'All' || p.dataKey === highlight);
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift">
      <p className="mb-1 font-medium text-ink">{label === 'Placed' ? 'At placement' : `${label} after placement`}</p>
      {rows.map((r) => (
        <p key={r.dataKey} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: r.dataKey === 'All' ? '#0F172A' : '#0F766E' }} />
            {r.dataKey === 'All' ? 'All sectors in scope' : r.dataKey}
          </span>
          <span className="num font-medium text-ink">{r.value === null ? '—' : `${(r.value * 100).toFixed(1)}%`}</span>
        </p>
      ))}
      <p className="num mt-1 text-[10px] text-muted">base: {String(rows[0]?.payload[`${rows[0]?.dataKey}__base`] ?? '')} trainees</p>
    </div>
  );
}

export function RetentionChart({ series, overall }: { series: RetentionSeries[]; overall: RetentionSeries }) {
  const worst = useMemo(() => {
    let best: RetentionSeries | null = null;
    for (const s of series) {
      const v = s.points.find((p) => p.month === 12)?.value;
      if (v === null || v === undefined) continue;
      const cur = best?.points.find((p) => p.month === 12)?.value ?? 2;
      if (v < cur) best = s;
    }
    return best?.short ?? series[0]?.short ?? 'All';
  }, [series]);
  const [picked, setPicked] = useState<string | null>(null);
  const highlight = picked && series.some((s) => s.short === picked) ? picked : series.length === 1 ? series[0].short : worst;

  const data = overall.points.map((p, i) => {
    const row: Record<string, number | string | null> = { label: p.label, All: p.value, All__base: p.base };
    for (const s of series) {
      row[s.short] = s.points[i]?.value ?? null;
      row[`${s.short}__base`] = s.points[i]?.base ?? 0;
    }
    return row;
  });

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {series.map((s) => (
            <Chip key={s.short} active={s.short === highlight} onClick={() => setPicked(s.short)}>
              {s.short}
            </Chip>
          ))}
        </div>
      )}
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="#EEF0F3" vertical={false} />
            <XAxis dataKey="label" tick={TICK} axisLine={{ stroke: '#E6E8EC' }} tickLine={false} />
            <YAxis domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={TICK} axisLine={false} tickLine={false} width={48} />
            <Tooltip content={<ChartTooltip highlight={highlight} />} cursor={{ stroke: '#E6E8EC' }} />
            {series
              .filter((s) => s.short !== highlight)
              .map((s) => (
                <Line key={s.short} type="monotone" dataKey={s.short} stroke="#D6DAE0" strokeWidth={1.25} dot={false} connectNulls isAnimationActive animationDuration={700} />
              ))}
            <Line type="monotone" dataKey="All" stroke="#0F172A" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls isAnimationActive animationDuration={700} />
            <Line
              key={highlight}
              type="monotone"
              dataKey={highlight}
              stroke="#0F766E"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: '#FFFFFF', stroke: '#0F766E', strokeWidth: 2 }}
              activeDot={{ r: 5, fill: '#0F766E', stroke: '#FFFFFF', strokeWidth: 2 }}
              connectNulls
              isAnimationActive
              animationDuration={700}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-primary" /> {highlight}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t border-dashed border-navy" /> All sectors in scope
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-[#D6DAE0]" /> Other sectors
        </span>
      </div>
    </div>
  );
}

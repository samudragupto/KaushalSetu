import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { EyeOff, ShieldCheck } from 'lucide-react';
import { SECTOR_BY_NAME } from '@kaushalsetu/shared';
import { api } from '../lib/api';
import { dateShort, inr, pct } from '../lib/format';
import { useCountUp } from '../lib/motion';
import { Logo } from '../components/layout/Logo';
import { MaharashtraMap, MapLegend } from '../components/charts/MaharashtraMap';
import { Card, CardHeader, ErrorState, Skeleton } from '../components/ui';
import { DataTable, type Column } from '../components/ui/DataTable';

interface Aggregates {
  asOf: string;
  minCellSize: number;
  consentingTrainees: number;
  excludedForConsent: number;
  state: { placementRate: number | null; retention6: number | null; medianWage: number | null; selfEmploymentShare: number | null };
  districts: { district: string; division: string; trainees: number | null; placementRate: number | null; retention6: number | null; medianWage: number | null }[];
  sectors: { sector: string; placementRate: number | null; retention6: number | null; medianWage: number | null }[];
  suppressedCells: number;
}

function Big({ label, value, kind }: { label: string; value: number | null; kind: 'pct' | 'inr' }) {
  const v = useCountUp(value === null ? null : kind === 'pct' ? value * 100 : value);
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="num mt-1 text-2xl font-semibold">{v === null ? '—' : kind === 'pct' ? `${v.toFixed(1)}%` : `₹${Math.round(v).toLocaleString('en-IN')}`}</p>
    </div>
  );
}

const Suppressed = () => (
  <span className="inline-flex items-center gap-1 text-[12px] text-muted" title="Fewer than 10 people; suppressed">
    <EyeOff className="h-3 w-3" strokeWidth={1.5} /> suppressed
  </span>
);

export default function PublicAggregates() {
  const q = useQuery({ queryKey: ['public-aggregates'], queryFn: () => api<Aggregates>('/public/aggregates', { auth: 'none' }), refetchInterval: 30000 });
  const d = q.data;
  const values = useMemo(() => Object.fromEntries((d?.districts ?? []).map((x) => [x.district, x.placementRate])), [d]);
  const range = useMemo(() => {
    const v = Object.values(values).filter((x): x is number => typeof x === 'number');
    return v.length ? [Math.min(...v), Math.max(...v)] : [null, null];
  }, [values]);

  const cols: Column<Aggregates['districts'][number]>[] = [
    { key: 'district', header: 'District', render: (r) => <div><p className="font-medium">{r.district}</p><p className="text-[12px] text-muted">{r.division} division</p></div>, sortValue: (r) => r.district, csv: (r) => r.district },
    { key: 'trainees', header: 'Trainees', align: 'right', render: (r) => (r.trainees === null ? <Suppressed /> : <span className="num">{r.trainees.toLocaleString('en-IN')}</span>), sortValue: (r) => r.trainees, csv: (r) => r.trainees ?? 'suppressed' },
    { key: 'placement', header: 'Placement', align: 'right', render: (r) => (r.placementRate === null ? <Suppressed /> : <span className="num">{pct(r.placementRate, 1)}</span>), sortValue: (r) => r.placementRate, csv: (r) => (r.placementRate === null ? 'suppressed' : pct(r.placementRate, 1)) },
    { key: 'retention', header: 'Retention 6m', align: 'right', render: (r) => (r.retention6 === null ? <Suppressed /> : <span className="num">{pct(r.retention6, 1)}</span>), sortValue: (r) => r.retention6, csv: (r) => (r.retention6 === null ? 'suppressed' : pct(r.retention6, 1)) },
    { key: 'wage', header: 'Median wage', align: 'right', render: (r) => (r.medianWage === null ? <Suppressed /> : <span className="num">{inr(r.medianWage)}</span>), sortValue: (r) => r.medianWage, csv: (r) => (r.medianWage === null ? 'suppressed' : r.medianWage) },
  ];

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link to="/">
            <Logo />
          </Link>
          <span className="text-[12px] text-muted">Open data · Skill Development Department, Government of Maharashtra</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 px-5 py-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Public statistics</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.01em]">Outcomes of state-funded skill training in Maharashtra</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Anonymised totals only. No names, IDs, phone numbers or employers are published. Figures include only trainees who agreed to be counted in public statistics, and any figure based on fewer than 10 people is withheld.
          </p>
        </div>
        {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {!d && !q.isError && (
          <div className="grid gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        )}
        {d && (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <Big label="Placement within 90 days" value={d.state.placementRate} kind="pct" />
              <Big label="Still working after 6 months" value={d.state.retention6} kind="pct" />
              <Big label="Median monthly wage" value={d.state.medianWage} kind="inr" />
              <Big label="Self-employed among working" value={d.state.selfEmploymentShare} kind="pct" />
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary-100 bg-primary-50/60 px-4 py-2.5 text-[13px] text-primary-700">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
              Based on <span className="num font-semibold">{d.consentingTrainees.toLocaleString('en-IN')}</span> consenting trainees. <span className="num font-semibold">{d.excludedForConsent.toLocaleString('en-IN')}</span> excluded at their request. <span className="num font-semibold">{d.suppressedCells}</span> district figures withheld because fewer than 10 people are behind them. As of {dateShort(d.asOf)}.
            </div>
            <div className="grid gap-4 lg:grid-cols-12">
              <Card className="lg:col-span-5">
                <CardHeader title="Placement by district" subtitle="Grey districts are suppressed" />
                <div className="px-3">
                  <MaharashtraMap values={values} height={360} tooltip={(name) => { const x = d.districts.find((y) => y.district === name); return <div><p className="font-semibold">{name}</p><p className="num text-muted">{x?.placementRate === null || !x ? 'Suppressed (fewer than 10)' : `Placement ${pct(x.placementRate, 1)}`}</p></div>; }} />
                </div>
                <div className="border-t border-line px-5 py-2.5">
                  <MapLegend min={range[0]} max={range[1]} label="Placement" format={(v) => pct(v)} />
                </div>
              </Card>
              <Card className="lg:col-span-7">
                <CardHeader title="By sector" />
                <div className="divide-y divide-grid">
                  {d.sectors.map((s) => (
                    <div key={s.sector} className="grid grid-cols-[1fr_repeat(3,90px)] items-center gap-2 px-5 py-2.5 text-[13px]">
                      <span>{SECTOR_BY_NAME[s.sector]?.short ?? s.sector}</span>
                      <span className="num text-right">{s.placementRate === null ? '—' : pct(s.placementRate, 1)}</span>
                      <span className="num text-right">{s.retention6 === null ? '—' : pct(s.retention6, 1)}</span>
                      <span className="num text-right">{inr(s.medianWage)}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1fr_repeat(3,90px)] gap-2 bg-[#FAFBFC] px-5 py-2 text-[11px] text-muted">
                    <span />
                    <span className="text-right">Placement</span>
                    <span className="text-right">Retention 6m</span>
                    <span className="text-right">Median wage</span>
                  </div>
                </div>
              </Card>
            </div>
            <Card>
              <CardHeader title="District table" subtitle="Download the same figures as CSV" />
              <DataTable rows={d.districts} columns={cols} rowKey={(r) => r.district} exportName="maharashtra-skilling-outcomes-public" searchText={(r) => `${r.district} ${r.division}`} searchPlaceholder="Search districts" maxHeight={480} />
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

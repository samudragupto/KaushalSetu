import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Brain, GitCompareArrows, Map as MapIcon, ShieldAlert, Trophy } from 'lucide-react';
import { SECTOR_BY_NAME, type DashboardPayload, type LeagueRow } from '@kaushalsetu/shared';
import { api } from '../lib/api';
import { useDemo } from '../lib/demo';
import { useFilters } from '../lib/filters';
import { dateShort, inr, pct } from '../lib/format';
import { PageHeader } from '../components/layout/AppShell';
import { Card, CardHeader, Chip, ErrorState, Skeleton } from '../components/ui';
import { KpiRow } from '../components/dashboard/KpiRow';
import { FilterBar, useFilterOptions } from '../components/dashboard/FilterBar';
import { TimeTravel } from '../components/dashboard/TimeTravel';
import { MaharashtraMap, MapLegend } from '../components/charts/MaharashtraMap';
import { RetentionChart } from '../components/charts/RetentionChart';
import { ReasonsDonut } from '../components/charts/ReasonsDonut';
import { LeagueTable } from '../components/dashboard/LeagueTable';
import { SkillGapPanel } from '../components/dashboard/SkillGapPanel';
import { IntegrityAlerts } from '../components/dashboard/IntegrityAlerts';
import { ProviderDrawer } from '../components/dashboard/ProviderDrawer';
import { SimulationConsole } from '../components/dashboard/SimulationConsole';

type MapMetric = 'placementRate' | 'retention6' | 'verificationRate' | 'medianWage';
const MAP_METRICS: { key: MapMetric; label: string }[] = [
  { key: 'placementRate', label: 'Placement' },
  { key: 'retention6', label: 'Retention 6m' },
  { key: 'verificationRate', label: 'Verified' },
  { key: 'medianWage', label: 'Wage' },
];

export default function GovtDashboard() {
  const { filters, setFilter, clear, active } = useFilters();
  const { enabled: demo } = useDemo();
  const options = useFilterOptions();
  const [metric, setMetric] = useState<MapMetric>('placementRate');
  const [reasonKind, setReasonKind] = useState<'attrition' | 'nonplacement'>('attrition');
  const [providerId, setProviderId] = useState<string | null>(null);

  const dash = useQuery({
    queryKey: ['dashboard', filters],
    queryFn: () => api<DashboardPayload>('/analytics/dashboard', { query: { ...filters } }),
    refetchInterval: 5000,
    placeholderData: (prev) => prev,
  });
  const league = useQuery({
    queryKey: ['league', filters],
    queryFn: () => api<LeagueRow[]>('/analytics/league', { query: { ...filters } }),
    refetchInterval: 5000,
    placeholderData: (prev) => prev,
  });

  const d = dash.data;
  const mapValues = useMemo(() => Object.fromEntries((d?.districts ?? []).map((x) => [x.district, x[metric]])), [d, metric]);
  const districtIndex = useMemo(() => new Map((d?.districts ?? []).map((x) => [x.district, x])), [d]);
  const mapRange = useMemo(() => {
    const vals = Object.values(mapValues).filter((v): v is number => typeof v === 'number');
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : [null, null];
  }, [mapValues]);

  const courseName = options.data?.courses.find((c) => c.code === filters.course)?.name;
  const providerName = options.data?.providers.find((p) => p.id === filters.provider)?.name;
  const scope = [filters.district, courseName ?? (filters.sector ? SECTOR_BY_NAME[filters.sector]?.short : null), providerName].filter(Boolean).join(' · ') || 'All of Maharashtra';
  const pulse = d?.weeklyPulse;
  const reasons = reasonKind === 'attrition' ? d?.reasons ?? [] : d?.nonPlacementReasons ?? [];

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        eyebrow={filters.asOf ? `Viewing the state as of ${dateShort(filters.asOf)}` : 'Live · refreshes every 5 seconds'}
        title="Post-training outcomes"
        subtitle={
          d ? (
            <>
              {scope} · <span className="num">{d.kpis.traineesInScope.toLocaleString('en-IN')}</span> trainees in scope
              {pulse && pulse.sent > 0 && (
                <>
                  {' · '}
                  <span className="num">{pulse.responded}</span> of <span className="num">{pulse.sent}</span> follow-ups answered{pulse.district ? ` in ${pulse.district}` : ''} this week
                </>
              )}
            </>
          ) : (
            'Loading the latest figures'
          )
        }
        actions={
          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            <span className={`h-2 w-2 rounded-full ${dash.isFetching ? 'bg-saffron' : dash.isError ? 'bg-danger' : 'bg-success'}`} />
            {dash.isError ? 'Connection lost, retrying' : `Data version ${d?.dataVersion ?? '…'}`}
          </span>
        }
      />

      <div className="space-y-2">
        <FilterBar filters={filters} setFilter={setFilter} clear={clear} active={active} />
        {demo && <TimeTravel asOf={filters.asOf} onChange={(v) => setFilter('asOf', v)} />}
      </div>

      {dash.isError && !d ? <ErrorState error={dash.error} onRetry={() => dash.refetch()} /> : <KpiRow kpis={d?.kpis} filtered={active > 0} />}

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader
            icon={<MapIcon className="h-4 w-4" strokeWidth={1.5} />}
            title="District performance"
            subtitle={filters.district ? `${filters.district} selected. Click it again to clear.` : 'Click a district to filter every panel.'}
            actions={
              <div className="flex gap-1">
                {MAP_METRICS.map((m) => (
                  <Chip key={m.key} active={metric === m.key} onClick={() => setMetric(m.key)}>
                    {m.label}
                  </Chip>
                ))}
              </div>
            }
          />
          <div className="px-3 pt-2">
            {!d ? (
              <Skeleton className="m-2 h-[400px]" />
            ) : (
              <MaharashtraMap
                values={mapValues}
                selected={filters.district}
                onSelect={(name) => setFilter('district', filters.district === name ? undefined : name)}
                pulse={filters.district ? [filters.district] : []}
                height={410}
                tooltip={(name) => {
                  const x = districtIndex.get(name);
                  return (
                    <div>
                      <p className="mb-1 text-[13px] font-semibold text-ink">{name}</p>
                      {x && x.trainees > 0 ? (
                        <dl className="num grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[12px]">
                          <dt className="font-sans text-muted">Trainees</dt>
                          <dd>{x.trainees.toLocaleString('en-IN')}</dd>
                          <dt className="font-sans text-muted">Placement</dt>
                          <dd>{pct(x.placementRate, 1)}</dd>
                          <dt className="font-sans text-muted">Retention 6m</dt>
                          <dd>{pct(x.retention6, 1)}</dd>
                          <dt className="font-sans text-muted">Verified</dt>
                          <dd>{pct(x.verificationRate, 1)}</dd>
                          <dt className="font-sans text-muted">Median wage</dt>
                          <dd>{inr(x.medianWage)}</dd>
                        </dl>
                      ) : (
                        <p className="text-[12px] text-muted">No trainees in the current filter.</p>
                      )}
                    </div>
                  );
                }}
              />
            )}
          </div>
          <div className="border-t border-line px-5 py-2.5">
            <MapLegend min={mapRange[0]} max={mapRange[1]} label={MAP_METRICS.find((m) => m.key === metric)?.label ?? ''} format={(v) => (metric === 'medianWage' ? inr(v) : pct(v))} />
          </div>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader icon={<Activity className="h-4 w-4" strokeWidth={1.5} />} title="Cohort retention after placement" subtitle="Share still working at each point after first placement" />
          <div className="p-5">{d ? <RetentionChart series={d.retention} overall={d.retentionOverall} /> : <Skeleton className="h-[300px]" />}</div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader icon={<Brain className="h-4 w-4" strokeWidth={1.5} />} title="Skill gap report" subtitle="What trainees say they were missing, ranked by mentions against the trainees not in work in that cohort" />
          <SkillGapPanel filters={filters} />
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader
            icon={<GitCompareArrows className="h-4 w-4" strokeWidth={1.5} />}
            title={reasonKind === 'attrition' ? 'Why placed trainees left work' : 'Why trainees were not placed'}
            subtitle="Reason given on WhatsApp or to a field agent"
            actions={
              <div className="flex gap-1">
                <Chip active={reasonKind === 'attrition'} onClick={() => setReasonKind('attrition')}>
                  Attrition
                </Chip>
                <Chip active={reasonKind === 'nonplacement'} onClick={() => setReasonKind('nonplacement')}>
                  Not placed
                </Chip>
              </div>
            }
          />
          <div className="p-5">{d ? <ReasonsDonut slices={reasons} total={reasons.reduce((a, b) => a + b.count, 0)} /> : <Skeleton className="h-[200px]" />}</div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader icon={<Trophy className="h-4 w-4" strokeWidth={1.5} />} title="Provider league table" subtitle="Claimed placement against independently verified placement. Select a provider for its records." />
          {league.isError ? <ErrorState error={league.error} onRetry={() => league.refetch()} /> : <LeagueTable rows={league.data} loading={!league.data} onOpen={(r) => setProviderId(r.providerId)} />}
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader icon={<ShieldAlert className="h-4 w-4" strokeWidth={1.5} />} title="Integrity alerts" subtitle="Rules run nightly and on demand" />
          <IntegrityAlerts onOpenProvider={setProviderId} />
        </Card>
      </div>

      <ProviderDrawer providerId={providerId} onClose={() => setProviderId(null)} asOf={filters.asOf} />
      {demo && <SimulationConsole />}
    </div>
  );
}

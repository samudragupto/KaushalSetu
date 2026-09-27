import { ShieldAlert } from 'lucide-react';
import type { LeagueRow } from '@kaushalsetu/shared';
import { inr, pct } from '../../lib/format';
import { Chip } from '../ui';
import { DataTable, type Column } from '../ui/DataTable';

function Bar({ value, tone = 'primary' }: { value: number | null; tone?: 'primary' | 'danger' }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="num w-12 text-right text-[13px]">{pct(value)}</span>
      <span className="hidden h-1.5 w-12 rounded-full bg-grid 2xl:block">
        <span className={`block h-1.5 rounded-full ${tone === 'danger' ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${Math.round((value ?? 0) * 100)}%` }} />
      </span>
    </div>
  );
}

export function LeagueTable({ rows, loading, onOpen }: { rows: LeagueRow[] | undefined; loading: boolean; onOpen: (row: LeagueRow) => void }) {
  const columns: Column<LeagueRow>[] = [
    {
      key: 'name',
      header: 'Provider',
      render: (r) => (
        <div className="min-w-[190px] py-0.5">
          <p className="font-medium leading-5 text-ink">{r.name}</p>
          <p className="text-[12px] text-muted">
            {r.type === 'PRIVATE' ? 'Private' : r.type === 'POLYTECHNIC' ? 'Polytechnic' : r.type} · {r.district} · <span className="num">{r.trainees.toLocaleString('en-IN')}</span> trainees
          </p>
          {r.flags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {r.flags.map((f) => (
                <Chip key={f.rule + f.title} tone={f.severity === 'HIGH' ? 'danger' : 'warning'} icon={<ShieldAlert className="h-3 w-3" strokeWidth={1.5} />}>
                  {f.title}
                </Chip>
              ))}
            </div>
          )}
        </div>
      ),
      sortValue: (r) => r.name,
      csv: (r) => `${r.name}${r.flags.length ? ` [${r.flags.map((f) => f.title).join('; ')}]` : ''}`,
    },
    { key: 'trainees', header: 'Trainees', align: 'right', render: () => null, csv: (r) => r.trainees, csvOnly: true },
    { key: 'placement', header: 'Placement', align: 'right', render: (r) => <Bar value={r.placementRate} />, sortValue: (r) => r.placementRate, csv: (r) => pct(r.placementRate, 1) },
    { key: 'verified', header: 'Verified', align: 'right', render: (r) => <Bar value={r.verifiedRate} tone={r.verifiedRate !== null && r.verifiedRate < 0.4 ? 'danger' : 'primary'} />, sortValue: (r) => r.verifiedRate, csv: (r) => pct(r.verifiedRate, 1) },
    { key: 'retention', header: 'Retention 6m', align: 'right', render: (r) => <span className="num">{pct(r.retention6)}</span>, sortValue: (r) => r.retention6, csv: (r) => pct(r.retention6, 1) },
    { key: 'wage', header: 'Median wage', align: 'right', render: (r) => <span className="num">{inr(r.medianWage)}</span>, sortValue: (r) => r.medianWage },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.providerId}
      loading={loading}
      searchText={(r) => `${r.name} ${r.district}`}
      searchPlaceholder="Search 46 providers or districts"
      exportName="provider-league-table"
      onRowClick={onOpen}
      maxHeight={440}
      emptyTitle="No providers have trainees in this filter"
    />
  );
}

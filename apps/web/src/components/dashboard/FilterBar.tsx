import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X } from 'lucide-react';
import { SECTOR_BY_NAME, SOCIAL_CATEGORY_LABELS, type DashboardFilters, type FilterOptions } from '@kaushalsetu/shared';
import { api } from '../../lib/api';
import { GENDER_LABEL, monthLabel } from '../../lib/format';
import { Button, Select, Skeleton } from '../ui';

export function useFilterOptions() {
  return useQuery({ queryKey: ['filter-options'], queryFn: () => api<FilterOptions>('/meta/filters'), staleTime: 5 * 60_000 });
}

interface Props {
  filters: DashboardFilters;
  setFilter: (k: keyof DashboardFilters, v: string | undefined) => void;
  clear: () => void;
  active: number;
}

function FilterSelect({ label, value, onChange, children, width = 'w-[136px]' }: { label: string; value?: string; onChange: (v: string | undefined) => void; children: React.ReactNode; width?: string }) {
  return (
    <label className={`${width} shrink-0`}>
      <span className="sr-only">{label}</span>
      <Select value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} className={value ? 'border-primary-200 bg-primary-50/50 font-medium text-primary-700' : ''} aria-label={label}>
        <option value="">{label}</option>
        {children}
      </Select>
    </label>
  );
}

export function FilterBar({ filters, setFilter, clear, active }: Props) {
  const opts = useFilterOptions();
  if (!opts.data) {
    return (
      <div className="flex gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-[140px]" />
        ))}
      </div>
    );
  }
  const o = opts.data;
  const courses = filters.sector ? o.courses.filter((c) => c.sector === filters.sector) : o.courses;
  const providers = filters.district ? o.providers.filter((p) => p.district === filters.district) : o.providers;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 hidden items-center gap-1.5 text-xs font-medium text-muted 2xl:flex">
        <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} /> Filters
      </span>
      <FilterSelect label="All districts" value={filters.district} onChange={(v) => setFilter('district', v)}>
        {o.districts.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="All sectors" value={filters.sector} onChange={(v) => setFilter('sector', v)}>
        {o.sectors.map((s) => (
          <option key={s} value={s}>
            {SECTOR_BY_NAME[s]?.short ?? s}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="All courses" value={filters.course} onChange={(v) => setFilter('course', v)} width="w-[168px]">
        {courses.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="All providers" value={filters.provider} onChange={(v) => setFilter('provider', v)} width="w-[168px]">
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Gender" value={filters.gender} onChange={(v) => setFilter('gender', v)} width="w-[100px]">
        {o.genders.map((g) => (
          <option key={g} value={g}>
            {GENDER_LABEL[g]}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Category" value={filters.socialCategory} onChange={(v) => setFilter('socialCategory', v)} width="w-[108px]">
        {o.socialCategories.map((c) => (
          <option key={c} value={c}>
            {SOCIAL_CATEGORY_LABELS[c]}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Age band" value={filters.ageBand} onChange={(v) => setFilter('ageBand', v)} width="w-[108px]">
        {o.ageBands.map((a) => (
          <option key={a} value={a}>
            {a} yrs
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Cohort month" value={filters.cohortMonth} onChange={(v) => setFilter('cohortMonth', v)} width="w-[150px]">
        {o.cohortMonths.map((m) => (
          <option key={m} value={m}>
            Batch end {monthLabel(m)}
          </option>
        ))}
      </FilterSelect>
      {active > 0 && (
        <Button size="sm" variant="ghost" onClick={clear} icon={<X className="h-3.5 w-3.5" strokeWidth={1.5} />}>
          Clear {active}
        </Button>
      )}
    </div>
  );
}

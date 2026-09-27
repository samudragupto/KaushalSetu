import { useMemo, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Search } from 'lucide-react';
import { downloadCsv } from '../../lib/csv';
import { Button, EmptyState, Skeleton } from '.';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => number | string | null;
  csv?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right' | 'center';
  width?: string;
  className?: string;
  // Included in CSV export but not rendered as a table column.
  csvOnly?: boolean;
}

interface Props<T> {
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  exportName?: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyBody?: ReactNode;
  maxHeight?: number;
  toolbar?: ReactNode;
  rowClassName?: (row: T) => string | undefined;
}

export function DataTable<T>({ rows, columns: allColumns, rowKey, loading, searchText, searchPlaceholder = 'Search', exportName, initialSort, onRowClick, emptyTitle = 'Nothing to show for these filters', emptyBody, maxHeight, toolbar, rowClassName }: Props<T>) {
  const columns = allColumns.filter((c) => !c.csvOnly);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort ?? null);

  const visible = useMemo(() => {
    let list = rows ?? [];
    if (query && searchText) {
      const q = query.toLowerCase();
      list = list.filter((r) => searchText(r).toLowerCase().includes(q));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        const get = col.sortValue;
        list = [...list].sort((a, b) => {
          const va = get(a);
          const vb = get(b);
          if (va === vb) return 0;
          if (va === null) return 1;
          if (vb === null) return -1;
          const cmp = va < vb ? -1 : 1;
          return sort.dir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return list;
  }, [rows, query, searchText, sort, columns]);

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
  };

  const exportCsv = () => {
    if (!exportName) return;
    downloadCsv(
      `${exportName}-${new Date().toISOString().slice(0, 10)}`,
      visible,
      allColumns.map((c) => ({ header: c.header, value: c.csv ?? ((r: T) => { const v = c.sortValue?.(r); return v === null ? '' : v; }) })),
    );
  };

  return (
    <div>
      {(searchText || exportName || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-2.5">
          {searchText && (
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted" strokeWidth={1.5} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-lg border border-line bg-white pl-8 pr-3 text-sm transition-colors placeholder:text-[#9CA3AF] hover:border-[#cfd3da] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
          )}
          {toolbar}
          <div className="ml-auto flex items-center gap-2">
            <span className="num text-xs text-muted">{loading ? '' : `${visible.length.toLocaleString('en-IN')} rows`}</span>
            {exportName && (
              <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!visible.length} icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} />}>
                CSV
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="scrollbar-thin overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[#FAFBFC]">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={clsx('whitespace-nowrap border-b border-line px-4 py-2 text-xs font-medium text-muted', c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left')}
                >
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className={clsx('inline-flex items-center gap-1 transition-colors hover:text-ink', sort?.key === c.key && 'text-ink')}>
                      {c.header}
                      {sort?.key === c.key ? sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" strokeWidth={1.5} /> : <ArrowDown className="h-3 w-3" strokeWidth={1.5} /> : <ChevronsUpDown className="h-3 w-3 opacity-40" strokeWidth={1.5} />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className="border-b border-grid px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              visible.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={clsx('transition-colors', onRowClick && 'cursor-pointer hover:bg-primary-50/60', rowClassName?.(row))}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={clsx('border-b border-grid px-4 py-2.5 align-middle', c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left', c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && visible.length === 0 && <EmptyState title={query ? `No rows match "${query}"` : emptyTitle} body={query ? 'Try a shorter search term.' : emptyBody} />}
      </div>
    </div>
  );
}

import { memo, useMemo, useRef, useState, type ReactNode } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { geoCentroid } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import mapData from '../../data/maharashtra-districts.json';

// District boundaries: datameet-derived Census 2011 districts filtered to Maharashtra, with
// Palghar split out and Mumbai divided into City and Suburban (see DECISIONS.md). Embedded in
// the bundle; no runtime fetch and no map API key.
const GEO = mapData as unknown as FeatureCollection<Geometry, { name: string }>;

export const DISTRICT_CENTROIDS: Record<string, [number, number]> = Object.fromEntries(
  GEO.features.map((f) => [f.properties.name, geoCentroid(f as Feature) as [number, number]]),
);

const LOW = [239, 247, 246];
const HIGH = [15, 118, 110];

export function rampColor(t: number): string {
  const c = LOW.map((l, i) => Math.round(l + (HIGH[i] - l) * Math.max(0, Math.min(1, t))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

interface Props {
  values?: Record<string, number | null>;
  selected?: string | null;
  onSelect?: (district: string) => void;
  tooltip?: (district: string) => ReactNode;
  pulse?: string[];
  variant?: 'choropleth' | 'outline';
  height?: number;
}

function MaharashtraMapInner({ values = {}, selected, onSelect, tooltip, pulse = [], variant = 'choropleth', height = 420 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);
  const [min, max] = useMemo(() => {
    const nums = Object.values(values).filter((v): v is number => typeof v === 'number');
    if (!nums.length) return [0, 1];
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    return [lo, hi === lo ? lo + 0.01 : hi];
  }, [values]);

  const fill = (name: string) => {
    if (variant === 'outline') return 'rgba(255,255,255,0.03)';
    const v = values[name];
    if (v === null || v === undefined) return '#F1F2F4';
    return rampColor((v - min) / (max - min));
  };

  const move = (name: string, e: React.MouseEvent) => {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    setHover({ name, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  return (
    <div ref={wrap} className="relative w-full" style={{ height }}>
      <ComposableMap projection="geoMercator" projectionConfig={{ center: [76.8, 18.9], scale: 5350 }} width={800} height={660} style={{ width: '100%', height: '100%' }}>
        <g className={variant === 'choropleth' ? 'map-breathe' : undefined}>
          <Geographies geography={GEO}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const name = (geo.properties as { name: string }).name;
                const isSel = selected === name;
                const stroke = variant === 'outline' ? 'rgba(148,163,184,0.35)' : isSel ? '#F59E0B' : '#FFFFFF';
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={(e) => variant === 'choropleth' && move(name, e)}
                    onMouseMove={(e) => variant === 'choropleth' && move(name, e)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onSelect?.(name)}
                    tabIndex={variant === 'choropleth' ? 0 : -1}
                    aria-label={name}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSelect?.(name);
                    }}
                    style={{
                      default: { fill: fill(name), stroke, strokeWidth: isSel ? 2 : 0.8, outline: 'none', transition: 'fill 500ms ease' },
                      hover: { fill: variant === 'outline' ? 'rgba(255,255,255,0.06)' : fill(name), stroke: variant === 'outline' ? stroke : '#0F172A', strokeWidth: variant === 'outline' ? 0.8 : 1.4, outline: 'none', cursor: onSelect ? 'pointer' : 'default' },
                      pressed: { fill: fill(name), stroke: '#F59E0B', strokeWidth: 2, outline: 'none' },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </g>
        {pulse.map((d) =>
          DISTRICT_CENTROIDS[d] ? (
            <Marker key={d} coordinates={DISTRICT_CENTROIDS[d]}>
              <circle r={9} fill="none" stroke="#F59E0B" strokeWidth={2} className="pulse-ring" />
              <circle r={4} fill="#F59E0B" stroke="#FFFFFF" strokeWidth={1.5} />
            </Marker>
          ) : null,
        )}
      </ComposableMap>
      {hover && tooltip && (
        <div
          className="pointer-events-none absolute z-10 min-w-[180px] rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift"
          style={{ left: Math.min(hover.x + 14, (wrap.current?.clientWidth ?? 400) - 200), top: Math.max(0, hover.y - 10) }}
        >
          {tooltip(hover.name)}
        </div>
      )}
    </div>
  );
}

export const MaharashtraMap = memo(MaharashtraMapInner);

export function MapLegend({ min, max, format, label }: { min: number | null; max: number | null; format: (v: number) => string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted">
      <span>{label}</span>
      <span className="num">{min !== null ? format(min) : '—'}</span>
      <span className="h-2 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${rampColor(0)}, ${rampColor(1)})` }} />
      <span className="num">{max !== null ? format(max) : '—'}</span>
      <span className="ml-2 inline-flex items-center gap-1">
        <span className="h-2 w-3 rounded-sm bg-[#F1F2F4]" /> fewer than 5 trainees
      </span>
    </div>
  );
}

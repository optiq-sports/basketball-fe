import React from 'react';
import { cn } from '../../lib/utils';

export interface ComparisonRow {
  label: string;
  /** Full name read out by screen readers, e.g. "Field goal percentage". */
  title?: string;
  home: number | null;
  away: number | null;
  /** How a value is shown. Defaults to the plain number. */
  format?: (n: number) => string;
  /** Bar scale: 'pair' fills the larger of the two; a number fills against that maximum (100 for percentages). */
  scale?: 'pair' | number;
  /** Fewer is better (turnovers, fouls), so the smaller side is the one emphasised. */
  lowerIsBetter?: boolean;
}

export interface TeamSide {
  name: string;
  color: string;
}

/**
 * Two teams compared stat by stat, bars meeting in the middle. The side that's ahead is emphasised, but
 * every number is printed and read out, so nothing depends on colour or bar length.
 */
export function ComparisonBars({ rows, home, away, className }: { rows: ComparisonRow[]; home: TeamSide; away: TeamSide; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span className="flex min-w-0 items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: home.color }} /><span className="truncate">{home.name}</span></span>
        <span className="flex min-w-0 items-center gap-2"><span className="truncate">{away.name}</span><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: away.color }} /></span>
      </div>
      <ul className="flex flex-col gap-2.5">
        {rows.map((r) => {
          const fmt = r.format ?? ((n: number) => String(n));
          const h = r.home;
          const a = r.away;
          const max = r.scale === undefined || r.scale === 'pair' ? Math.max(h ?? 0, a ?? 0, 1) : r.scale;
          const width = (v: number | null) => (v === null ? 0 : Math.min(100, (v / max) * 100));
          const ahead = h === null || a === null || h === a ? null : (h > a) !== !!r.lowerIsBetter ? 'home' : 'away';
          return (
            <li key={r.label} className="grid grid-cols-[2.75rem_1fr_3.25rem_1fr_2.75rem] items-center gap-2 text-sm">
              <span className="sr-only">
                {r.title ?? r.label}: {home.name} {h === null ? 'none' : fmt(h)}, {away.name} {a === null ? 'none' : fmt(a)}
              </span>
              <span aria-hidden className={cn('text-right tabular-nums', ahead === 'home' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500')}>{h === null ? '—' : fmt(h)}</span>
              <span aria-hidden className="flex h-2.5 justify-end overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <span className="h-full rounded-full transition-[width]" style={{ width: `${width(h)}%`, backgroundColor: home.color, opacity: ahead === 'away' ? 0.55 : 1 }} />
              </span>
              <span aria-hidden className="text-center text-xs font-semibold text-gray-500">{r.label}</span>
              <span aria-hidden className="flex h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <span className="h-full rounded-full transition-[width]" style={{ width: `${width(a)}%`, backgroundColor: away.color, opacity: ahead === 'home' ? 0.55 : 1 }} />
              </span>
              <span aria-hidden className={cn('tabular-nums', ahead === 'away' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500')}>{a === null ? '—' : fmt(a)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

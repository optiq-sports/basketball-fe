import React, { useId, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';

export interface ShotPoint {
  eventId: string;
  teamId: string | null;
  result: string | null;
  x: number | null;
  y: number | null;
  /** Quarter the shot was taken in. Only some events carry it; the period filter appears only when they do. */
  period?: number;
}

/**
 * Full court in feet (94 × 50). Only one end is drawn; the other is the same drawing rotated 180°
 * around the centre spot, which is how the real court is laid out.
 *
 * Assumption to verify against a real game: shot `x` and `y` are normalised 0–1 across the full
 * court width and length. Shots outside that range are dropped rather than drawn in the wrong place.
 */
function CourtLines({ id }: { id: string }) {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={0.5} className="text-white/45">
      <rect x={0} y={0} width={94} height={50} />
      <line x1={47} y1={0} x2={47} y2={50} />
      <circle cx={47} cy={25} r={6} />
      <g id={id}>
        <rect x={0} y={17} width={19} height={16} />
        <circle cx={19} cy={25} r={6} />
        <path d="M0 3 L14.2 3 A23.75 23.75 0 0 1 14.2 47 L0 47" />
        <line x1={4} y1={22.8} x2={4} y2={27.2} strokeWidth={0.6} />
        <circle cx={5.25} cy={25} r={0.75} />
      </g>
      <use href={`#${id}`} transform="rotate(180 47 25)" />
    </g>
  );
}

export function ShotChartCourt({
  shots,
  homeTeamId,
  homeLabel = 'Home',
  awayLabel = 'Away',
}: {
  shots: ShotPoint[];
  homeTeamId?: string;
  homeLabel?: string;
  awayLabel?: string;
}) {
  const courtId = useId().replace(/:/g, '');
  const [period, setPeriod] = useState<'all' | number>('all');
  const [showMade, setShowMade] = useState(true);
  const [showMissed, setShowMissed] = useState(true);

  const periods = useMemo(() => {
    const set = new Set<number>();
    for (const s of shots) if (typeof s.period === 'number') set.add(s.period);
    return [...set].sort((a, b) => a - b);
  }, [shots]);

  const placed = shots.filter((s) => s.x !== null && s.y !== null && s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1);
  const visible = placed.filter((s) => {
    if (period !== 'all' && s.period !== period) return false;
    const made = s.result === 'made';
    return made ? showMade : showMissed;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {periods.length > 0 ? (
          <div role="group" aria-label="Quarter" className="flex flex-wrap gap-1.5">
            {(['all', ...periods] as const).map((p) => (
              <button
                key={String(p)}
                type="button"
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'h-8 rounded-md px-3 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50',
                  period === p ? 'bg-court-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200',
                )}
              >
                {p === 'all' ? 'All' : `Q${p}`}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div role="group" aria-label="Shot result" className="flex gap-1.5">
          <button
            type="button"
            aria-pressed={showMade}
            onClick={() => setShowMade((v) => !v)}
            className={cn('h-8 rounded-md px-3 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50', showMade ? 'bg-white text-gray-900 dark:bg-gray-800 dark:text-white' : 'text-gray-400')}
          >
            Made
          </button>
          <button
            type="button"
            aria-pressed={showMissed}
            onClick={() => setShowMissed((v) => !v)}
            className={cn('h-8 rounded-md px-3 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50', showMissed ? 'bg-white text-gray-900 dark:bg-gray-800 dark:text-white' : 'text-gray-400')}
          >
            Missed
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-court-900 p-3 md:p-5">
        <svg viewBox="-2 -2 98 54" role="img" aria-label={`Shot chart: ${visible.length} shots shown`} className="block h-auto w-full">
          <rect x={-2} y={-2} width={98} height={54} fill="none" />
          <CourtLines id={courtId} />
          {visible.map((s) => {
            const x = (s.x as number) * 94;
            const y = (s.y as number) * 50;
            const isHome = homeTeamId !== undefined && s.teamId === homeTeamId;
            const color = isHome ? '#ff6b2c' : '#8fb4e0';
            return s.result === 'made' ? (
              <circle key={s.eventId} cx={x} cy={y} r={1.6} fill={color} stroke="#0a1224" strokeWidth={0.4} />
            ) : (
              <g key={s.eventId} stroke={color} strokeWidth={0.7} strokeLinecap="round">
                <line x1={x - 1.2} y1={y - 1.2} x2={x + 1.2} y2={y + 1.2} />
                <line x1={x + 1.2} y1={y - 1.2} x2={x - 1.2} y2={y + 1.2} />
              </g>
            );
          })}
        </svg>
        {placed.length === 0 && (
          <p className="absolute inset-x-0 bottom-3 text-center text-sm text-white/70">No shot locations recorded yet.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-signal-500" aria-hidden />{homeLabel}</span>
        <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#8fb4e0]" aria-hidden />{awayLabel}</span>
        <span>● made &nbsp; ✕ missed</span>
      </div>
    </div>
  );
}

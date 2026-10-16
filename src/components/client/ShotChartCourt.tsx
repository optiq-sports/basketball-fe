import React, { useId, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { shotToCourtFeet } from '../../lib/shot-coordinates';

export interface ShotPoint {
  eventId: string;
  teamId: string | null;
  result: string | null;
  x: number | null;
  y: number | null;
  shooterPlayerId?: string | null;
  /** Quarter the shot was taken in. Only some events carry it; the period filter appears only when they do. */
  period?: number;
}

/**
 * Full court in feet (94 × 50). Only one end is drawn; the other is the same drawing rotated 180°
 * around the centre spot, which is how the real court is laid out.
 *
 * Shot `x` and `y` arrive as a 0–1 fraction of StatDash's own court element, which is a different
 * shape from this one, so they are converted by `shotToCourtFeet` before being plotted (Bug 207).
 * Shots outside 0–1 are dropped rather than drawn in the wrong place.
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
  homeColor = '#ff6b2c',
  awayColor = '#8fb4e0',
  playerNames,
}: {
  shots: ShotPoint[];
  homeTeamId?: string;
  homeLabel?: string;
  awayLabel?: string;
  homeColor?: string;
  awayColor?: string;
  /** Player id → name. With it, each shooter gets a chip to show only their shots. */
  playerNames?: Record<string, string>;
}) {
  const courtId = useId().replace(/:/g, '');
  const [period, setPeriod] = useState<'all' | number>('all');
  const [showMade, setShowMade] = useState(true);
  const [showMissed, setShowMissed] = useState(true);
  const [team, setTeam] = useState<'both' | 'home' | 'away'>('both');
  const [picked, setPicked] = useState<string[]>([]);

  const periods = useMemo(() => {
    const set = new Set<number>();
    for (const s of shots) if (typeof s.period === 'number') set.add(s.period);
    return [...set].sort((a, b) => a - b);
  }, [shots]);

  const placed = shots.filter((s) => s.x !== null && s.y !== null && s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1);
  const isHomeShot = (s: ShotPoint) => homeTeamId !== undefined && s.teamId === homeTeamId;

  // Shooters with their made/attempted, per side, from the shots in the chosen quarter.
  const shooters = useMemo(() => {
    const m = new Map<string, { id: string; home: boolean; made: number; att: number }>();
    for (const s of shots) {
      if (!s.shooterPlayerId || (period !== 'all' && s.period !== period)) continue;
      if (s.result !== 'made' && s.result !== 'missed') continue;
      const e = m.get(s.shooterPlayerId) ?? { id: s.shooterPlayerId, home: homeTeamId !== undefined && s.teamId === homeTeamId, made: 0, att: 0 };
      e.att += 1;
      if (s.result === 'made') e.made += 1;
      m.set(s.shooterPlayerId, e);
    }
    return [...m.values()].sort((a, b) => b.att - a.att);
  }, [shots, period, homeTeamId]);
  const nameOf = (id: string) => playerNames?.[id] ?? 'Player';

  const visible = placed.filter((s) => {
    if (period !== 'all' && s.period !== period) return false;
    if (team === 'home' && !isHomeShot(s)) return false;
    if (team === 'away' && isHomeShot(s)) return false;
    if (picked.length > 0 && !(s.shooterPlayerId && picked.includes(s.shooterPlayerId))) return false;
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
                  'h-8 rounded-md px-3 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/50',
                  period === p ? 'bg-brand-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200',
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
            className={cn('h-8 rounded-md px-3 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/50', showMade ? 'bg-white text-gray-900 dark:bg-gray-800 dark:text-white' : 'text-gray-400')}
          >
            Made
          </button>
          <button
            type="button"
            aria-pressed={showMissed}
            onClick={() => setShowMissed((v) => !v)}
            className={cn('h-8 rounded-md px-3 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/50', showMissed ? 'bg-white text-gray-900 dark:bg-gray-800 dark:text-white' : 'text-gray-400')}
          >
            Missed
          </button>
        </div>
      </div>

      <div role="group" aria-label="Team" className="flex flex-wrap gap-1.5">
        {([['both', 'Both teams'], ['home', homeLabel], ['away', awayLabel]] as const).map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={team === v}
            onClick={() => { setTeam(v); setPicked([]); }}
            className={cn(
              'h-8 rounded-md px-3 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/50',
              team === v ? 'bg-brand-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200',
            )}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-xl bg-brand-900 p-3 md:p-5">
        <svg viewBox="-2 -2 98 54" role="img" aria-label={`Shot chart: ${visible.length} shots shown`} className="block h-auto w-full">
          <rect x={-2} y={-2} width={98} height={54} fill="none" />
          <CourtLines id={courtId} />
          {visible.map((s) => {
            const { xFt: x, yFt: y } = shotToCourtFeet(s.x as number, s.y as number);
            const color = isHomeShot(s) ? homeColor : awayColor;
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
        <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: homeColor }} aria-hidden />{homeLabel}</span>
        <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: awayColor }} aria-hidden />{awayLabel}</span>
        <span>● made &nbsp; ✕ missed</span>
      </div>

      {playerNames && shooters.length > 0 && (
        <div role="group" aria-label="Shooters" className="flex flex-wrap gap-1.5">
          {shooters
            .filter((p) => team === 'both' || (team === 'home') === p.home)
            .map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((cur) => (cur.includes(p.id) ? cur.filter((x) => x !== p.id) : [...cur, p.id]))}
                  className={cn(
                    'flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/50',
                    on ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200',
                  )}
                >
                  <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: p.home ? homeColor : awayColor }} />
                  {nameOf(p.id)}
                  <span className="tabular-nums opacity-75">{p.made}/{p.att}</span>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

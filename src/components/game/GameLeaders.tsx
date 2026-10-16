import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BoxScoreRow } from '../client/BoxScoreTable';
import { PlayerAvatar } from '../players/PlayerAvatar';
import { isLight } from '../teams/TeamCrest';
import { leaderOf, type LeaderKey } from '../../lib/game-stats';
import { cn } from '../../lib/utils';
import type { TeamSide } from './ComparisonBars';

const CATEGORIES: Array<{ key: LeaderKey; label: string }> = [
  { key: 'points', label: 'Points' },
  { key: 'rebounds', label: 'Rebounds' },
  { key: 'assists', label: 'Assists' },
  { key: 'steals', label: 'Steals' },
  { key: 'blocks', label: 'Blocks' },
];

function Leader({ row, value, label, side, playerHref }: { row: BoxScoreRow | null; value?: number; label: string; side: TeamSide; playerHref?: (id: string) => string }) {
  const dark = !isLight(side.color);
  const [first, ...rest] = (row?.name ?? '').split(' ');
  const body = row ? (
    <>
      <PlayerAvatar firstName={first ?? ''} lastName={rest.join(' ')} photo={row.photo ?? undefined} size="lg" />
      <div className="min-w-0">
        <p className="truncate text-base font-semibold">{row.name}</p>
        <p className={cn('text-xs', dark ? 'text-white/75' : 'text-black/65')}>{side.name}{row.jerseyNumber != null ? ` · #${row.jerseyNumber}` : ''}</p>
      </div>
      <p className="ml-auto text-3xl font-bold tabular-nums">{value}<span className="sr-only"> {label}</span></p>
    </>
  ) : (
    <p className={cn('text-sm', dark ? 'text-white/75' : 'text-black/65')}>No {label.toLowerCase()} recorded for {side.name}.</p>
  );
  const cls = cn('flex min-h-24 min-w-0 items-center gap-3 rounded-xl p-4', dark ? 'text-white' : 'text-gray-900');
  return row && playerHref ? (
    <Link to={playerHref(row.playerId)} className={cn(cls, 'outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/60')} style={{ backgroundColor: side.color }}>{body}</Link>
  ) : (
    <div className={cls} style={{ backgroundColor: side.color }}>{body}</div>
  );
}

/** The best performer on each side in a chosen stat, in each team's own colour. */
export function GameLeaders({ home, away, homeRows, awayRows, playerHref }: { home: TeamSide; away: TeamSide; homeRows: BoxScoreRow[]; awayRows: BoxScoreRow[]; playerHref?: (id: string) => string }) {
  const [key, setKey] = useState<LeaderKey>('points');
  const label = CATEGORIES.find((c) => c.key === key)!.label;
  const h = leaderOf(homeRows, key);
  const a = leaderOf(awayRows, key);
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Leader category" className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={key === c.key}
            onClick={() => setKey(c.key)}
            className={cn(
              'h-8 rounded-md px-3 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/50',
              key === c.key ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Leader row={h} value={h?.[key]} label={label} side={home} playerHref={playerHref} />
        <Leader row={a} value={a?.[key]} label={label} side={away} playerHref={playerHref} />
      </div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { PlayerAvatar } from '../players/PlayerAvatar';
import { EmptyState } from '../admin/page-states';
import { isLight } from '../teams/TeamCrest';
import { clockText, periodLabel } from '../../lib/timeline-stats';
import { cn } from '../../lib/utils';
import type { TimelineEvent } from '../../services/statdash/types';
import type { TeamSide } from './ComparisonBars';

export interface RosterEntry { name: string; side: 'home' | 'away'; photo?: string | null; jerseyNumber?: number | null }

interface Row {
  e: TimelineEvent;
  /** Points this play scored, from the change in the running score. */
  points: number;
  side: 'home' | 'away' | null;
}

/** The feed of recorded plays, newest first, a quarter at a time. Scoring plays are lifted into cards. */
export function PlayByPlay({ events, roster, homeTeamId, awayTeamId, home, away }: {
  events: TimelineEvent[];
  roster: Map<string, RosterEntry>;
  homeTeamId: string;
  awayTeamId: string;
  home: TeamSide;
  away: TeamSide;
}) {
  const rows = useMemo<Row[]>(() => {
    const sorted = [...events].sort((a, b) => a.sequence - b.sequence);
    let ph = 0;
    let pa = 0;
    return sorted.map((e) => {
      const dh = e.homeScore - ph;
      const da = e.awayScore - pa;
      ph = e.homeScore;
      pa = e.awayScore;
      const side = e.teamId === homeTeamId ? 'home' : e.teamId === awayTeamId ? 'away' : (e.playerId ? roster.get(e.playerId)?.side ?? null : null);
      return { e, points: dh > 0 ? dh : da > 0 ? da : 0, side };
    });
  }, [events, homeTeamId, awayTeamId, roster]);

  const periods = useMemo(() => [...new Set(rows.map((r) => r.e.period).filter((p): p is number => p != null))].sort((a, b) => a - b), [rows]);
  const [picked, setPicked] = useState<number | null>(null);
  const period = picked !== null && periods.includes(picked) ? picked : periods[periods.length - 1];

  if (rows.length === 0) return <EmptyState title="No plays recorded yet" description="The feed fills in as the game is scored." />;

  const shown = rows.filter((r) => r.e.period === period).reverse();
  const color = (s: 'home' | 'away' | null) => (s === 'home' ? home.color : s === 'away' ? away.color : '#9ca3af');

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Quarter" className="flex flex-wrap gap-1.5">
        {periods.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={p === period}
            onClick={() => setPicked(p)}
            className={cn(
              'h-8 min-w-12 rounded-md px-3 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50',
              p === period ? 'bg-court-700 text-white dark:bg-court-400 dark:text-court-950' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200',
            )}
          >
            {periodLabel(p)}
          </button>
        ))}
      </div>

      <ol aria-label={`Plays, ${period ? periodLabel(period) : ''}, newest first`} className="flex flex-col gap-1.5">
        {shown.map(({ e, points, side }) => {
          const who = e.playerId ? roster.get(e.playerId) : undefined;
          const clock = e.clockSecondsRemaining == null ? '' : clockText(e.clockSecondsRemaining);
          const score = (
            <span className="tabular-nums">
              <span className={cn(points > 0 && side === 'home' && 'font-bold')}>{e.homeScore}</span> – <span className={cn(points > 0 && side === 'away' && 'font-bold')}>{e.awayScore}</span>
            </span>
          );

          if (e.eventType === 'period_end' || e.eventType === 'game_end') {
            return (
              <li key={e.sequence} className="flex items-center justify-between rounded-md bg-court-950 px-4 py-3 text-white">
                <span className="text-sm tabular-nums text-white/70">{clock || '0:00'}</span>
                <span className="text-base font-bold uppercase tracking-wide">{e.eventType === 'game_end' ? 'End of game' : 'End of period'}</span>
                <span className="text-sm">{score}</span>
              </li>
            );
          }

          if (points > 0) {
            const dark = !isLight(color(side));
            const [first, ...rest] = (who?.name ?? '').split(' ');
            return (
              <li key={e.sequence} className="flex items-center gap-3 overflow-hidden rounded-md border-l-4 bg-white p-3 shadow-sm dark:bg-gray-900" style={{ borderLeftColor: color(side) }}>
                <span className="w-12 shrink-0 text-sm tabular-nums text-gray-500">{clock}</span>
                {who && <PlayerAvatar firstName={first ?? ''} lastName={rest.join(' ')} photo={who.photo ?? undefined} size="md" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-gray-900 dark:text-white">{who?.jerseyNumber != null && <span className="mr-1.5 tabular-nums">{who.jerseyNumber}</span>}{who?.name ?? 'Team'}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{e.description}</p>
                </div>
                <span className={cn('shrink-0 rounded px-2 py-0.5 text-xs font-bold', dark ? 'text-white' : 'text-gray-900')} style={{ backgroundColor: color(side) }}>+{points}</span>
                <span className="w-20 shrink-0 text-right text-sm">{score}</span>
              </li>
            );
          }

          return (
            <li key={e.sequence} className="flex items-center gap-3 rounded-md border-l-4 bg-white px-3 py-2.5 dark:bg-gray-900" style={{ borderLeftColor: color(side) }}>
              <span className="w-12 shrink-0 text-sm tabular-nums text-gray-500">{clock}</span>
              <p className="min-w-0 flex-1 text-sm text-gray-800 dark:text-gray-200">
                {who ? <><span className="font-semibold">{who.jerseyNumber != null && <span className="mr-1 tabular-nums">{who.jerseyNumber}</span>}{who.name}</span> {e.description}</> : <>Team {e.description}</>}
              </p>
              <span className="w-20 shrink-0 text-right text-sm text-gray-500">{score}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

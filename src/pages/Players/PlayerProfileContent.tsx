import React from 'react';
import { normalizeName } from '../../lib/text';
import { positionLabel as formatPosition } from '../../components/players/player-form';
import { PlayerAvatar } from '../../components/players/PlayerAvatar';
import { Badge } from '../../components/ui/primitives/badge';
import type { Player, Team } from '../../types/api';

/** One entry of `recentMatches` on GET /players/:id (see PlayersService.findOne). */
interface RecentMatch {
  matchId: string;
  opponent: string | null;
  scheduledDate?: string | null;
  points: number;
  rebounds: number;
  assists: number;
  blocks: number;
  steals: number;
  fouls: number;
  turnovers: number;
}

// Stat columns after the "Game(s)" label, in table order. Only some are tracked per game by the
// backend; the rest (FG splits, OREB/DREB, +/-, EFF) stay "—" until it records them.
const STAT_COLUMNS = ['PTS', 'FG', '2PT FG', '3PT FG', 'FT', 'REB', 'OREB', 'DREB', 'AST', 'STL', 'BLK', 'PF', 'TO', '+/-', 'EFF'] as const;

function statCells(m: Pick<RecentMatch, 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks' | 'fouls' | 'turnovers'>, digits = 0): string[] {
  const f = (n: number) => (digits === 0 ? String(n) : n.toFixed(digits));
  return [f(m.points), '—', '—', '—', '—', f(m.rebounds), '—', '—', f(m.assists), f(m.steals), f(m.blocks), f(m.fouls), f(m.turnovers), '—', '—'];
}

function formatGameDate(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateOfBirth(raw: string | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface PlayerProfileContentProps {
  player: Player;
  team?: Team;
}

/** Presentational player-profile body, shared between the standalone route page and the inline modal. */
const PlayerProfileContent: React.FC<PlayerProfileContentProps> = ({ player, team }) => {
  const rawTeamName = team?.name ?? player.teamName ?? undefined;
  const teamName = rawTeamName ? normalizeName(rawTeamName) : player.teamId ? '—' : 'No team';
  const dobDisplay = formatDateOfBirth(player.dateOfBirth);
  const positionLabel = formatPosition(player.position) || '—';
  const firstName = normalizeName(player.firstName);
  const lastName = normalizeName(player.lastName);

  const recentRaw = (player as { recentMatches?: RecentMatch[] }).recentMatches;
  const recentMatches: RecentMatch[] = Array.isArray(recentRaw) ? recentRaw : [];
  const totals = recentMatches.reduce(
    (t, m) => ({
      points: t.points + m.points, rebounds: t.rebounds + m.rebounds, assists: t.assists + m.assists,
      steals: t.steals + m.steals, blocks: t.blocks + m.blocks, fouls: t.fouls + m.fouls, turnovers: t.turnovers + m.turnovers,
    }),
    { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0, fouls: 0, turnovers: 0 },
  );
  const n = recentMatches.length;
  const averages = n > 0
    ? { points: totals.points / n, rebounds: totals.rebounds / n, assists: totals.assists / n, steals: totals.steals / n, blocks: totals.blocks / n, fouls: totals.fouls / n, turnovers: totals.turnovers / n }
    : null;
  const avg1 = (v: number | undefined) => (v == null ? '—' : v.toFixed(1));
  const statSummary = [
    { label: 'PPG', value: avg1(averages?.points) },
    { label: 'RPG', value: avg1(averages?.rebounds) },
    { label: 'APG', value: avg1(averages?.assists) },
    { label: 'BPG', value: avg1(averages?.blocks) },
    { label: 'SPG', value: avg1(averages?.steals) },
    { label: 'FG%', value: '—' },
  ];

  const details: Array<[string, string]> = [
    ['Team', teamName],
    ['Position', positionLabel],
    ['Height', player.height || '—'],
    ['Date of birth', dobDisplay],
    ['Nationality', (player.nationality as string | undefined) || '—'],
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <PlayerAvatar firstName={player.firstName} lastName={player.lastName} photo={player.photo} size="lg" className="size-24 text-3xl" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Player{player.jerseyNumber != null ? <span className="ml-2 font-bold tabular-nums text-signal-600 dark:text-signal-400">#{player.jerseyNumber}</span> : null}
            </p>
            <h2 className="truncate text-2xl font-bold text-court-900 dark:text-white">{firstName} {lastName}</h2>
            {player.isCaptain && <Badge variant="court" className="mt-1.5">Captain</Badge>}
          </div>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {details.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
              <dd className="truncate font-medium text-gray-900 dark:text-gray-100">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          {statSummary.map((stat, i) => (
            <div key={i} className="rounded-xl bg-court-800 p-4 text-center text-white">
              <div className="mb-1 text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-court-200">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02] sm:p-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="relative overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-court-50 dark:bg-court-400/10">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-court-900 dark:text-court-200">Games(s)</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">PTS</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">FG</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">2PT FG</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">3PT FG</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">FT</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">REB</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">OREB</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">DREB</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">AST</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">STL</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">BLK</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">PF</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">TO</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">+/-</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-court-900 dark:text-court-200">EFF</th>
                </tr>
              </thead>
              <tbody>
                {recentMatches.length === 0 && (
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td colSpan={STAT_COLUMNS.length + 1} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      No recorded games yet.
                    </td>
                  </tr>
                )}
                {recentMatches.map((game) => (
                  <tr key={game.matchId} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-court-700 dark:text-court-300">
                        {game.opponent ? `vs ${normalizeName(game.opponent)}` : 'Game'}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{formatGameDate(game.scheduledDate)}</div>
                    </td>
                    {statCells(game).map((cell, i) => (
                      <td key={i} className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{cell}</td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-court-50 dark:bg-court-400/10 border-b border-gray-200 dark:border-gray-800">
                  <td className="px-4 py-4 text-sm font-semibold text-court-900 dark:text-court-200">Cumulative</td>
                  {(n > 0 ? statCells(totals) : STAT_COLUMNS.map(() => '—')).map((cell, i) => (
                    <td key={i} className="px-4 py-4 text-center text-sm font-medium text-gray-800 dark:text-gray-300">{cell}</td>
                  ))}
                </tr>
                <tr className="bg-court-50 dark:bg-court-400/10">
                  <td className="px-4 py-4 text-sm font-semibold text-court-900 dark:text-court-200">Average</td>
                  {(averages ? statCells(averages, 1) : STAT_COLUMNS.map(() => '—')).map((cell, i) => (
                    <td key={i} className="px-4 py-4 text-center text-sm font-medium text-gray-800 dark:text-gray-300">{cell}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-center">
          {n > 0
            ? `Based on the player's ${n} most recent recorded game${n === 1 ? '' : 's'}. Shooting splits, OREB/DREB, +/- and EFF aren't tracked per game yet.`
            : 'Stats will appear here once this player has recorded games.'}
        </p>
      </div>
    </div>
  );
};

export default PlayerProfileContent;

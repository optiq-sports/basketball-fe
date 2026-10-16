import React from 'react';
import { normalizeName } from '../../lib/text';
import { positionLabel as formatPosition } from '../../components/players/player-form';
import { PlayerAvatar } from '../../components/players/PlayerAvatar';
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

/**
 * The player's profile body, shared by the route page and the list's modal — back to the pre-redesign
 * shape: the `/player-bg.png` hero with the jersey number over the name on two lines and a large
 * portrait at the right, a `brand-50` band of detail tiles, the six `brand-500` average tiles, then the
 * per-game stat table.
 *
 * **The numbers are real.** The old component shipped `PLACEHOLDER_GAMES` — four hardcoded rows reading
 * "vs TEAM, DATE" / "Tournament phase" with a dash in every column — and a `STAT_SUMMARY` whose six
 * values were all `'—'`. `GET /players/:id` returns `recentMatches`, so the table, the Cumulative and
 * Average rows and the PPG/RPG/APG/BPG/SPG tiles are computed from it. The columns the backend does not
 * track per game (the shooting splits, OREB/DREB, +/- and EFF) still read `—`, and the note under the
 * table says which.
 *
 * The portrait is a fixed square: the old one was `w-90 h-80 mr-20 top-[2.1rem]`, and `w-90` is not a
 * Tailwind size, so the width never applied.
 *
 * The detail band wraps evenly rather than `grid-cols-4`, and carries Nationality as well — real data
 * the old band left out.
 */
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
    ['Date of birth', dobDisplay],
    ['Height', player.height || '—'],
    ['Club', teamName],
    ['Position', positionLabel],
    ['Nationality', (player.nationality as string | undefined) || '—'],
  ];

  return (
    <div>
      <div
        className="relative mb-4 overflow-hidden rounded-2xl bg-white shadow-theme-sm dark:bg-gray-900"
        style={{
          backgroundImage: "url('/player-bg.png')",
          backgroundPosition: 'right center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '600px 300px',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-6 p-8">
          <div className="min-w-0 flex-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              #{player.jerseyNumber != null ? player.jerseyNumber : '—'}
            </span>
            <h2 className="mt-2 text-4xl font-bold text-brand-900 dark:text-white">{firstName}</h2>
            <h2 className="text-4xl font-bold text-brand-900 dark:text-white">{lastName}</h2>
            {player.isCaptain && (
              <span className="mt-3 inline-block rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                Captain
              </span>
            )}
          </div>

          <PlayerAvatar
            firstName={player.firstName}
            lastName={player.lastName}
            photo={player.photo}
            size="full"
            rounded="none"
            className="size-48 shrink-0 rounded-2xl text-5xl"
          />
        </div>

        <div className="relative bg-brand-50 p-8 dark:bg-brand-500/10">
          <dl className="grid grid-cols-2 gap-6 text-center sm:grid-cols-3 lg:grid-cols-5">
            {details.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-sm text-gray-600 dark:text-gray-400">{label}</dt>
                <dd className="truncate text-lg font-semibold text-brand-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mb-8 rounded-2xl bg-white p-4 shadow-theme-sm dark:bg-gray-900 sm:p-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-6">
          {statSummary.map((stat, i) => (
            <div key={i} className="rounded-xl bg-brand-500 p-6 text-center text-white">
              <div className="mb-2 text-3xl font-bold">{stat.value}</div>
              <div className="text-sm text-brand-100">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full rounded-2xl bg-gray-50 p-4 shadow-theme-sm dark:bg-white/[0.02] sm:p-6">
        <div className="overflow-hidden rounded-lg bg-white shadow-theme-xs dark:bg-gray-900">
          <div className="relative overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-brand-50 dark:bg-brand-500/10">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-brand-900 dark:text-brand-300">Games(s)</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">PTS</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">FG</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">2PT FG</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">3PT FG</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">FT</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">REB</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">OREB</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">DREB</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">AST</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">STL</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">BLK</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">PF</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">TO</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">+/-</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-brand-900 dark:text-brand-300">EFF</th>
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
                      <div className="text-sm font-medium text-brand-700 dark:text-brand-400">
                        {game.opponent ? `vs ${normalizeName(game.opponent)}` : 'Game'}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{formatGameDate(game.scheduledDate)}</div>
                    </td>
                    {statCells(game).map((cell, i) => (
                      <td key={i} className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{cell}</td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-brand-50 dark:bg-brand-500/10 border-b border-gray-200 dark:border-gray-800">
                  <td className="px-4 py-4 text-sm font-semibold text-brand-900 dark:text-brand-300">Cumulative</td>
                  {(n > 0 ? statCells(totals) : STAT_COLUMNS.map(() => '—')).map((cell, i) => (
                    <td key={i} className="px-4 py-4 text-center text-sm font-medium text-gray-800 dark:text-gray-300">{cell}</td>
                  ))}
                </tr>
                <tr className="bg-brand-50 dark:bg-brand-500/10">
                  <td className="px-4 py-4 text-sm font-semibold text-brand-900 dark:text-brand-300">Average</td>
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

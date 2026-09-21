import React from 'react';
import { resolvePlayerPhotoUrl, handlePhotoLoadError } from '../../utils/playerPhotoPlaceholder';
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
  const teamName = team?.name ?? (player as { teamName?: string }).teamName ?? (player.teamId ? '—' : 'No team');
  const dobDisplay = formatDateOfBirth(player.dateOfBirth);
  const positionLabel = typeof player.position === 'string' ? player.position.replace(/_/g, ' ') : '—';

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

  return (
    <div>
      <div
        className="rounded-2xl shadow-theme-sm overflow-hidden mb-4 bg-white dark:bg-gray-900 relative"
        style={{
          backgroundImage: "url('/player-bg.png')",
          backgroundPosition: 'right center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '600px 300px',
        }}
      >
        <div className="p-8 flex justify-between items-start">
          <div className="flex-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              #{player.jerseyNumber != null ? player.jerseyNumber : '—'}
            </span>
            <h2 className="text-4xl font-bold text-brand-900 dark:text-white mt-2">{player.firstName}</h2>
            <h2 className="text-4xl font-bold text-brand-900 dark:text-white">{player.lastName}</h2>
          </div>
          <div className="relative">
            <div className="w-90 h-80 relative mr-20 top-[2.1rem]">
              <img
                src={resolvePlayerPhotoUrl(
                  (player as { photo?: string }).photo ?? (player as { image?: string }).image,
                  player.id,
                )}
                onError={handlePhotoLoadError(player.id)}
                alt={`${player.firstName} ${player.lastName}`}
                className="relative z-10 w-full h-full object-cover rounded-2xl"
              />
            </div>
          </div>
        </div>

        <div className="p-8 relative bg-brand-50 dark:bg-brand-500/10">
          <div className="grid grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Date of birth</p>
              <p className="text-lg font-semibold text-brand-900 dark:text-white">{dobDisplay}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Height</p>
              <p className="text-lg font-semibold text-brand-900 dark:text-white">{player.height ?? '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Club</p>
              <p className="text-lg font-semibold text-brand-900 dark:text-white">{teamName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Position</p>
              <p className="text-lg font-semibold text-brand-900 dark:text-white">{positionLabel}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-theme-sm p-8 mb-8">
        <div className="grid grid-cols-6 gap-6">
          {statSummary.map((stat, i) => (
            <div key={i} className="bg-brand-500 rounded-xl p-6 text-center text-white">
              <div className="text-3xl font-bold mb-2">{stat.value}</div>
              <div className="text-sm text-brand-100">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full bg-gray-50 dark:bg-white/[0.02] p-6 rounded-2xl shadow-theme-sm">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-theme-xs overflow-hidden">
          <div className="overflow-x-auto">
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
                        {game.opponent ? `vs ${game.opponent}` : 'Game'}
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

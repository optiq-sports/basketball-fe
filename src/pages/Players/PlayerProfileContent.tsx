import React from 'react';
import { resolvePlayerPhotoUrl, handlePhotoLoadError } from '../../utils/playerPhotoPlaceholder';
import type { Player, Team } from '../../types/api';

const PLACEHOLDER_GAMES = Array(4).fill({
  opponent: 'vs TEAM, DATE',
  phase: 'Tournament phase',
  pts: '—',
  fg: '—',
  twoFg: '—',
  threeFg: '—',
  ft: '—',
  reb: '—',
  oreb: '—',
  dreb: '—',
  ast: '—',
  stl: '—',
  blk: '—',
  pf: '—',
  to: '—',
  plusMinus: '—',
  eff: '—',
});

const STAT_SUMMARY = [
  { label: 'PPG', value: '—' },
  { label: 'RPG', value: '—' },
  { label: 'APG', value: '—' },
  { label: 'BPG', value: '—' },
  { label: 'SPG', value: '—' },
  { label: 'FG%', value: '—' },
];

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
          {STAT_SUMMARY.map((stat, i) => (
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
                {PLACEHOLDER_GAMES.map((game, index) => (
                  <tr key={index} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-brand-700 dark:text-brand-400">{game.opponent}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{game.phase}</div>
                    </td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.pts}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.fg}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.twoFg}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.threeFg}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.ft}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.reb}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.oreb}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.dreb}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.ast}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.stl}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.blk}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.pf}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.to}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.plusMinus}</td>
                    <td className="px-4 py-4 text-center text-sm text-gray-800 dark:text-gray-300">{game.eff}</td>
                  </tr>
                ))}
                <tr className="bg-brand-50 dark:bg-brand-500/10 border-b border-gray-200 dark:border-gray-800">
                  <td className="px-4 py-4 text-sm font-semibold text-brand-900 dark:text-brand-300">Cumulative</td>
                  {Array(15).fill(0).map((_, i) => (
                    <td key={i} className="px-4 py-4 text-center text-sm font-medium text-gray-800 dark:text-gray-300">—</td>
                  ))}
                </tr>
                <tr className="bg-brand-50 dark:bg-brand-500/10">
                  <td className="px-4 py-4 text-sm font-semibold text-brand-900 dark:text-brand-300">Average</td>
                  {Array(15).fill(0).map((_, i) => (
                    <td key={i} className="px-4 py-4 text-center text-sm font-medium text-gray-800 dark:text-gray-300">—</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-center">
          Stats will appear here when game data is available from the backend.
        </p>
      </div>
    </div>
  );
};

export default PlayerProfileContent;

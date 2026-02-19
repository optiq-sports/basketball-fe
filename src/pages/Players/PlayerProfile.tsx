import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { usePlayer, useTeam } from '../../api/hooks';

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

const PlayerProfile: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const playerQuery = usePlayer(playerId ?? null);
  const player = playerQuery.data;
  const teamQuery = useTeam(player?.teamId, !!player?.teamId);
  const team = teamQuery.data;

  if (playerQuery.isPending || !playerId) {
    return (
      <div className="min-h-screen bg-[#FCFEFF] p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-500">Loading player...</p>
        </div>
      </div>
    );
  }

  if (playerQuery.error || !player) {
    return (
      <div className="min-h-screen bg-[#FCFEFF] p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-red-600">{playerQuery.error?.message ?? 'Player not found'}</p>
          <button
            onClick={() => navigate('/players-management')}
            className="mt-4 text-[#21409A] hover:underline"
          >
            Back to Players
          </button>
        </div>
      </div>
    );
  }

  const teamName = team?.name ?? (player.teamId ? '—' : 'No team');
  const positionLabel = typeof player.position === 'string' ? player.position.replace(/_/g, ' ') : '—';

  return (
    <div className="min-h-screen bg-[#FCFEFF] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <button
            onClick={() => navigate('/players-management')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <FiArrowLeft className="w-5 h-5" />
            Back to Players
          </button>
          <h1 className="text-2xl font-semibold text-gray-800">Player Profile</h1>
        </div>

        {/* Player Profile Card - same layout as PlayerDetails */}
        <div
          className="rounded-2xl shadow-sm overflow-hidden mb-4 bg-white relative"
          style={{
            backgroundImage: "url('/player-bg.png')",
            backgroundPosition: 'right center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '600px 300px',
          }}
        >
          <div className="p-8 flex justify-between items-start">
            <div className="flex-1">
              <span className="text-sm text-gray-500">
                #{player.jerseyNumber != null ? player.jerseyNumber : '—'}
              </span>
              <h2 className="text-4xl font-bold text-blue-900 mt-2">{player.firstName}</h2>
              <h2 className="text-4xl font-bold text-blue-900">{player.lastName}</h2>
            </div>
            <div className="relative">
              <div className="w-90 h-80 relative mr-20 top-[2.1rem]">
                <img
                  src={(player as { image?: string }).image ?? '/player1.png'}
                  alt={`${player.firstName} ${player.lastName}`}
                  className="relative z-10 w-full h-full object-cover rounded-2xl"
                />
              </div>
            </div>
          </div>

          <div className="p-8 relative" style={{ background: '#EEF3FF' }}>
            <div className="grid grid-cols-4 gap-6 text-center">
              <div>
                <p className="text-sm text-gray-600">Date of birth</p>
                <p className="text-lg font-semibold text-blue-900">
                  {player.dateOfBirth ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Height</p>
                <p className="text-lg font-semibold text-blue-900">{player.height ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Club</p>
                <p className="text-lg font-semibold text-blue-900">{teamName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Position</p>
                <p className="text-lg font-semibold text-blue-900">{positionLabel}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stat Summary Cards - same as PlayerDetails */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <div className="grid grid-cols-6 gap-6">
            {STAT_SUMMARY.map((stat, i) => (
              <div
                key={i}
                className="bg-[#21409A] rounded-xl p-6 text-center text-white"
              >
                <div className="text-3xl font-bold mb-2">{stat.value}</div>
                <div className="text-sm text-blue-200">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Table - same as PlayerDetails, placeholder until backend */}
        <div className="w-full bg-gray-50 p-6 rounded-2xl shadow-sm">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-blue-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-blue-900">Games(s)</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">PTS</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">FG</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">2PT FG</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">3PT FG</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">FT</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">REB</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">OREB</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">DREB</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">AST</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">STL</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">BLK</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">PF</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">TO</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">+/-</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-blue-900">EFF</th>
                  </tr>
                </thead>
                <tbody>
                  {PLACEHOLDER_GAMES.map((game, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-blue-700">{game.opponent}</div>
                        <div className="text-xs text-gray-600">{game.phase}</div>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.pts}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.fg}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.twoFg}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.threeFg}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.ft}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.reb}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.oreb}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.dreb}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.ast}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.stl}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.blk}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.pf}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.to}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.plusMinus}</td>
                      <td className="px-4 py-4 text-center text-sm text-gray-800">{game.eff}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 border-b border-gray-200">
                    <td className="px-4 py-4 text-sm font-semibold text-blue-900">Cumulative</td>
                    {Array(15).fill(0).map((_, i) => (
                      <td key={i} className="px-4 py-4 text-center text-sm font-medium text-gray-800">—</td>
                    ))}
                  </tr>
                  <tr className="bg-blue-50">
                    <td className="px-4 py-4 text-sm font-semibold text-blue-900">Average</td>
                    {Array(15).fill(0).map((_, i) => (
                      <td key={i} className="px-4 py-4 text-center text-sm font-medium text-gray-800">—</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-3 text-center">
            Stats will appear here when game data is available from the backend.
          </p>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/players-management')}
            className="px-8 py-3 bg-[#21409A] hover:bg-blue-800 text-white font-medium rounded-lg transition-colors"
          >
            Back to Players
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;

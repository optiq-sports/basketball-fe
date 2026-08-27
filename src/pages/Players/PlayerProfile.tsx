import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { usePlayer, useTeam } from '../../api/hooks';
import PlayerProfileContent from './PlayerProfileContent';

const PlayerProfile: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const playerQuery = usePlayer(playerId ?? null);
  const player = playerQuery.data;
  const teamQuery = useTeam(player?.teamId, !!player?.teamId);
  const team = teamQuery.data;

  if (playerQuery.isPending || !playerId) {
    return (
      <div className="min-h-screen bg-[#FCFEFF] dark:bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-500 dark:text-gray-400">Loading player...</p>
        </div>
      </div>
    );
  }

  if (playerQuery.error || !player) {
    return (
      <div className="min-h-screen bg-[#FCFEFF] dark:bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-error-600 dark:text-error-500">{playerQuery.error?.message ?? 'Player not found'}</p>
          <button
            onClick={() => navigate('/players-management')}
            className="mt-4 text-brand-600 dark:text-brand-400 hover:underline"
          >
            Back to Players
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCFEFF] dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <button
            onClick={() => navigate('/players-management')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <FiArrowLeft className="w-5 h-5" />
            Back to Players
          </button>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Player Profile</h1>
        </div>

        <PlayerProfileContent player={player} team={team} />

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/players-management')}
            className="px-8 py-3 bg-brand-500 hover:bg-brand-600 text-white font-medium rounded-lg transition-colors"
          >
            Back to Players
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;

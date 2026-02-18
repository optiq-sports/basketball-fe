import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { usePlayer, useTeam } from '../../api/hooks';

const PlayerProfile: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const playerQuery = usePlayer(playerId ?? null);
  const player = playerQuery.data;
  const teamQuery = useTeam(player?.teamId, !!player?.teamId);
  const team = teamQuery.data;

  if (playerQuery.isPending || !playerId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-gray-500">Loading player...</p>
        </div>
      </div>
    );
  }

  if (playerQuery.error || !player) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto">
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/players-management')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <FiArrowLeft className="w-5 h-5" />
          Back to Players
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                <img
                  src="/player1.png"
                  alt={`${player.firstName} ${player.lastName}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">
                  {player.firstName} {player.lastName}
                </h1>
                {player.jerseyNumber != null && (
                  <p className="text-sm text-gray-500 mt-1">#{player.jerseyNumber}</p>
                )}
                <div className="mt-4 space-y-2 text-sm">
                  {player.position && (
                    <p>
                      <span className="text-gray-500">Position:</span>{' '}
                      <span className="text-gray-900">{String(player.position).replace(/_/g, ' ')}</span>
                    </p>
                  )}
                  <p>
                    <span className="text-gray-500">Team:</span>{' '}
                    {player.teamId ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/teams-management/${player.teamId}`)}
                        className="text-[#21409A] hover:underline font-medium"
                      >
                        {teamName}
                      </button>
                    ) : (
                      <span className="text-gray-700">{teamName}</span>
                    )}
                  </p>
                  {player.height && (
                    <p>
                      <span className="text-gray-500">Height:</span> <span className="text-gray-900">{player.height}</span>
                    </p>
                  )}
                  {player.dateOfBirth && (
                    <p>
                      <span className="text-gray-500">Date of birth:</span>{' '}
                      <span className="text-gray-900">{player.dateOfBirth}</span>
                    </p>
                  )}
                  {(player as { country?: string }).country && (
                    <p>
                      <span className="text-gray-500">Country:</span>{' '}
                      <span className="text-gray-900">{(player as { country?: string }).country}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;

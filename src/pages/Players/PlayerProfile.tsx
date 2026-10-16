import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { usePlayer, useTeam } from '../../api/hooks';
import Skeleton from '../../components/ui/Skeleton';
import { btnPrimary } from '../../components/ui/formStyles';
import PlayerProfileContent from './PlayerProfileContent';

/**
 * `/players-management/:playerId` — one player, back to the pre-redesign layout: the `#FCFEFF` page,
 * the Back to Players link opposite the title, the profile itself, and a second Back button under it.
 *
 * Three things the old page didn't do: a failed load offers Retry rather than only a way out, the
 * loading state is the shape of the page rather than the words "Loading player...", and the two Back
 * controls are real links rather than buttons that call `navigate`, so they can be opened in a new tab
 * (Fix 137).
 */
const PlayerProfile: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const playerQuery = usePlayer(playerId ?? null);
  const player = playerQuery.data;
  const teamQuery = useTeam(player?.teamId, !!player?.teamId);

  if (playerQuery.isPending || !playerId) {
    return (
      <div className="min-h-screen bg-[#FCFEFF] p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl space-y-4" aria-label="Loading player">
          <Skeleton className="h-8 w-40 rounded" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (playerQuery.isError || !player) {
    return (
      <div className="min-h-screen bg-[#FCFEFF] p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl">
          <p className="text-error-600 dark:text-error-500">
            {playerQuery.error?.message ?? 'Player not found'}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void playerQuery.refetch()}
              className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Retry
            </button>
            <Link to="/players-management" className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400">
              Back to Players
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCFEFF] p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            to="/players-management"
            className="flex cursor-pointer items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            <FiArrowLeft aria-hidden className="size-5" />
            Back to Players
          </Link>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Player Profile</h1>
        </div>

        <PlayerProfileContent player={player} team={teamQuery.data} />

        <div className="mt-6 text-center">
          <Link to="/players-management" className={`${btnPrimary} px-8 py-3`}>
            Back to Players
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;

import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePlayer, useTeam } from '../../api/hooks';
import { ErrorState } from '../../components/admin/page-states';
import Skeleton from '../../components/ui/Skeleton';
import PlayerProfileContent from './PlayerProfileContent';

const BackLink = () => (
  <Link to="/players-management" className="w-fit text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← Players</Link>
);

/** `/players-management/:playerId`: one player, their details, and their recent games. */
const PlayerProfile: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const playerQuery = usePlayer(playerId ?? null);
  const player = playerQuery.data;
  const teamQuery = useTeam(player?.teamId, !!player?.teamId);

  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      {playerQuery.isPending && (
        <div className="flex flex-col gap-4" aria-label="Loading player">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      )}
      {playerQuery.isError && <ErrorState message={playerQuery.error.message} onRetry={() => void playerQuery.refetch()} />}
      {player && <PlayerProfileContent player={player} team={teamQuery.data} />}
    </div>
  );
};

export default PlayerProfile;

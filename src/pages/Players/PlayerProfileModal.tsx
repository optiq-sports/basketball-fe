import React from 'react';
import { LuTriangleAlert, LuRotateCw } from 'react-icons/lu';
import { usePlayer, useTeam } from '../../api/hooks';
import Modal from '../../components/ui/Modal';
import Skeleton from '../../components/ui/Skeleton';
import PlayerProfileContent from './PlayerProfileContent';

interface PlayerProfileModalProps {
  playerId: string | null;
  onClose: () => void;
}

const PlayerProfileSkeleton: React.FC = () => (
  <div>
    <div className="mb-4 rounded-2xl bg-gray-50 dark:bg-white/[0.02] p-8">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className="h-9 w-40 rounded" />
          <Skeleton className="h-9 w-32 rounded" />
        </div>
        <Skeleton className="h-40 w-40 rounded-2xl" />
      </div>
    </div>
    <div className="mb-8 grid grid-cols-6 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
    <Skeleton className="h-48 w-full rounded-2xl" />
  </div>
);

const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({ playerId, onClose }) => {
  const playerQuery = usePlayer(playerId);
  const player = playerQuery.data;
  const teamQuery = useTeam(player?.teamId, !!player?.teamId);

  return (
    <Modal open={!!playerId} onClose={onClose} title="Player Profile" size="xl">
      {playerQuery.isPending && <PlayerProfileSkeleton />}
      {playerQuery.error && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <LuTriangleAlert className="size-8 text-error-500" />
          <p className="text-sm text-error-600 dark:text-error-500">{playerQuery.error.message}</p>
          <button
            type="button"
            onClick={() => playerQuery.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            <LuRotateCw className="size-3.5" />
            Retry
          </button>
        </div>
      )}
      {player && <PlayerProfileContent player={player} team={teamQuery.data} />}
    </Modal>
  );
};

export default PlayerProfileModal;

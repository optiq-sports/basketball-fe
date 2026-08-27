import React from 'react';
import { LuTriangleAlert, LuRotateCw } from 'react-icons/lu';
import { useStatistician } from '../../api/hooks';
import type { Statistician } from '../../types/api';
import Modal from '../../components/ui/Modal';
import Skeleton from '../../components/ui/Skeleton';
import StatisticianProfileContent from './StatisticianProfileContent';

interface StatisticianProfileModalProps {
  statisticianId: string | null;
  onClose: () => void;
}

const StatisticianProfileSkeleton: React.FC = () => (
  <div>
    <div className="mb-4 rounded-2xl bg-gray-50 dark:bg-white/[0.02] p-8">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-9 w-48 rounded" />
        </div>
        <Skeleton className="h-40 w-40 rounded-2xl" />
      </div>
    </div>
    <div className="grid grid-cols-6 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  </div>
);

const StatisticianProfileModal: React.FC<StatisticianProfileModalProps> = ({ statisticianId, onClose }) => {
  const statQuery = useStatistician(statisticianId);

  return (
    <Modal open={!!statisticianId} onClose={onClose} title="Statistician" size="xl">
      {statQuery.isPending && <StatisticianProfileSkeleton />}
      {statQuery.error && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <LuTriangleAlert className="size-8 text-error-500" />
          <p className="text-sm text-error-600 dark:text-error-500">
            {statQuery.error instanceof Error ? statQuery.error.message : 'Statistician not found'}
          </p>
          <button
            type="button"
            onClick={() => statQuery.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
          >
            <LuRotateCw className="size-3.5" />
            Retry
          </button>
        </div>
      )}
      {statQuery.data && <StatisticianProfileContent stat={statQuery.data as Statistician} />}
    </Modal>
  );
};

export default StatisticianProfileModal;

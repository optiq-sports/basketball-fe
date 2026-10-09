import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStatistician } from '../../api/hooks';
import type { Statistician } from '../../types/api';
import { ErrorState } from '../../components/admin/page-states';
import Skeleton from '../../components/ui/Skeleton';
import StatisticianProfileContent from './StatisticianProfileContent';

const BackLink = () => (
  <Link to="/statisticians" className="w-fit text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← Statisticians</Link>
);

/** `/statisticians/:id` — one statistician and the games they have scored. */
const ViewStat: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const query = useStatistician(id ?? null);

  return (
    <div className="flex flex-col gap-4">
      <BackLink />
      {query.isPending && (
        <div className="flex flex-col gap-4" aria-label="Loading statistician">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}
      {query.isError && <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />}
      {query.data && <StatisticianProfileContent stat={query.data as Statistician} />}
    </div>
  );
};

export default ViewStat;

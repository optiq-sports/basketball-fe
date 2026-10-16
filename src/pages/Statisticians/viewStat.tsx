import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { useStatistician } from '../../api/hooks';
import type { Statistician } from '../../types/api';
import Skeleton from '../../components/ui/Skeleton';
import StatisticianProfileContent from './StatisticianProfileContent';

/**
 * `/statisticians/:id` — one statistician and the games they have scored, back to the pre-redesign
 * layout: the `brand`-tinted gradient band with a Back link above the profile.
 *
 * Back goes to the statisticians list rather than `navigate(-1)`. The old page used history, which sent
 * the user wherever they happened to come from — and from the list's own profile modal that meant
 * bouncing them out of the app entirely if this was their first page.
 *
 * A failed load offers Retry, which the old page didn't, and Back is a real link rather than a button
 * that calls `navigate` (Fix 137).
 */
const ViewStat: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const statQuery = useStatistician(id ?? null);

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-white p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );

  const backLink = (
    <Link to="/statisticians" className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400">
      Back to Statisticians
    </Link>
  );

  if (!id) {
    return shell(
      <>
        <p className="text-error-600 dark:text-error-500">Statistician not found</p>
        <div className="mt-4">{backLink}</div>
      </>,
    );
  }

  if (statQuery.isPending) {
    return shell(
      <div className="space-y-4" aria-label="Loading statistician">
        <Skeleton className="h-8 w-28 rounded" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>,
    );
  }

  if (statQuery.isError || !statQuery.data) {
    return shell(
      <>
        <p className="text-error-600 dark:text-error-500">
          {statQuery.error instanceof Error ? statQuery.error.message : 'Statistician not found'}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void statQuery.refetch()}
            className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Retry
          </button>
          {backLink}
        </div>
      </>,
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-50 to-brand-100 px-8 pb-12 pt-8 dark:from-brand-500/10 dark:to-brand-500/5">
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="mb-6">
            <Link
              to="/statisticians"
              className="flex cursor-pointer items-center gap-2 text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              <FiArrowLeft aria-hidden size={20} />
              <span className="font-medium">Back to Statisticians</span>
            </Link>
          </div>

          <StatisticianProfileContent stat={statQuery.data as Statistician} />
        </div>
      </div>
    </div>
  );
};

export default ViewStat;

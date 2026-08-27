import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { useStatistician } from '../../api/hooks';
import type { Statistician } from '../../types/api';
import StatisticianProfileContent from './StatisticianProfileContent';

const ViewStat: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const statQuery = useStatistician(id ?? null);

  if (!id) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-error-600 dark:text-error-500">Statistician not found</p>
          <button
            onClick={() => navigate('/statisticians')}
            className="mt-4 text-brand-600 dark:text-brand-400 hover:underline"
          >
            Back to Statisticians
          </button>
        </div>
      </div>
    );
  }

  if (statQuery.isPending) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-500 dark:text-gray-400">Loading statistician...</p>
        </div>
      </div>
    );
  }

  if (statQuery.error || !statQuery.data) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-error-600 dark:text-error-500">
            {statQuery.error instanceof Error ? statQuery.error.message : 'Statistician not found'}
          </p>
          <button
            onClick={() => navigate('/statisticians')}
            className="mt-4 text-brand-600 dark:text-brand-400 hover:underline"
          >
            Back to Statisticians
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="relative bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-500/10 dark:to-brand-500/5 pt-8 pb-12 px-8 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <FiArrowLeft size={20} />
              <span className="font-medium">Back</span>
            </button>
          </div>

          <StatisticianProfileContent stat={statQuery.data as Statistician} />
        </div>
      </div>
    </div>
  );
};

export default ViewStat;

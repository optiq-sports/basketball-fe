import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FiArrowRight } from 'react-icons/fi';
import { queryKeys } from '../../api/hooks';
import StatisticianLayout from '../../components/StatisticianLayout';
import StartersFlow, { type StartersFlowHandle } from './StartersFlow';
import { readStoredSessionContext } from '../../features/statdash/sessionContextStorage';

const TOKEN_KEY = 'access_token';

const Starters: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startersFlowRef = useRef<StartersFlowHandle>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  useEffect(() => {
    if (!readStoredSessionContext()) {
      navigate('/match-key', { replace: true });
    }
  }, [navigate]);

  const handleContinue = useCallback(async () => {
    if (!startersFlowRef.current?.attemptContinue()) {
      return;
    }
    const context = readStoredSessionContext();
    if (!context) {
      navigate('/match-key', { replace: true });
      return;
    }
    setIsSubmitting(true);
    navigate('/choose-sides');
    setIsSubmitting(false);
  }, [navigate]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('user_name');
    queryClient.removeQueries({ queryKey: queryKeys.auth.profile });
    navigate('/login');
  }, [navigate, queryClient]);

  return (
    <StatisticianLayout>
      <div className="flex min-h-0 flex-1 flex-col bg-[#F0F2F5] font-sans">
        <div className="flex shrink-0 items-center justify-between px-8 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            className="rounded text-sm text-gray-600 underline-offset-2 transition-colors hover:text-gray-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Log out
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleContinue}
            className="group flex items-center gap-2 text-sm font-semibold text-gray-700 transition-colors hover:text-gray-900"
          >
            <FiArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            <span>{isSubmitting ? 'Saving…' : 'Continue'}</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-6 pb-20 pt-4">
          <StartersFlow ref={startersFlowRef} variant="page" />
        </div>
      </div>
    </StatisticianLayout>
  );
};

export default Starters;

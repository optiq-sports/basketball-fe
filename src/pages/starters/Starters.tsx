import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FiArrowRight } from 'react-icons/fi';
import { queryKeys } from '../../api/hooks';
import StatisticianLayout from '../../components/StatisticianLayout';
import StartersFlow, { type StartersFlowHandle } from './StartersFlow';

const TOKEN_KEY = 'access_token';

const Starters: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startersFlowRef = useRef<StartersFlowHandle>(null);

  useEffect(() => {
    if (!sessionStorage.getItem('statistician_match_key')) {
      navigate('/match-key', { replace: true });
    }
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
            onClick={() => {
              if (startersFlowRef.current?.attemptContinue()) {
                navigate('/choose-sides');
              }
            }}
            className="group flex items-center gap-2 text-sm font-semibold text-gray-700 transition-colors hover:text-gray-900"
          >
            <FiArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            <span>Continue</span>
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

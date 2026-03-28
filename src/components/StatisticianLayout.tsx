import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../api/hooks';

const TOKEN_KEY = 'access_token';

/**
 * Minimal shell for statistician-only screens (no main app sidebar/nav chrome).
 */
const StatisticianLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('user_name');
    queryClient.removeQueries({ queryKey: queryKeys.auth.profile });
    navigate('/login');
  };

  return (
    <div className="min-h-[100dvh] bg-[#F4F7F9] flex flex-col">
      <header className="shrink-0 flex justify-end px-4 pt-3 sm:pt-5">
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-gray-900 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5998] focus-visible:ring-offset-2 rounded"
        >
          Log out
        </button>
      </header>
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
    </div>
  );
};

export default StatisticianLayout;

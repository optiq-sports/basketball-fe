import React from 'react';

/**
 * Minimal shell for statistician-only screens (no main app sidebar/nav chrome).
 * Log out is only shown on the Starters page (see `pages/starters/Starters.tsx`).
 */
const StatisticianLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F4F7F9]">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
};

export default StatisticianLayout;

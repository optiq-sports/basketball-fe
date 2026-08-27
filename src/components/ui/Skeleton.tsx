import React from 'react';

/** Pulsing placeholder block — pass any size/shape via className (e.g. "h-4 w-32 rounded"). */
const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full rounded' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-white/10 ${className}`} />
);

export default Skeleton;

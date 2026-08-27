import React from 'react';
import { LuCircleCheck, LuClock, LuCircleX, LuCircle } from 'react-icons/lu';

export type StatusTone = 'success' | 'warning' | 'error' | 'neutral';

const TONE_STYLES: Record<StatusTone, string> = {
  success: 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500',
  warning: 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500',
  error: 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-500',
  neutral: 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400',
};

const TONE_ICON: Record<StatusTone, React.ComponentType<{ className?: string }>> = {
  success: LuCircleCheck,
  warning: LuClock,
  error: LuCircleX,
  neutral: LuCircle,
};

export interface StatusBadgeProps {
  label: string;
  tone: StatusTone;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ label, tone }) => {
  const Icon = TONE_ICON[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2.5 py-0.5 text-xs font-medium ${TONE_STYLES[tone]}`}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
};

export default StatusBadge;

import React from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'bg-success-50 border-success-100 text-success-700 dark:bg-success-500/15 dark:border-success-500/30 dark:text-success-500',
  error: 'bg-error-50 border-error-100 text-error-700 dark:bg-error-500/15 dark:border-error-500/30 dark:text-error-500',
  info: 'bg-brand-50 border-brand-100 text-brand-700 dark:bg-brand-500/15 dark:border-brand-500/30 dark:text-brand-400',
};

const TYPE_ICON: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

export const ToastStack: React.FC<{ toasts: ToastItem[]; onDismiss: (id: string) => void }> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[400] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${TYPE_STYLES[t.type]}`}
        >
          <span className="mt-0.5 shrink-0 font-semibold">{TYPE_ICON[t.type]}</span>
          <p className="flex-1 text-sm">{t.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            className="shrink-0 text-current opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

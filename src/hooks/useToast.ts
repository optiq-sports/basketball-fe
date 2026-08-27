import { useMemo } from 'react';
import { useToastContext } from '../components/ui/ToastProvider';

/** Replacement for `alert(...)`: `toast.success(...)`, `toast.error(...)`, `toast.info(...)`. */
export function useToast() {
  const { push } = useToastContext();
  return useMemo(
    () => ({
      success: (message: string, duration?: number) => push('success', message, duration),
      error: (message: string, duration?: number) => push('error', message, duration),
      info: (message: string, duration?: number) => push('info', message, duration),
    }),
    [push],
  );
}

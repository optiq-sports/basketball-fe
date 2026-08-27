import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ConfirmDialogProps } from '../components/ui/ConfirmDialog';

export interface ConfirmOptions {
  title?: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}

/**
 * Drop-in replacement for `window.confirm`: `await confirm({...})` resolves
 * `true`/`false` based on the user's choice. Render `<ConfirmDialog {...dialogProps} />`
 * once per component tree alongside this hook.
 */
export function useConfirmDialog() {
  const [state, setState] = useState<{ open: boolean; options: ConfirmOptions | null }>({
    open: false,
    options: null,
  });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, options });
    });
  }, []);

  const handleClose = useCallback(() => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    resolverRef.current?.(true);
    resolverRef.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  const dialogProps: ConfirmDialogProps = {
    open: state.open,
    onClose: handleClose,
    onConfirm: handleConfirm,
    title: state.options?.title,
    description: state.options?.description ?? '',
    confirmLabel: state.options?.confirmLabel,
    cancelLabel: state.options?.cancelLabel,
    tone: state.options?.tone,
  };

  return { confirm, dialogProps };
}

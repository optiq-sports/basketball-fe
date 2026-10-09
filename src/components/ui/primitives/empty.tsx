import * as React from 'react';
import { cn } from '../../../lib/utils';

/** Dashed container for "nothing here yet" — use with EmptyState for the standard layout. */
export function Empty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="empty"
      className={cn(
        'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 p-10 text-center text-balance dark:border-gray-700',
        className,
      )}
      {...props}
    />
  );
}

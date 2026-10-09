import * as React from 'react';
import { cn } from '../../../lib/utils';

/** Surface for summaries and panels. Flat, bordered, no shadow — matching the list pages. */
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'flex min-w-0 flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('text-base font-semibold text-gray-900 dark:text-white', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-gray-500 dark:text-gray-400', className)} {...props} />;
}

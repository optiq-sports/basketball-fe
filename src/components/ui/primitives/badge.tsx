import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

export const badgeVariants = cva(
  'inline-flex h-5 w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-xs font-semibold',
  {
    variants: {
      variant: {
        neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        court: 'bg-court-100 text-court-800 dark:bg-court-800 dark:text-court-100',
        live: 'bg-signal-50 text-signal-700 dark:bg-signal-500/15 dark:text-signal-300',
        success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
        warning: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
        danger: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

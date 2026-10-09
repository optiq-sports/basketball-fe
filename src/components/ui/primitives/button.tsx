import * as React from 'react';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

/**
 * Admin button, adapted from the churchos design system (`packages/design-system/components/ui/button.tsx`)
 * onto this app's court/signal tokens. Focus rings are visible for keyboard users.
 */
export const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent text-sm font-semibold transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-court-400/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-rose-500 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  {
    variants: {
      variant: {
        primary: 'bg-court-700 text-white hover:bg-court-800 dark:bg-court-400 dark:text-court-950 dark:hover:bg-court-300',
        signal: 'bg-signal-500 text-white hover:bg-signal-600',
        secondary:
          'border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800',
        ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white',
        destructive: 'bg-rose-600 text-white hover:bg-rose-700',
        'destructive-ghost': 'text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10',
        link: 'text-court-700 underline-offset-4 hover:underline dark:text-court-300',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-9 px-4',
        lg: 'h-11 px-5 text-base',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, ...props },
  ref,
) {
  return (
    <ButtonPrimitive
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

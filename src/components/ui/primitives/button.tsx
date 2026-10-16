import * as React from 'react';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../../lib/utils';

/**
 * Admin button. Retoned onto the app's own `brand`/`error` tokens with the shell restore (Fix 145) —
 * it was adapted from the churchos design system onto `court`/`signal` during the redesign.
 *
 * Most restored screens use the plain classes in `ui/formStyles` instead, since the pre-redesign pages
 * wrote their buttons inline. This stays for what still uses it, and keeps its visible focus rings.
 */
export const buttonVariants = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent text-sm font-semibold transition-colors outline-none select-none focus-visible:ring-[3px] focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-error-500 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  {
    variants: {
      variant: {
        primary: 'bg-brand-500 text-white hover:bg-brand-600',
        signal: 'bg-warning-500 text-white hover:bg-warning-600',
        secondary:
          'border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800',
        ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white',
        destructive: 'bg-error-500 text-white hover:bg-error-600',
        'destructive-ghost': 'text-error-600 hover:bg-error-50 hover:text-error-700 dark:text-error-500 dark:hover:bg-error-500/10',
        link: 'text-brand-600 underline-offset-4 hover:underline dark:text-brand-400',
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

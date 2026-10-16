import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';

const SIZES = { sm: 'size-8 text-[10px]', md: 'size-12 text-sm', lg: 'size-16 text-lg', full: 'size-full text-3xl' } as const;
const ROUNDING = { full: 'rounded-full', none: 'rounded-none' } as const;

const initialsOf = (firstName: string, lastName: string) =>
  `${firstName.trim()[0] ?? ''}${lastName.trim()[0] ?? ''}`.toUpperCase() || '?';

/**
 * A player's photo, or their initials when there is none. A `photo` URL that 404s (a deleted upload,
 * a bad URL) falls back to the initials too, rather than showing the browser's broken-image icon.
 */
export function PlayerAvatar({
  firstName,
  lastName,
  photo,
  size = 'md',
  rounded = 'full',
  className,
}: {
  firstName: string;
  lastName: string;
  photo?: string | null;
  size?: keyof typeof SIZES;
  /** `none` for a square portrait tile, where the card already does the rounding. */
  rounded?: keyof typeof ROUNDING;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (photo && !broken) {
    return (
      <img
        src={photo}
        alt=""
        onError={() => setBroken(true)}
        className={cn(SIZES[size], ROUNDING[rounded], 'shrink-0 bg-gray-100 object-cover dark:bg-gray-800', className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        SIZES[size],
        ROUNDING[rounded],
        'flex shrink-0 items-center justify-center bg-brand-50 font-bold text-brand-700 dark:bg-brand-500/10 dark:text-brand-400',
        className,
      )}
    >
      {initialsOf(normalizeName(firstName), normalizeName(lastName))}
    </span>
  );
}

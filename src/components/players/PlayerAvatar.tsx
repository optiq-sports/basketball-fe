import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';

const SIZES = { sm: 'size-8 text-[10px]', md: 'size-12 text-sm', lg: 'size-16 text-lg' } as const;

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
  className,
}: {
  firstName: string;
  lastName: string;
  photo?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (photo && !broken) {
    return (
      <img
        src={photo}
        alt=""
        onError={() => setBroken(true)}
        className={cn(SIZES[size], 'shrink-0 rounded-full bg-gray-100 object-cover dark:bg-gray-800', className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        SIZES[size],
        'flex shrink-0 items-center justify-center rounded-full bg-court-100 font-bold text-court-700 dark:bg-court-800 dark:text-court-200',
        className,
      )}
    >
      {initialsOf(normalizeName(firstName), normalizeName(lastName))}
    </span>
  );
}

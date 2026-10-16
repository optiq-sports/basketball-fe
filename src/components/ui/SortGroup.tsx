import React from 'react';
import { cn } from '../../lib/utils';

export type SortOption<K extends string> = { key: K; label: string };

/**
 * The row of sort buttons the list pages share: one button per field, the active one filled, with an
 * arrow showing the direction. Clicking the active field flips the direction; clicking another field
 * switches to it.
 *
 * It only *reports* a click — the page decides what the next direction is and puts it in the URL, since
 * a sensible default differs by field (a name starts A–Z, a date starts newest first). Retoned onto
 * `brand` with the restore; the redesign's version was `court`.
 */
export function SortGroup<K extends string>({
  options,
  active,
  dir,
  onSort,
  label = 'Sort by',
  className,
}: {
  options: ReadonlyArray<SortOption<K>>;
  active: K;
  dir: 'asc' | 'desc';
  onSort: (key: K) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {options.map((option) => {
        const isActive = option.key === active;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onSort(option.key)}
            aria-pressed={isActive}
            aria-label={`Sort by ${option.label}${isActive ? `, ${dir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
            className={cn(
              'h-11 cursor-pointer rounded-lg px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500',
              isActive
                ? 'bg-brand-500 text-white hover:bg-brand-600'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5',
            )}
          >
            {option.label}
            {isActive ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
          </button>
        );
      })}
    </div>
  );
}

export default SortGroup;

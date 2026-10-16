import React from 'react';
import { FiGrid, FiList } from 'react-icons/fi';
import { cn } from '../../lib/utils';

export type ListView = 'cards' | 'table';

/**
 * The cards ⇄ table switch. A segmented pair of buttons, the chosen one filled.
 *
 * The caller owns the value — the pages keep it in the URL so a view survives a reload and can be
 * linked, and mirror it to `localStorage` so it also survives arriving at the page with no `?view=`.
 */
export function ViewToggle({
  view,
  onChange,
  label = 'View',
  className,
}: {
  view: ListView;
  onChange: (view: ListView) => void;
  label?: string;
  className?: string;
}) {
  const options: Array<{ key: ListView; label: string; Icon: typeof FiGrid }> = [
    { key: 'cards', label: 'Cards', Icon: FiGrid },
    { key: 'table', label: 'Table', Icon: FiList },
  ];

  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex rounded-lg border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-900', className)}
    >
      {options.map(({ key, label: optionLabel, Icon }) => {
        const isActive = view === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(key)}
            className={cn(
              'inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500',
              isActive
                ? 'bg-brand-500 text-white'
                : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5',
            )}
          >
            <Icon aria-hidden size={16} />
            {optionLabel}
          </button>
        );
      })}
    </div>
  );
}

export default ViewToggle;

import React from 'react';
import { FiEdit2, FiMapPin, FiRotateCcw, FiSlash } from 'react-icons/fi';
import StatusBadge from '../ui/StatusBadge';
import { PlayerAvatar } from '../players/PlayerAvatar';
import { displayName, locationOf, splitFullName } from './statistician-form';
import type { Statistician } from '../../types/api';

export const STATISTICIAN_GRID = 'grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4';

/**
 * A statistician as the pre-redesign photo tile: a square portrait with a dark gradient at its foot,
 * the actions revealed in its top corner, and the name, status and location below. Clicking the tile
 * opens their profile.
 *
 * The actions appear on hover *and on keyboard focus* — the old tile revealed them on hover only, so
 * they could not be reached by keyboard at all, and never appeared on a touch screen.
 *
 * The second action is Deactivate, not Delete. `DELETE /statistician/:id` only sets the account's
 * status to INACTIVE; the account and every game they scored stay, and an inactive statistician can be
 * reactivated. The old tile's Delete claimed "This cannot be undone", which was never true.
 */
export function StatisticianCard({
  statistician,
  onOpen,
  onEdit,
  onDeactivate,
  onReactivate,
  busy,
}: {
  statistician: Statistician;
  onOpen: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  busy?: boolean;
}) {
  const name = displayName(statistician);
  const { firstName, lastName } = splitFullName(name);
  const inactive = statistician.status === 'INACTIVE';
  const location = locationOf(statistician);
  // The gradient exists to lift the photo's foot away from the card below it. With no photo the tile is
  // initials on a light panel, where the same gradient reads as a grey smudge across the bottom third.
  const photo = statistician.profile?.photos?.[0];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open ${name}`}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
        className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >
        <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-white/5">
          <PlayerAvatar firstName={firstName} lastName={lastName} photo={photo} size="full" rounded="none" />
          {photo && <div aria-hidden className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />}
        </div>

        <div className="p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-base font-bold text-gray-900 dark:text-white">{name}</h3>
            <StatusBadge label={inactive ? 'Inactive' : 'Active'} tone={inactive ? 'neutral' : 'success'} />
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <FiMapPin aria-hidden size={14} className="shrink-0" />
            <span className="truncate">{location || '—'}</span>
          </div>
        </div>
      </div>

      <div className="absolute right-2 top-2 flex gap-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${name}`}
          title={`Edit ${name}`}
          className="cursor-pointer rounded-lg bg-white/90 p-2 text-brand-600 hover:bg-white"
        >
          <FiEdit2 aria-hidden size={16} />
        </button>
        {inactive ? (
          <button
            type="button"
            onClick={onReactivate}
            disabled={busy}
            aria-label={`Reactivate ${name}`}
            title={`Reactivate ${name}`}
            className="cursor-pointer rounded-lg bg-white/90 p-2 text-success-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiRotateCcw aria-hidden size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onDeactivate}
            aria-label={`Deactivate ${name}`}
            title={`Deactivate ${name}`}
            className="cursor-pointer rounded-lg bg-white/90 p-2 text-error-600 hover:bg-white"
          >
            <FiSlash aria-hidden size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

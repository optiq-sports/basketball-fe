import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/primitives/button';
import { Badge } from '../ui/primitives/badge';
import { PlayerAvatar } from '../players/PlayerAvatar';
import { displayName, locationOf, splitFullName } from './statistician-form';
import type { Statistician } from '../../types/api';

export const STATISTICIAN_GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';

/**
 * A statistician as a card: photo, name, email and where they're based. The whole card opens their
 * profile; the buttons sit above that link so they stay clickable.
 *
 * The second action depends on status. An active statistician can be deactivated; an inactive one can
 * be reactivated. Nothing here deletes anyone — `DELETE /statistician/:id` only sets the status to
 * INACTIVE, and the account and every game they scored stay.
 */
export function StatisticianCard({
  statistician,
  onEdit,
  onDeactivate,
  onReactivate,
  busy,
}: {
  statistician: Statistician;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
  busy?: boolean;
}) {
  const name = displayName(statistician);
  const { firstName, lastName } = splitFullName(name);
  const inactive = statistician.status === 'INACTIVE';
  const location = locationOf(statistician);

  return (
    <article className="group relative flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <PlayerAvatar firstName={firstName} lastName={lastName} photo={statistician.profile?.photos?.[0]} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-gray-900 dark:text-white">{name}</p>
          <p className="truncate text-sm text-gray-500">{statistician.email}</p>
          {inactive && <Badge variant="warning" className="mt-1.5">Inactive</Badge>}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-gray-500">Phone</dt>
          <dd className="truncate font-medium text-gray-800 dark:text-gray-200">{statistician.profile?.phone || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-gray-500">Location</dt>
          <dd className="truncate font-medium text-gray-800 dark:text-gray-200">{location || '—'}</dd>
        </div>
      </dl>

      <Link
        to={`/statisticians/${statistician.id}`}
        aria-label={`Open ${name}`}
        className="absolute inset-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/60"
      >
        <span className="sr-only">Open statistician</span>
      </Link>

      <div className="relative z-10 mt-auto flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <Button variant="secondary" size="sm" aria-label={`Edit ${name}`} onClick={onEdit}>Edit</Button>
        {inactive ? (
          <Button variant="secondary" size="sm" aria-label={`Reactivate ${name}`} onClick={onReactivate} disabled={busy}>
            Reactivate
          </Button>
        ) : (
          <Button variant="destructive-ghost" size="sm" aria-label={`Deactivate ${name}`} onClick={onDeactivate}>
            Deactivate
          </Button>
        )}
      </div>
    </article>
  );
}

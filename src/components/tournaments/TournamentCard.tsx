import React from 'react';
import { Link } from 'react-router-dom';
import { LuTrophy } from 'react-icons/lu';
import { Button } from '../ui/primitives/button';
import { Badge } from '../ui/primitives/badge';
import { normalizeName } from '../../lib/text';
import { divisionLabel } from './tournament-form';
import type { Tournament } from '../../types/api';

const formatDay = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
const dateRange = (t: Tournament) => (t.endDate ? `${formatDay(t.startDate)} – ${formatDay(t.endDate)}` : formatDay(t.startDate));

/**
 * A tournament as a card, its flyer as the banner — a tournament is a poster-and-schedule, not a row
 * of fields to scan across columns. Without a flyer, a plain dark banner stands in rather than nothing.
 */
export function TournamentCard({ tournament, onEdit, onDelete }: { tournament: Tournament; onEdit: () => void; onDelete: () => void }) {
  const name = normalizeName(tournament.name);

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-court-950">
        {tournament.flyer ? (
          <img src={tournament.flyer} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-court-800 to-court-950">
            <LuTrophy aria-hidden className="size-10 text-court-400" />
          </div>
        )}
        <Badge variant="neutral" className="absolute left-3 top-3 bg-white/90 text-gray-900">{divisionLabel(tournament.division)}</Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-gray-900 dark:text-white">{name}</p>
          <p className="mt-0.5 text-sm text-gray-500">{dateRange(tournament)}</p>
          {tournament.venue && <p className="truncate text-sm text-gray-500">{tournament.venue}</p>}
        </div>

        <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-sm dark:border-gray-800">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Teams</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">{tournament._count?.teams ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Matches</dt>
            <dd className="font-semibold text-gray-900 dark:text-white">{tournament._count?.matches ?? '—'}</dd>
          </div>
        </dl>
      </div>

      <Link
        to={`/tournaments/${tournament.id}`}
        aria-label={`Open ${name}`}
        className="absolute inset-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/60"
      >
        <span className="sr-only">Open tournament</span>
      </Link>

      <div className="relative z-10 flex justify-end gap-2 border-t border-gray-100 p-3 dark:border-gray-800">
        <Button variant="secondary" size="sm" aria-label={`Edit ${name}`} onClick={onEdit}>Edit</Button>
        <Button variant="destructive-ghost" size="sm" aria-label={`Delete ${name}`} onClick={onDelete}>Delete</Button>
      </div>
    </article>
  );
}

export const TOURNAMENT_GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaCalendar, FaMapMarkerAlt } from 'react-icons/fa';
import { FiEdit2, FiTrash } from 'react-icons/fi';
import { LuTrophy } from 'react-icons/lu';
import { normalizeName } from '../../lib/text';
import { divisionLabel } from './tournament-form';
import type { Tournament } from '../../types/api';

export const TOURNAMENT_GRID = 'grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4';

const formatDay = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** "3 Oct – 28 Oct 2026", or the one date when there's only one, or TBA. */
export function formatDateRange(start?: string, end?: string): string {
  if (!start && !end) return 'TBA';
  if (!start) return formatDay(end);
  if (!end || start === end) return formatDay(start);
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return formatDay(start);
  return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

/**
 * A tournament as the pre-redesign card: its flyer filling a square tile with the actions in the
 * corner, then the name, venue and dates underneath. A tournament is a poster-and-schedule, which is
 * why this is a card rather than a table row.
 *
 * The old card's broken-flyer handling is kept — a flyer URL that 404s falls back to the trophy
 * placeholder rather than showing the browser's broken-image icon — and two things are added because
 * the data is already on every tournament and was going unused: the division, and how many teams and
 * matches it has.
 *
 * The card is a real link, so a tournament can be opened in a new tab, and the actions appear on focus
 * as well as hover so they can be reached by keyboard and on a touch screen.
 */
export function TournamentCard({ tournament, onEdit, onDelete }: { tournament: Tournament; onEdit: () => void; onDelete: () => void }) {
  const [flyerBroken, setFlyerBroken] = useState(false);
  const name = normalizeName(tournament.name);
  const showFlyer = !!tournament.flyer && !flyerBroken;
  const teams = tournament._count?.teams;
  const matches = tournament._count?.matches;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <Link
        to={`/tournaments/${tournament.id}`}
        aria-label={`Open ${name}`}
        className="block cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >
        <div className="relative aspect-square overflow-hidden bg-gray-50 dark:bg-white/[0.03]">
          {showFlyer ? (
            <img
              src={tournament.flyer}
              alt=""
              onError={() => setFlyerBroken(true)}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-gray-300 dark:text-gray-700">
              <LuTrophy aria-hidden className="size-10" />
              <span className="text-xs font-medium text-gray-400 dark:text-gray-600">No flyer</span>
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-gray-900">
            {divisionLabel(tournament.division)}
          </span>
        </div>

        <div className="p-4">
          <h3 className="mb-2 truncate text-base font-bold text-gray-900 dark:text-white">{name}</h3>
          <dl className="space-y-1.5">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <FaMapMarkerAlt aria-hidden className="size-3.5 shrink-0" />
              <dt className="sr-only">Venue</dt>
              <dd className="truncate text-sm">{tournament.venue || '—'}</dd>
            </div>
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <FaCalendar aria-hidden className="size-3.5 shrink-0" />
              <dt className="sr-only">Dates</dt>
              <dd className="truncate text-sm">{formatDateRange(tournament.startDate, tournament.endDate)}</dd>
            </div>
            <div className="flex items-center gap-2 border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <dt className="sr-only">Teams and matches</dt>
              <dd>
                {teams ?? 0} {teams === 1 ? 'team' : 'teams'} · {matches ?? 0} {matches === 1 ? 'match' : 'matches'}
              </dd>
            </div>
          </dl>
        </div>
      </Link>

      <div className="absolute right-2 top-2 z-10 flex gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${name}`}
          title={`Edit ${name}`}
          className="cursor-pointer rounded-lg bg-white/90 p-1.5 text-gray-700 hover:bg-white"
        >
          <FiEdit2 aria-hidden size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${name}`}
          title={`Delete ${name}`}
          className="cursor-pointer rounded-lg bg-white/90 p-1.5 text-error-600 hover:bg-white"
        >
          <FiTrash aria-hidden size={14} />
        </button>
      </div>
    </div>
  );
}

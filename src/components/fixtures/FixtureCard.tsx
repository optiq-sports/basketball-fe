import React from 'react';
import { Link } from 'react-router-dom';
import { FiCalendar, FiEdit2, FiMapPin, FiTrash } from 'react-icons/fi';
import StatusBadge from '../ui/StatusBadge';
import { TeamCrest } from '../teams/TeamCrest';
import { CopyMatchCodeButton } from '../matches/CopyMatchCodeButton';
import { normalizeName } from '../../lib/text';

export type FixtureStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';

export const STATUS_BADGE: Record<FixtureStatus, { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' }> = {
  SCHEDULED: { label: 'Scheduled', tone: 'neutral' },
  LIVE: { label: 'Live', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'error' },
  POSTPONED: { label: 'Postponed', tone: 'error' },
};

export const FIXTURE_GRID = 'grid grid-cols-1 gap-4 lg:grid-cols-2';

export interface FixtureSide {
  name: string;
  code?: string;
  logo?: string | null;
  color?: string | null;
}

export interface FixtureCardData {
  id: string;
  /** Position in the whole list, not in this page — so page 2 doesn't start at Game 1 again. */
  number: number;
  home: FixtureSide;
  away: FixtureSide;
  homeScore?: number | null;
  awayScore?: number | null;
  status: FixtureStatus;
  scheduledDate?: string;
  venue?: string | null;
  matchCode: string;
  /** Who is set to score it. Unassigned is flagged, since the game can't be scored without one. */
  statistician?: string | null;
}

const formatDateTime = (iso?: string): { date: string; time: string } => {
  if (!iso) return { date: '—', time: '—' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '—', time: '—' };
  return {
    date: d.toLocaleDateString(undefined, { dateStyle: 'medium' }),
    time: d.toLocaleTimeString(undefined, { timeStyle: 'short' }),
  };
};

/**
 * One fixture as the pre-redesign card: a header with its number, status and the actions; the two teams
 * either side of the score (or VS before tip-off); and a footer with the date, time and venue.
 *
 * Three differences from the old card, each because the old one hid something real:
 *
 * - **The crests are the teams' own.** The old card put `/ball1.png` on an amber circle and
 *   `/ball2.png` on a blue one for every game, so neither team's logo or colour ever showed.
 * - **Who is scoring it is on the card.** A fixture with no statistician can't be scored, and there was
 *   nothing on this screen to say so.
 * - **The actions appear on focus as well as hover**, so they can be reached by keyboard and on a
 *   touch screen.
 *
 * The body is a real link rather than a click-handled div, as the old card had, so the game can be
 * opened in a new tab, middle-clicked, or have its address copied.
 */
export function FixtureCard({
  fixture,
  onEdit,
  onDelete,
  tournamentId,
}: {
  fixture: FixtureCardData;
  onEdit: () => void;
  onDelete: () => void;
  tournamentId: string;
}) {
  const { date, time } = formatDateTime(fixture.scheduledDate);
  const badge = STATUS_BADGE[fixture.status] ?? STATUS_BADGE.SCHEDULED;
  const hasScore = fixture.homeScore != null && fixture.awayScore != null;
  const home = normalizeName(fixture.home.name);
  const away = normalizeName(fixture.away.name);
  const label = `${home} vs ${away}`;

  return (
    <div className="group rounded-2xl border border-gray-200 bg-white transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600">
            Game {fixture.number}
          </span>
          <StatusBadge label={badge.label} tone={badge.tone} />
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">
          <CopyMatchCodeButton code={fixture.matchCode} label={label} />
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${label}`}
            title={`Edit ${label}`}
            className="cursor-pointer rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
          >
            <FiEdit2 aria-hidden size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${label}`}
            title={`Delete ${label}`}
            className="cursor-pointer rounded-lg p-1.5 text-error-500 hover:bg-error-50 dark:hover:bg-error-500/10"
          >
            <FiTrash aria-hidden size={16} />
          </button>
        </div>
      </div>

      <Link
        to={`/tournaments/${tournamentId}/match/${fixture.id}`}
        aria-label={`Open ${label}`}
        className="block cursor-pointer px-5 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <TeamCrest name={fixture.home.name} code={fixture.home.code} logo={fixture.home.logo} color={fixture.home.color} size="lg" />
            <span className="max-w-full truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{home}</span>
          </div>

          <div className="shrink-0 px-2 text-center">
            {hasScore ? (
              <div className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                {fixture.homeScore}
                <span aria-hidden className="mx-1 text-gray-300 dark:text-gray-700">–</span>
                {fixture.awayScore}
              </div>
            ) : (
              <div className="text-xs font-semibold text-gray-400 dark:text-gray-600">VS</div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <TeamCrest name={fixture.away.name} code={fixture.away.code} logo={fixture.away.logo} color={fixture.away.color} size="lg" />
            <span className="max-w-full truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{away}</span>
          </div>
        </div>
      </Link>

      <dl className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-gray-100 px-5 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <FiCalendar aria-hidden className="size-3.5" />
          <dt className="sr-only">Kick-off</dt>
          <dd>{date} · {time}</dd>
        </div>
        <span aria-hidden className="text-gray-300 dark:text-gray-700">•</span>
        <div className="flex min-w-0 items-center gap-1.5">
          <FiMapPin aria-hidden className="size-3.5" />
          <dt className="sr-only">Venue</dt>
          <dd className="truncate">{fixture.venue || '—'}</dd>
        </div>
        <span aria-hidden className="text-gray-300 dark:text-gray-700">•</span>
        <div className="flex min-w-0 items-center gap-1.5">
          <dt className="sr-only">Statistician</dt>
          <dd className={fixture.statistician ? 'truncate' : 'font-semibold text-warning-700 dark:text-warning-500'}>
            {fixture.statistician ? normalizeName(fixture.statistician) : 'No statistician'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

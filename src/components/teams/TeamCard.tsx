import React from 'react';
import { Link } from 'react-router-dom';
import { FiAward, FiEdit2, FiMapPin, FiTrash, FiUsers } from 'react-icons/fi';
import { TeamCrest, isLight, safeColor } from './TeamCrest';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';
import type { Team } from '../../types/api';

type TeamRow = Team & { _count?: { playerTeams?: number } };

export const TEAM_GRID = 'grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3';

/**
 * A team as the pre-redesign card: a banner washed in the team's own colour, its crest sitting in a
 * white ring over the join, then the name, the code pill, and a divided list with the coaching staff,
 * roster size and location. The whole card opens the team.
 *
 * Two things differ from the old card, both because the old one was losing real data:
 *
 * - **The crest is the team's actual logo** where it has one. The old card drew a basketball glyph on
 *   a colour circle for every team, so an uploaded logo never appeared anywhere on this screen.
 *   `TeamCrest` also keeps a white or pale team colour visible instead of white-on-white.
 * - **The actions appear on focus as well as hover.** The old card revealed them with
 *   `opacity-0 group-hover:opacity-100` alone, so Edit and Delete were unreachable by keyboard and
 *   never appeared on a touch screen.
 *
 * The card is a real link rather than a click-handled div, so a team can be opened in a new tab.
 */
export function TeamCard({ team, onEdit, onDelete }: { team: TeamRow; onEdit: () => void; onDelete: () => void }) {
  const name = normalizeName(team.name);
  const color = safeColor(team.color) ?? '#21409A';
  // A near-white team colour (#fafafa is in the seed data) makes the banner vanish into the card, so a
  // pale one gets a bottom edge to keep the band readable as a band.
  const paleBanner = isLight(color);
  const rosterCount = team._count?.playerTeams;
  const location = [team.state, team.country].filter(Boolean).join(', ');
  const staff = [team.coach, team.assistantCoach].filter(Boolean).map((s) => normalizeName(s as string)).join(' / ');

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <Link
        to={`/teams-management/${team.id}`}
        aria-label={`Open ${name}`}
        className="block w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >
        <div
          className={cn('h-24', paleBanner && 'border-b border-gray-200 dark:border-gray-700')}
          style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
        />

        <div className="flex justify-center">
          <div className="-mt-8 flex size-16 items-center justify-center rounded-full border-4 border-white bg-white dark:border-gray-900 dark:bg-gray-900">
            <TeamCrest name={team.name} code={team.code} logo={team.logo} color={team.color} size="lg" className="size-full" />
          </div>
        </div>

        <div className="p-5 pt-3 text-center">
          <h3 className="truncate text-lg font-bold text-gray-900 dark:text-white">{name}</h3>
          <span className="mt-1 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-white/5 dark:text-gray-400">
            {team.code || '—'}
          </span>

          <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-left text-sm dark:border-gray-800">
            {staff && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <FiAward aria-hidden size={14} className="shrink-0 text-gray-400 dark:text-gray-500" />
                <dt className="sr-only">Coaching staff</dt>
                <dd className="truncate">{staff}</dd>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <FiUsers aria-hidden size={14} className="shrink-0 text-gray-400 dark:text-gray-500" />
              <dt className="sr-only">Roster</dt>
              <dd className="truncate">
                {rosterCount == null ? '—' : `${rosterCount} ${rosterCount === 1 ? 'player' : 'players'}`}
              </dd>
            </div>
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <FiMapPin aria-hidden size={14} className="shrink-0 text-gray-400 dark:text-gray-500" />
              <dt className="sr-only">Location</dt>
              <dd className="truncate">{location || '—'}</dd>
            </div>
          </dl>
        </div>
      </Link>

      <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">
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

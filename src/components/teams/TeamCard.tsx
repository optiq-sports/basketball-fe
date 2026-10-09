import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/primitives/button';
import { TeamCrest } from './TeamCrest';
import { normalizeName } from '../../lib/text';
import type { Team } from '../../types/api';

type TeamRow = Team & { _count?: { playerTeams?: number } };

/** A team as a card: crest, name, code, coach, and its roster size. The whole card opens the team. */
export function TeamCard({ team, onEdit, onDelete }: { team: TeamRow; onEdit: () => void; onDelete: () => void }) {
  const name = normalizeName(team.name);
  const rosterCount = team._count?.playerTeams;

  return (
    <article className="group relative flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <TeamCrest name={team.name} code={team.code} logo={team.logo} color={team.color} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-gray-900 dark:text-white">{name}</p>
          <p className="text-sm text-gray-500">{team.code}</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Coach</dt>
          <dd className="truncate font-medium text-gray-800 dark:text-gray-200">{normalizeName(team.coach) || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500">Roster</dt>
          <dd className="font-medium text-gray-800 dark:text-gray-200">{rosterCount ?? '—'}</dd>
        </div>
      </dl>

      <Link
        to={`/teams-management/${team.id}`}
        aria-label={`Open ${name}`}
        className="absolute inset-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/60"
      >
        <span className="sr-only">Open team</span>
      </Link>

      <div className="relative z-10 flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <Button variant="secondary" size="sm" aria-label={`Edit ${name}`} onClick={onEdit}>Edit</Button>
        <Button variant="destructive-ghost" size="sm" aria-label={`Delete ${name}`} onClick={onDelete}>Delete</Button>
      </div>
    </article>
  );
}

export const TEAM_GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';

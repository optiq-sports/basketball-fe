import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../ui/primitives/button';
import { Badge } from '../ui/primitives/badge';
import { PlayerAvatar } from './PlayerAvatar';
import { positionLabel } from './player-form';
import { normalizeName } from '../../lib/text';
import type { Player } from '../../types/api';

/**
 * A player as a card: photo, jersey number, position and current team. The whole card opens their
 * profile; the buttons sit above that link so they stay clickable.
 *
 * Jersey number, team and captaincy all come from the player's first *active* assignment, and the
 * backend sends them as `null` when there is none — so an unassigned player reads "No team" rather
 * than showing a blank where a team should be.
 *
 * The second action is "Release", not "Delete", because that is what the backend does: its
 * `DELETE /players/:id` only deactivates every team assignment and leaves the profile and all
 * recorded stats in place. There is no endpoint that deletes a player outright.
 */
export function PlayerCard({
  player,
  onEdit,
  onRelease,
}: {
  player: Player;
  onEdit: () => void;
  onRelease: () => void;
}) {
  const name = `${normalizeName(player.firstName)} ${normalizeName(player.lastName)}`;
  const position = positionLabel(player.position);
  const teamName = player.teamName ? normalizeName(player.teamName) : null;

  return (
    <article className="group relative flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-3">
        <PlayerAvatar firstName={player.firstName} lastName={player.lastName} photo={player.photo} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {player.jerseyNumber != null && (
              <span className="text-sm font-bold tabular-nums text-signal-600 dark:text-signal-400">
                #{player.jerseyNumber}
              </span>
            )}
            <p className="truncate text-base font-semibold text-gray-900 dark:text-white">{name}</p>
          </div>
          <p className="truncate text-sm text-gray-500">{position || 'Position not set'}</p>
          {player.isCaptain && (
            <Badge variant="court" className="mt-1.5">Captain</Badge>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-gray-500">Team</dt>
          <dd className="truncate font-medium text-gray-800 dark:text-gray-200">{teamName ?? 'No team'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-gray-500">Height</dt>
          <dd className="truncate font-medium text-gray-800 dark:text-gray-200">{player.height || '—'}</dd>
        </div>
        <div className="min-w-0 col-span-2">
          <dt className="text-xs uppercase tracking-wide text-gray-500">Nationality</dt>
          <dd className="truncate font-medium text-gray-800 dark:text-gray-200">{player.nationality || '—'}</dd>
        </div>
      </dl>

      <Link
        to={`/players-management/${player.id}`}
        aria-label={`Open ${name}`}
        className="absolute inset-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/60"
      >
        <span className="sr-only">Open player</span>
      </Link>

      <div className="relative z-10 mt-auto flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <Button variant="secondary" size="sm" aria-label={`Edit ${name}`} onClick={onEdit}>Edit</Button>
        {player.teamId && (
          <Button variant="destructive-ghost" size="sm" aria-label={`Release ${name}`} onClick={onRelease}>Release</Button>
        )}
      </div>
    </article>
  );
}

export const PLAYER_GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';

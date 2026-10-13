import React from 'react';
import { Link } from 'react-router-dom';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import { useRemovePlayerFromTeam, useSetTeamCaptain } from '../../api/hooks';
import { PlayerAvatar } from '../players/PlayerAvatar';
import { positionLabel } from '../players/player-form';
import { Badge } from '../ui/primitives/badge';
import { Button } from '../ui/primitives/button';
import ConfirmDialog from '../ui/ConfirmDialog';
import { normalizeName } from '../../lib/text';
import type { Player } from '../../types/api';

export const ROSTER_GRID = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3';

const playerName = (p: Player) => `${normalizeName(p.firstName)} ${normalizeName(p.lastName)}`.trim();

/**
 * The roster as photo cards — the pre-redesign look, restored at the product lead's request (Fix 126)
 * after the redesign replaced it with a table only. `RosterTable` stays: this is a sibling, not a
 * replacement, and `TeamDetails` offers both the way `Players` already offers cards and a table.
 *
 * A self-contained component on purpose, calling the same mutations `RosterTable` does rather than
 * sharing state with it — the two views are independent, so either can be dropped or changed without
 * touching the other.
 */
const RosterCard: React.FC<{ teamId: string; teamName: string; players: Player[] }> = ({ teamId, teamName, players }) => {
  const setCaptain = useSetTeamCaptain();
  const removePlayer = useRemovePlayerFromTeam();
  const toast = useToast();
  const { confirm, dialogProps } = useConfirmDialog();

  const toggleCaptain = (p: Player) => {
    setCaptain.mutate(
      { teamId, playerId: p.id, body: { isCaptain: !p.isCaptain } },
      { onError: (err) => toast.error(`Couldn’t update captain: ${err.message}`) },
    );
  };

  const remove = async (p: Player) => {
    const ok = await confirm({
      title: `Remove ${playerName(p)}?`,
      description: `${playerName(p)} leaves ${teamName}’s active roster. They can be added back later, and their stats aren’t affected.`,
      confirmLabel: 'Remove from roster',
      tone: 'danger',
    });
    if (!ok) return;
    removePlayer.mutate(
      { playerId: p.id, teamId },
      { onSuccess: () => toast.success(`${playerName(p)} removed.`), onError: (err) => toast.error(`Couldn’t remove: ${err.message}`) },
    );
  };

  return (
    <>
      <ul className={ROSTER_GRID} aria-label="Roster">
        {players.map((p) => {
          const name = playerName(p);
          const saving = setCaptain.isPending && setCaptain.variables?.playerId === p.id;
          return (
            <li key={p.id} className="min-w-0">
              <article className="group relative flex min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-start gap-3">
                  <PlayerAvatar firstName={p.firstName} lastName={p.lastName} photo={p.photo} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      {p.jerseyNumber != null && (
                        <span className="text-sm font-bold tabular-nums text-signal-600 dark:text-signal-400">#{p.jerseyNumber}</span>
                      )}
                      <p className="truncate text-base font-semibold text-gray-900 dark:text-white">{name}</p>
                    </div>
                    <p className="truncate text-sm text-gray-500">{positionLabel(p.position) || 'Position not set'}</p>
                    {p.isCaptain && <Badge variant="court" className="mt-1.5">Captain</Badge>}
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs uppercase tracking-wide text-gray-500">Height</dt>
                    <dd className="truncate font-medium text-gray-800 dark:text-gray-200">{p.height || '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs uppercase tracking-wide text-gray-500">Nationality</dt>
                    <dd className="truncate font-medium text-gray-800 dark:text-gray-200">{p.nationality || '—'}</dd>
                  </div>
                </dl>

                <Link
                  to={`/players-management/${p.id}`}
                  aria-label={`Open ${name}`}
                  className="absolute inset-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/60"
                >
                  <span className="sr-only">Open player</span>
                </Link>

                <div className="relative z-10 mt-auto flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                  <Button variant="secondary" size="sm" disabled={saving} onClick={() => toggleCaptain(p)} aria-label={p.isCaptain ? `Remove ${name} as captain` : `Make ${name} captain`}>
                    {p.isCaptain ? 'Remove captain' : 'Make captain'}
                  </Button>
                  <Button variant="destructive-ghost" size="sm" onClick={() => void remove(p)} aria-label={`Remove ${name}`}>Remove</Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog {...dialogProps} />
    </>
  );
};

export default RosterCard;

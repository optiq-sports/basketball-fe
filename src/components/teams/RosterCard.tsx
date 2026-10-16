import React from 'react';
import { Link } from 'react-router-dom';
import { FiEdit2, FiUserMinus } from 'react-icons/fi';
import { PlayerAvatar } from '../players/PlayerAvatar';
import { positionLabel } from '../players/player-form';
import { iconButton } from '../ui/formStyles';
import { normalizeName } from '../../lib/text';
import type { Player } from '../../types/api';

export const ROSTER_GRID = 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3';

const playerName = (p: Player) => `${normalizeName(p.firstName)} ${normalizeName(p.lastName)}`.trim();

/**
 * The roster as the pre-redesign grey photo cards: avatar, jersey number, name, position, and two icon
 * actions. The whole card opens the player's own page; the buttons stop that so they stay usable.
 *
 * Editing and removing are the page's jobs, not this component's — it reports both upward so the one
 * dialog on the page handles them, rather than each card owning a copy of the mutation.
 */
const RosterCard: React.FC<{
  players: Player[];
  onEdit: (player: Player) => void;
  onRemove: (player: Player) => void;
  /** Overview shows the squad to read; the Players tab is where it's managed. */
  readOnly?: boolean;
}> = ({ players, onEdit, onRemove, readOnly = false }) => {
  return (
    <ul className={ROSTER_GRID} aria-label="Roster">
      {players.map((p) => {
        const name = playerName(p);
        return (
          <li key={p.id} className="min-w-0">
            <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-4 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-white/[0.02]">
              <Link
                to={`/players-management/${p.id}`}
                aria-label={`Open ${name}`}
                className="absolute inset-0 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <span className="sr-only">Open player</span>
              </Link>
              <div className="relative flex items-center gap-4">
                <PlayerAvatar firstName={p.firstName} lastName={p.lastName} photo={p.photo} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    {p.jerseyNumber != null && (
                      <span className="text-sm font-bold text-gray-900 dark:text-white">#{p.jerseyNumber}</span>
                    )}
                    <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">{name}</h3>
                    {p.isCaptain && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                        Captain
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-600 dark:text-gray-400">
                    {positionLabel(p.position) || 'Position not set'}
                  </p>
                </div>
                {!readOnly && (
                <div className="relative z-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(p);
                    }}
                    className={iconButton('brand')}
                    title={`Edit ${name}`}
                    aria-label={`Edit ${name}`}
                  >
                    <FiEdit2 size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(p);
                    }}
                    className={iconButton('warning')}
                    title={`Remove ${name} from this team`}
                    aria-label={`Remove ${name} from this team`}
                  >
                    <FiUserMinus size={18} />
                  </button>
                </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default RosterCard;

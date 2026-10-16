import React from 'react';
import { Link } from 'react-router-dom';
import { FiEdit2, FiUserMinus } from 'react-icons/fi';
import { PlayerAvatar } from '../players/PlayerAvatar';
import { positionLabel } from '../players/player-form';
import { iconButton } from '../ui/formStyles';
import { normalizeName } from '../../lib/text';
import type { Player } from '../../types/api';

const playerName = (p: Player) => `${normalizeName(p.firstName)} ${normalizeName(p.lastName)}`.trim();

/**
 * The same roster as `RosterCard`, as a table: jersey, player, position, height and nationality read
 * across columns, which is what cards can't do. The two are interchangeable — identical props, so the
 * page swaps one for the other and nothing else changes.
 *
 * Restored with the roster view toggle (Fix 147). Unlike the version the redesign had, this one owns no
 * mutations: the page keeps the single edit dialog, the single remove confirmation and the captain
 * select, so the two views can't drift apart or raise two dialogs between them.
 */
const RosterTable: React.FC<{
  players: Player[];
  onEdit: (player: Player) => void;
  onRemove: (player: Player) => void;
  /** Overview shows the squad to read; the Players tab is where it's managed. */
  readOnly?: boolean;
}> = ({ players, onEdit, onRemove, readOnly = false }) => {
  const cell = 'px-4 py-3 text-sm text-gray-700 dark:text-gray-300';

  return (
    // `relative` keeps the caption's absolute positioning clipped to the scroller, not the page.
    <div className="relative overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <table className="w-full min-w-[640px]">
        <caption className="sr-only">Roster</caption>
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <th scope="col" className="px-4 py-3 font-semibold">#</th>
            <th scope="col" className="px-4 py-3 font-semibold">Player</th>
            <th scope="col" className="px-4 py-3 font-semibold">Position</th>
            <th scope="col" className="px-4 py-3 font-semibold">Height</th>
            <th scope="col" className="px-4 py-3 font-semibold">Nationality</th>
            {!readOnly && (
              <th scope="col" className="px-4 py-3 font-semibold text-right">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const name = playerName(p);
            return (
              <tr key={p.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                <td className={`${cell} font-semibold tabular-nums text-gray-900 dark:text-white`}>
                  {p.jerseyNumber ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/players-management/${p.id}`}
                    aria-label={`Open ${name}`}
                    className="flex cursor-pointer items-center gap-3 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <PlayerAvatar firstName={p.firstName} lastName={p.lastName} photo={p.photo} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400">
                        {name}
                      </span>
                      {p.isCaptain && (
                        <span className="mt-0.5 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                          Captain
                        </span>
                      )}
                    </span>
                  </Link>
                </td>
                <td className={cell}>{positionLabel(p.position) || '—'}</td>
                <td className={cell}>{p.height || '—'}</td>
                <td className={cell}>{p.nationality || '—'}</td>
                {!readOnly && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(p)}
                        className={iconButton('brand')}
                        title={`Edit ${name}`}
                        aria-label={`Edit ${name}`}
                      >
                        <FiEdit2 size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(p)}
                        className={iconButton('warning')}
                        title={`Remove ${name} from this team`}
                        aria-label={`Remove ${name} from this team`}
                      >
                        <FiUserMinus size={18} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RosterTable;

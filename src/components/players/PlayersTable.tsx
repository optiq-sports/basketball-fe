import React from 'react';
import { Link } from 'react-router-dom';
import { LuArrowDown, LuArrowUp, LuArrowUpDown } from 'react-icons/lu';
import { Button } from '../ui/primitives/button';
import { Badge } from '../ui/primitives/badge';
import { PlayerAvatar } from './PlayerAvatar';
import { positionLabel } from './player-form';
import { normalizeName } from '../../lib/text';
import { cn } from '../../lib/utils';
import type { Player } from '../../types/api';

/** The sorts the backend accepts for players. Each is a column on the player table itself. */
export type PlayerSortKey = 'name' | 'position' | 'nationality' | 'createdAt';

interface Column {
  key: string;
  label: string;
  /** Set only for columns the backend can sort. Jersey number and team live on the join table, so they can't. */
  sortKey?: PlayerSortKey;
  className?: string;
}

const COLUMNS: Column[] = [
  { key: 'name', label: 'Player', sortKey: 'name' },
  { key: 'jersey', label: '#', className: 'w-14' },
  { key: 'position', label: 'Position', sortKey: 'position' },
  { key: 'team', label: 'Team' },
  { key: 'height', label: 'Height' },
  { key: 'nationality', label: 'Nationality', sortKey: 'nationality' },
  { key: 'createdAt', label: 'Added', sortKey: 'createdAt' },
];

const formatAdded = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/**
 * The players as a table, for scanning and comparing many at once. The page is the same server page the
 * cards show, and the sort is the same server-side sort: a header click asks the server, it doesn't
 * reorder the twelve rows on screen. Jersey number and team have no sort arrow because the backend
 * answers 400 for them (Gap 37).
 */
export function PlayersTable({
  players,
  sort,
  dir,
  onSort,
  onEdit,
  onRelease,
  busy,
}: {
  players: Player[];
  sort: PlayerSortKey;
  dir: 'asc' | 'desc';
  onSort: (key: PlayerSortKey) => void;
  onEdit: (p: Player) => void;
  onRelease: (p: Player) => void;
  busy?: boolean;
}) {
  return (
    <div className={cn('relative overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900', busy && 'opacity-70 transition-opacity')}>
      <table className="w-full min-w-[52rem] text-left text-sm" aria-label="Players">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800">
          <tr>
            {COLUMNS.map((c) => {
              const active = c.sortKey !== undefined && c.sortKey === sort;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : c.sortKey ? 'none' : undefined}
                  className={cn('px-3 py-3 font-semibold', c.className)}
                >
                  {c.sortKey ? (
                    <button
                      type="button"
                      onClick={() => onSort(c.sortKey!)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded uppercase tracking-wide outline-none hover:text-gray-900 focus-visible:ring-[3px] focus-visible:ring-court-400/50 dark:hover:text-white"
                    >
                      {c.label}
                      {active ? (dir === 'asc' ? <LuArrowUp aria-hidden className="size-3.5" /> : <LuArrowDown aria-hidden className="size-3.5" />) : <LuArrowUpDown aria-hidden className="size-3.5 opacity-40" />}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
            <th scope="col" className="px-3 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const name = `${normalizeName(p.firstName)} ${normalizeName(p.lastName)}`;
            return (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/60">
                <td className="px-3 py-2.5">
                  <Link
                    to={`/players-management/${p.id}`}
                    className="flex items-center gap-3 whitespace-nowrap rounded outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50"
                  >
                    <PlayerAvatar firstName={p.firstName} lastName={p.lastName} photo={p.photo} size="sm" />
                    <span className="font-medium text-gray-900 hover:underline dark:text-white">{name}</span>
                    {p.isCaptain && <Badge variant="court">Captain</Badge>}
                  </Link>
                </td>
                <td className="px-3 py-2.5 font-semibold tabular-nums text-signal-600 dark:text-signal-400">{p.jerseyNumber != null ? `#${p.jerseyNumber}` : '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-gray-700 dark:text-gray-300">{positionLabel(p.position) || '—'}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{p.teamName ? normalizeName(p.teamName) : 'No team'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-gray-700 dark:text-gray-300">{p.height || '—'}</td>
                <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{p.nationality || '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-gray-500">{formatAdded(p.createdAt)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" aria-label={`Edit ${name}`} onClick={() => onEdit(p)}>Edit</Button>
                    {p.teamId && (
                      <Button variant="destructive-ghost" size="sm" aria-label={`Release ${name}`} onClick={() => onRelease(p)}>Release</Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

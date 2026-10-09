import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import { useRemovePlayerFromTeam, useSetTeamCaptain } from '../../api/hooks';
import { resolvePlayerPhotoUrl, handlePhotoLoadError } from '../../utils/playerPhotoPlaceholder';
import { EmptyState } from '../admin/page-states';
import { Badge } from '../ui/primitives/badge';
import { Button } from '../ui/primitives/button';
import ConfirmDialog from '../ui/ConfirmDialog';
import { normalizeName } from '../../lib/text';
import type { Player } from '../../types/api';

const playerName = (p: Player) => `${normalizeName(p.firstName)} ${normalizeName(p.lastName)}`.trim();

const POSITION_LABELS: Record<string, string> = {
  POINT_GUARD: 'Point Guard',
  SHOOTING_GUARD: 'Shooting Guard',
  SMALL_FORWARD: 'Small Forward',
  POWER_FORWARD: 'Power Forward',
  CENTER: 'Center',
};

/** The team's roster. A table, not cards: jersey, position, height and nationality are scanned across columns. */
const RosterTable: React.FC<{ teamId: string; teamName: string; players: Player[]; onAddPlayers: () => void }> = ({ teamId, teamName, players, onAddPlayers }) => {
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

  const columns = useMemo<ColumnDef<Player>[]>(
    () => [
      { id: 'jersey', header: '#', cell: ({ row }) => <span className="tabular-nums font-semibold text-gray-900 dark:text-white">{row.original.jerseyNumber ?? '—'}</span> },
      {
        id: 'player',
        header: 'Player',
        cell: ({ row }) => {
          const p = row.original;
          return (
            <Link to={`/players-management/${p.id}`} className="flex items-center gap-3 outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50 rounded-sm">
              <img
                src={resolvePlayerPhotoUrl(p.photo, p.id)}
                onError={() => handlePhotoLoadError(p.id)}
                alt=""
                className="size-9 shrink-0 rounded-full object-cover"
              />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-gray-900 hover:text-court-700 dark:text-white dark:hover:text-court-300">{playerName(p)}</span>
                {p.isCaptain && <Badge variant="court" className="mt-0.5">Captain</Badge>}
              </span>
            </Link>
          );
        },
      },
      { id: 'position', header: 'Position', cell: ({ row }) => <span className="text-gray-700 dark:text-gray-300">{POSITION_LABELS[row.original.position as string] ?? row.original.position ?? '—'}</span> },
      { id: 'height', header: 'Height', cell: ({ row }) => <span className="text-gray-700 dark:text-gray-300">{row.original.height || '—'}</span> },
      { id: 'nationality', header: 'Nationality', cell: ({ row }) => <span className="text-gray-700 dark:text-gray-300">{row.original.nationality || '—'}</span> },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          const p = row.original;
          const saving = setCaptain.isPending && setCaptain.variables?.playerId === p.id;
          return (
            <div className="flex justify-end gap-1.5">
              <Button variant="secondary" size="sm" disabled={saving} onClick={() => toggleCaptain(p)} aria-label={p.isCaptain ? `Remove ${playerName(p)} as captain` : `Make ${playerName(p)} captain`}>
                {p.isCaptain ? 'Remove captain' : 'Make captain'}
              </Button>
              <Button variant="destructive-ghost" size="sm" onClick={() => void remove(p)} aria-label={`Remove ${playerName(p)}`}>Remove</Button>
            </div>
          );
        },
      },
    ],
    // toggleCaptain/remove close over stable hooks and teamId/teamName
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamId, teamName, setCaptain.isPending, setCaptain.variables],
  );

  const table = useReactTable({ data: players, columns, getCoreRowModel: getCoreRowModel() });

  if (players.length === 0) {
    return <EmptyState title="No players yet" description="Add players from elsewhere, or create new ones for this team." action={{ label: 'Add players', onClick: onAddPlayers }} />;
  }

  // `relative` on the scroll wrapper so the table's screen-reader-only text (absolutely positioned) is clipped
  // with it instead of stretching the page.
  return (
    <div className="relative overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">Roster</caption>
        <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-gray-200 dark:border-gray-800">
              {hg.headers.map((h) => <th key={h.id} scope="col" className="px-4 py-3 font-semibold">{flexRender(h.column.columnDef.header, h.getContext())}</th>)}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
              {row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default RosterTable;

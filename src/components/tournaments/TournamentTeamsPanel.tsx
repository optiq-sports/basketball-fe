import React, { useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import { useSetTournamentTeamGroup, useTournamentRemoveTeam } from '../../api/hooks';
import ConfirmDialog from '../ui/ConfirmDialog';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';
import { EmptyState } from '../admin/page-states';
import type { StandingRow } from '../../pages/tournaments/standings';
import { cn } from '../../lib/utils';
import { safeColor } from '../teams/TeamCrest';
import { normalizeName } from '../../lib/text';

export const GROUP_OPTIONS = ['A', 'B', 'C', 'D'] as const;

/**
 * The tournament's teams with live standings. Moving a team to another group and removing a team both
 * apply at once and roll back with the server's reason if refused. Removing only unlinks the team: its
 * matches stay in the tournament.
 */
const TournamentTeamsPanel: React.FC<{
  tournamentId: string;
  tournamentName: string;
  rows: StandingRow[];
  onAddTeams: () => void;
}> = ({ tournamentId, tournamentName, rows, onAddTeams }) => {
  const setGroup = useSetTournamentTeamGroup();
  const removeTeam = useTournamentRemoveTeam();
  const toast = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const [groupFilter, setGroupFilter] = useState<'all' | string>('all');

  const visible = useMemo(
    () => (groupFilter === 'all' ? rows : rows.filter((r) => (r.group ?? '') === groupFilter)),
    [rows, groupFilter],
  );

  const groupsInUse = useMemo(() => [...new Set(rows.map((r) => r.group).filter((g): g is string => !!g))].sort(), [rows]);

  const remove = async (team: StandingRow) => {
    const ok = await confirm({
      title: `Remove ${normalizeName(team.name)}?`,
      description: `${normalizeName(team.name)} leaves ${tournamentName}. Matches already scheduled stay in the tournament.`,
      confirmLabel: 'Remove team',
      tone: 'danger',
    });
    if (!ok) return;
    removeTeam.mutate(
      { tournamentId, teamId: team.id },
      {
        onSuccess: () => toast.success(`${normalizeName(team.name)} removed.`),
        onError: (err) => toast.error(`Couldn’t remove ${normalizeName(team.name)}: ${err.message}`),
      },
    );
  };

  const columns = useMemo<ColumnDef<StandingRow>[]>(
    () => [
      {
        id: 'group',
        header: 'Group',
        cell: ({ row }) => {
          const team = row.original;
          const saving = setGroup.isPending && setGroup.variables?.teamId === team.id;
          return (
            <div className="flex items-center gap-2">
              <select
                aria-label={`Group for ${normalizeName(team.name)}`}
                value={team.group ?? ''}
                disabled={saving}
                onChange={(e) => {
                  const group = e.target.value;
                  if (!group || group === team.group) return;
                  setGroup.mutate(
                    { tournamentId, teamId: team.id, group },
                    { onError: (err) => toast.error(`Couldn’t move ${normalizeName(team.name)}: ${err.message}`) },
                  );
                }}
                className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="">None</option>
                {GROUP_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              {saving && <Spinner className="size-4 text-court-600" />}
            </div>
          );
        },
      },
      {
        id: 'team',
        header: 'Team',
        cell: ({ row }) => {
          const t = row.original;
          const color = safeColor(t.color);
          return (
            <span className="flex items-center gap-2.5">
              <span aria-hidden className={cn('size-3 shrink-0 rounded-full', !color && 'bg-gray-300 dark:bg-gray-600')} style={color ? { backgroundColor: color } : undefined} />
              <span className="font-semibold text-gray-900 dark:text-white">{normalizeName(t.name)}</span>
            </span>
          );
        },
      },
      { id: 'gp', header: 'GP', cell: ({ row }) => <span className="tabular-nums">{row.original.gp}</span> },
      { id: 'w', header: 'W', cell: ({ row }) => <span className="tabular-nums">{row.original.w}</span> },
      { id: 'l', header: 'L', cell: ({ row }) => <span className="tabular-nums">{row.original.l}</span> },
      { id: 'pct', header: 'PCT', cell: ({ row }) => <span className="tabular-nums">{row.original.pct.toFixed(1)}</span> },
      { id: 'pts', header: 'PTS', cell: ({ row }) => <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{row.original.points}</span> },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button variant="destructive-ghost" size="sm" onClick={() => void remove(row.original)} aria-label={`Remove ${normalizeName(row.original.name)}`}>
              Remove
            </Button>
          </div>
        ),
      },
    ],
    // mutations are stable hook objects; remove closes over them
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tournamentId, setGroup.isPending, setGroup.variables],
  );

  const table = useReactTable({ data: visible, columns, getCoreRowModel: getCoreRowModel() });

  if (rows.length === 0) {
    return <EmptyState title="No teams yet" description="Add the teams taking part, then assign them to groups." action={{ label: 'Add teams', onClick: onAddTeams }} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter by group" className="flex flex-wrap gap-1.5">
          {(['all', ...groupsInUse] as const).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={groupFilter === g}
              onClick={() => setGroupFilter(g)}
              className={cn(
                'h-8 rounded-md px-3 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50',
                groupFilter === g ? 'bg-court-700 text-white dark:bg-court-400 dark:text-court-950' : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300',
              )}
            >
              {g === 'all' ? 'All groups' : `Group ${g}`}
            </button>
          ))}
        </div>
        <Button onClick={onAddTeams}>Add teams</Button>
      </div>

      <div className="relative overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">Teams and standings</caption>
          <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-200 dark:border-gray-800">
                {hg.headers.map((h) => (
                  <th key={h.id} scope="col" className={cn('px-4 py-3 font-semibold', ['gp', 'w', 'l', 'pct', 'pts'].includes(h.id) && 'text-right')}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-gray-500">No teams in this group.</td></tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cn('px-4 py-3', ['gp', 'w', 'l', 'pct', 'pts'].includes(cell.column.id) && 'text-right')}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">Standings count only completed games. A win is worth 2 points.</p>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default TournamentTeamsPanel;

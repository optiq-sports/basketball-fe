import React, { useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import { useSetTournamentTeamGroup, useTournamentRemoveTeam } from '../../api/hooks';
import ConfirmDialog from '../ui/ConfirmDialog';
import Spinner from '../ui/Spinner';
import { btnPrimary, selectClass } from '../ui/formStyles';
import type { StandingRow } from '../../pages/tournaments/standings';
import { cn } from '../../lib/utils';
import { TeamCrest } from '../teams/TeamCrest';
import { normalizeName } from '../../lib/text';

export const GROUP_OPTIONS = ['A', 'B', 'C', 'D'] as const;

/**
 * Who is entered in the tournament, and which group each team is in. Moving a team and removing one
 * both apply at once and roll back with the server's reason if refused. Removing only unlinks the team:
 * its matches stay in the tournament.
 *
 * The win–loss record is deliberately not here — the standings table above it is where the league table
 * lives, and repeating GP/W/L in both read as two tables of the same thing. The old page had neither
 * the group picker nor the remove action, so this is the only place either exists.
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
  // Alphabetical by name here, not by record: this is the list of entrants, not the league table.
  const visible = useMemo(() => [...rows].sort((a, b) => a.name.localeCompare(b.name)), [rows]);

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
                className={`w-auto ${selectClass}`}
              >
                <option value="">None</option>
                {GROUP_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              {saving && <Spinner className="size-4 text-brand-500" />}
            </div>
          );
        },
      },
      {
        id: 'team',
        header: 'Team',
        cell: ({ row }) => {
          const t = row.original;
          return (
            <span className="flex items-center gap-3">
              <TeamCrest name={t.name} color={t.color} size="sm" />
              <span className="font-semibold text-gray-900 dark:text-white">{normalizeName(t.name)}</span>
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <button
              type="button"
              onClick={() => void remove(row.original)}
              aria-label={`Remove ${normalizeName(row.original.name)}`}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-error-600 transition-colors hover:bg-error-50 dark:text-error-500 dark:hover:bg-error-500/10"
            >
              Remove
            </button>
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
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">No teams yet</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Add the teams taking part, then assign them to groups.</p>
        </div>
        <button type="button" onClick={onAddTeams} className={btnPrimary}>Add Teams</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" onClick={onAddTeams} className={btnPrimary}>Add Teams</button>
      </div>

      <div className="relative overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <table className="w-full min-w-[32rem] text-sm" aria-label="Teams and groups">
          <caption className="sr-only">Teams entered, and the group each is in</caption>
          <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-200 dark:border-gray-800">
                {hg.headers.map((h) => (
                  <th key={h.id} scope="col" className={cn('px-4 py-3 font-semibold', h.id === 'actions' && 'text-right')}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">No teams in this tournament yet.</td></tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cn('px-4 py-3', cell.column.id === 'actions' && 'text-right')}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default TournamentTeamsPanel;

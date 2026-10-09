import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDeleteTeam, usePlayers, useTeam, useUpdateTeam } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import type { Team, TeamCreate } from '../../types/api';
import { ErrorState, ListSkeleton, PageHeader } from '../../components/admin/page-states';
import { Button } from '../../components/ui/primitives/button';
import { Card, CardTitle } from '../../components/ui/primitives/card';
import TeamFormDialog from '../../components/teams/TeamFormDialog';
import DeleteTeamDialog, { type DeleteTeamTarget } from '../../components/teams/DeleteTeamDialog';
import RosterTable from '../../components/teams/RosterTable';
import AddPlayerDialog from '../../components/teams/AddPlayerDialog';
import { safeColor } from '../../components/teams/TeamCrest';
import { teamPerformanceByTournament, type TeamMatchForPerformance } from './team-performance';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';

type TeamDetail = Team & {
  tournamentTeams?: Array<{ tournament: { id: string; name: string } }>;
  homeMatches?: Array<{ tournamentId: string; status: string; homeScore?: number | null; awayScore?: number | null }>;
  awayMatches?: Array<{ tournamentId: string; status: string; homeScore?: number | null; awayScore?: number | null }>;
};

/**
 * One team: its details, a real per-tournament record, and its roster. Replaces a page that showed
 * invented championships and season stats with no backend source (Fix 105) — the performance table here
 * is computed entirely from the team's own matches.
 */
const TeamDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const teamQuery = useTeam(id);
  const playersQuery = usePlayers(id ?? undefined);
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTeamTarget | null>(null);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);

  const team = teamQuery.data as TeamDetail | undefined;
  const players = playersQuery.data ?? [];

  const performance = useMemo(() => {
    if (!team) return [];
    const tournaments = (team.tournamentTeams ?? []).map((tt) => tt.tournament);
    const matches: TeamMatchForPerformance[] = [
      ...(team.homeMatches ?? []).map((m) => ({ ...m, isHome: true })),
      ...(team.awayMatches ?? []).map((m) => ({ ...m, isHome: false })),
    ];
    return teamPerformanceByTournament(tournaments, matches);
  }, [team]);

  const saveEdit = (body: TeamCreate) => {
    if (!team) return;
    setEditError(null);
    updateTeam.mutate(
      { id: team.id, data: body },
      { onSuccess: () => { toast.success(`${body.name} saved.`); setEditOpen(false); }, onError: (err) => setEditError(err.message) },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteTeam.mutate(target.id, {
      onSuccess: () => { toast.success(`${target.name} deleted.`); navigate('/teams-management', { replace: true }); },
      onError: (err) => { toast.error(`Couldn’t delete ${target.name}: ${err.message}`); setDeleteTarget(null); },
    });
  };

  if (teamQuery.isPending) return <ListSkeleton columns={3} rows={4} label="Loading team" />;
  if (teamQuery.isError || !team) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/teams-management" className="w-fit text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← Teams</Link>
        <ErrorState message={(teamQuery.error as Error | null)?.message ?? 'This team couldn’t be found.'} onRetry={() => void teamQuery.refetch()} />
      </div>
    );
  }

  const color = safeColor(team.color);

  return (
    <div className="flex flex-col gap-6">
      <Link to="/teams-management" className="w-fit text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← Teams</Link>

      <PageHeader
        title={normalizeName(team.name)}
        description={[team.coach && `Coach: ${team.coach}`, team.country].filter(Boolean).join(' · ') || team.code}
        actions={
          <>
            {team.logo ? (
              <img src={team.logo} alt="" className="size-10 rounded-lg object-cover" />
            ) : (
              <span aria-hidden className={cn('flex size-10 items-center justify-center rounded-lg text-sm font-bold text-white', !color && 'bg-gray-400 dark:bg-gray-700')} style={color ? { backgroundColor: color } : undefined}>
                {team.code.slice(0, 3).toUpperCase()}
              </span>
            )}
            <Button variant="secondary" onClick={() => { setEditError(null); setEditOpen(true); }}>Edit</Button>
            <Button variant="destructive-ghost" onClick={() => setDeleteTarget({ id: team.id, name: normalizeName(team.name) })}>Delete</Button>
          </>
        }
      />

      <Card>
        <CardTitle>Record by tournament</CardTitle>
        {performance.length === 0 ? (
          <p className="text-sm text-gray-500">This team isn’t in any tournament yet.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">Record by tournament</caption>
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th scope="col" className="py-2 pr-3 font-semibold">Tournament</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">GP</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">W</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">L</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">PCT</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">PF</th>
                  <th scope="col" className="py-2 pl-3 text-right font-semibold">PA</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((row) => (
                  <tr key={row.tournamentId} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                    <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white">{normalizeName(row.tournamentName)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.gp}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.w}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.l}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.pct.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.pointsFor}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">{row.pointsAgainst}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Roster</h2>
        <Button onClick={() => setAddPlayerOpen(true)}>Add player</Button>
      </div>

      {playersQuery.isPending ? (
        <ListSkeleton columns={6} rows={5} label="Loading roster" />
      ) : playersQuery.isError ? (
        <ErrorState message={(playersQuery.error as Error).message} onRetry={() => void playersQuery.refetch()} />
      ) : (
        <RosterTable teamId={team.id} teamName={team.name} players={players} onAddPlayers={() => setAddPlayerOpen(true)} />
      )}

      <TeamFormDialog open={editOpen} onClose={() => setEditOpen(false)} initial={team} isSaving={updateTeam.isPending} serverError={editError} onSubmit={saveEdit} />
      <DeleteTeamDialog target={deleteTarget} isDeleting={deleteTeam.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      <AddPlayerDialog open={addPlayerOpen} onClose={() => setAddPlayerOpen(false)} teamId={team.id} />
    </div>
  );
};

export default TeamDetails;

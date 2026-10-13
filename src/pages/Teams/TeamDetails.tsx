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
import RosterCard from '../../components/teams/RosterCard';
import AddPlayerDialog from '../../components/teams/AddPlayerDialog';
import { safeColor } from '../../components/teams/TeamCrest';
import { teamPerformanceByTournament, teamSummary, type TeamMatchForPerformance } from './team-performance';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';

type TeamDetail = Team & {
  /** Not on the backend `Team` yet (Gap 56): shown when they arrive. */
  arena?: string | null;
  foundedYear?: number | null;
  contactEmail?: string | null;
  tournamentTeams?: Array<{ tournament: { id: string; name: string } }>;
  homeMatches?: Array<{ tournamentId: string; status: string; homeScore?: number | null; awayScore?: number | null; scheduledDate?: string }>;
  awayMatches?: Array<{ tournamentId: string; status: string; homeScore?: number | null; awayScore?: number | null; scheduledDate?: string }>;
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
  // Cards is the restored pre-redesign roster experience and the default (Fix 126); Table is still
  // here for scanning many players' height/nationality/position across columns at once.
  const [rosterView, setRosterView] = useState<'cards' | 'table'>('cards');

  const team = teamQuery.data as TeamDetail | undefined;
  const players = playersQuery.data ?? [];

  // Coach and assistant coach, named and labelled, restored from the pre-redesign page (Fix 126) —
  // real data (`team.coach`/`team.assistantCoach`/`team.country`), not the fabricated section that
  // sat beside it there (see this file's own history and docs/BACKEND_GAPS.md for why that's gone).
  const coachingStaff = useMemo(() => {
    if (!team) return [];
    return [
      ...(team.coach ? [{ id: 'coach', name: team.coach, role: 'Coach' }] : []),
      ...(team.assistantCoach ? [{ id: 'assistant', name: team.assistantCoach, role: 'Assistant coach' }] : []),
    ];
  }, [team]);

  const teamMatches = useMemo<TeamMatchForPerformance[]>(
    () => (team ? [...(team.homeMatches ?? []).map((m) => ({ ...m, isHome: true })), ...(team.awayMatches ?? []).map((m) => ({ ...m, isHome: false }))] : []),
    [team],
  );
  const performance = useMemo(
    () => (team ? teamPerformanceByTournament((team.tournamentTeams ?? []).map((tt) => tt.tournament), teamMatches) : []),
    [team, teamMatches],
  );
  const summary = useMemo(() => teamSummary(teamMatches), [teamMatches]);

  const info: Array<[string, string]> = team
    ? ([
        ['Country', team.country],
        ['State or city', team.state],
        ['Home arena', team.arena],
        ['Founded', team.foundedYear != null ? String(team.foundedYear) : null],
        ['Contact email', team.contactEmail],
      ] as Array<[string, string | null | undefined]>).filter((r): r is [string, string] => !!r[1])
    : [];
  const record = (r: { w: number; l: number }) => `${r.w}–${r.l}`;
  const tiles: Array<[string, string]> = [
    ['Games played', String(summary.played)],
    ['Win %', summary.winPct == null ? '—' : `${summary.winPct}%`],
    ['Home record', summary.played ? record(summary.home) : '—'],
    ['Away record', summary.played ? record(summary.away) : '—'],
    ['Streak', summary.streak ? `${summary.streak.kind}${summary.streak.count}` : '—'],
    ['Points per game', summary.ppg == null ? '—' : String(summary.ppg)],
    ['Allowed per game', summary.papg == null ? '—' : String(summary.papg)],
  ];

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
        <CardTitle>Season at a glance</CardTitle>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {tiles.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
              <dd className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-gray-500">From this team’s finished games. A game whose score hasn’t reached the match yet isn’t counted.</p>
      </Card>

      {info.length > 0 && (
        <Card>
          <CardTitle>Team information</CardTitle>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {info.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
                <dd className="truncate text-sm font-medium text-gray-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

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

      {coachingStaff.length > 0 && (
        <Card>
          <CardTitle>Coaching staff</CardTitle>
          <div className="grid gap-6 sm:grid-cols-2">
            {coachingStaff.map((staff) => (
              <div key={staff.id} className="min-w-0">
                <p className="truncate text-base font-semibold text-gray-900 dark:text-white">{normalizeName(staff.name)}</p>
                <p className="text-sm text-gray-500">{staff.role}{team.country ? ` · ${team.country}` : ''}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Roster</h2>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Roster view" className="flex rounded-md border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-900">
            {(['cards', 'table'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={rosterView === v}
                onClick={() => setRosterView(v)}
                className={cn(
                  'h-8 rounded px-3 text-sm font-semibold capitalize outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50',
                  rosterView === v ? 'bg-court-700 text-white dark:bg-court-400 dark:text-court-950' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Button onClick={() => setAddPlayerOpen(true)}>Add player</Button>
        </div>
      </div>

      {playersQuery.isPending ? (
        <ListSkeleton columns={6} rows={5} label="Loading roster" />
      ) : playersQuery.isError ? (
        <ErrorState message={(playersQuery.error as Error).message} onRetry={() => void playersQuery.refetch()} />
      ) : players.length === 0 ? (
        <RosterTable teamId={team.id} teamName={team.name} players={players} onAddPlayers={() => setAddPlayerOpen(true)} />
      ) : rosterView === 'cards' ? (
        <RosterCard teamId={team.id} teamName={team.name} players={players} />
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

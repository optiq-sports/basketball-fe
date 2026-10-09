import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDeleteTournament, useMatches, useTournament, useUpdateTournament } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import type { Match, Tournament, TournamentCreate } from '../../types/api';
import { PageHeader, ListSkeleton, EmptyState, ErrorState } from '../../components/admin/page-states';
import { Button } from '../../components/ui/primitives/button';
import { Badge } from '../../components/ui/primitives/badge';
import { Card, CardTitle } from '../../components/ui/primitives/card';
import TournamentFormDialog from '../../components/tournaments/TournamentFormDialog';
import DeleteTournamentDialog, { type DeleteTarget } from '../../components/tournaments/DeleteTournamentDialog';
import TournamentTeamsPanel from '../../components/tournaments/TournamentTeamsPanel';
import AddTeamsDialog from '../../components/tournaments/AddTeamsDialog';
import { divisionLabel } from '../../components/tournaments/tournament-form';
import { computeStandings, leadersFrom, LEADER_LABELS, LEADER_STATS, type LeaderStat, type StandingsTeam } from './standings';
import { cn } from '../../lib/utils';
import { MatchCard, MATCH_GRID } from '../../components/matches/MatchCard';
import { normalizeName } from '../../lib/text';

type Tab = 'overview' | 'teams' | 'matches';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'teams', label: 'Teams' },
  { id: 'matches', label: 'Matches' },
];

const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/**
 * One tournament: its details, its teams and standings, and its matches. Editing and deleting reuse the
 * list's dialogs. Team management and standings are here; match scheduling and results come in Module 4.
 */
const Tournaments: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const tab: Tab = TABS.some((t) => t.id === params.get('tab')) ? (params.get('tab') as Tab) : 'overview';
  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    if (next === 'overview') p.delete('tab');
    else p.set('tab', next);
    setParams(p, { replace: true });
  };

  const tournamentQuery = useTournament(id);
  const matchesQuery = useMatches(id);
  const updateTournament = useUpdateTournament();
  const deleteTournament = useDeleteTournament();

  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [addTeamsOpen, setAddTeamsOpen] = useState(false);
  const [leaderStat, setLeaderStat] = useState<LeaderStat>('points');
  const [copied, setCopied] = useState(false);

  // Teams come with the tournament, each with its group and full details.
  const tournament = tournamentQuery.data as (Tournament & { teams?: Array<{ teamId: string; group?: string | null; team: StandingsTeam & { color?: string | null } }> }) | undefined;
  const linkedTeams = tournament?.teams ?? [];
  const matches: Match[] = matchesQuery.data ?? [];

  const standingTeams: StandingsTeam[] = useMemo(
    () => linkedTeams.map((lt) => ({ id: lt.team.id, name: normalizeName(lt.team.name), group: lt.group ?? null, color: lt.team.color })),
    [linkedTeams],
  );
  const standings = useMemo(() => computeStandings(standingTeams, matches), [standingTeams, matches]);
  const existingTeamIds = useMemo(() => new Set(linkedTeams.map((lt) => lt.teamId)), [linkedTeams]);

  const teamNames = useMemo(() => new Map(standingTeams.map((t) => [t.id, t.name])), [standingTeams]);
  const teamColors = useMemo(() => new Map(linkedTeams.map((lt) => [lt.team.id, lt.team.color])), [linkedTeams]);
  const teamLogos = useMemo(() => new Map(linkedTeams.map((lt) => [lt.team.id, (lt.team as { logo?: string }).logo])), [linkedTeams]);
  const leaders = useMemo(() => leadersFrom(matches, leaderStat, teamNames), [matches, leaderStat, teamNames]);

  const saveEdit = (body: TournamentCreate) => {
    if (!tournament) return;
    setEditError(null);
    updateTournament.mutate(
      { id: tournament.id, data: body },
      {
        onSuccess: () => {
          toast.success(`${body.name} saved.`);
          setEditOpen(false);
        },
        onError: (err) => setEditError(err.message),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteTournament.mutate(target.id, {
      onSuccess: () => {
        toast.success(`${target.name} deleted.`);
        navigate('/tournaments', { replace: true });
      },
      onError: (err) => {
        toast.error(`Couldn’t delete ${target.name}: ${err.message}`);
        setDeleteTarget(null);
      },
    });
  };

  const copyCode = async () => {
    if (!tournament?.code) return;
    try {
      await navigator.clipboard.writeText(tournament.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Couldn’t copy the code. Select it and copy by hand.');
    }
  };

  if (tournamentQuery.isPending) {
    return <ListSkeleton columns={3} rows={4} label="Loading tournament" />;
  }
  if (tournamentQuery.isError || !tournament) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/tournaments" className="w-fit text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← Tournaments</Link>
        <ErrorState message={(tournamentQuery.error as Error | null)?.message ?? 'This tournament couldn’t be found.'} onRetry={() => void tournamentQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/tournaments" className="w-fit text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← Tournaments</Link>

      <PageHeader
        title={normalizeName(tournament.name)}
        description={`${day(tournament.startDate)}${tournament.endDate ? ` – ${day(tournament.endDate)}` : ''}${tournament.venue ? ` · ${tournament.venue}` : ''}`}
        actions={
          <>
            <Badge variant="court">{divisionLabel(tournament.division)}</Badge>
            {tournament.code && (
              <Button variant="secondary" size="sm" onClick={() => void copyCode()} aria-label={`Copy tournament code ${tournament.code}`}>
                {copied ? 'Copied' : `Code ${tournament.code}`}
              </Button>
            )}
            <Button variant="secondary" onClick={() => { setEditError(null); setEditOpen(true); }}>Edit</Button>
            <Button
              variant="destructive-ghost"
              onClick={() => setDeleteTarget({ id: tournament.id, name: normalizeName(tournament.name), matches: matches.length, teams: linkedTeams.length })}
            >
              Delete
            </Button>
          </>
        }
      />

      <div role="tablist" aria-label="Tournament sections" className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              'relative h-11 shrink-0 px-4 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50',
              tab === t.id ? 'text-court-900 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
            )}
          >
            {t.label}
            {t.id === 'teams' && <span className="ml-1.5 tabular-nums text-gray-400">{linkedTeams.length}</span>}
            {t.id === 'matches' && <span className="ml-1.5 tabular-nums text-gray-400">{matches.length}</span>}
            {tab === t.id && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-signal-500" />}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle>Format</CardTitle>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Detail label="Games" value={tournament.numberOfGames} />
              <Detail label="Quarters" value={tournament.numberOfQuarters} />
              <Detail label="Quarter length" value={`${tournament.quarterDuration} min`} />
              <Detail label="Overtime" value={tournament.overtimeDuration ? `${tournament.overtimeDuration} min` : '—'} />
            </dl>
            <CardTitle className="mt-2">Officials</CardTitle>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Detail label="Crew chief" value={tournament.crewChief} />
              <Detail label="Umpire 1" value={tournament.umpire1} />
              <Detail label="Umpire 2" value={tournament.umpire2} />
              <Detail label="Commissioner" value={tournament.commissioner} />
            </dl>
          </Card>

          <Card>
            <CardTitle>Leaders</CardTitle>
            <div role="group" aria-label="Leader category" className="flex flex-wrap gap-1.5">
              {LEADER_STATS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={leaderStat === s}
                  onClick={() => setLeaderStat(s)}
                  className={cn('h-7 rounded-md px-2.5 text-xs font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50', leaderStat === s ? 'bg-court-700 text-white dark:bg-court-400 dark:text-court-950' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300')}
                >
                  {LEADER_LABELS[s]}
                </button>
              ))}
            </div>
            {leaders.length === 0 ? (
              <p className="text-sm text-gray-500">Leaders appear once a game is completed.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                {leaders.map((l, i) => (
                  <li key={l.playerId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-5 text-right tabular-nums text-gray-400">{i + 1}</span>
                      <span className="truncate font-medium text-gray-900 dark:text-white">{normalizeName(l.name)}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-300">
                      <span className="font-semibold text-gray-900 dark:text-white">{l.total}</span> · {l.avg} avg · {l.gp} GP
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}

      {tab === 'teams' && (
        <div id="panel-teams" role="tabpanel" aria-labelledby="tab-teams">
          <TournamentTeamsPanel
            tournamentId={tournament.id}
            tournamentName={normalizeName(tournament.name)}
            rows={standings}
            onAddTeams={() => setAddTeamsOpen(true)}
          />
        </div>
      )}

      {tab === 'matches' && (
        <div id="panel-matches" role="tabpanel" aria-labelledby="tab-matches" className="flex flex-col gap-4">
          {matchesQuery.isPending && <ListSkeleton columns={4} rows={5} label="Loading matches" />}
          {matchesQuery.isError && <ErrorState message={(matchesQuery.error as Error).message} onRetry={() => void matchesQuery.refetch()} />}
          {!matchesQuery.isPending && !matchesQuery.isError && matches.length === 0 && (
            <EmptyState title="No matches yet" description="Matches are scheduled from the fixtures view." action={{ label: 'Open fixtures', onClick: () => navigate(`/tournaments/${tournament.id}/fixtures`) }} />
          )}
          {!matchesQuery.isPending && !matchesQuery.isError && matches.length > 0 && (
            <ul className={MATCH_GRID} aria-label="Matches in this tournament">
              {matches.map((m) => (
                <li key={m.id} className="min-w-0">
                  <MatchCard
                    match={{
                      id: m.id,
                      home: { name: teamNames.get(m.homeTeamId) ?? 'TBD', color: teamColors.get(m.homeTeamId), logo: teamLogos.get(m.homeTeamId) },
                      away: { name: teamNames.get(m.awayTeamId) ?? 'TBD', color: teamColors.get(m.awayTeamId), logo: teamLogos.get(m.awayTeamId) },
                      homeScore: m.homeScore,
                      awayScore: m.awayScore,
                      status: m.status,
                      scheduledDate: m.scheduledDate,
                      venue: m.venue,
                    }}
                    href={`/tournaments/${tournament.id}/match/${m.id}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <TournamentFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={tournament}
        isSaving={updateTournament.isPending}
        serverError={editError}
        onSubmit={saveEdit}
      />
      <DeleteTournamentDialog target={deleteTarget} isDeleting={deleteTournament.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      <AddTeamsDialog open={addTeamsOpen} onClose={() => setAddTeamsOpen(false)} tournamentId={tournament.id} existingTeamIds={existingTeamIds} />
    </div>
  );
};

const Detail: React.FC<{ label: string; value?: string | number | null }> = ({ label, value }) => (
  <div className="min-w-0">
    <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className="mt-0.5 truncate font-medium text-gray-900 dark:text-white">{value ?? '—'}</dd>
  </div>
);

export default Tournaments;

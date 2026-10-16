import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiCalendar, FiChevronDown, FiChevronLeft, FiEdit2, FiMapPin, FiTrash2, FiUserPlus } from 'react-icons/fi';
import { LuTrophy } from 'react-icons/lu';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useCreateMatch,
  useDeleteTournament,
  useMatches,
  useStatisticians,
  useTournament,
  useUpdateTournament,
} from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { useLivePoll } from '../../hooks/useLivePoll';
import type { Match, MatchCreate, Tournament, TournamentCreate } from '../../types/api';
import DataTable from '../../components/ui/DataTable';
import Skeleton from '../../components/ui/Skeleton';
import { btnPrimary, btnSecondary, errorBanner } from '../../components/ui/formStyles';
import TournamentFormDialog from '../../components/tournaments/TournamentFormDialog';
import DeleteTournamentDialog, { type DeleteTarget } from '../../components/tournaments/DeleteTournamentDialog';
import TournamentTeamsPanel from '../../components/tournaments/TournamentTeamsPanel';
import AddTeamsDialog from '../../components/tournaments/AddTeamsDialog';
import { divisionLabel } from '../../components/tournaments/tournament-form';
import { TeamCrest } from '../../components/teams/TeamCrest';
import { CopyMatchCodeButton } from '../../components/matches/CopyMatchCodeButton';
import { matchCodeOf } from '../../lib/match-code';
import FixtureFormDialog, { type FixtureStatistician, type FixtureTeam } from '../../components/fixtures/FixtureFormDialog';
import { computeStandings, leadersFrom, LEADER_LABELS, LEADER_STATS, type LeaderStat, type StandingRow, type StandingsTeam } from './standings';
import { normalizeName } from '../../lib/text';

/** The short column labels the old standings table used. */
const LEADER_SHORT: Record<LeaderStat, string> = {
  points: 'PTS',
  rebounds: 'REB',
  assists: 'AST',
  blocks: 'BLK',
  steals: 'STL',
};

const LEADER_RANK_COLORS = ['#FFCA69', '#80B7D5', '#7FD99A'];

const formatMatchTime = (iso?: string): string => {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'TBA' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const formatDateOnly = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

interface LinkedTeam {
  teamId: string;
  group?: string | null;
  team: StandingsTeam & { code?: string; color?: string | null; logo?: string | null };
}

type TournamentDetail = Tournament & { teams?: LinkedTeam[] };

/**
 * One tournament, back to its pre-redesign layout: the flyer as a banner, the title with its venue and
 * dates, the four quick-stat cards, a live game panel, group tabs over the standings beside the
 * schedule list, and the tournament leaders underneath.
 *
 * Everything added since stays, and three things the old page got wrong are not restored:
 *
 * - **The group tabs now filter.** The old page hardcoded Group A/B/C/D and used the choice only in the
 *   heading — the table below showed every team whichever tab was active. The tabs here are the groups
 *   the tournament actually uses, and they filter the standings.
 * - **"Ongoing Game" means live.** The old panel matched `LIVE || COMPLETED`, so a game that had
 *   finished was presented as still in progress.
 * - **Leaders link to the player, not to one game.** The old card opened the player's stats inside
 *   whichever match it had last seen them in, while the number on the card was their tournament total.
 *
 * Teams and their groups are managed in their own section rather than in the standings table: the old
 * page could only add teams, never move one between groups or remove one.
 */
const Tournaments: React.FC = () => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const tournamentQuery = useTournament(tournamentId);
  const matchesQuery = useMatches(tournamentId);
  // Polls while a game is live so the score, standings and leaders catch up without a reload (Fix 125).
  const hasLiveMatch = (matchesQuery.data ?? []).some((m) => m.status === 'LIVE');
  useLivePoll(hasLiveMatch, () => matchesQuery.refetch());
  const statisticiansQuery = useStatisticians();
  const updateTournament = useUpdateTournament();
  const deleteTournament = useDeleteTournament();
  const createMatch = useCreateMatch();

  const [showEditModal, setShowEditModal] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [showAddTeamsModal, setShowAddTeamsModal] = useState(false);
  const [activeLeaderStat, setActiveLeaderStat] = useState<LeaderStat>('points');
  const [showSchedules, setShowSchedules] = useState(true);
  const [fixtureOpen, setFixtureOpen] = useState(false);
  const [fixtureError, setFixtureError] = useState<string | null>(null);

  const tournament = tournamentQuery.data as TournamentDetail | undefined;
  const linkedTeams = tournament?.teams ?? [];
  const matches: Match[] = matchesQuery.data ?? [];

  const standingTeams: StandingsTeam[] = useMemo(
    () => linkedTeams.map((lt) => ({ id: lt.team.id, name: normalizeName(lt.team.name), group: lt.group ?? null, color: lt.team.color })),
    [linkedTeams],
  );
  const standings = useMemo(() => computeStandings(standingTeams, matches), [standingTeams, matches]);
  const existingTeamIds = useMemo(() => new Set(linkedTeams.map((lt) => lt.teamId)), [linkedTeams]);

  const teamById = useMemo(() => new Map(linkedTeams.map((lt) => [lt.team.id, lt.team])), [linkedTeams]);
  const teamNames = useMemo(() => new Map(standingTeams.map((t) => [t.id, t.name])), [standingTeams]);
  const leaders = useMemo(() => leadersFrom(matches, activeLeaderStat, teamNames, 3), [matches, activeLeaderStat, teamNames]);

  /** Only the groups this tournament actually uses, so the tabs mean something. */
  const groupsInUse = useMemo(
    () => [...new Set(linkedTeams.map((lt) => lt.group).filter((g): g is string => !!g))].sort(),
    [linkedTeams],
  );
  const groupParam = params.get('group');
  const activeGroup = groupParam && groupsInUse.includes(groupParam) ? groupParam : 'all';
  const setActiveGroup = (group: string) => {
    const next = new URLSearchParams(params);
    if (group === 'all') next.delete('group');
    else next.set('group', group);
    setParams(next, { replace: true });
  };
  const visibleStandings = useMemo(
    () => (activeGroup === 'all' ? standings : standings.filter((r) => (r.group ?? '') === activeGroup)),
    [standings, activeGroup],
  );

  const completedCount = matches.filter((m) => m.status === 'COMPLETED').length;
  const liveMatch = useMemo(() => matches.find((m) => m.status === 'LIVE') ?? null, [matches]);

  const fixtureTeams: FixtureTeam[] = useMemo(
    () => linkedTeams.map((lt) => ({ id: lt.team.id, name: normalizeName(lt.team.name) })).sort((a, b) => a.name.localeCompare(b.name)),
    [linkedTeams],
  );
  const fixtureStatisticians: FixtureStatistician[] = (statisticiansQuery.data ?? []) as FixtureStatistician[];
  const canCreateFixture = fixtureTeams.length >= 2;

  const saveEdit = (body: TournamentCreate) => {
    if (!tournament) return;
    setEditError(null);
    updateTournament.mutate(
      { id: tournament.id, data: body },
      {
        onSuccess: () => { toast.success(`${normalizeName(body.name)} saved.`); setShowEditModal(false); },
        onError: (err) => setEditError(err.message),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteTournament.mutate(target.id, {
      onSuccess: () => { toast.success(`${target.name} deleted.`); navigate('/tournaments', { replace: true }); },
      onError: (err) => { toast.error(`Couldn’t delete ${target.name}: ${err.message}`); setDeleteTarget(null); },
    });
  };

  const createFixture = (body: { create?: MatchCreate }) => {
    if (!body.create) return;
    setFixtureError(null);
    createMatch.mutate(body.create, {
      onSuccess: () => { toast.success('Fixture created.'); setFixtureOpen(false); },
      onError: (err) => setFixtureError(err.message),
    });
  };

  const standingsColumns = useMemo<ColumnDef<StandingRow>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (r) => r.name,
        header: 'Team',
        cell: ({ row }) => {
          const t = teamById.get(row.original.id);
          return (
            <div className="flex items-center gap-3">
              <TeamCrest name={row.original.name} code={t?.code} logo={t?.logo} color={row.original.color} size="sm" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{row.original.name}</span>
            </div>
          );
        },
      },
      { id: 'gp', accessorFn: (r) => r.gp, header: 'GP', cell: ({ row }) => <span className="tabular-nums">{row.original.gp}</span> },
      { id: 'w', accessorFn: (r) => r.w, header: 'W', cell: ({ row }) => <span className="tabular-nums">{row.original.w}</span> },
      { id: 'l', accessorFn: (r) => r.l, header: 'L', cell: ({ row }) => <span className="tabular-nums">{row.original.l}</span> },
      { id: 'pct', accessorFn: (r) => r.pct, header: '%', cell: ({ row }) => <span className="tabular-nums">{row.original.gp > 0 ? `${row.original.pct.toFixed(1)}%` : '—'}</span> },
      { id: 'points', accessorFn: (r) => r.points, header: 'Points', cell: ({ row }) => <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{row.original.points}</span> },
    ],
    [teamById],
  );

  if (tournamentQuery.isPending || !tournamentId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-950" aria-label="Loading tournament">
        <div className="mx-auto max-w-7xl space-y-6">
          <Skeleton className="h-10 w-72 rounded" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }
  if (tournamentQuery.isError || !tournament) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-950">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-4">
          <p className="text-error-600 dark:text-error-500">
            {(tournamentQuery.error as Error | null)?.message ?? 'This tournament couldn’t be found.'}
          </p>
          <button type="button" onClick={() => void tournamentQuery.refetch()} className={btnSecondary}>Retry</button>
          <button type="button" onClick={() => navigate('/tournaments')} className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400">
            Back to Tournaments
          </button>
        </div>
      </div>
    );
  }

  const quickStats: Array<{ label: string; value: string }> = [
    { label: 'Teams', value: String(linkedTeams.length) },
    { label: 'Games played', value: String(completedCount) },
    { label: 'Total games', value: String(tournament.numberOfGames ?? matches.length) },
    { label: 'Division', value: divisionLabel(tournament.division) },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl">
        {tournament.flyer && (
          <div className="mb-6 max-h-[220px] overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
            <img src={tournament.flyer} alt="" className="max-h-[220px] w-full object-cover object-top" />
          </div>
        )}

        <button
          type="button"
          onClick={() => navigate('/tournaments')}
          className="mb-3 flex cursor-pointer items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <FiChevronLeft className="size-4" />
          Tournaments
        </button>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{normalizeName(tournament.name)}</h1>
            {(tournament.venue || tournament.startDate) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                {tournament.venue && (
                  <span className="flex items-center gap-1.5">
                    <FiMapPin aria-hidden className="size-3.5" />
                    {tournament.venue}
                  </span>
                )}
                {tournament.startDate && (
                  <span className="flex items-center gap-1.5">
                    <FiCalendar aria-hidden className="size-3.5" />
                    {formatDateOnly(tournament.startDate)}
                    {tournament.endDate && tournament.endDate !== tournament.startDate
                      ? ` – ${formatDateOnly(tournament.endDate)}`
                      : ''}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setEditError(null); setShowEditModal(true); }}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <FiEdit2 aria-hidden className="size-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setShowAddTeamsModal(true)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
            >
              <FiUserPlus aria-hidden className="size-4" />
              Add Teams
            </button>
            <button
              type="button"
              onClick={() => navigate(`/tournaments/${tournamentId}/fixtures`)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              <FiCalendar aria-hidden className="size-4" />
              View Fixtures
            </button>
            <button
              type="button"
              onClick={() => setDeleteTarget({ id: tournament.id, name: normalizeName(tournament.name), matches: matches.length, teams: linkedTeams.length })}
              disabled={deleteTournament.isPending}
              title="Delete tournament"
              aria-label="Delete tournament"
              className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-error-500 transition-colors hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-error-500/10"
            >
              <FiTrash2 aria-hidden className="size-4" />
            </button>
          </div>
        </div>

        <dl className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {quickStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{stat.label}</dt>
              <dd className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{stat.value}</dd>
            </div>
          ))}
        </dl>

        {matchesQuery.isError && (
          <div className={`mb-4 ${errorBanner}`}>
            {(matchesQuery.error as Error).message || 'Failed to load matches'}
          </div>
        )}

        {liveMatch && (
          <Link
            to={`/tournaments/${tournamentId}/match/${liveMatch.id}`}
            aria-label={`Open the live game, ${teamNames.get(liveMatch.homeTeamId) ?? 'TBD'} against ${teamNames.get(liveMatch.awayTeamId) ?? 'TBD'}`}
            className="mb-6 block cursor-pointer rounded-2xl border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ongoing game</h2>
              <span className="flex items-center gap-1.5 rounded-full bg-error-50 px-2 py-0.5 text-xs font-semibold text-error-700 dark:bg-error-500/10 dark:text-error-500">
                <span aria-hidden className="size-1.5 rounded-full bg-error-500" />
                Live
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8">
              <div className="flex items-center gap-4">
                <TeamCrest
                  name={teamNames.get(liveMatch.homeTeamId) ?? 'TBD'}
                  code={teamById.get(liveMatch.homeTeamId)?.code}
                  logo={teamById.get(liveMatch.homeTeamId)?.logo}
                  color={teamById.get(liveMatch.homeTeamId)?.color}
                  size="lg"
                />
                <div>
                  <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">{teamNames.get(liveMatch.homeTeamId) ?? 'TBD'}</div>
                  <div className="text-4xl font-bold tabular-nums text-gray-900 dark:text-white">{liveMatch.homeScore ?? 0}</div>
                </div>
              </div>

              <div className="text-lg font-medium text-gray-400 dark:text-gray-500">VS</div>

              <div className="flex items-center gap-4">
                <div>
                  <div className="mb-1 text-right text-xs text-gray-500 dark:text-gray-400">{teamNames.get(liveMatch.awayTeamId) ?? 'TBD'}</div>
                  <div className="text-4xl font-bold tabular-nums text-gray-900 dark:text-white">{liveMatch.awayScore ?? 0}</div>
                </div>
                <TeamCrest
                  name={teamNames.get(liveMatch.awayTeamId) ?? 'TBD'}
                  code={teamById.get(liveMatch.awayTeamId)?.code}
                  logo={teamById.get(liveMatch.awayTeamId)?.logo}
                  color={teamById.get(liveMatch.awayTeamId)?.color}
                  size="lg"
                />
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
              {normalizeName(tournament.name)} | {formatMatchTime(liveMatch.scheduledDate)}
            </p>
          </Link>
        )}

        {groupsInUse.length > 0 && (
          <div role="group" aria-label="Filter standings by group" className="mb-6 inline-flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
            {['all', ...groupsInUse].map((group) => (
              <button
                key={group}
                type="button"
                aria-pressed={activeGroup === group}
                onClick={() => setActiveGroup(group)}
                className={`cursor-pointer rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                  activeGroup === group
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
                }`}
              >
                {group === 'all' ? 'All groups' : `Group ${group}`}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Standings */}
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-100 p-5 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {activeGroup === 'all' ? 'Standings' : `Group ${activeGroup} standings`}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {completedCount}/{tournament.numberOfGames ?? '—'} games played
              </p>
            </div>
            <div className="p-5 pt-0">
              <DataTable
                columns={standingsColumns}
                data={visibleStandings}
                label={activeGroup === 'all' ? 'Standings' : `Group ${activeGroup} standings`}
                pageSize={20}
                emptyMessage={activeGroup === 'all' ? 'No teams in this tournament yet.' : 'No teams in this group.'}
              />
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Only completed games count. A win is worth 2 points.
              </p>
            </div>
          </div>

          {/* Schedules */}
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-5 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowSchedules((v) => !v)}
                aria-expanded={showSchedules}
                className="flex cursor-pointer items-center gap-2 text-lg font-bold text-gray-900 dark:text-white"
              >
                <FiChevronDown aria-hidden className={`size-4 text-gray-400 transition-transform ${showSchedules ? '' : '-rotate-90'}`} />
                Schedules ({matches.length})
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setFixtureError(null); setFixtureOpen(true); }}
                  disabled={!canCreateFixture}
                  title={canCreateFixture ? undefined : 'Add at least two teams first'}
                  className="cursor-pointer text-sm font-medium text-brand-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:no-underline dark:text-brand-400"
                >
                  New fixture
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/tournaments/${tournamentId}/fixtures`)}
                  className="cursor-pointer text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  View all
                </button>
              </div>
            </div>

            {showSchedules && (
              <div className="space-y-3 p-5">
                {matchesQuery.isPending && <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Loading matches...</p>}
                {!matchesQuery.isPending && matches.length === 0 && (
                  <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No matches scheduled yet.</p>
                )}
                {matches.map((m) => {
                  const home = teamNames.get(m.homeTeamId) ?? 'TBD';
                  const away = teamNames.get(m.awayTeamId) ?? 'TBD';
                  return (
                    <div key={m.id} className="relative rounded-xl border border-gray-200 bg-gray-50 p-4 transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.02] dark:hover:border-gray-700">
                      <Link
                        to={`/tournaments/${tournamentId}/match/${m.id}`}
                        aria-label={`Open ${home} against ${away}`}
                        className="absolute inset-0 cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <span className="sr-only">Open match</span>
                      </Link>
                      <div className="relative flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
                          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                            <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{home}</span>
                            <TeamCrest name={home} code={teamById.get(m.homeTeamId)?.code} logo={teamById.get(m.homeTeamId)?.logo} color={teamById.get(m.homeTeamId)?.color} size="sm" />
                          </div>
                          {m.status === 'COMPLETED' || m.status === 'LIVE' ? (
                            <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                              {m.homeScore ?? 0} – {m.awayScore ?? 0}
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs font-semibold text-gray-400 dark:text-gray-600">VS</span>
                          )}
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <TeamCrest name={away} code={teamById.get(m.awayTeamId)?.code} logo={teamById.get(m.awayTeamId)?.logo} color={teamById.get(m.awayTeamId)?.color} size="sm" />
                            <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{away}</span>
                          </div>
                        </div>
                        {m.status === 'SCHEDULED' && (
                          <span className="relative z-10 shrink-0">
                            <CopyMatchCodeButton code={matchCodeOf(m)} label={`${home} vs ${away}`} />
                          </span>
                        )}
                      </div>
                      <div className="relative mt-2.5 flex items-center justify-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>{m.venue ?? '—'}</span>
                        <span aria-hidden className="text-gray-300 dark:text-gray-700">•</span>
                        <span>{formatMatchTime(m.scheduledDate)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tournament leaders */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Tournament leaders</h2>

          <div role="group" aria-label="Leader category" className="mb-6 inline-flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
            {LEADER_STATS.map((stat) => (
              <button
                key={stat}
                type="button"
                aria-pressed={activeLeaderStat === stat}
                onClick={() => setActiveLeaderStat(stat)}
                className={`cursor-pointer rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                  activeLeaderStat === stat
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
                }`}
              >
                {LEADER_LABELS[stat]}
              </button>
            ))}
          </div>

          {leaders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 py-12 text-center dark:border-gray-800 dark:bg-white/[0.02]">
              <LuTrophy aria-hidden className="size-8 text-gray-300 dark:text-gray-700" />
              <p className="text-sm text-gray-500 dark:text-gray-400">No stats recorded yet for this tournament.</p>
            </div>
          ) : (
            <ol className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {leaders.map((player, i) => (
                <li key={player.playerId}>
                  <Link
                    to={`/players-management/${player.playerId}`}
                    aria-label={`Open ${normalizeName(player.name)}`}
                    className="flex cursor-pointer items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                  >
                    <span
                      aria-hidden
                      className="flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                      style={{ backgroundColor: LEADER_RANK_COLORS[i % LEADER_RANK_COLORS.length] }}
                    >
                      #{i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-gray-900 dark:text-white">{normalizeName(player.name)}</div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-brand-600 dark:text-brand-400">{player.total}</span>{' '}
                        {LEADER_SHORT[activeLeaderStat]} · {player.avg} avg · {player.gp} GP
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Teams and groups */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Teams and groups</h2>
          <TournamentTeamsPanel
            tournamentId={tournament.id}
            tournamentName={normalizeName(tournament.name)}
            rows={standings}
            onAddTeams={() => setShowAddTeamsModal(true)}
          />
        </div>
      </div>

      <TournamentFormDialog
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        initial={tournament}
        isSaving={updateTournament.isPending}
        serverError={editError}
        onSubmit={saveEdit}
      />
      <DeleteTournamentDialog target={deleteTarget} isDeleting={deleteTournament.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      <AddTeamsDialog open={showAddTeamsModal} onClose={() => setShowAddTeamsModal(false)} tournamentId={tournament.id} existingTeamIds={existingTeamIds} />
      <FixtureFormDialog
        open={fixtureOpen}
        onClose={() => setFixtureOpen(false)}
        match={null}
        teams={fixtureTeams}
        statisticians={fixtureStatisticians}
        isSaving={createMatch.isPending}
        serverError={fixtureError}
        onSubmit={createFixture}
        tournamentId={tournament.id}
      />
    </div>
  );
};

export default Tournaments;

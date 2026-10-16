import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiAward, FiCalendar, FiEdit2, FiMapPin, FiTrash, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { GiBasketballBall } from 'react-icons/gi';
import type { ColumnDef } from '@tanstack/react-table';
import {
  useDeleteTeam,
  usePlayers,
  useRemovePlayerFromTeam,
  useSetTeamCaptain,
  useTeam,
  useUpdatePlayer,
  useUpdateTeam,
  useUploadFile,
} from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import type { Player, PlayerUpdateBody, Team, TeamCreate } from '../../types/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import DataTable from '../../components/ui/DataTable';
import Skeleton from '../../components/ui/Skeleton';
import { btnPrimary, labelClass, selectClass } from '../../components/ui/formStyles';
import TeamFormDialog from '../../components/teams/TeamFormDialog';
import DeleteTeamDialog, { type DeleteTeamTarget } from '../../components/teams/DeleteTeamDialog';
import RosterCard from '../../components/teams/RosterCard';
import RosterTable from '../../components/teams/RosterTable';
import { ViewToggle, type ListView } from '../../components/ui/ViewToggle';
import AddPlayerDialog from '../../components/teams/AddPlayerDialog';
import { TeamCrest, isLight, safeColor } from '../../components/teams/TeamCrest';
import PlayerFormDialog from '../../components/players/PlayerFormDialog';
import { teamPerformanceByTournament, teamSummary, hasFinalScore, type TeamMatchForPerformance, type TeamPerformanceRow } from './team-performance';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';

/** The opponent on one of this team's matches, as `GET /teams/:id` includes it. */
interface MatchSide {
  id: string;
  name: string;
  code?: string;
  color?: string | null;
  logo?: string | null;
}

interface TeamMatch {
  id: string;
  tournamentId: string;
  tournament?: { id: string; name: string };
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  scheduledDate?: string;
  venue?: string | null;
  homeTeam?: MatchSide;
  awayTeam?: MatchSide;
}

type TeamDetail = Team & {
  /**
   * In the Prisma schema and in what `TeamsService.findOne` selects, but no migration adds the columns
   * (`arena`, `founded_year`, `contact_email`), so the deployed database doesn't have them yet and
   * these arrive undefined — Gap 54. Shown the moment they're real.
   */
  arena?: string | null;
  foundedYear?: number | null;
  contactEmail?: string | null;
  tournamentTeams?: Array<{ tournament: { id: string; name: string } }>;
  homeMatches?: TeamMatch[];
  awayMatches?: TeamMatch[];
};

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'History' },
  { id: 'players', label: 'Players' },
  { id: 'stats', label: 'Statistics' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const isTab = (v: string | null): v is TabId => !!v && TABS.some((t) => t.id === v);

/** One finished game, from this team's point of view. */
interface HistoryRow {
  id: string;
  tournamentId: string;
  tournamentName: string;
  /** The raw timestamp, for ordering — the displayed date is words and sorts wrongly. */
  playedAt: string;
  date: string;
  venue: string | null;
  ourScore: number;
  theirScore: number;
  opponent: MatchSide;
  result: 'win' | 'loss' | 'tie';
}

const formatDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * One team, back to its pre-redesign shape: the colour-washed hero with the team's crest and record,
 * then Overview / History / Players / Statistics tabs.
 *
 * Every number on it is real. The old page filled these sections with invented data — eight fabricated
 * games against the Warriors and the Bulls, three invented championships, three seasons of made-up
 * win–loss records and points, and a stat grid hardcoded to zero. That is why the redesign replaced it
 * (Fix 105). The layout is back; the fiction is not:
 *
 * - **Match history** is this team's own `homeMatches`/`awayMatches`, which the backend returns with the
 *   opposing team and the tournament attached, so the opponent, score, venue and date are all real.
 * - **The record** — games played, wins, losses, win %, home and away splits, points per game and the
 *   current streak — is computed from those same games by `teamSummary`.
 * - **Statistics** shows the real per-tournament record from `teamPerformanceByTournament` where the old
 *   page showed invented seasons.
 * - **Championships are gone.** Nothing in the backend records a tournament winner, so there is no
 *   honest way to show them. Tournaments entered takes that tile's place.
 *
 * A COMPLETED game still stored as 0–0 hasn't had its score written back to the match (Gap 47), so it
 * is left out rather than counted as a tie.
 */
const ROSTER_VIEW_KEY = 'roster_view';

/** The roster view: what was chosen last time, else cards. A private window can throw on access. */
const initialRosterView = (): ListView => {
  try {
    return localStorage.getItem(ROSTER_VIEW_KEY) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
};

const TeamDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const { confirm, dialogProps } = useConfirmDialog();

  const tabParam = params.get('tab');
  const activeTab: TabId = isTab(tabParam) ? tabParam : 'overview';
  const setTab = (tab: TabId) => {
    const next = new URLSearchParams(params);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setParams(next, { replace: true });
  };

  const teamQuery = useTeam(id ?? null);
  const playersQuery = usePlayers(id ?? undefined);
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const setCaptain = useSetTeamCaptain();
  const removePlayer = useRemovePlayerFromTeam();
  const updatePlayer = useUpdatePlayer();
  const uploadFile = useUploadFile();

  const [rosterView, setRosterView] = useState<ListView>(initialRosterView);
  const chooseRosterView = (next: ListView) => {
    setRosterView(next);
    try {
      localStorage.setItem(ROSTER_VIEW_KEY, next);
    } catch {
      // Storing is a convenience; the view still changes for this visit.
    }
  };

  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTeamTarget | null>(null);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerFormError, setPlayerFormError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const team = teamQuery.data as TeamDetail | undefined;
  const players = playersQuery.data ?? [];

  const teamMatches = useMemo<TeamMatchForPerformance[]>(
    () =>
      team
        ? [
            ...(team.homeMatches ?? []).map((m) => ({ ...m, isHome: true })),
            ...(team.awayMatches ?? []).map((m) => ({ ...m, isHome: false })),
          ]
        : [],
    [team],
  );
  const performance = useMemo(
    () => (team ? teamPerformanceByTournament((team.tournamentTeams ?? []).map((tt) => tt.tournament), teamMatches) : []),
    [team, teamMatches],
  );
  const summary = useMemo(() => teamSummary(teamMatches), [teamMatches]);

  /** Finished games with a real score, newest first, each from this team's side. */
  const history = useMemo<HistoryRow[]>(() => {
    if (!team) return [];
    const sides: Array<{ match: TeamMatch; isHome: boolean }> = [
      ...(team.homeMatches ?? []).map((match) => ({ match, isHome: true })),
      ...(team.awayMatches ?? []).map((match) => ({ match, isHome: false })),
    ];
    return sides
      .filter(({ match, isHome }) => hasFinalScore({ ...match, isHome }))
      .map(({ match, isHome }) => {
        const ourScore = (isHome ? match.homeScore : match.awayScore) as number;
        const theirScore = (isHome ? match.awayScore : match.homeScore) as number;
        const opponent = (isHome ? match.awayTeam : match.homeTeam) ?? { id: '', name: 'Unknown team' };
        return {
          id: match.id,
          tournamentId: match.tournamentId,
          tournamentName: match.tournament?.name ? normalizeName(match.tournament.name) : '—',
          playedAt: match.scheduledDate ?? '',
          date: formatDate(match.scheduledDate),
          venue: match.venue ?? null,
          ourScore,
          theirScore,
          opponent,
          result: ourScore > theirScore ? ('win' as const) : theirScore > ourScore ? ('loss' as const) : ('tie' as const),
        };
      })
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  }, [team]);

  const coachingStaff = useMemo(() => {
    if (!team) return [];
    return [
      ...(team.coach ? [{ id: 'coach', name: team.coach, role: 'Coach' }] : []),
      ...(team.assistantCoach ? [{ id: 'assistant', name: team.assistantCoach, role: 'Assistant coach' }] : []),
    ];
  }, [team]);

  const performanceColumns = useMemo<ColumnDef<TeamPerformanceRow>[]>(
    () => [
      { id: 'tournamentName', accessorFn: (r) => r.tournamentName, header: 'Tournament', cell: ({ row }) => <span className="font-medium text-gray-900 dark:text-white">{row.original.tournamentName}</span> },
      { id: 'gp', accessorFn: (r) => r.gp, header: 'Played', cell: ({ row }) => <span className="tabular-nums">{row.original.gp}</span> },
      { id: 'w', accessorFn: (r) => r.w, header: 'Wins', cell: ({ row }) => <span className="font-semibold tabular-nums text-success-700 dark:text-success-500">{row.original.w}</span> },
      { id: 'l', accessorFn: (r) => r.l, header: 'Losses', cell: ({ row }) => <span className="font-semibold tabular-nums text-error-600 dark:text-error-500">{row.original.l}</span> },
      { id: 'pct', accessorFn: (r) => r.pct, header: 'Win %', cell: ({ row }) => <span className="tabular-nums">{row.original.gp > 0 ? `${row.original.pct.toFixed(1)}%` : '—'}</span> },
      { id: 'pointsFor', accessorFn: (r) => r.pointsFor, header: 'Points For', cell: ({ row }) => <span className="tabular-nums">{row.original.pointsFor.toLocaleString()}</span> },
      { id: 'pointsAgainst', accessorFn: (r) => r.pointsAgainst, header: 'Points Against', cell: ({ row }) => <span className="tabular-nums">{row.original.pointsAgainst.toLocaleString()}</span> },
    ],
    [],
  );

  const saveEdit = (body: TeamCreate) => {
    if (!team) return;
    setEditError(null);
    updateTeam.mutate(
      { id: team.id, data: body },
      {
        onSuccess: () => { toast.success(`${normalizeName(body.name)} saved.`); setEditOpen(false); },
        onError: (err) => setEditError(err.message),
      },
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

  const playerName = (p: Player) => `${normalizeName(p.firstName)} ${normalizeName(p.lastName)}`.trim();

  /**
   * Takes a player off this team's active roster. The old page asked for a release date first; the
   * backend's `removeFromTeam(playerId, teamId)` takes no date and always stamps today, so the picker
   * was decorative and is gone.
   */
  const handleRemovePlayer = async (player: Player) => {
    if (!id) return;
    const name = playerName(player);
    const ok = await confirm({
      title: `Remove ${name}?`,
      description: `${name} leaves ${team ? normalizeName(team.name) : 'this team'}’s active roster, dated today. Their profile and recorded stats are untouched, and they can be signed again later.`,
      confirmLabel: 'Remove from team',
    });
    if (!ok) return;
    removePlayer.mutate(
      { playerId: player.id, teamId: id },
      { onSuccess: () => toast.success(`${name} removed.`), onError: (err) => toast.error(`Couldn’t remove ${name}: ${err.message}`) },
    );
  };

  const handleUpdatePlayer = (body: PlayerUpdateBody) => {
    if (!editingPlayer) return;
    setPlayerFormError(null);
    if (Object.keys(body).length === 0) {
      setEditingPlayer(null);
      return;
    }
    updatePlayer.mutate(
      { id: editingPlayer.id, data: body },
      {
        onSuccess: () => { toast.success(`${playerName(editingPlayer)} saved.`); setEditingPlayer(null); },
        onError: (err) => setPlayerFormError(err.message),
      },
    );
  };

  const chooseCaptain = (playerId: string) => {
    if (!id) return;
    const current = players.find((p) => p.isCaptain);
    // An empty choice clears the captaincy; the old page silently ignored it.
    if (!playerId) {
      if (!current) return;
      setCaptain.mutate(
        { teamId: id, playerId: current.id, body: { isCaptain: false } },
        { onError: (err) => toast.error(`Couldn’t clear the captain: ${err.message}`) },
      );
      return;
    }
    setCaptain.mutate(
      { teamId: id, playerId, body: { isCaptain: true } },
      { onError: (err) => toast.error(`Couldn’t set the captain: ${err.message}`) },
    );
  };

  const uploadLogo = async (file: File) => {
    if (!id) return;
    setUploadingLogo(true);
    try {
      const res = await uploadFile.mutateAsync(file);
      await updateTeam.mutateAsync({ id, data: { logo: res.url } });
      void teamQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  if (teamQuery.isPending && !team) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950" aria-label="Loading team">
        <Skeleton className="h-80 w-full" />
        <div className="space-y-6 p-8">
          <Skeleton className="h-10 w-64 rounded" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }
  if (teamQuery.isError || !team) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white dark:bg-gray-950">
        <p className="text-error-600 dark:text-error-500">
          {(teamQuery.error as Error | null)?.message ?? 'This team couldn’t be found.'}
        </p>
        <button type="button" onClick={() => navigate('/teams-management')} className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400">
          Back to Teams
        </button>
      </div>
    );
  }

  const color = safeColor(team.color) ?? '#552583';
  /**
   * A team's own colour fills the hero, and some are near-white (#fafafa in the seed data), which left
   * every white label on it invisible — the pre-redesign page had the same fault. On a light colour the
   * hero writes in dark ink instead.
   */
  const pale = isLight(color);
  const ink = pale ? 'text-gray-900' : 'text-white';
  const inkMuted = pale ? 'text-gray-700' : 'text-white/90';
  const inkFaint = pale ? 'text-gray-600' : 'text-white/80';
  const inkHover = pale ? 'hover:text-gray-600' : 'hover:text-gray-200';
  const glass = pale ? 'bg-black/5 hover:bg-black/10' : 'bg-white/20 hover:bg-white/30';
  const panel = pale ? 'bg-black/[0.03]' : 'bg-white/10';
  const location = [team.state, team.country].filter(Boolean).join(', ');
  const tournamentCount = (team.tournamentTeams ?? []).length;
  const captainId = players.find((p) => p.isCaptain)?.id ?? '';

  const heroTiles: Array<{ label: string; value: string; className?: string }> = [
    { label: 'Games Played', value: String(summary.played) },
    { label: 'Wins', value: String(summary.wins), className: pale ? 'text-success-700' : 'text-green-300' },
    { label: 'Losses', value: String(summary.losses), className: pale ? 'text-error-600' : 'text-red-300' },
    { label: 'Tournaments', value: String(tournamentCount), className: pale ? 'text-warning-700' : 'text-yellow-300' },
    { label: 'Win %', value: summary.winPct == null ? '—' : `${summary.winPct}%` },
    { label: 'PPG', value: summary.ppg == null ? '—' : String(summary.ppg) },
    { label: 'PAPG', value: summary.papg == null ? '—' : String(summary.papg) },
    {
      label: 'Streak',
      value: summary.streak ? `${summary.streak.kind}${summary.streak.count}` : '—',
      className:
        summary.streak?.kind === 'W'
          ? pale ? 'text-success-700' : 'text-green-300'
          : summary.streak?.kind === 'L'
            ? pale ? 'text-error-600' : 'text-red-300'
            : undefined,
    },
  ];

  const infoRows: Array<[string, string]> = (
    [
      ['Home arena', team.arena],
      ['Home record', summary.played ? `${summary.home.w}–${summary.home.l}` : '—'],
      ['Away record', summary.played ? `${summary.away.w}–${summary.away.l}` : '—'],
      ['Contact email', team.contactEmail],
      ['Country', team.country],
      ['State or city', team.state],
    ] as Array<[string, string | null | undefined]>
  ).filter((r): r is [string, string] => !!r[1]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Hero, washed in the team's own colour */}
      <div className="relative overflow-hidden px-8 pb-12 pt-8" style={{ backgroundColor: color }}>
        <div aria-hidden className="absolute inset-0 opacity-20">
          <svg className="h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
            <path d="M0,100 Q100,50 200,100 T400,100" stroke={pale ? 'black' : 'white'} strokeWidth="3" fill="none" opacity="0.5" />
            <path d="M0,120 Q150,70 300,120 T400,120" stroke={pale ? 'black' : 'white'} strokeWidth="3" fill="none" opacity="0.3" />
            <path d="M0,80 Q120,30 240,80 T400,80" stroke={pale ? 'black' : 'white'} strokeWidth="3" fill="none" opacity="0.4" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/teams-management')}
              className={cn('flex cursor-pointer items-center gap-2 transition-colors', ink, inkHover)}
            >
              <FiArrowLeft size={20} />
              <span className="font-medium">Back to Teams</span>
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setEditError(null); setEditOpen(true); }}
                className={cn('flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 backdrop-blur-sm transition-colors', glass, ink)}
              >
                <FiEdit2 size={18} />
                <span className="font-medium">Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget({ id: team.id, name: normalizeName(team.name) })}
                className="flex cursor-pointer items-center gap-2 rounded-lg bg-error-500/80 px-4 py-2 text-white backdrop-blur-sm transition-colors hover:bg-error-600/90"
              >
                <FiTrash size={18} />
                <span className="font-medium">Delete</span>
              </button>
            </div>
          </div>

          <div className={cn('relative mb-4 overflow-hidden rounded-2xl shadow-sm backdrop-blur-sm', panel)}>
            <div className="flex items-start justify-between gap-6 p-8">
              <div className="min-w-0 flex-1">
                <span className={cn('text-sm', inkFaint)}>Team</span>
                <h2 className={cn('mt-2 text-4xl font-bold', ink)}>{normalizeName(team.name)}</h2>
                <div className="mt-4 space-y-2">
                  <div className={cn('flex items-center gap-2', inkMuted)}>
                    <span className="font-medium">Code:</span>
                    <span>{team.code}</span>
                  </div>
                  {location && (
                    <div className={cn('flex items-center gap-2', inkMuted)}>
                      <FiMapPin size={16} />
                      <span>{location}</span>
                    </div>
                  )}
                  {team.foundedYear != null && (
                    <div className={cn('flex items-center gap-2', inkMuted)}>
                      <FiCalendar size={16} />
                      <span>Founded: {team.foundedYear}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                <div className="relative size-40">
                  {team.logo ? (
                    <img src={team.logo} alt="" className="relative z-10 size-full rounded-2xl object-cover" />
                  ) : (
                    <div className={cn('flex size-full items-center justify-center rounded-2xl', pale ? 'bg-black/5' : 'bg-white/20')}>
                      <GiBasketballBall aria-hidden className={cn('text-8xl opacity-80', ink)} />
                    </div>
                  )}
                </div>
                <label className={cn('mt-2 inline-block cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors', glass, ink)}>
                  {uploadingLogo ? 'Uploading...' : 'Change logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label="Upload team logo"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void uploadLogo(file);
                    }}
                  />
                </label>
              </div>
            </div>

            <div className={cn('relative p-8 backdrop-blur-sm', panel)}>
              <dl className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
                {heroTiles.map((tile) => (
                  <div key={tile.label}>
                    <dt className={cn('text-sm', inkFaint)}>{tile.label}</dt>
                    <dd className={cn('text-2xl font-bold', tile.className ?? ink)}>{tile.value}</dd>
                  </div>
                ))}
              </dl>
              <p className={cn('mt-4 text-center text-xs', inkFaint)}>
                From this team’s finished games. A game whose score hasn’t reached the match yet isn’t counted.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-8 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <div role="tablist" aria-label="Team sections" className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`cursor-pointer px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'overview' && (
            <>
              {infoRows.length > 0 && (
                <section className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <h2 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">Team information</h2>
                  <dl className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {infoRows.map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <dt className="mb-1 text-sm text-gray-600 dark:text-gray-400">{label}</dt>
                        <dd className="truncate text-lg font-semibold text-gray-900 dark:text-white">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              <section className="mb-8">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Current players</h2>
                  {players.length > 0 && <ViewToggle view={rosterView} onChange={chooseRosterView} label="Roster view" />}
                </div>
                {playersQuery.isPending ? (
                  <p className="text-gray-500 dark:text-gray-400">Loading players...</p>
                ) : players.length === 0 ? (
                  <p className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                    No players on this team yet. Add them from the Players tab.
                  </p>
                ) : (
                  rosterView === 'cards' ? (
                    <RosterCard players={players} onEdit={setEditingPlayer} onRemove={handleRemovePlayer} readOnly />
                  ) : (
                    <RosterTable players={players} onEdit={setEditingPlayer} onRemove={handleRemovePlayer} readOnly />
                  )
                )}
              </section>

              {coachingStaff.length > 0 && (
                <section className="mb-8">
                  <h2 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">Coaching staff</h2>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-white/[0.02]">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      {coachingStaff.map((staff) => (
                        <div key={staff.id} className="text-center">
                          <FiUsers aria-hidden className="mx-auto mb-2 text-3xl text-gray-400 dark:text-gray-500" />
                          <h3 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{normalizeName(staff.name)}</h3>
                          <p className="mb-1 text-sm text-gray-600 dark:text-gray-400">{staff.role}</p>
                          {team.country && <p className="text-xs text-gray-500 dark:text-gray-400">{team.country}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <section>
              <h2 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">Match history</h2>
              {history.length === 0 ? (
                <p className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                  No finished games yet. A game appears here once it is completed and its final score has reached the match.
                </p>
              ) : (
                <div className="space-y-4">
                  {history.map((match) => (
                    <Link
                      key={match.id}
                      to={`/tournaments/${match.tournamentId}/match/${match.id}`}
                      aria-label={`Open ${normalizeName(team.name)} against ${normalizeName(match.opponent.name)}`}
                      className="block cursor-pointer rounded-lg border border-gray-200 bg-gray-50 p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-800 dark:bg-white/[0.02]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <TeamCrest name={team.name} code={team.code} logo={team.logo} color={team.color} />
                            <span className="w-32 truncate text-sm font-medium text-gray-700 dark:text-gray-300">{normalizeName(team.name)}</span>
                            <span className={`text-sm font-semibold tabular-nums ${match.result === 'win' ? 'text-success-700 dark:text-success-500' : 'text-gray-800 dark:text-gray-200'}`}>
                              {match.ourScore}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <TeamCrest name={match.opponent.name} code={match.opponent.code} logo={match.opponent.logo} color={match.opponent.color} />
                            <span className="w-32 truncate text-sm font-medium text-gray-700 dark:text-gray-300">{normalizeName(match.opponent.name)}</span>
                            <span className={`text-sm font-semibold tabular-nums ${match.result === 'loss' ? 'text-error-600 dark:text-error-500' : 'text-gray-800 dark:text-gray-200'}`}>
                              {match.theirScore}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right text-xs text-gray-500 dark:text-gray-400">
                          <p className="mb-1 font-medium text-gray-700 dark:text-gray-300">{match.tournamentName}</p>
                          {match.venue && <p>{match.venue}</p>}
                          <p>{match.date}</p>
                          <span
                            className={`mt-2 inline-block rounded-full px-2 py-1 text-xs font-medium ${
                              match.result === 'win'
                                ? 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500'
                                : match.result === 'loss'
                                  ? 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-500'
                                  : 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300'
                            }`}
                          >
                            {match.result === 'win' ? 'Win' : match.result === 'loss' ? 'Loss' : 'Tie'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'players' && (
            <section className="mb-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Current players</h2>
                <div className="flex flex-wrap items-center gap-3">
                  {players.length > 0 && <ViewToggle view={rosterView} onChange={chooseRosterView} label="Roster view" />}
                  <button type="button" onClick={() => setAddPlayerOpen(true)} className={btnPrimary}>
                    Add Player
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="team-captain" className={labelClass}>Team captain</label>
                <select
                  id="team-captain"
                  value={captainId}
                  onChange={(e) => chooseCaptain(e.target.value)}
                  disabled={setCaptain.isPending || players.length === 0}
                  className={`max-w-xs ${selectClass}`}
                >
                  <option value="">No captain</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {playerName(p)}{p.jerseyNumber != null ? ` #${p.jerseyNumber}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {playersQuery.isPending ? (
                <p className="text-gray-500 dark:text-gray-400">Loading players...</p>
              ) : playersQuery.isError ? (
                <p className="rounded-lg border border-error-100 bg-error-50 p-6 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-500">
                  {(playersQuery.error as Error).message}
                </p>
              ) : players.length === 0 ? (
                <p className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                  No players on this team yet. Add one above, or upload the whole squad from Players.
                </p>
              ) : (
                rosterView === 'cards' ? (
                  <RosterCard players={players} onEdit={setEditingPlayer} onRemove={handleRemovePlayer} />
                ) : (
                  <RosterTable players={players} onEdit={setEditingPlayer} onRemove={handleRemovePlayer} />
                )
              )}
            </section>
          )}

          {activeTab === 'stats' && (
            <>
              <section className="mb-8">
                <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-800 dark:text-white">
                  <FiTrendingUp aria-hidden className="text-brand-600 dark:text-brand-400" />
                  Record by tournament
                </h2>
                <DataTable
                  columns={performanceColumns}
                  data={performance}
                  label="Record by tournament"
                  emptyMessage="This team isn’t in any tournament yet."
                />
              </section>

              <section className="mb-8">
                <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-gray-800 dark:text-white">
                  <FiAward aria-hidden className="text-brand-600 dark:text-brand-400" />
                  At a glance
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: 'Tournaments entered', value: String(tournamentCount) },
                    { label: 'Win percentage', value: summary.winPct == null ? '—' : `${summary.winPct}%` },
                    { label: 'Games played', value: String(summary.played) },
                    { label: 'Founded', value: team.foundedYear != null ? String(team.foundedYear) : '—' },
                  ].map((tile) => (
                    <div key={tile.label} className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-800 dark:bg-white/[0.02]">
                      <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{tile.value}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{tile.label}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <TeamFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initial={team}
        isSaving={updateTeam.isPending}
        serverError={editError}
        onSubmit={saveEdit}
      />
      <DeleteTeamDialog
        target={deleteTarget}
        isDeleting={deleteTeam.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <AddPlayerDialog open={addPlayerOpen} onClose={() => setAddPlayerOpen(false)} teamId={team.id} />
      <PlayerFormDialog
        open={!!editingPlayer}
        onClose={() => { setEditingPlayer(null); setPlayerFormError(null); }}
        initial={editingPlayer}
        isSaving={updatePlayer.isPending}
        serverError={playerFormError}
        onUpdate={handleUpdatePlayer}
      />
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default TeamDetails;

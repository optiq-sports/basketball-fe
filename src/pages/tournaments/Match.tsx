import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiChevronLeft } from 'react-icons/fi';
import { useDeleteMatch, useMatch, useStatisticians, useUpdateMatch } from '../../api/hooks';
import { useRebuildProjection } from '../../services/statdash/hooks';
import { useToast } from '../../hooks/useToast';
import type { Match, MatchStatus } from '../../types/api';
import Skeleton from '../../components/ui/Skeleton';
import { btnPrimary, btnSecondary, errorBanner, labelClass, selectClass } from '../../components/ui/formStyles';
import { GameView, type GameTab } from '../../components/game/GameView';
import { CopyMatchCodeButton } from '../../components/matches/CopyMatchCodeButton';
import { matchCodeOf } from '../../lib/match-code';
import { QuarterScoresCard } from '../../components/fixtures/QuarterScoresCard';
import { ADMIN_SETTABLE_STATUSES, STATUS_LABELS } from '../../components/fixtures/fixture-form';
import DeleteFixtureDialog, { type FixtureDeleteTarget } from '../../components/fixtures/DeleteFixtureDialog';
import { dataErrorMessage } from '../../lib/box-score';
import { formatMatchDate } from '../../lib/match-format';
import { normalizeName } from '../../lib/text';
import { useLivePoll } from '../../hooks/useLivePoll';

const TAB_IDS: GameTab[] = ['box', 'plays', 'shots', 'stats'];

type StatisticianOption = { id: string; name?: string | null; email: string };

/**
 * One match, for admins — back to the pre-redesign shell: the `max-w-7xl` page on white, the
 * `text-2xl` "Home vs Away" title with the kick-off under it, then the scoreboard, the admin's own
 * controls, and the game data tabs (all of which live in `GameView`, shared with the client portal).
 *
 * **The status is editable here again** (Fix 147), under the same rule the fixture form uses: an admin
 * may set scheduled, cancelled or postponed, and live and completed are the scorer's to set. The old
 * header offered all five, which let an admin flip a game to LIVE or COMPLETED by hand and fight the
 * scorer — the events are what decide those two, and overriding them desynchronises the session. So the
 * control is back, with the two values it was wrong to offer shown but locked. Time and venue are still
 * edited on the fixture.
 *
 * Also kept: deleting asks for the fixture's name and warns when the game has recorded data; the
 * statistician assignment and the match code sit together, since they are the pair a scorer needs; and
 * the header score polls while the game is live (Fix 125).
 */
const GameScorePage: React.FC = () => {
  const { id: tournamentId, matchId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const tabParam = params.get('tab') as GameTab | null;
  const tab: GameTab = tabParam && TAB_IDS.includes(tabParam) ? tabParam : 'overview';

  const matchQuery = useMatch(matchId);
  const match = matchQuery.data as (Match & { statistician?: { name?: string | null; email?: string } | null }) | undefined;
  const sessionId = match?.gameSessions?.[0]?.id;
  const playerHref = (playerId: string) => `/tournaments/${tournamentId}/match/${matchId}/player/${playerId}`;

  const statisticiansQuery = useStatisticians();
  const updateMatch = useUpdateMatch();
  const deleteMatch = useDeleteMatch();
  const rebuild = useRebuildProjection();
  // The score in the header and the data under it both poll while the game is live (Fix 125); GameView does the data.
  const isLive = match?.status === 'LIVE';
  useLivePoll(isLive, () => void matchQuery.refetch(), 8_000);

  const [assignee, setAssignee] = useState<string | null>(null);
  const [status, setStatus] = useState<MatchStatus | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FixtureDeleteTarget | null>(null);
  const statisticians = (statisticiansQuery.data ?? []) as StatisticianOption[];
  const currentAssignee = (match as { statisticianId?: string | null } | undefined)?.statisticianId ?? '';
  const selectedAssignee = assignee ?? currentAssignee;
  const assignmentChanged = selectedAssignee !== currentAssignee;

  // Live and completed belong to the scorer, so a game in either keeps its status: the select shows the
  // value and says why, rather than hiding where the game has got to.
  const statusLocked = !!match && !ADMIN_SETTABLE_STATUSES.includes(match.status);
  const selectedStatus: MatchStatus | '' = status ?? match?.status ?? '';
  const statusChanged = !!match && selectedStatus !== match.status;
  const statusOptions: MatchStatus[] = [
    ...new Set<MatchStatus>([...ADMIN_SETTABLE_STATUSES, ...(match ? [match.status] : [])]),
  ];

  const saveStatus = () => {
    if (!match || !statusChanged || selectedStatus === '') return;
    updateMatch.mutate(
      { id: match.id, data: { status: selectedStatus } },
      {
        onSuccess: () => {
          toast.success(`Status set to ${STATUS_LABELS[selectedStatus].toLowerCase()}.`);
          setStatus(null);
        },
        onError: (err) => toast.error(`Couldn’t change the status: ${err.message}`),
      },
    );
  };

  const setTab = (next: GameTab) => {
    const p = new URLSearchParams(params);
    if (next === 'overview') p.delete('tab');
    else p.set('tab', next);
    setParams(p, { replace: true });
  };

  const saveAssignee = () => {
    if (!match) return;
    updateMatch.mutate(
      { id: match.id, data: { statisticianId: selectedAssignee || null } },
      {
        onSuccess: () => {
          toast.success(selectedAssignee ? 'Statistician assigned.' : 'Statistician unassigned.');
          setAssignee(null);
        },
        onError: (err) => toast.error(`Couldn’t save the statistician: ${err.message}`),
      },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteMatch.mutate(target.id, {
      onSuccess: () => {
        toast.success(`${target.label} deleted.`);
        navigate(`/tournaments/${tournamentId}/fixtures`, { replace: true });
      },
      onError: (err) => {
        toast.error(`Couldn’t delete ${target.label}: ${err.message}`);
        setDeleteTarget(null);
      },
    });
  };

  if (matchQuery.isPending) {
    return (
      <div className="min-h-screen bg-white p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl space-y-6" aria-label="Loading match">
          <Skeleton className="h-10 w-72 rounded" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }
  if (matchQuery.isError || !match) {
    return (
      <div className="min-h-screen bg-white p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className={errorBanner}>{dataErrorMessage(matchQuery.error, 'match')}</div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void matchQuery.refetch()}
              className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Retry
            </button>
            <Link
              to={`/tournaments/${tournamentId}/fixtures`}
              className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Back to Fixtures
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const home = normalizeName(match.homeTeam?.name) || 'Home';
  const away = normalizeName(match.awayTeam?.name) || 'Away';
  const label = `${home} vs ${away}`;
  const started = match.status !== 'SCHEDULED';
  const statisticianName = match.statistician ? match.statistician.name || match.statistician.email || 'Assigned' : null;

  return (
    <div className="min-h-screen bg-white p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl">
        <Link
          to={`/tournaments/${tournamentId}/fixtures`}
          className="mb-3 flex w-fit cursor-pointer items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <FiChevronLeft aria-hidden className="size-4" />
          Fixtures
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">{home} vs {away}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{formatMatchDate(match.scheduledDate)}</p>
        </div>

        <GameView match={match} sessionId={sessionId} tab={tab} onTab={setTab} playerHref={playerHref}>
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2 dark:border-gray-800 dark:bg-gray-900">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Statistician</h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {statisticianName ? `Currently scoring: ${statisticianName}` : 'No statistician is assigned to this game yet.'}
                </p>
              </div>

              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (assignmentChanged) saveAssignee();
                }}
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <label htmlFor="assign-statistician" className={labelClass}>Assign to</label>
                  <select
                    id="assign-statistician"
                    value={selectedAssignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    disabled={statisticiansQuery.isPending || updateMatch.isPending}
                    className={selectClass}
                  >
                    <option value="">Unassigned</option>
                    {statisticians.map((st) => <option key={st.id} value={st.id}>{st.name || st.email}</option>)}
                  </select>
                </div>
                <button type="submit" className={btnPrimary} disabled={!assignmentChanged || updateMatch.isPending}>
                  {updateMatch.isPending ? 'Saving...' : 'Save statistician'}
                </button>
              </form>

              {statisticiansQuery.isError && (
                <p className="text-sm text-error-600 dark:text-error-500">
                  Couldn’t load statisticians: {(statisticiansQuery.error as Error).message}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Match code</p>
                  <code className="block truncate text-xs text-gray-600 dark:text-gray-400" data-testid="match-code">{matchCodeOf(match)}</code>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    The statistician types this on the match key screen to open the game.
                  </p>
                </div>
                <CopyMatchCodeButton code={matchCodeOf(match)} label={label} size="default" />
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">This game</h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Scores come from the scorer’s recorded plays. Edit the time or venue on the fixture.
                </p>
              </div>

              <form
                className="flex flex-col gap-2 border-b border-gray-100 pb-4 dark:border-gray-800"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveStatus();
                }}
              >
                <label htmlFor="match-status" className={labelClass}>Status</label>
                <select
                  id="match-status"
                  value={selectedStatus}
                  onChange={(e) => setStatus(e.target.value as MatchStatus)}
                  disabled={statusLocked || updateMatch.isPending}
                  className={selectClass}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s} disabled={!ADMIN_SETTABLE_STATUSES.includes(s) && s !== match.status}>
                      {STATUS_LABELS[s]}{!ADMIN_SETTABLE_STATUSES.includes(s) ? ' (set by the scorer)' : ''}
                    </option>
                  ))}
                </select>
                {statusLocked ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Live and completed games are set by the scorer, from the plays they record.
                  </p>
                ) : (
                  <button type="submit" className={btnPrimary} disabled={!statusChanged || updateMatch.isPending}>
                    {updateMatch.isPending ? 'Saving...' : 'Save status'}
                  </button>
                )}
              </form>

              <div className="flex flex-col gap-2">
                <button type="button" className={btnSecondary} onClick={() => navigate(`/tournaments/${tournamentId}/fixtures`)}>
                  Edit time and venue
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={!sessionId || rebuild.isPending}
                  onClick={() =>
                    sessionId &&
                    rebuild.mutate(sessionId, {
                      onSuccess: () => toast.success('Box score rebuilt from the recorded plays.'),
                      onError: (e) => toast.error(`Couldn’t rebuild: ${e.message}`),
                    })
                  }
                  title={!sessionId ? 'There’s no game data to rebuild yet' : 'Recalculate the box score and shot chart from every recorded play'}
                >
                  {rebuild.isPending ? 'Rebuilding...' : 'Rebuild box score'}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget({ id: match.id, label, hasGameData: started })}
                  className="cursor-pointer rounded-lg px-5 py-2.5 font-medium text-error-600 transition-colors hover:bg-error-50 dark:text-error-500 dark:hover:bg-error-500/10"
                >
                  Delete match
                </button>
              </div>
            </section>
          </div>

          <QuarterScoresCard
            match={match}
            home={home}
            away={away}
            isSaving={updateMatch.isPending}
            onSave={(data) =>
              updateMatch.mutate(
                { id: match.id, data },
                {
                  onSuccess: () => toast.success('Quarter scores saved.'),
                  onError: (err) => toast.error(`Couldn’t save the quarter scores: ${err.message}`),
                },
              )
            }
          />
        </GameView>
      </div>

      <DeleteFixtureDialog target={deleteTarget} isDeleting={deleteMatch.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
};

export default GameScorePage;

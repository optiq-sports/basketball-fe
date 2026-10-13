import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDeleteMatch, useMatch, useStatisticians, useUpdateMatch } from '../../api/hooks';
import { useRebuildProjection } from '../../services/statdash/hooks';
import { useToast } from '../../hooks/useToast';
import type { Match } from '../../types/api';
import { ErrorState, ListSkeleton } from '../../components/admin/page-states';
import { Button } from '../../components/ui/primitives/button';
import { Card, CardTitle, CardDescription } from '../../components/ui/primitives/card';
import { GameView, type GameTab } from '../../components/game/GameView';
import { CopyMatchCodeButton } from '../../components/matches/CopyMatchCodeButton';
import { matchCodeOf } from '../../lib/match-code';
import { QuarterScoresCard } from '../../components/fixtures/QuarterScoresCard';
import DeleteFixtureDialog, { type FixtureDeleteTarget } from '../../components/fixtures/DeleteFixtureDialog';
import { dataErrorMessage } from '../../lib/box-score';
import { normalizeName } from '../../lib/text';
import { useLivePoll } from '../../hooks/useLivePoll';

const TAB_IDS: GameTab[] = ['box', 'plays', 'shots', 'stats'];

type StatisticianOption = { id: string; name?: string | null; email: string };

/**
 * One match, for admins: the scoreboard by quarter, who is scoring it, its box score and shot chart, and
 * deleting it. Scores come from the scorer's events, so they aren't edited here. Status and time are edited
 * on the fixture.
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
  const [deleteTarget, setDeleteTarget] = useState<FixtureDeleteTarget | null>(null);
  const statisticians = (statisticiansQuery.data ?? []) as StatisticianOption[];
  const currentAssignee = (match as { statisticianId?: string | null } | undefined)?.statisticianId ?? '';
  const selectedAssignee = assignee ?? currentAssignee;
  const assignmentChanged = selectedAssignee !== currentAssignee;

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

  if (matchQuery.isPending) return <ListSkeleton columns={3} rows={4} label="Loading match" />;
  if (matchQuery.isError || !match) {
    return (
      <div className="flex flex-col gap-4">
        <Link to={`/tournaments/${tournamentId}/fixtures`} className="w-fit text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← Fixtures</Link>
        <ErrorState message={dataErrorMessage(matchQuery.error, 'match')} onRetry={() => void matchQuery.refetch()} />
      </div>
    );
  }

  const home = normalizeName(match.homeTeam?.name) || 'Home';
  const away = normalizeName(match.awayTeam?.name) || 'Away';
  const label = `${home} vs ${away}`;
  const started = match.status !== 'SCHEDULED';
  const statisticianName = match.statistician ? match.statistician.name || match.statistician.email || 'Assigned' : null;

  return (
    <div className="flex flex-col gap-6">
      <Link to={`/tournaments/${tournamentId}/fixtures`} className="w-fit text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← Fixtures</Link>

      <h1 className="sr-only">{label}</h1>

      <GameView match={match} sessionId={sessionId} tab={tab} onTab={setTab} playerHref={playerHref}>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle>Statistician</CardTitle>
            <CardDescription>{statisticianName ? `Currently scoring: ${statisticianName}` : 'No statistician is assigned to this game yet.'}</CardDescription>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (assignmentChanged) saveAssignee();
              }}
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label htmlFor="assign-statistician" className="text-sm font-medium text-gray-700 dark:text-gray-300">Assign to</label>
                <select
                  id="assign-statistician"
                  value={selectedAssignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  disabled={statisticiansQuery.isPending || updateMatch.isPending}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">Unassigned</option>
                  {statisticians.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
                </select>
              </div>
              <Button type="submit" disabled={!assignmentChanged || updateMatch.isPending}>
                {updateMatch.isPending ? 'Saving…' : 'Save statistician'}
              </Button>
            </form>
            {statisticiansQuery.isError && <p className="text-sm text-rose-600">Couldn’t load statisticians: {(statisticiansQuery.error as Error).message}</p>}

            <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Match code</p>
                <code className="block truncate text-xs text-gray-600 dark:text-gray-400" data-testid="match-code">{matchCodeOf(match)}</code>
                <p className="text-xs text-gray-500">The statistician types this on the match key screen to open the game.</p>
              </div>
              <CopyMatchCodeButton code={matchCodeOf(match)} label={label} size="default" />
            </div>
          </Card>

          <Card>
            <CardTitle>This game</CardTitle>
            <CardDescription>Scores come from the scorer’s recorded plays. Edit the time, venue or status on the fixture.</CardDescription>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={() => navigate(`/tournaments/${tournamentId}/fixtures`)}>Edit on fixtures</Button>
              <Button
                variant="secondary"
                disabled={!sessionId || rebuild.isPending}
                onClick={() => sessionId && rebuild.mutate(sessionId, { onSuccess: () => toast.success('Box score rebuilt from the recorded plays.'), onError: (e) => toast.error(`Couldn’t rebuild: ${e.message}`) })}
                title={!sessionId ? 'There’s no game data to rebuild yet' : 'Recalculate the box score and shot chart from every recorded play'}
              >
                {rebuild.isPending ? 'Rebuilding…' : 'Rebuild box score'}
              </Button>
              <Button variant="destructive-ghost" onClick={() => setDeleteTarget({ id: match.id, label, hasGameData: started })}>Delete match</Button>
            </div>
          </Card>
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

      <DeleteFixtureDialog target={deleteTarget} isDeleting={deleteMatch.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
};

export default GameScorePage;

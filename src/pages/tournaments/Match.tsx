import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDeleteMatch, useMatch, useStatisticians, useUpdateMatch } from '../../api/hooks';
import { useBoxScoreProjection, useRebuildProjection, useShotChartProjection } from '../../services/statdash/hooks';
import { useToast } from '../../hooks/useToast';
import type { Match } from '../../types/api';
import { ErrorState, EmptyState, ListSkeleton } from '../../components/admin/page-states';
import { Badge } from '../../components/ui/primitives/badge';
import { Button } from '../../components/ui/primitives/button';
import { Card, CardTitle, CardDescription } from '../../components/ui/primitives/card';
import { BoxScoreTable } from '../../components/client/BoxScoreTable';
import { CopyMatchCodeButton } from '../../components/matches/CopyMatchCodeButton';
import { matchCodeOf } from '../../lib/match-code';
import { ShotChartCourt } from '../../components/client/ShotChartCourt';
import DeleteFixtureDialog, { type FixtureDeleteTarget } from '../../components/fixtures/DeleteFixtureDialog';
import { dataErrorMessage, splitBoxScore } from '../../lib/box-score';
import { formatMatchDate, statusLabel } from '../../lib/match-format';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';

type Tab = 'box' | 'shots';
const STATUS_VARIANT: Record<string, 'live' | 'court' | 'neutral' | 'danger' | 'warning'> = {
  LIVE: 'live',
  SCHEDULED: 'court',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
  POSTPONED: 'warning',
};

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
  const tab: Tab = params.get('tab') === 'shots' ? 'shots' : 'box';

  const matchQuery = useMatch(matchId);
  const match = matchQuery.data as (Match & { statistician?: { name?: string | null; email?: string } | null }) | undefined;
  const sessionId = match?.gameSessions?.[0]?.id;
  const playerHref = (playerId: string) => `/tournaments/${tournamentId}/match/${matchId}/player/${playerId}`;

  const statisticiansQuery = useStatisticians();
  const updateMatch = useUpdateMatch();
  const deleteMatch = useDeleteMatch();
  const rebuild = useRebuildProjection();
  const boxQuery = useBoxScoreProjection(sessionId, tab === 'box' && !!sessionId);
  const shotQuery = useShotChartProjection(sessionId, tab === 'shots' && !!sessionId);

  const [assignee, setAssignee] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FixtureDeleteTarget | null>(null);
  const statisticians = (statisticiansQuery.data ?? []) as StatisticianOption[];
  const currentAssignee = (match as { statisticianId?: string | null } | undefined)?.statisticianId ?? '';
  const selectedAssignee = assignee ?? currentAssignee;
  const assignmentChanged = selectedAssignee !== currentAssignee;

  const split = useMemo(() => (match && boxQuery.data ? splitBoxScore(boxQuery.data, match) : null), [match, boxQuery.data]);

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    if (next === 'box') p.delete('tab');
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
  const quarters = [1, 2, 3, 4]
    .map((q) => ({ q, h: match[`quarter${q}Home`] as number | undefined, a: match[`quarter${q}Away`] as number | undefined }))
    .filter((x) => x.h !== undefined && x.a !== undefined);
  const statisticianName = match.statistician ? match.statistician.name || match.statistician.email || 'Assigned' : null;

  return (
    <div className="flex flex-col gap-6">
      <Link to={`/tournaments/${tournamentId}/fixtures`} className="w-fit text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← Fixtures</Link>

      <h1 className="sr-only">{label}</h1>

      <Card className="overflow-hidden p-0">
        <div className="bg-court-950 px-5 py-6 text-white md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-court-200">
            <span>{match.tournament?.name ?? 'Tournament'}</span>
            <Badge variant={STATUS_VARIANT[match.status] ?? 'neutral'} className={match.status === 'SCHEDULED' ? 'bg-white/10 text-white' : undefined}>{statusLabel(match.status)}</Badge>
          </div>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <p className="truncate text-base font-semibold md:text-xl">{home}</p>
            <p className="tabular-nums text-4xl font-bold md:text-5xl" aria-label={started ? `${home} ${match.homeScore ?? 0}, ${away} ${match.awayScore ?? 0}` : 'Not started'}>
              {started ? `${match.homeScore ?? 0} – ${match.awayScore ?? 0}` : 'vs'}
            </p>
            <p className="truncate text-right text-base font-semibold md:text-xl">{away}</p>
          </div>
          <p className="mt-5 text-sm text-court-200">
            {formatMatchDate(match.scheduledDate)}{match.venue ? ` · ${match.venue}` : ''}
          </p>
        </div>
        {quarters.length > 0 && (
          <div className="relative overflow-x-auto px-5 py-3 md:px-8">
            <table className="w-full text-sm tabular-nums">
              <caption className="sr-only">Scores by quarter</caption>
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th scope="col" className="py-1.5 text-left font-semibold">Team</th>
                  {quarters.map((x) => <th key={x.q} scope="col" className="py-1.5 text-right font-semibold">Q{x.q}</th>)}
                </tr>
              </thead>
              <tbody className="text-gray-800 dark:text-gray-200">
                <tr><th scope="row" className="py-1.5 text-left font-medium">{home}</th>{quarters.map((x) => <td key={x.q} className="py-1.5 text-right">{x.h}</td>)}</tr>
                <tr><th scope="row" className="py-1.5 text-left font-medium">{away}</th>{quarters.map((x) => <td key={x.q} className="py-1.5 text-right">{x.a}</td>)}</tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

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

      <div role="tablist" aria-label="Game data" className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {([{ id: 'box', label: 'Box score' }, { id: 'shots', label: 'Shot chart' }] as const).map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn('relative h-11 px-4 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50', tab === t.id ? 'text-court-900 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200')}
          >
            {t.label}
            {tab === t.id && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-signal-500" />}
          </button>
        ))}
      </div>

      {!sessionId ? (
        <EmptyState title="No game data yet" description={started ? 'The scorer hasn’t recorded this game yet.' : 'Game data appears once the match starts.'} />
      ) : tab === 'box' ? (
        boxQuery.isPending ? (
          <ListSkeleton columns={8} rows={5} label="Loading box score" />
        ) : boxQuery.isError ? (
          <ErrorState message={dataErrorMessage(boxQuery.error, 'box score')} onRetry={() => void boxQuery.refetch()} />
        ) : boxQuery.data && boxQuery.data.totalEvents === 0 ? (
          <EmptyState title="No plays recorded yet" description="The box score fills in as the game is scored." />
        ) : split ? (
          <div className="flex flex-col gap-6">
            <BoxScoreTable teamName={home} rows={split.home} caption="Box score" playerHref={playerHref} />
            <BoxScoreTable teamName={away} rows={split.away} caption="Box score" playerHref={playerHref} />
            {split.unassigned > 0 && (
              <p className="text-xs text-gray-500">{split.unassigned} {split.unassigned === 1 ? 'player isn’t' : 'players aren’t'} on either team roster and {split.unassigned === 1 ? 'is' : 'are'} left out.</p>
            )}
          </div>
        ) : null
      ) : shotQuery.isPending ? (
        <ListSkeleton columns={2} rows={3} label="Loading shot chart" />
      ) : shotQuery.isError ? (
        <ErrorState message={dataErrorMessage(shotQuery.error, 'shot chart')} onRetry={() => void shotQuery.refetch()} />
      ) : (
        <ShotChartCourt shots={shotQuery.data ?? []} homeTeamId={match.homeTeamId} homeLabel={home} awayLabel={away} />
      )}

      <DeleteFixtureDialog target={deleteTarget} isDeleting={deleteMatch.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
    </div>
  );
};

export default GameScorePage;

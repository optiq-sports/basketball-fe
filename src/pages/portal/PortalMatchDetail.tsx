import React, { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMatch } from '../../api/hooks';
import { useBoxScoreProjection, useShotChartProjection } from '../../services/statdash/hooks';
import { ErrorState, EmptyState, ListSkeleton } from '../../components/admin/page-states';
import { Badge } from '../../components/ui/primitives/badge';
import { Card } from '../../components/ui/primitives/card';
import { BoxScoreTable } from '../../components/client/BoxScoreTable';
import { ShotChartCourt } from '../../components/client/ShotChartCourt';
import { cn } from '../../lib/utils';
import { formatMatchDate, statusLabel } from './portal-format';
import { dataErrorMessage, splitBoxScore } from '../../lib/box-score';
import { normalizeName } from '../../lib/text';

type Tab = 'box' | 'shots';

const PortalMatchDetail: React.FC = () => {
  const { matchId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'shots' ? 'shots' : 'box';

  const matchQuery = useMatch(matchId);
  const match = matchQuery.data;
  const sessionId = match?.gameSessions?.[0]?.id;

  const boxQuery = useBoxScoreProjection(sessionId, tab === 'box' && !!sessionId);
  const shotQuery = useShotChartProjection(sessionId, tab === 'shots' && !!sessionId);

  const split = useMemo(() => (match && boxQuery.data ? splitBoxScore(boxQuery.data, match) : null), [match, boxQuery.data]);

  const setTab = (next: Tab) => {
    const p = new URLSearchParams(params);
    if (next === 'box') p.delete('tab');
    else p.set('tab', next);
    setParams(p, { replace: true });
  };

  if (matchQuery.isPending) {
    return <ListSkeleton columns={3} rows={3} label="Loading match" />;
  }
  if (matchQuery.isError || !match) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/portal/matches" className="text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← Matches</Link>
        <ErrorState message={dataErrorMessage(matchQuery.error, 'match')} onRetry={() => void matchQuery.refetch()} />
      </div>
    );
  }

  const home = normalizeName(match.homeTeam?.name) || 'Home';
  const away = normalizeName(match.awayTeam?.name) || 'Away';
  const started = match.status !== 'SCHEDULED';
  const quarters = [1, 2, 3, 4]
    .map((q) => ({ q, h: match[`quarter${q}Home`] as number | undefined, a: match[`quarter${q}Away`] as number | undefined }))
    .filter((x) => x.h !== undefined && x.a !== undefined);

  return (
    <div className="flex flex-col gap-6">
      <Link to="/portal/matches" className="w-fit text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← Matches</Link>

      <Card className="overflow-hidden p-0">
        <div className="bg-court-950 px-5 py-6 text-white md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-court-200">
            <span>{match.tournament?.name ?? 'Tournament'}</span>
            <Badge variant={match.status === 'LIVE' ? 'live' : 'neutral'} className={match.status === 'LIVE' ? '' : 'bg-white/10 text-white'}>
              {statusLabel(match.status)}
            </Badge>
          </div>
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold md:text-xl">{home}</p>
            </div>
            <p className="tabular-nums text-4xl font-bold md:text-5xl" aria-label={started ? `${home} ${match.homeScore ?? 0}, ${away} ${match.awayScore ?? 0}` : 'Not started'}>
              {started ? `${match.homeScore ?? 0} – ${match.awayScore ?? 0}` : 'vs'}
            </p>
            <div className="min-w-0 text-right">
              <p className="truncate text-base font-semibold md:text-xl">{away}</p>
            </div>
          </div>
          <p className="mt-5 text-sm text-court-200">
            {formatMatchDate(match.scheduledDate)}
            {match.venue ? ` · ${match.venue}` : ''}
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

      <div role="tablist" aria-label="Game data" className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(
          [
            { id: 'box', label: 'Box score' },
            { id: 'shots', label: 'Shot chart' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'relative h-11 px-4 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50',
              tab === t.id ? 'text-court-900 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
            )}
          >
            {t.label}
            {tab === t.id && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-signal-500" />}
          </button>
        ))}
      </div>

      {!sessionId ? (
        <EmptyState
          title="No game data yet"
          description={started ? 'The scorer hasn’t recorded this game yet.' : 'Game data appears once the match starts.'}
        />
      ) : tab === 'box' ? (
        boxQuery.isPending ? (
          <ListSkeleton columns={8} rows={5} label="Loading box score" />
        ) : boxQuery.isError ? (
          <ErrorState message={dataErrorMessage(boxQuery.error, 'box score')} onRetry={() => void boxQuery.refetch()} />
        ) : split && boxQuery.data && boxQuery.data.totalEvents === 0 ? (
          <EmptyState title="No plays recorded yet" description="The box score fills in as the game is scored." />
        ) : split ? (
          <div className="flex flex-col gap-6">
            <BoxScoreTable teamName={home} rows={split.home} caption="Box score" />
            <BoxScoreTable teamName={away} rows={split.away} caption="Box score" />
            {split.unassigned > 0 && (
              <p className="text-xs text-gray-500">
                {split.unassigned} {split.unassigned === 1 ? 'player isn’t' : 'players aren’t'} on either team roster, and {split.unassigned === 1 ? 'is' : 'are'} left out.
              </p>
            )}
          </div>
        ) : null
      ) : shotQuery.isPending ? (
        <ListSkeleton columns={2} rows={3} label="Loading shot chart" />
      ) : shotQuery.isError ? (
        <ErrorState message={dataErrorMessage(shotQuery.error, 'shot chart')} onRetry={() => void shotQuery.refetch()} />
      ) : (
        <ShotChartCourt
          shots={shotQuery.data ?? []}
          homeTeamId={match.homeTeamId}
          homeLabel={home}
          awayLabel={away}
        />
      )}
    </div>
  );
};

export default PortalMatchDetail;

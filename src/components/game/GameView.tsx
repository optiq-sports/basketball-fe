import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { timelineUnavailable, useBoxScoreProjection, useShotChartProjection, useSummaryProjection, useTimelineProjection } from '../../services/statdash/hooks';
import { useLivePoll } from '../../hooks/useLivePoll';
import type { Match } from '../../types/api';
import { EmptyState, ErrorState, ListSkeleton } from '../admin/page-states';
import { Badge } from '../ui/primitives/badge';
import { Card, CardTitle } from '../ui/primitives/card';
import { BoxScoreTable } from '../client/BoxScoreTable';
import { ShotChartCourt } from '../client/ShotChartCourt';
import { TeamCrest, isLight, safeColor } from '../teams/TeamCrest';
import { ComparisonBars, type ComparisonRow, type TeamSide } from './ComparisonBars';
import { GameLeaders } from './GameLeaders';
import { LeadTracker } from './LeadTracker';
import { PlayByPlay } from './PlayByPlay';
import { dataErrorMessage, rosterOf, splitBoxScore } from '../../lib/box-score';
import { pct, teamShooting, teamTotals } from '../../lib/game-stats';
import { leadSummary, periodLabel, periodScores } from '../../lib/timeline-stats';
import { formatMatchDate, statusLabel } from '../../lib/match-format';
import { normalizeName } from '../../lib/text';
import { cn } from '../../lib/utils';

export type GameTab = 'overview' | 'box' | 'plays' | 'shots' | 'stats';
const TABS: Array<{ id: GameTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'box', label: 'Box score' },
  { id: 'plays', label: 'Play by play' },
  { id: 'shots', label: 'Shot chart' },
  { id: 'stats', label: 'Game stats' },
];

const FALLBACKS = ['#ff6b2c', '#2f5fb3', '#1f9d6b', '#7a4fd1'];

const hueOf = (hex: string): number => {
  let h = hex.slice(1);
  if (h.length < 6) h = [...h].map((x) => x + x).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (hue * 60 + 360) % 360;
};
const hueGap = (a: string, b: string) => {
  const d = Math.abs(hueOf(a) - hueOf(b));
  return Math.min(d, 360 - d);
};

/** A team colour usable on bars and cards: its own, unless it is missing or so pale (white, cream) that it would vanish. */
const usable = (c?: string | null) => {
  const color = safeColor(c);
  return color && !isLight(color) ? color : undefined;
};

/**
 * Each team's own colour, with a fallback for one that has none (or a white one). A fallback is chosen to
 * sit well away in hue from the other side, and if both teams share a colour the away side changes, so the
 * two stay tellable apart.
 */
export function sideColors(match: Match): { home: string; away: string } {
  const ownHome = usable(match.homeTeam?.color);
  const ownAway = usable(match.awayTeam?.color);
  const apart = (other: string) => FALLBACKS.find((f) => hueGap(f, other) >= 60) ?? FALLBACKS[1];
  const home = ownHome ?? (ownAway ? apart(ownAway) : FALLBACKS[0]);
  let away = ownAway ?? apart(home);
  if (ownAway && ownHome && away.toLowerCase() === home.toLowerCase()) away = apart(home);
  return { home, away };
}

const STATUS_VARIANT: Record<string, 'live' | 'court' | 'neutral' | 'danger' | 'warning'> = {
  LIVE: 'live', SCHEDULED: 'court', COMPLETED: 'neutral', CANCELLED: 'danger', POSTPONED: 'warning',
};

const pctText = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/**
 * Everything about one game that both the admin and the client portal show: scoreboard, tabs
 * (Overview, Box score, Shot chart, Game stats) and the data behind them. The pages around it add only
 * what is theirs, such as the admin's statistician and delete controls, passed as `children`.
 */
export function GameView({ match, sessionId, tab, onTab, playerHref, children }: {
  match: Match;
  sessionId?: string;
  tab: GameTab;
  onTab: (t: GameTab) => void;
  playerHref?: (playerId: string) => string;
  children?: React.ReactNode;
}) {
  const hasData = !!sessionId;
  const boxQuery = useBoxScoreProjection(sessionId, hasData);
  const shotQuery = useShotChartProjection(sessionId, hasData);
  const summaryQuery = useSummaryProjection(sessionId, hasData);
  const timelineQuery = useTimelineProjection(sessionId, hasData);

  // The scorer's live stream only reaches the scorer's own screen, so anything else polls while the game is on (Fix 125).
  const isLive = match.status === 'LIVE';
  useLivePoll(isLive && hasData, () => void boxQuery.refetch(), 8_000);
  useLivePoll(isLive && hasData, () => void shotQuery.refetch(), 8_000);
  useLivePoll(isLive && hasData, () => void summaryQuery.refetch(), 8_000);
  useLivePoll(isLive && hasData && !timelineQuery.isError, () => void timelineQuery.refetch(), 8_000);

  const split = useMemo(() => (boxQuery.data ? splitBoxScore(boxQuery.data, match) : null), [match, boxQuery.data]);
  const shots = useMemo(() => shotQuery.data ?? [], [shotQuery.data]);
  const playerNames = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [id, who] of rosterOf(match)) out[id] = who.name;
    return out;
  }, [match]);

  const roster = useMemo(() => rosterOf(match), [match]);
  const events = useMemo(() => timelineQuery.data ?? [], [timelineQuery.data]);
  const noTimeline = timelineQuery.isError && timelineUnavailable(timelineQuery.error);
  const quarterSeconds = ((match.tournament as { quarterDuration?: number } | undefined)?.quarterDuration ?? 10) * 60;
  const overtimeSeconds = ((match.tournament as { overtimeDuration?: number | null } | undefined)?.overtimeDuration ?? 5) * 60;
  const lead = useMemo(() => leadSummary(events, quarterSeconds, overtimeSeconds), [events, quarterSeconds, overtimeSeconds]);

  const colors = sideColors(match);
  const home = normalizeName(match.homeTeam?.name) || 'Home';
  const away = normalizeName(match.awayTeam?.name) || 'Away';
  const homeSide: TeamSide = { name: home, color: colors.home };
  const awaySide: TeamSide = { name: away, color: colors.away };
  const started = match.status !== 'SCHEDULED';
  const final = match.status === 'COMPLETED';
  // The scorer's events update the game session's score, but nothing copies it onto the match record when the
  // game ends (Gap 55), so a finished game can read 0 – 0 there. The session's own score is the real one.
  const sessionScore = summaryQuery.data?.score;
  const homeScore = sessionScore?.home ?? match.homeScore ?? 0;
  const awayScore = sessionScore?.away ?? match.awayScore ?? 0;
  const homeWon = final && homeScore > awayScore;
  const awayWon = final && awayScore > homeScore;
  const recordedQuarters = [1, 2, 3, 4]
    .map((q) => ({ q, h: match[`quarter${q}Home`] as number | undefined, a: match[`quarter${q}Away`] as number | undefined }))
    .filter((x) => typeof x.h === 'number' && typeof x.a === 'number');
  // The match record's quarter scores are often empty (Gap 47); the plays, when the backend sends them, say the same thing.
  const quarters = recordedQuarters.length > 0 ? recordedQuarters : periodScores(events).map((x) => ({ q: x.period, h: x.home, a: x.away }));

  const totals = split ? { home: teamTotals(split.home), away: teamTotals(split.away) } : null;
  const hs = teamShooting(shots, match.homeTeamId);
  const as = teamShooting(shots, match.awayTeamId);

  const keyRows: ComparisonRow[] = totals
    ? [
        { label: 'PTS', title: 'Points', home: totals.home.points, away: totals.away.points },
        { label: 'REB', title: 'Rebounds', home: totals.home.rebounds, away: totals.away.rebounds },
        { label: 'AST', title: 'Assists', home: totals.home.assists, away: totals.away.assists },
        { label: 'STL', title: 'Steals', home: totals.home.steals, away: totals.away.steals },
        { label: 'BLK', title: 'Blocks', home: totals.home.blocks, away: totals.away.blocks },
        { label: 'TO', title: 'Turnovers', home: totals.home.turnovers, away: totals.away.turnovers, lowerIsBetter: true },
        { label: 'PF', title: 'Personal fouls', home: totals.home.fouls, away: totals.away.fouls, lowerIsBetter: true },
      ]
    : [];
  const adv = summaryQuery.data?.advanced;
  const advHome = adv?.[match.homeTeamId];
  const advAway = adv?.[match.awayTeamId];
  const advancedRows: ComparisonRow[] = ([
    ['pointsInPaint', 'Points in the paint'],
    ['fastBreakPoints', 'Fast break points'],
    ['pointsOffTurnovers', 'Points off turnovers'],
    ['secondChancePoints', 'Second chance points'],
    ['benchPoints', 'Points from the bench'],
  ] as const).flatMap(([k, label]) => (advHome?.[k] == null && advAway?.[k] == null ? [] : [{ label: label.replace('Points ', 'Pts ').replace('Second chance points', '2nd chance').replace('Fast break points', 'Fast break'), title: label, home: advHome?.[k] ?? null, away: advAway?.[k] ?? null }]));

  const shootingRows: ComparisonRow[] = [
    { label: 'FG', title: 'Field goal percentage', home: pct(hs.fgm, hs.fga), away: pct(as.fgm, as.fga), format: pctText, scale: 100 },
    { label: '2PT', title: 'Two-point percentage', home: pct(hs.twoM, hs.twoA), away: pct(as.twoM, as.twoA), format: pctText, scale: 100 },
    { label: '3PT', title: 'Three-point percentage', home: pct(hs.threeM, hs.threeA), away: pct(as.threeM, as.threeA), format: pctText, scale: 100 },
  ];

  const dataState = (() => {
    if (!hasData) return <EmptyState title="No game data yet" description={started ? 'The scorer hasn’t recorded this game yet.' : 'Game data appears once the match starts.'} />;
    if (boxQuery.isPending) return <ListSkeleton columns={8} rows={5} label="Loading game data" />;
    if (boxQuery.isError) return <ErrorState message={dataErrorMessage(boxQuery.error, 'box score')} onRetry={() => void boxQuery.refetch()} />;
    if (boxQuery.data && boxQuery.data.totalEvents === 0) return <EmptyState title="No plays recorded yet" description="This fills in as the game is scored." />;
    return null;
  })();

  const info: Array<[string, string]> = [
    ['Tournament', match.tournament?.name ?? '—'],
    ['Date and time', formatMatchDate(match.scheduledDate)],
    ['Venue', match.venue || '—'],
    ['Status', statusLabel(match.status)],
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0">
        <div className="relative bg-court-950 px-5 py-6 text-white md:px-8">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30" style={{ background: `linear-gradient(90deg, ${colors.home} 0%, transparent 45%, transparent 55%, ${colors.away} 100%)` }} />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-court-200">
              <span>{match.tournament?.name ?? 'Tournament'}</span>
              <span className="flex items-center gap-2">
                {isLive && <span role="status" className="text-xs">Updating live</span>}
                <Badge variant={STATUS_VARIANT[match.status] ?? 'neutral'} className={match.status === 'SCHEDULED' ? 'bg-white/10 text-white' : undefined}>{statusLabel(match.status)}</Badge>
              </span>
            </div>
            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
              <div className="flex min-w-0 flex-col items-start gap-2 md:flex-row md:items-center md:gap-3">
                <TeamCrest name={home} code={match.homeTeam?.code} logo={match.homeTeam?.logo} color={match.homeTeam?.color} size="lg" />
                <p className={cn('truncate text-base md:text-xl', homeWon ? 'font-bold' : 'font-semibold')}>{home}</p>
              </div>
              <p className="tabular-nums text-4xl font-bold md:text-5xl" aria-label={started ? `${home} ${homeScore}, ${away} ${awayScore}` : 'Not started'}>
                {started ? `${homeScore} – ${awayScore}` : 'vs'}
              </p>
              <div className="flex min-w-0 flex-col items-end gap-2 md:flex-row-reverse md:items-center md:gap-3">
                <TeamCrest name={away} code={match.awayTeam?.code} logo={match.awayTeam?.logo} color={match.awayTeam?.color} size="lg" />
                <p className={cn('truncate text-right text-base md:text-xl', awayWon ? 'font-bold' : 'font-semibold')}>{away}</p>
              </div>
            </div>
            <p className="mt-5 text-sm text-court-200">{formatMatchDate(match.scheduledDate)}{match.venue ? ` · ${match.venue}` : ''}</p>
          </div>
        </div>
        {quarters.length > 0 && (
          <div className="relative overflow-x-auto px-5 py-3 md:px-8">
            <table className="w-full text-sm tabular-nums">
              <caption className="sr-only">Scores by quarter</caption>
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th scope="col" className="py-1.5 text-left font-semibold">Team</th>
                  {quarters.map((x) => <th key={x.q} scope="col" className="py-1.5 text-right font-semibold">{periodLabel(x.q)}</th>)}
                  <th scope="col" className="py-1.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="text-gray-800 dark:text-gray-200">
                <tr><th scope="row" className="py-1.5 text-left font-medium">{home}</th>{quarters.map((x) => <td key={x.q} className="py-1.5 text-right">{x.h}</td>)}<td className="py-1.5 text-right font-bold">{homeScore}</td></tr>
                <tr><th scope="row" className="py-1.5 text-left font-medium">{away}</th>{quarters.map((x) => <td key={x.q} className="py-1.5 text-right">{x.a}</td>)}<td className="py-1.5 text-right font-bold">{awayScore}</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {children}

      <div role="tablist" aria-label="Game data" className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => onTab(t.id)}
            className={cn('relative h-11 shrink-0 px-4 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50', tab === t.id ? 'text-court-900 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200')}
          >
            {t.label}
            {tab === t.id && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-signal-500" />}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="flex flex-col gap-6">
          {dataState ?? (split && (
            <>
              <Card>
                <CardTitle>Game leaders</CardTitle>
                <GameLeaders home={homeSide} away={awaySide} homeRows={split.home} awayRows={split.away} playerHref={playerHref} />
              </Card>
              <Card>
                <CardTitle>Key stats</CardTitle>
                <ComparisonBars rows={keyRows} home={homeSide} away={awaySide} />
              </Card>
            </>
          ))}
          <Card>
            <CardTitle>Game information</CardTitle>
            <dl className="grid gap-4 sm:grid-cols-2">
              {info.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{k}</dt>
                  <dd className="truncate text-sm font-medium text-gray-900 dark:text-white">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      )}

      {tab === 'box' && (dataState ?? (split && (
        <div className="flex flex-col gap-6">
          <BoxScoreTable teamName={home} rows={split.home} caption="Box score" playerHref={playerHref} />
          <BoxScoreTable teamName={away} rows={split.away} caption="Box score" playerHref={playerHref} />
          {split.unassigned > 0 && (
            <p className="text-xs text-gray-500">{split.unassigned} {split.unassigned === 1 ? 'player isn’t' : 'players aren’t'} on either team roster and {split.unassigned === 1 ? 'is' : 'are'} left out.</p>
          )}
        </div>
      )))}

      {tab === 'plays' && (!hasData ? dataState : timelineQuery.isPending ? (
        <ListSkeleton columns={3} rows={6} label="Loading plays" />
      ) : noTimeline ? (
        <EmptyState title="Play by play isn’t available yet" description="Every play is recorded, but the server can’t send them back yet. This tab fills in once it can." />
      ) : timelineQuery.isError ? (
        <ErrorState message={dataErrorMessage(timelineQuery.error, 'plays')} onRetry={() => void timelineQuery.refetch()} />
      ) : (
        <PlayByPlay events={events} roster={roster} homeTeamId={match.homeTeamId} awayTeamId={match.awayTeamId} home={homeSide} away={awaySide} />
      ))}

      {tab === 'shots' && (!hasData ? dataState : shotQuery.isPending ? (
        <ListSkeleton columns={2} rows={3} label="Loading shot chart" />
      ) : shotQuery.isError ? (
        <ErrorState message={dataErrorMessage(shotQuery.error, 'shot chart')} onRetry={() => void shotQuery.refetch()} />
      ) : (
        <ShotChartCourt shots={shots} homeTeamId={match.homeTeamId} homeLabel={home} awayLabel={away} homeColor={colors.home} awayColor={colors.away} playerNames={playerNames} />
      ))}

      {tab === 'stats' && (dataState ?? (split && (
        <div className="flex flex-col gap-6">
          <Card>
            <CardTitle>Shooting</CardTitle>
            {shotQuery.isError ? (
              <ErrorState message={dataErrorMessage(shotQuery.error, 'shot chart')} onRetry={() => void shotQuery.refetch()} />
            ) : (
              <>
                <ComparisonBars rows={shootingRows} home={homeSide} away={awaySide} />
                <div className="relative mt-4 overflow-x-auto">
                  <table className="w-full text-sm tabular-nums">
                    <caption className="sr-only">Shots made and attempted</caption>
                    <thead className="text-xs uppercase text-gray-500">
                      <tr><th scope="col" className="py-1.5 text-left font-semibold">Team</th><th scope="col" className="py-1.5 text-right font-semibold">FG</th><th scope="col" className="py-1.5 text-right font-semibold">2PT</th><th scope="col" className="py-1.5 text-right font-semibold">3PT</th></tr>
                    </thead>
                    <tbody className="text-gray-800 dark:text-gray-200">
                      {([[home, hs], [away, as]] as const).map(([name, s]) => (
                        <tr key={name}>
                          <th scope="row" className="py-1.5 text-left font-medium">{name}</th>
                          <td className="py-1.5 text-right">{s.fgm}/{s.fga}</td>
                          <td className="py-1.5 text-right">{s.twoM}/{s.twoA}</td>
                          <td className="py-1.5 text-right">{s.threeM}/{s.threeA}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
          <Card>
            <CardTitle>Key stats</CardTitle>
            <ComparisonBars rows={keyRows} home={homeSide} away={awaySide} />
          </Card>
          <Card>
            <CardTitle>Lead tracker</CardTitle>
            {timelineQuery.isPending ? (
              <ListSkeleton columns={2} rows={3} label="Loading lead tracker" />
            ) : noTimeline ? (
              <p className="text-sm text-gray-500">The lead tracker is built from every play, which the server can’t send back yet.</p>
            ) : timelineQuery.isError ? (
              <ErrorState message={dataErrorMessage(timelineQuery.error, 'plays')} onRetry={() => void timelineQuery.refetch()} />
            ) : (
              <LeadTracker summary={lead} home={homeSide} away={awaySide} />
            )}
          </Card>
          <Card>
            <CardTitle>Advanced stats</CardTitle>
            {advancedRows.length > 0 ? (
              <ComparisonBars rows={advancedRows} home={homeSide} away={awaySide} />
            ) : (
              <p className="text-sm text-gray-500">Points in the paint, fast break, off turnovers, second chance and bench points aren’t sent by the server yet.</p>
            )}
          </Card>
        </div>
      )))}
    </div>
  );
}

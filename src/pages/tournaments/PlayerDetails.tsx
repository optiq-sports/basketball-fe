import React from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { useMatch } from '../../api/hooks';
import { usePlayerGameProjection } from '../../services/statdash';
import { pickGameSessionId, pickPlayerStats } from './playerMatchStats';
import { ErrorState } from '../../components/admin/page-states';
import Skeleton from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/primitives/badge';
import { PlayerAvatar } from '../../components/players/PlayerAvatar';
import { positionLabel } from '../../components/players/player-form';
import { normalizeName } from '../../lib/text';

function formatDob(dob?: string | null): string {
  if (!dob) return '—';
  try {
    return new Date(dob).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dob;
  }
}

const formatPosition = (pos?: string | null): string => positionLabel(pos) || '—';

const DASH = '—';

export default function PlayerDetails() {
  const { id, matchId, playerId } = useParams<{ id: string; matchId: string; playerId: string }>();
  const location = useLocation();
  const matchQuery = useMatch(matchId);

  // Live stats come from the game's projection, which is keyed by session id, not match id.
  // Only polls while the match is actually live; otherwise it's a single fetch (used as a
  // fallback when nothing was saved for a finished game).
  const gameSessionId = pickGameSessionId(matchQuery.data?.gameSessions);
  const isLive = matchQuery.data?.status === 'LIVE';
  const projectionQuery = usePlayerGameProjection(gameSessionId, playerId, { live: isLive });

  // Where the back link goes depends on where the visitor came from.
  const backTournamentId = location.state?.tournamentId ?? id;
  const back =
    location.state?.from === 'tournament-leaders'
      ? { to: `/tournaments/${backTournamentId}`, label: 'Tournament' }
      : location.state?.from === 'players-page'
        ? { to: '/players-management', label: 'Players' }
        : { to: `/tournaments/${id}/match/${matchId}`, label: 'Match' };

  const BackLink = () => (
    <Link to={back.to} className="w-fit text-sm font-semibold text-court-700 hover:underline dark:text-court-300">← {back.label}</Link>
  );

  if (matchQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <div className="flex flex-col gap-4" aria-label="Loading player stats">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (matchQuery.isError || !matchQuery.data) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <ErrorState message="Failed to load match data." onRetry={() => void matchQuery.refetch()} />
      </div>
    );
  }

  const match = matchQuery.data;
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;
  const stats = match.stats ?? [];

  // Find this player's stat record for the match
  const playerStat = stats.find(s => s.playerId === playerId) ?? null;

  // Find player info from team rosters (homeTeam.playerTeams or awayTeam.playerTeams)
  const homePlayers = homeTeam?.playerTeams ?? [];
  const awayPlayers = awayTeam?.playerTeams ?? [];
  const homeEntry = homePlayers.find(pt => pt.player?.id === playerId || pt.playerId === playerId);
  const awayEntry = awayPlayers.find(pt => pt.player?.id === playerId || pt.playerId === playerId);
  const rosterEntry = homeEntry ?? awayEntry;
  const playerInfo = rosterEntry?.player ?? playerStat?.player ?? null;

  const fullName = playerInfo ? `${normalizeName(playerInfo.firstName)} ${normalizeName(playerInfo.lastName)}` : DASH;
  const jerseyNumber = rosterEntry?.jerseyNumber ?? DASH;
  const position = formatPosition(playerInfo?.position);
  const dob = formatDob(playerInfo?.dateOfBirth);
  const height = playerInfo?.height ?? DASH;
  const playerTeamName = normalizeName(homeEntry ? (homeTeam?.name ?? DASH) : (awayTeam?.name ?? DASH));
  const opponentName = normalizeName(homeEntry ? (awayTeam?.name ?? DASH) : (homeTeam?.name ?? DASH));
  const tournamentName = normalizeName(match.tournament?.name) || DASH;

  // Live projection while the game is on; the saved MatchStat record once it's over.
  const picked = pickPlayerStats({
    isLive,
    saved: playerStat
      ? {
          points: playerStat.points ?? 0,
          rebounds: playerStat.rebounds ?? 0,
          assists: playerStat.assists ?? 0,
          blocks: playerStat.blocks ?? 0,
          steals: playerStat.steals ?? 0,
          fouls: playerStat.fouls ?? 0,
          turnovers: playerStat.turnovers ?? 0,
        }
      : null,
    projection: projectionQuery.data,
  });
  const hasStats = picked !== null;
  // Live but the projection can't be reached (or hasn't loaded): whatever is shown is the last
  // saved record, which lags the game. Say so instead of presenting it as current.
  const liveUnavailable = isLive && picked?.source !== 'live';
  const lastUpdated = projectionQuery.dataUpdatedAt
    ? new Date(projectionQuery.dataUpdatedAt).toLocaleTimeString()
    : null;

  // Only what the backend records per player per game. Shooting splits, the rebound split, +/- and EFF
  // aren't in the saved record, so they are not shown as columns of dashes; the box score shows them
  // when they are recorded (Gap 28).
  const summaryCards = [
    { label: 'PTS', value: picked?.stats.points ?? DASH },
    { label: 'REB', value: picked?.stats.rebounds ?? DASH },
    { label: 'AST', value: picked?.stats.assists ?? DASH },
    { label: 'STL', value: picked?.stats.steals ?? DASH },
    { label: 'BLK', value: picked?.stats.blocks ?? DASH },
    { label: 'PF', value: picked?.stats.fouls ?? DASH },
    { label: 'TO', value: picked?.stats.turnovers ?? DASH },
  ];

  const details: Array<[string, string]> = [
    ['Team', playerTeamName],
    ['Position', position],
    ['Height', height],
    ['Date of birth', dob],
  ];

  return (
    <div className="flex flex-col gap-4">
      <BackLink />

      <section className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <PlayerAvatar
            firstName={playerInfo?.firstName ?? ''}
            lastName={playerInfo?.lastName ?? ''}
            photo={(playerInfo as { photo?: string } | null)?.photo}
            size="lg"
            className="size-20 text-2xl"
          />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              {tournamentName}
              <span className="ml-2 font-bold tabular-nums text-signal-600 dark:text-signal-400">#{jerseyNumber}</span>
            </p>
            <h1 className="truncate text-2xl font-bold text-court-900 dark:text-white">{fullName}</h1>
            <p className="text-sm text-gray-500">{playerTeamName} vs {opponentName}</p>
          </div>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {details.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
              <dd className="truncate font-medium text-gray-900 dark:text-gray-100">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="game-stats" className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <h2 id="game-stats" className="text-lg font-bold text-gray-900 dark:text-white">This game</h2>
        {isLive && (
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${liveUnavailable ? 'text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}`} role="status">
            <Badge variant={liveUnavailable ? 'warning' : 'live'}>
              <span aria-hidden className={`size-1.5 rounded-full ${liveUnavailable ? 'bg-amber-500' : 'animate-pulse bg-signal-500'}`} />
              Live
            </Badge>
            {liveUnavailable ? (
              <span>Live updates unavailable. Showing the last saved stats, which may be behind the game.</span>
            ) : (
              <span>
                Updating every 5 seconds
                {lastUpdated ? ` · last updated ${lastUpdated}` : ''}
              </span>
            )}
          </div>
        )}
        {!isLive && picked?.source === 'projection' && (
          <p className="text-xs text-gray-500">Final stats haven&rsquo;t been saved for this game yet. Showing the game&rsquo;s recorded events.</p>
        )}
        {!hasStats && <p className="text-sm text-gray-500">No recorded stats for this player in this match yet.</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-7">
          {summaryCards.map((stat) => (
            <div key={stat.label} className="rounded-xl bg-court-800 p-4 text-center text-white">
              <div className="mb-1 text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-court-200">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

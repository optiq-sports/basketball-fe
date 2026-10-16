import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMatch } from '../../api/hooks';
import { usePlayerGameProjection } from '../../services/statdash';
import { pickGameSessionId, pickPlayerStats } from './playerMatchStats';
import Skeleton from '../../components/ui/Skeleton';
import { btnPrimary, errorBanner } from '../../components/ui/formStyles';
import { PlayerAvatar } from '../../components/players/PlayerAvatar';
import { positionLabel } from '../../components/players/player-form';
import { normalizeName } from '../../lib/text';
import type { MatchStatRecord } from '../../types/api';

function formatDob(dob?: string | null): string {
  if (!dob) return '—';
  const d = new Date(dob);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

const formatPosition = (pos?: string | null): string => positionLabel(pos) || '—';

const DASH = '—';

/** "7/15" when both are recorded, else a dash — a made count with no attempts isn't a split. */
const split = (made?: number, attempted?: number): string =>
  made == null || attempted == null ? DASH : `${made}/${attempted}`;

const num = (v?: number | null): string => (v == null ? DASH : String(v));

const TABLE_HEADS = ['Game(s)', 'PTS', 'FG', '2PT FG', '3PT FG', 'FT', 'REB', 'OREB', 'DREB', 'AST', 'STL', 'BLK', 'PF', 'TO', '+/-', 'EFF'] as const;

/**
 * One player's game, back to the pre-redesign layout: the `#FCFEFF` page under the tournament name and
 * the fixture, the `/player-bg.png` hero with the jersey number over the name, the `#EEF3FF` detail
 * band, the `#21409A` stat tiles, the per-game stat table, and a Back button whose destination depends
 * on where the visitor came from.
 *
 * **Everything the redesign added is kept, because it is what makes the numbers right:**
 *
 * - While a game is live the figures come from the game's **projection**, polled every five seconds —
 *   the saved `MatchStat` record is only synced afterwards, so during play it is stale or absent.
 * - When the projection can't be reached mid-game, the page says the numbers may be behind rather than
 *   presenting the last saved record as current.
 * - A finished game with nothing saved falls back to the projection, but only when it has something in
 *   it, so a player who never played doesn't get a recorded-looking line of zeros.
 *
 * **Three things the old page did, not restored:**
 *
 * 1. **The portrait was `/dplayer.png`** — a fixed stock image for every player, so nobody's real photo
 *    ever appeared here.
 * 2. **"Cumulative" and "Average" rows repeated the single game's numbers.** Three identical rows; an
 *    average over one game is that game.
 * 3. **`w-90 h-80 mr-20 top-[2.1rem]`** on the portrait — `w-90` is not a Tailwind size, so the width
 *    never applied.
 *
 * The shooting splits, the rebound split, +/- and EFF are real columns as of the 14 Oct migration
 * (Gap 54) and `MatchesService` returns every `MatchStat` field, so they are shown when present. They
 * will read `—` until `statdash-matchstat-sync` starts succeeding (Gap 47) — the live backend currently
 * has 41 consecutive failures on that queue and no stat rows at all.
 */
export default function PlayerDetails() {
  const { id, matchId, playerId } = useParams<{ id: string; matchId: string; playerId: string }>();
  const location = useLocation();
  const matchQuery = useMatch(matchId);

  // Live stats come from the game's projection, which is keyed by session id, not match id.
  const gameSessionId = pickGameSessionId(matchQuery.data?.gameSessions);
  const isLive = matchQuery.data?.status === 'LIVE';
  const projectionQuery = usePlayerGameProjection(gameSessionId, playerId, { live: isLive });

  // Where Back goes depends on where the visitor came from.
  const backTournamentId = location.state?.tournamentId ?? id;
  const back =
    location.state?.from === 'tournament-leaders'
      ? { to: `/tournaments/${backTournamentId}`, label: 'Back to Tournament' }
      : location.state?.from === 'players-page'
        ? { to: '/players-management', label: 'Back to Players' }
        : { to: `/tournaments/${id}/match/${matchId}`, label: 'Back to Match' };

  if (matchQuery.isPending) {
    return (
      <div className="min-h-screen bg-[#FCFEFF] p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl space-y-4" aria-label="Loading player stats">
          <Skeleton className="h-10 w-64 rounded" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (matchQuery.isError || !matchQuery.data) {
    return (
      <div className="min-h-screen bg-[#FCFEFF] p-6 dark:bg-gray-950">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className={errorBanner}>Failed to load match data.</div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => void matchQuery.refetch()}
              className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Retry
            </button>
            <Link to={back.to} className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400">
              {back.label}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const match = matchQuery.data;
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;
  const stats = match.stats ?? [];

  const playerStat = (stats.find((s) => s.playerId === playerId) ?? null) as MatchStatRecord | null;

  const homeEntry = (homeTeam?.playerTeams ?? []).find((pt) => pt.player?.id === playerId || pt.playerId === playerId);
  const awayEntry = (awayTeam?.playerTeams ?? []).find((pt) => pt.player?.id === playerId || pt.playerId === playerId);
  const rosterEntry = homeEntry ?? awayEntry;
  const playerInfo = rosterEntry?.player ?? playerStat?.player ?? null;

  const firstName = playerInfo ? normalizeName(playerInfo.firstName) : '';
  const lastName = playerInfo ? normalizeName(playerInfo.lastName) : '';
  const fullName = playerInfo ? `${firstName} ${lastName}`.trim() : DASH;
  const jerseyNumber = rosterEntry?.jerseyNumber ?? DASH;
  const playerTeamName = normalizeName(homeEntry ? (homeTeam?.name ?? DASH) : (awayTeam?.name ?? DASH));
  const opponentName = normalizeName(homeEntry ? (awayTeam?.name ?? DASH) : (homeTeam?.name ?? DASH));
  const tournamentName = normalizeName(match.tournament?.name) || DASH;

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
  const liveUnavailable = isLive && picked?.source !== 'live';
  const lastUpdated = projectionQuery.dataUpdatedAt ? new Date(projectionQuery.dataUpdatedAt).toLocaleTimeString() : null;

  const summaryCards = [
    { label: 'PTS', value: num(picked?.stats.points) },
    { label: 'REB', value: num(picked?.stats.rebounds) },
    { label: 'AST', value: num(picked?.stats.assists) },
    { label: 'BLK', value: num(picked?.stats.blocks) },
    { label: 'STL', value: num(picked?.stats.steals) },
    { label: 'PF', value: num(picked?.stats.fouls) },
  ];

  const details: Array<[string, string]> = [
    ['Date of birth', formatDob(playerInfo?.dateOfBirth)],
    ['Height', playerInfo?.height ?? DASH],
    ['Club', playerTeamName],
    ['Position', formatPosition(playerInfo?.position)],
  ];

  /** The table row: the seven tracked figures, plus the advanced columns when the record has them. */
  const row: string[] = [
    num(picked?.stats.points),
    split(playerStat?.fgm, playerStat?.fga),
    split(playerStat?.twoPm, playerStat?.twoPa),
    split(playerStat?.threePm, playerStat?.threePa),
    split(playerStat?.ftm, playerStat?.fta),
    num(picked?.stats.rebounds),
    num(playerStat?.oreb),
    num(playerStat?.dreb),
    num(picked?.stats.assists),
    num(picked?.stats.steals),
    num(picked?.stats.blocks),
    num(picked?.stats.fouls),
    num(picked?.stats.turnovers),
    num(playerStat?.plusMinus),
    num(playerStat?.eff),
  ];

  return (
    <div className="min-h-screen bg-[#FCFEFF] p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">{tournamentName}</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{playerTeamName} vs {opponentName}</p>
        </div>

        <div
          className="relative mb-4 overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-gray-900"
          style={{
            backgroundImage: "url('/player-bg.png')",
            backgroundPosition: 'right center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '600px 300px',
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-6 p-8">
            <div className="min-w-0 flex-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">#{jerseyNumber}</span>
              <h2 className="mt-2 text-4xl font-bold text-brand-900 dark:text-white">{fullName}</h2>
            </div>

            <PlayerAvatar
              firstName={firstName}
              lastName={lastName}
              photo={(playerInfo as { photo?: string } | null)?.photo}
              size="full"
              rounded="none"
              className="size-48 shrink-0 rounded-2xl text-5xl"
            />
          </div>

          <div className="relative bg-brand-50 p-8 dark:bg-brand-500/10">
            <dl className="grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
              {details.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-sm text-gray-600 dark:text-gray-400">{label}</dt>
                  <dd className="truncate text-lg font-semibold text-brand-900 dark:text-white">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <section aria-labelledby="game-stats" className="mb-8 rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900 sm:p-8">
          <h2 id="game-stats" className="sr-only">This game</h2>

          {isLive && (
            <div
              role="status"
              className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${
                liveUnavailable ? 'text-warning-700 dark:text-warning-500' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  liveUnavailable
                    ? 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-500'
                    : 'bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-500'
                }`}
              >
                <span aria-hidden className={`size-1.5 rounded-full ${liveUnavailable ? 'bg-warning-500' : 'animate-pulse bg-error-500'}`} />
                Live
              </span>
              {liveUnavailable ? (
                <span>Live updates unavailable. Showing the last saved stats, which may be behind the game.</span>
              ) : (
                <span>Updating every 5 seconds{lastUpdated ? ` · last updated ${lastUpdated}` : ''}</span>
              )}
            </div>
          )}

          {!isLive && picked?.source === 'projection' && (
            <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
              Final stats haven&rsquo;t been saved for this game yet. Showing the game&rsquo;s recorded events.
            </p>
          )}

          {!hasStats && (
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">No recorded stats for this player in this match yet.</p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 lg:grid-cols-6">
            {summaryCards.map((stat) => (
              <div key={stat.label} className="rounded-xl bg-brand-900 p-6 text-center text-white">
                <div className="mb-2 text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-brand-200">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="w-full rounded-2xl bg-gray-50 p-4 shadow-sm dark:bg-white/[0.02] sm:p-6">
          <div className="overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-900">
            <div className="relative overflow-x-auto">
              <table className="w-full" aria-label="This game's stat line">
                <thead>
                  <tr className="bg-brand-50 dark:bg-brand-500/10">
                    {TABLE_HEADS.map((h) => (
                      <th key={h} scope="col" className="px-4 py-3 text-center text-sm font-semibold text-brand-900 first:text-left dark:text-brand-300">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hasStats ? (
                    <tr className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.02]">
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-brand-700 dark:text-brand-400">vs {opponentName}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{tournamentName}</div>
                      </td>
                      {row.map((cell, i) => (
                        <td
                          key={i}
                          className={`px-4 py-4 text-center text-sm ${cell === DASH ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-gray-300'}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={TABLE_HEADS.length} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                        No stats recorded for this player in this match yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
            One game, so there is no cumulative or average to show. A dash is a figure this game has no record of.
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link to={back.to} className={`${btnPrimary} px-8 py-3`}>
            {back.label}
          </Link>
        </div>
      </div>
    </div>
  );
}

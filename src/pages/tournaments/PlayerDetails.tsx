import React from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useMatch } from '../../api/hooks';
import { usePlayerGameProjection } from '../../services/statdash';
import { pickGameSessionId, pickPlayerStats } from './playerMatchStats';

function formatDob(dob?: string | null): string {
  if (!dob) return '—';
  try {
    return new Date(dob).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dob;
  }
}

function formatPosition(pos?: string | null): string {
  if (!pos) return '—';
  return pos.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const DASH = '—';

export default function PlayerDetails() {
  const { id, matchId, playerId } = useParams<{ id: string; matchId: string; playerId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const matchQuery = useMatch(matchId);

  // Live stats come from the game's projection, which is keyed by session id, not match id.
  // Only polls while the match is actually live; otherwise it's a single fetch (used as a
  // fallback when nothing was saved for a finished game).
  const gameSessionId = pickGameSessionId(matchQuery.data?.gameSessions);
  const isLive = matchQuery.data?.status === 'LIVE';
  const projectionQuery = usePlayerGameProjection(gameSessionId, playerId, { live: isLive });

  const fromTournamentLeaders = location.state?.from === 'tournament-leaders';
  const fromPlayersPage = location.state?.from === 'players-page';
  const backTournamentId = location.state?.tournamentId ?? id;

  if (matchQuery.isPending) {
    return (
      <div className="min-h-screen bg-[#FCFEFF] p-6 flex items-center justify-center text-gray-500">
        Loading player stats…
      </div>
    );
  }

  if (matchQuery.isError || !matchQuery.data) {
    return (
      <div className="min-h-screen bg-[#FCFEFF] p-6 flex items-center justify-center text-red-500">
        Failed to load match data.
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

  const fullName = playerInfo ? `${playerInfo.firstName} ${playerInfo.lastName}` : DASH;
  const jerseyNumber = rosterEntry?.jerseyNumber ?? DASH;
  const position = formatPosition(playerInfo?.position);
  const dob = formatDob(playerInfo?.dateOfBirth);
  const height = playerInfo?.height ?? DASH;
  const playerTeamName = homeEntry ? (homeTeam?.name ?? DASH) : (awayTeam?.name ?? DASH);
  const opponentName = homeEntry ? (awayTeam?.name ?? DASH) : (homeTeam?.name ?? DASH);
  const tournamentName = match.tournament?.name ?? DASH;

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
  const pts = picked?.stats.points ?? null;
  const reb = picked?.stats.rebounds ?? null;
  const ast = picked?.stats.assists ?? null;
  const blk = picked?.stats.blocks ?? null;
  const stl = picked?.stats.steals ?? null;
  const pf = picked?.stats.fouls ?? null;
  const to = picked?.stats.turnovers ?? null;

  const hasStats = picked !== null;
  // Live but the projection can't be reached (or hasn't loaded): whatever is shown is the last
  // saved record, which lags the game — say so instead of presenting it as current.
  const liveUnavailable = isLive && picked?.source !== 'live';
  const lastUpdated = projectionQuery.dataUpdatedAt
    ? new Date(projectionQuery.dataUpdatedAt).toLocaleTimeString()
    : null;

  const summaryCards = [
    { label: 'PTS', value: pts ?? DASH },
    { label: 'REB', value: reb ?? DASH },
    { label: 'AST', value: ast ?? DASH },
    { label: 'BLK', value: blk ?? DASH },
    { label: 'STL', value: stl ?? DASH },
    { label: 'PF',  value: pf  ?? DASH },
  ];

  return (
    <div className="min-h-screen bg-[#FCFEFF] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">{tournamentName}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {playerTeamName} vs {opponentName}
            </p>
          </div>
        </div>

        {/* Player Profile Card */}
        <div
          className="rounded-2xl shadow-sm overflow-hidden mb-4 bg-white relative"
          style={{
            backgroundImage: "url('/player-bg.png')",
            backgroundPosition: 'right center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '600px 300px',
          }}
        >
          <div className="p-8 flex justify-between items-start">
            <div className="flex-1">
              <span className="text-sm text-gray-500">#{jerseyNumber}</span>
              <h2 className="text-4xl font-bold text-blue-900 mt-2">{fullName}</h2>
            </div>
            <div className="relative">
              <div className="w-90 h-80 relative mr-20 top-[2.1rem]">
                <img
                  src="/dplayer.png"
                  alt="Player"
                  className="relative z-10 w-full h-full object-cover rounded-2xl"
                />
              </div>
            </div>
          </div>

          <div className="p-8 relative" style={{ background: '#EEF3FF' }}>
            <div className="grid grid-cols-4 gap-6 text-center">
              <div>
                <p className="text-sm text-gray-600">Date of birth</p>
                <p className="text-lg font-semibold text-blue-900">{dob}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Height</p>
                <p className="text-lg font-semibold text-blue-900">{height}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Club</p>
                <p className="text-lg font-semibold text-blue-900">{playerTeamName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Position</p>
                <p className="text-lg font-semibold text-blue-900">{position}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stat Summary Cards */}
        <div className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          {isLive && (
            <div
              className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${
                liveUnavailable ? 'text-amber-700' : 'text-gray-600'
              }`}
              role="status"
            >
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
                  liveUnavailable ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'
                }`}
              >
                <span
                  className={`size-2 rounded-full ${
                    liveUnavailable ? 'bg-amber-500' : 'animate-pulse bg-red-500'
                  }`}
                />
                Live
              </span>
              {liveUnavailable ? (
                <span>Live updates unavailable — showing the last saved stats, which may be behind the game.</span>
              ) : (
                <span>
                  Updating every 5 seconds
                  {lastUpdated ? ` · last updated ${lastUpdated}` : ''}
                </span>
              )}
            </div>
          )}
          {!isLive && picked?.source === 'projection' && (
            <p className="text-xs text-gray-500 mb-4">
              Final stats haven&rsquo;t been saved for this game yet — showing the game&rsquo;s recorded events.
            </p>
          )}
          {!hasStats && (
            <p className="text-sm text-gray-500 mb-4">No recorded stats for this player in this match yet.</p>
          )}
          <div className="grid grid-cols-6 gap-6">
            {summaryCards.map((stat, i) => (
              <div key={i} className="bg-[#21409A] rounded-xl p-6 text-center text-white">
                <div className="text-3xl font-bold mb-2">{stat.value}</div>
                <div className="text-sm text-blue-200">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Table */}
        <div className="w-full bg-gray-50 p-6 rounded-2xl shadow-sm">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-blue-50">
                    {['Game(s)', 'PTS', 'FG', '2PT FG', '3PT FG', 'FT', 'REB', 'OREB', 'DREB', 'AST', 'STL', 'BLK', 'PF', 'TO', '+/-', 'EFF'].map(h => (
                      <th key={h} className="px-4 py-3 text-center text-sm font-semibold text-blue-900 first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hasStats ? (
                    <>
                      <tr className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-blue-700">vs {opponentName}</div>
                          <div className="text-xs text-gray-600">{tournamentName}</div>
                        </td>
                        <td className="px-4 py-4 text-center text-sm text-gray-800">{pts}</td>
                        {/* FG, 2PT FG, 3PT FG, FT — not in MatchStat schema */}
                        {[DASH, DASH, DASH, DASH].map((v, i) => (
                          <td key={i} className="px-4 py-4 text-center text-sm text-gray-400">{v}</td>
                        ))}
                        <td className="px-4 py-4 text-center text-sm text-gray-800">{reb}</td>
                        {/* OREB, DREB — not in MatchStat schema */}
                        {[DASH, DASH].map((v, i) => (
                          <td key={i} className="px-4 py-4 text-center text-sm text-gray-400">{v}</td>
                        ))}
                        <td className="px-4 py-4 text-center text-sm text-gray-800">{ast}</td>
                        <td className="px-4 py-4 text-center text-sm text-gray-800">{stl}</td>
                        <td className="px-4 py-4 text-center text-sm text-gray-800">{blk}</td>
                        <td className="px-4 py-4 text-center text-sm text-gray-800">{pf}</td>
                        <td className="px-4 py-4 text-center text-sm text-gray-800">{to}</td>
                        {/* +/-, EFF — not in MatchStat schema */}
                        {[DASH, DASH].map((v, i) => (
                          <td key={i} className="px-4 py-4 text-center text-sm text-gray-400">{v}</td>
                        ))}
                      </tr>

                      {/* Cumulative */}
                      <tr className="bg-blue-50 border-b border-gray-200">
                        <td className="px-4 py-4 text-sm font-semibold text-blue-900">Cumulative</td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{pts}</td>
                        {[DASH, DASH, DASH, DASH].map((v, i) => <td key={i} className="px-4 py-4 text-center text-sm text-gray-400">{v}</td>)}
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{reb}</td>
                        {[DASH, DASH].map((v, i) => <td key={i} className="px-4 py-4 text-center text-sm text-gray-400">{v}</td>)}
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{ast}</td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{stl}</td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{blk}</td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{pf}</td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{to}</td>
                        {[DASH, DASH].map((v, i) => <td key={i} className="px-4 py-4 text-center text-sm text-gray-400">{v}</td>)}
                      </tr>

                      {/* Average */}
                      <tr className="bg-blue-50">
                        <td className="px-4 py-4 text-sm font-semibold text-blue-900">Average</td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{pts}</td>
                        {[DASH, DASH, DASH, DASH].map((v, i) => <td key={i} className="px-4 py-4 text-center text-sm text-gray-400">{v}</td>)}
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{reb}</td>
                        {[DASH, DASH].map((v, i) => <td key={i} className="px-4 py-4 text-center text-sm text-gray-400">{v}</td>)}
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{ast}</td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{stl}</td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{blk}</td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{pf}</td>
                        <td className="px-4 py-4 text-center text-sm font-medium text-gray-800">{to}</td>
                        {[DASH, DASH].map((v, i) => <td key={i} className="px-4 py-4 text-center text-sm text-gray-400">{v}</td>)}
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan={16} className="px-4 py-10 text-center text-sm text-gray-500">
                        No stats recorded for this player in this match yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-6 text-center">
          {fromTournamentLeaders ? (
            <button
              onClick={() => navigate(`/tournaments/${backTournamentId}`)}
              className="px-8 py-3 bg-[#21409A] hover:bg-blue-800 text-white font-medium rounded-lg transition-colors"
            >
              Back to Tournament
            </button>
          ) : fromPlayersPage ? (
            <button
              onClick={() => navigate('/players-management')}
              className="px-8 py-3 bg-[#21409A] hover:bg-blue-800 text-white font-medium rounded-lg transition-colors"
            >
              Back to Players
            </button>
          ) : (
            <button
              onClick={() => navigate(`/tournaments/${id}/match/${matchId}`)}
              className="px-8 py-3 bg-[#21409A] hover:bg-blue-800 text-white font-medium rounded-lg transition-colors"
            >
              Back to Match
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

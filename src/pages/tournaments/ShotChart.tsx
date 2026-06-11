import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMatch } from '../../api/hooks';
import { useShotChartProjection } from '../../services/statdash';

const QUARTERS = ['all', 'q1', 'q2', 'q3', 'q4'] as const;
type Quarter = (typeof QUARTERS)[number];

const ShotChart: React.FC = () => {
  const { id, matchId } = useParams();
  const [activeQuarter, setActiveQuarter] = useState<Quarter>('all');
  const [showMade, setShowMade] = useState(true);
  const [showMissed, setShowMissed] = useState(true);

  const matchQuery = useMatch(matchId);
  const match = matchQuery.data;
  // Session ID required for live shot chart — available once Backend Gap #5 is resolved
  const sessionId = match?.gameSessions?.[0]?.id;
  const shotChartQuery = useShotChartProjection(sessionId, !!sessionId);
  const shots = shotChartQuery.data ?? [];

  // Quarter filter: backend shot events don't include a period field (Backend Gap #6)
  // so Q1-Q4 filters will show 0 until that's added to the shot payload
  const filteredShots = shots.filter((shot) => {
    if (activeQuarter !== 'all') {
      const q = Number(activeQuarter.replace('q', ''));
      if ((shot as Record<string, unknown>).period !== q) return false;
    }
    if (!showMade && shot.result === 'made') return false;
    if (!showMissed && shot.result !== 'made') return false;
    return true;
  });

  const homeTeamId = match?.homeTeamId;
  const homeRoster = match?.homeTeam?.playerTeams ?? [];
  const awayRoster = match?.awayTeam?.playerTeams ?? [];
  const homeName = match?.homeTeam?.name ?? 'Home';
  const awayName = match?.awayTeam?.name ?? 'Away';

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Quarter Filters */}
        <div className="flex justify-center gap-3 mb-6">
          {QUARTERS.map((q) => (
            <button
              key={q}
              onClick={() => setActiveQuarter(q)}
              className={`px-6 py-2.5 rounded-lg font-medium cursor-pointer transition-all ${
                activeQuarter === q
                  ? 'bg-[#21409A] text-white shadow-md'
                  : 'text-gray-600 bg-white border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {q === 'all' ? 'All' : q.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Basketball Court with Shot Markers */}
        <div className="bg-gradient-to-b from-blue-100 to-blue-50 rounded-lg p-8 mb-6 border border-gray-200">
          {!sessionId && !matchQuery.isPending && (
            <p className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Shot chart requires a session ID from the match record (Backend Gap #5).
            </p>
          )}
          {shotChartQuery.isPending && sessionId && (
            <div className="mb-3 text-sm text-gray-600">Loading shot chart...</div>
          )}
          {shotChartQuery.error instanceof Error && (
            <div className="mb-3 text-sm text-red-600">{shotChartQuery.error.message}</div>
          )}

          <div className="relative max-w-3xl mx-auto" style={{ aspectRatio: '16/10' }}>
            <div className="bg-[#4A90E2] rounded-lg w-full h-full" />
            {/* Shot markers overlaid as SVG */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {filteredShots.map((shot) => {
                if (shot.x === null || shot.y === null) return null;
                const isHome = shot.teamId === homeTeamId;
                const color = isHome ? '#FFCA69' : '#80B7D5';
                const x = shot.x * 100;
                const y = shot.y * 100;
                return shot.result === 'made' ? (
                  <circle
                    key={shot.eventId}
                    cx={x}
                    cy={y}
                    r={2.5}
                    fill={color}
                    stroke="#1e3a8a"
                    strokeWidth={0.5}
                  />
                ) : (
                  <g key={shot.eventId}>
                    <line x1={x - 2} y1={y - 2} x2={x + 2} y2={y + 2} stroke={color} strokeWidth={1.5} />
                    <line x1={x + 2} y1={y - 2} x2={x - 2} y2={y + 2} stroke={color} strokeWidth={1.5} />
                  </g>
                );
              })}
            </svg>
            {filteredShots.length === 0 && !shotChartQuery.isPending && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-sm opacity-80">
                  {sessionId ? `0 shots in ${activeQuarter.toUpperCase()}` : 'No session data'}
                </span>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex justify-center gap-6 mt-4">
            <button
              onClick={() => setShowMade((v) => !v)}
              className={`flex items-center gap-2 cursor-pointer transition-opacity ${showMade ? 'opacity-100' : 'opacity-40'} hover:opacity-80`}
            >
              <span className="w-3 h-3 rounded-full bg-[#FFCA69] border border-blue-900 inline-block" />
              <span className="text-sm text-gray-700">Made</span>
            </button>
            <button
              onClick={() => setShowMissed((v) => !v)}
              className={`flex items-center gap-2 cursor-pointer transition-opacity ${showMissed ? 'opacity-100' : 'opacity-40'} hover:opacity-80`}
            >
              <span className="text-gray-600 text-lg leading-none">✕</span>
              <span className="text-sm text-gray-700">Missed</span>
            </button>
          </div>
        </div>

        {/* Player Selection Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Home Team */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700 mb-1">{homeName}</p>
            <label className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500" />
              <span className="text-sm font-medium text-gray-700">All Players</span>
            </label>
            {homeRoster.map((pt, i) => (
              <label key={pt.playerId ?? i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500" />
                <span className="text-sm text-gray-700">
                  {pt.jerseyNumber != null ? `#${pt.jerseyNumber} ` : ''}
                  {pt.player ? `${pt.player.firstName} ${pt.player.lastName}` : 'Player'}
                </span>
              </label>
            ))}
            {homeRoster.length === 0 && (
              <p className="text-sm text-gray-400 px-3">No roster data</p>
            )}
          </div>

          {/* Away Team */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700 mb-1 text-right">{awayName}</p>
            <label className="flex items-center justify-end gap-3 p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100">
              <span className="text-sm font-medium text-gray-700">All Players</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
            </label>
            {awayRoster.map((pt, i) => (
              <label key={pt.playerId ?? i} className="flex items-center justify-end gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                <span className="text-sm text-gray-700">
                  {pt.player ? `${pt.player.firstName} ${pt.player.lastName}` : 'Player'}
                  {pt.jerseyNumber != null ? ` #${pt.jerseyNumber}` : ''}
                </span>
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
              </label>
            ))}
            {awayRoster.length === 0 && (
              <p className="text-sm text-gray-400 px-3 text-right">No roster data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShotChart;

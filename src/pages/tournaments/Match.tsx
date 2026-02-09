import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMatch, useTeams, useUpdateMatch, useDeleteMatch } from '../../api/hooks';
import type { MatchStatus } from '../../types/api';

interface QuarterScore {
  q1: number;
  q2: number;
  q3: number;
  q4: number;
}

interface Player {
  id: number;
  name: string;
  surname: string;
  number: string;
  image: string;
  points: number;
  team: string;
}

type LeaderCategory = 'points' | 'rebounds' | 'assists' | 'block' | 'steals';

function formatMatchTime(scheduledDate?: string): string {
  if (!scheduledDate) return '—';
  try {
    return new Date(scheduledDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return scheduledDate;
  }
}

const GameScorePage: React.FC = () => {
  const { id: tournamentId, matchId } = useParams<{ id: string; matchId: string }>();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<LeaderCategory>('points');
  const [showBoxScore, setShowBoxScore] = useState(false);
  const [activeTeam, setActiveTeam] = useState<'A' | 'B'>('A');
  const [activeTab, setActiveTab] = useState<'stats' | 'boxscore' | 'shotchart'>('stats');
  const [teamAAllPlayers, setTeamAAllPlayers] = useState(true);
  const [teamASelectedPlayers, setTeamASelectedPlayers] = useState<number[]>([]);
  const [teamBAllPlayers, setTeamBAllPlayers] = useState(true);
  const [teamBSelectedPlayers, setTeamBSelectedPlayers] = useState<number[]>([]);
  const [showMade, setShowMade] = useState(true);
  const [showMissed, setShowMissed] = useState(true);

  const matchQuery = useMatch(matchId);
  const teamsQuery = useTeams();
  const updateMatch = useUpdateMatch();
  const deleteMatch = useDeleteMatch();

  const teamMap = useMemo(() => {
    const map = new Map<string, string>();
    (teamsQuery.data ?? []).forEach((t) => map.set(t.id, t.name));
    return map;
  }, [teamsQuery.data]);

  const match = matchQuery.data;
  const homeTeamName = match ? (teamMap.get(match.homeTeamId) ?? 'Home') : 'Home';
  const awayTeamName = match ? (teamMap.get(match.awayTeamId) ?? 'Away') : 'Away';

  const teamAScore: QuarterScore = useMemo(() => ({
    q1: match?.quarter1Home ?? 0,
    q2: match?.quarter2Home ?? 0,
    q3: match?.quarter3Home ?? 0,
    q4: match?.quarter4Home ?? 0,
  }), [match]);
  const teamBScore: QuarterScore = useMemo(() => ({
    q1: match?.quarter1Away ?? 0,
    q2: match?.quarter2Away ?? 0,
    q3: match?.quarter3Away ?? 0,
    q4: match?.quarter4Away ?? 0,
  }), [match]);

  const totalScoreA = match?.totalHome ?? (teamAScore.q1 + teamAScore.q2 + teamAScore.q3 + teamAScore.q4);
  const totalScoreB = match?.totalAway ?? (teamBScore.q1 + teamBScore.q2 + teamBScore.q3 + teamBScore.q4);

  const players: Player[] = [
    { id: 1, name: 'Name', surname: 'Surname', number: '11', image: '/player1.png', points: 25, team: 'yellow' },
    { id: 2, name: 'Name', surname: 'Surname', number: '23', image: '/player2.png', points: 22, team: 'blue' },
  ];

  const handleUpdateStatus = (status: MatchStatus) => {
    if (!matchId || !match) return;
    updateMatch.mutate(
      { id: matchId, data: { status } },
      { onError: (e) => alert(e.message) }
    );
  };

  const handleUpdateQuarterScore = (quarter: 1 | 2 | 3 | 4, home: number, away: number) => {
    if (!matchId) return;
    const data = {
      [`quarter${quarter}Home`]: home,
      [`quarter${quarter}Away`]: away,
    } as { quarter1Home?: number; quarter1Away?: number; quarter2Home?: number; quarter2Away?: number; quarter3Home?: number; quarter3Away?: number; quarter4Home?: number; quarter4Away?: number };
    updateMatch.mutate(
      { id: matchId, data },
      { onError: (e) => alert(e.message) }
    );
  };

  const handleDeleteMatch = () => {
    if (!matchId || !tournamentId || !window.confirm('Delete this match? This cannot be undone.')) return;
    deleteMatch.mutate(matchId, {
      onSuccess: () => navigate(`/tournaments/${tournamentId}/fixtures`),
      onError: (e) => alert(e.message),
    });
  };

  if (matchQuery.isPending || !matchId) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-7xl mx-auto text-gray-500">Loading match…</div>
      </div>
    );
  }
  if (matchQuery.error || !matchQuery.data) {
    return (
      <div className="min-h-screen bg-white p-6">
        <div className="max-w-7xl mx-auto text-red-600">
          {matchQuery.error instanceof Error ? matchQuery.error.message : 'Match not found'}
        </div>
      </div>
    );
  }

  const handleViewBoxScore = () => {
    setShowBoxScore(true);
  };

  const handlePlayerClick = (playerId: number) => {
    navigate(`/tournaments/${tournamentId}/match/${matchId}/player/${playerId}`);
  };

  // Team A handlers
  const handleTeamAAllPlayersChange = (checked: boolean) => {
    setTeamAAllPlayers(checked);
    if (checked) {
      setTeamASelectedPlayers([]);
    }
  };

  const handleTeamAPlayerChange = (playerIndex: number, checked: boolean) => {
    if (checked) {
      setTeamASelectedPlayers([...teamASelectedPlayers, playerIndex]);
      setTeamAAllPlayers(false);
    } else {
      const updated = teamASelectedPlayers.filter(idx => idx !== playerIndex);
      setTeamASelectedPlayers(updated);
      if (updated.length === 0) {
        setTeamAAllPlayers(true);
      }
    }
  };

  // Team B handlers
  const handleTeamBAllPlayersChange = (checked: boolean) => {
    setTeamBAllPlayers(checked);
    if (checked) {
      setTeamBSelectedPlayers([]);
    }
  };

  const handleTeamBPlayerChange = (playerIndex: number, checked: boolean) => {
    if (checked) {
      setTeamBSelectedPlayers([...teamBSelectedPlayers, playerIndex]);
      setTeamBAllPlayers(false);
    } else {
      const updated = teamBSelectedPlayers.filter(idx => idx !== playerIndex);
      setTeamBSelectedPlayers(updated);
      if (updated.length === 0) {
        setTeamBAllPlayers(true);
      }
    }
  };

  // Determine if player image should be shown
  const shouldShowTeamAImage = !teamAAllPlayers && teamASelectedPlayers.length > 0;
  const shouldShowTeamBImage = !teamBAllPlayers && teamBSelectedPlayers.length > 0;

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">{homeTeamName} vs {awayTeamName}</h1>
          <p className="text-sm text-gray-600 mt-3">{formatMatchTime(match?.scheduledDate)}</p>
          {match && (
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-500">Status:</span>
              <select
                value={match.status}
                onChange={(e) => handleUpdateStatus(e.target.value as MatchStatus)}
                disabled={updateMatch.isPending}
                className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
              >
                <option value="SCHEDULED">Scheduled</option>
                <option value="LIVE">Live</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="POSTPONED">Postponed</option>
              </select>
              <button
                type="button"
                onClick={handleDeleteMatch}
                disabled={deleteMatch.isPending}
                className="text-sm px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-70"
              >
                {deleteMatch.isPending ? 'Deleting…' : 'Delete match'}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-lg shadow-sm p-20 mb-6 border" style={{ background: '#FCFEFF', border: '1px solid #A9A9A91A' }}>
          <div className="flex items-center justify-evenly gap-12 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-[#FFCA69] rounded-xl flex items-center justify-evenly p-2">
                <img className="w-32" src="/ball1.png" alt="Home" />
              </div>
              <div className="flex items-center gap-3">
                <div className="text-4xl text-gray-400">{homeTeamName}</div>
                <div className="text-5xl font-bold text-gray-900">{totalScoreA}</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="px-10 py-2 bg-[#6AE36F] rounded-lg">
                <div className="text-sm font-medium text-[#126A16]">Q1</div>
              </div>
              <div className="text-sm font-medium text-gray-500">{match?.status === 'LIVE' ? 'Live' : match?.status ?? '—'}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="text-5xl font-bold text-gray-900">{totalScoreB}</div>
                <div className="text-4xl text-gray-400">{awayTeamName}</div>
              </div>
              <div className="w-14 h-14 bg-[#80B7D5] rounded-xl flex items-center justify-evenly p-2">
                <img className="w-32" src="/ball2.png" alt="Away" />
              </div>
            </div>
          </div>
          <div className="text-center text-xs text-gray-400">
            {match?.venue ?? '—'} | {formatMatchTime(match?.scheduledDate)}
          </div>
        </div>

        {/* Quarter Scores Table - Hidden when Box Score is shown */}
        {!showBoxScore && (
          <div className="max-w-4xl mx-auto rounded-2xl shadow-sm mb-8 border" style={{ background: '#FCFEFF', border: '1px solid #A9A9A91A' }}>
          <p className="text-xs text-gray-500 px-4 pt-3">Edit quarter scores below and blur to save.</p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-bold text-gray-700" style={{ background: '#EEF3FF' }}>Team</th>
                <th className="text-center py-3 px-4 text-sm font-bold text-gray-700" style={{ background: '#EEF3FF' }}>Q1</th>
                <th className="text-center py-3 px-4 text-sm font-bold text-gray-700" style={{ background: '#EEF3FF' }}></th>
                <th className="text-center py-3 px-4 text-sm font-bold text-gray-700" style={{ background: '#EEF3FF' }}>Q2</th>
                <th className="text-center py-3 px-4 text-sm font-bold text-gray-700" style={{ background: '#EEF3FF' }}></th>
                <th className="text-center py-3 px-4 text-sm font-bold text-gray-700" style={{ background: '#EEF3FF' }}>Q3</th>
                <th className="text-center py-3 px-4 text-sm font-bold text-gray-700" style={{ background: '#EEF3FF' }}></th>
                <th className="text-center py-3 px-4 text-sm font-bold text-gray-700" style={{ background: '#EEF3FF' }}>Q4</th>
                </tr>
            </thead>
            <tbody>
               <tr>
                 <td className="py-4 px-4">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-[#FFCA69] rounded-lg flex items-center justify-center">
                       <img src="/ball1.png" alt="Team A" className="w-5 h-5" />
                     </div>
                     <span className="text-sm font-medium text-gray-700">{homeTeamName}</span>
                   </div>
                 </td>
                 <td className="text-center py-2 px-2">
                   <input type="number" min={0} className="w-12 text-center py-1 border border-gray-300 rounded text-sm font-semibold" value={teamAScore.q1} onBlur={(e) => handleUpdateQuarterScore(1, parseInt(e.target.value, 10) || 0, teamBScore.q1)} />
                 </td>
                 <td className="text-center py-4 px-2 text-sm font-semibold text-[#A9A9A9]">|</td>
                 <td className="text-center py-2 px-2">
                   <input type="number" min={0} className="w-12 text-center py-1 border border-gray-300 rounded text-sm font-semibold" value={teamAScore.q2} onBlur={(e) => handleUpdateQuarterScore(2, parseInt(e.target.value, 10) || 0, teamBScore.q2)} />
                 </td>
                 <td className="text-center py-4 px-2 text-sm font-semibold text-[#A9A9A9]">|</td>
                 <td className="text-center py-2 px-2">
                   <input type="number" min={0} className="w-12 text-center py-1 border border-gray-300 rounded text-sm font-semibold" value={teamAScore.q3} onBlur={(e) => handleUpdateQuarterScore(3, parseInt(e.target.value, 10) || 0, teamBScore.q3)} />
                 </td>
                 <td className="text-center py-4 px-2 text-sm font-semibold text-[#A9A9A9]">|</td>
                 <td className="text-center py-2 px-2">
                   <input type="number" min={0} className="w-12 text-center py-1 border border-gray-300 rounded text-sm font-semibold" value={teamAScore.q4} onBlur={(e) => handleUpdateQuarterScore(4, parseInt(e.target.value, 10) || 0, teamBScore.q4)} />
                 </td>
               </tr>
               <tr>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#80B7D5] rounded-lg flex items-center justify-center">
                      <img src="/ball2.png" alt="Team B" className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-medium text-gray-700">{awayTeamName}</span>
                  </div>
                </td>
                 <td className="text-center py-2 px-2">
                   <input type="number" min={0} className="w-12 text-center py-1 border border-gray-300 rounded text-sm font-semibold" value={teamBScore.q1} onBlur={(e) => handleUpdateQuarterScore(1, teamAScore.q1, parseInt(e.target.value, 10) || 0)} />
                 </td>
                 <td className="text-center py-4 px-2 text-sm font-semibold text-[#A9A9A9]">|</td>
                 <td className="text-center py-2 px-2">
                   <input type="number" min={0} className="w-12 text-center py-1 border border-gray-300 rounded text-sm font-semibold" value={teamBScore.q2} onBlur={(e) => handleUpdateQuarterScore(2, teamAScore.q2, parseInt(e.target.value, 10) || 0)} />
                 </td>
                 <td className="text-center py-4 px-2 text-sm font-semibold text-[#A9A9A9]">|</td>
                 <td className="text-center py-2 px-2">
                   <input type="number" min={0} className="w-12 text-center py-1 border border-gray-300 rounded text-sm font-semibold" value={teamBScore.q3} onBlur={(e) => handleUpdateQuarterScore(3, teamAScore.q3, parseInt(e.target.value, 10) || 0)} />
                 </td>
                 <td className="text-center py-4 px-2 text-sm font-semibold text-[#A9A9A9]">|</td>
                 <td className="text-center py-2 px-2">
                   <input type="number" min={0} className="w-12 text-center py-1 border border-gray-300 rounded text-sm font-semibold" value={teamBScore.q4} onBlur={(e) => handleUpdateQuarterScore(4, teamAScore.q4, parseInt(e.target.value, 10) || 0)} />
                 </td>
              </tr>
            </tbody>
          </table>
        </div>
        )}

        {/* Main Tabs */}
        <div className="flex gap-3 mb-6 justify-center">
          <button
            onClick={() => {
              setActiveTab('stats');
              setShowBoxScore(false);
            }}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'stats'
                ? 'bg-[#21409A] text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Game Stats
          </button>
          <button
            onClick={() => {
              setActiveTab('boxscore');
              setShowBoxScore(true);
            }}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'boxscore'
                ? 'bg-[#21409A] text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Box Score
          </button>
          <button
            onClick={() => {
              setActiveTab('shotchart');
              setShowBoxScore(false);
            }}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === 'shotchart'
                ? 'bg-[#21409A] text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Shot Chart
          </button>
        </div>

        {/* Shot Chart Section - Only show when shotchart tab is active */}
        {activeTab === 'shotchart' && (
          <div className="max-w-7xl mx-auto">
            {/* Quarter Filters */}
            <div className="flex justify-center gap-3 mb-6">
              <button className="px-6 py-2.5 rounded-lg font-medium bg-[#21409A] text-white shadow-md cursor-pointer">
                All
              </button>
              <button className="px-6 py-2.5 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 cursor-pointer">
                Q1
              </button>
              <button className="px-6 py-2.5 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 cursor-pointer">
                Q2
              </button>
              <button className="px-6 py-2.5 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 cursor-pointer">
                Q3
              </button>
              <button className="px-6 py-2.5 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 cursor-pointer">
                Q4
              </button>
            </div>

            {/* Basketball Court with Shot Chart */}
            <div className="bg-gradient-to-b from-blue-100 to-blue-50 rounded-lg p-8 mb-6 border border-gray-200 flex flex-col items-center">
              <img src="/court.png" alt="Basketball Court" className="w-2xl h-w-3xl-lg mb-6 object-cover" />
              
              {/* Legend */}
              <div className="flex items-center gap-6">
                {/* Made */}
                <button
                  onClick={() => setShowMade(!showMade)}
                  className={`flex items-center gap-2 cursor-pointer transition-opacity ${
                    showMade ? 'opacity-100' : 'opacity-40'
                  } hover:opacity-80`}
                >
                  <div className={`w-5 h-5 ${showMade ? 'bg-blue-900' : 'bg-gray-400'} rounded flex items-center justify-center`}>
                    {showMade && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className={`w-2 h-2 ${showMade ? 'bg-blue-900' : 'bg-gray-400'} rounded-full`}></div>
                  <span className="text-sm font-medium text-gray-700">Made</span>
                </button>

                {/* Missed */}
                <button
                  onClick={() => setShowMissed(!showMissed)}
                  className={`flex items-center gap-2 cursor-pointer transition-opacity ${
                    showMissed ? 'opacity-100' : 'opacity-40'
                  } hover:opacity-80`}
                >
                  <div className={`w-5 h-5 ${showMissed ? 'bg-blue-200' : 'bg-gray-300'} rounded flex items-center justify-center`}>
                    {showMissed && (
                      <svg className="w-3.5 h-3.5 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div className="w-2 h-2 flex items-center justify-center">
                    {showMissed ? (
                      <svg className="w-2.5 h-2.5 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700">Missed</span>
                </button>
              </div>
            </div>


            {/* Player Cards and Selection Lists Container */}
            <div className="flex gap-[23px] justify-center" style={{ marginTop: '42px' }}>
              {/* Team A Section */}
              <div className="flex flex-col">
                {/* Player 1 - Yellow */}
                {shouldShowTeamAImage && (
                  <>
                    <div
                      className="rounded-2xl overflow-hidden bg-[#FFCA69] relative mb-6"
                      style={{ width: '335px', height: '374px' }}
                    >
                      <div className="absolute left-4 top-4 z-10">
                        <div className="text-white font-medium mb-1">Name</div>
                        <div className="text-white font-bold text-lg mb-1">Surname</div>
                        <div className="bg-white text-gray-900 font-bold text-sm w-8 h-8 flex items-center justify-center rounded-md mb-4">
                          11
                        </div>
                        <div className="mb-2">
                          <div className="relative w-16 h-16">
                            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                              {/* Background circle */}
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke="#E5E7EB"
                                strokeWidth="8"
                                fill="none"
                              />
                              {/* Progress circle */}
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke="#80B7D5"
                                strokeWidth="8"
                                fill="none"
                                strokeDasharray="251.2"
                                strokeDashoffset="125.6"
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-[10px] font-bold text-gray-800">FG%</div>
                              </div>
                            </div>
                          </div>
                          <div className="text-white font-bold text-sm mt-1">50%</div>
                          <div className="text-white text-xs">(10/20)</div>
                        </div>
                      </div>
                      <div className="relative" style={{ height: '374px' }}>
                        <img
                          src="/player1.png"
                          alt="Player"
                          className="w-[21rem] ml-0 mx-auto absolute mt-[4.7rem]"
                        />
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t-2 border-dashed border-gray-300 mb-6" style={{ width: '335px' }}></div>
                  </>
                )}

                {/* Team A Players Selection List */}
                <div className="space-y-3" style={{ width: '335px' }}>
                  <label className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100">
                    <input 
                      type="checkbox" 
                      checked={teamAAllPlayers}
                      onChange={(e) => handleTeamAAllPlayersChange(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500" 
                    />
                    <span className="text-sm font-medium text-gray-700">All Players</span>
                  </label>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <label key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <input 
                        type="checkbox" 
                        checked={teamASelectedPlayers.includes(i)}
                        onChange={(e) => handleTeamAPlayerChange(i, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500" 
                      />
                      <span className="text-sm text-gray-700">Name Surname</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Team B Section */}
              <div className="flex flex-col">
                {/* Player 2 - Blue */}
                {shouldShowTeamBImage && (
                  <>
                    <div
                      className="rounded-2xl overflow-hidden bg-[#80B7D5] relative mb-6"
                      style={{ width: '335px', height: '374px' }}
                    >
                      <div className="absolute left-4 top-4 z-10">
                        <div className="text-white font-medium mb-1">Name</div>
                        <div className="text-white font-bold text-lg mb-1">Surname</div>
                        <div className="bg-white text-gray-900 font-bold text-sm w-8 h-8 flex items-center justify-center rounded-md mb-4">
                          23
                        </div>
                        <div className="mb-2">
                          <div className="relative w-16 h-16">
                            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                              {/* Background circle */}
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke="#E5E7EB"
                                strokeWidth="8"
                                fill="none"
                              />
                              {/* Progress circle */}
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke="#FFCA69"
                                strokeWidth="8"
                                fill="none"
                                strokeDasharray="251.2"
                                strokeDashoffset="125.6"
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-[10px] font-bold text-gray-800">FG%</div>
                              </div>
                            </div>
                          </div>
                          <div className="text-white font-bold text-sm mt-1">50%</div>
                          <div className="text-white text-xs">(10/20)</div>
                        </div>
                      </div>
                      <div className="relative" style={{ height: '374px' }}>
                        <img
                          src="/player2.png"
                          alt="Player"
                          className="w-[21rem] ml-0 mx-auto absolute mt-[4.7rem]"
                        />
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t-2 border-dashed border-gray-300 mb-6" style={{ width: '335px' }}></div>
                  </>
                )}

                {/* Team B Players Selection List */}
                <div className="space-y-3" style={{ width: '335px' }}>
                  <label className="flex items-center justify-end gap-3 p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100">
                    <span className="text-sm font-medium text-gray-700">All Players</span>
                    <input 
                      type="checkbox" 
                      checked={teamBAllPlayers}
                      onChange={(e) => handleTeamBAllPlayersChange(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500" 
                    />
                  </label>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <label key={i} className="flex items-center justify-end gap-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                      <span className="text-sm text-gray-700">Name Surname</span>
                      <input 
                        type="checkbox" 
                        checked={teamBSelectedPlayers.includes(i)}
                        onChange={(e) => handleTeamBPlayerChange(i, e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500" 
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Game Leaders Section - Hidden when Box Score or Shot Chart is shown */}
        {!showBoxScore && activeTab !== 'shotchart' && (
          <div className="max-w-4xl mx-auto rounded-lg shadow-sm p-6 border" style={{ background: '#FCFEFF', border: '1px solid #A9A9A91A' }}>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Game Leaders</h2>

            {/* Category Tabs */}
            <div className="flex gap-2 mb-6 justify-center">
              <button
                onClick={() => setActiveCategory('points')}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  activeCategory === 'points'
                    ? 'bg-[#21409A] text-[#F8F8F8]'
                    : 'bg-[#F8F8F8] text-gray-600 border border-gray-200'
                }`}
              >
                Points
              </button>
              <button
                onClick={() => setActiveCategory('rebounds')}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  activeCategory === 'rebounds'
                    ? 'bg-[#21409A] text-[#F8F8F8]'
                    : 'bg-[#F8F8F8] text-gray-600 border border-gray-200'
                }`}
              >
                Rebounds
              </button>
              <button
                onClick={() => setActiveCategory('assists')}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  activeCategory === 'assists'
                    ? 'bg-[#21409A] text-[#F8F8F8]'
                    : 'bg-[#F8F8F8] text-gray-600 border border-gray-200'
                }`}
              >
                Assists
              </button>
              <button
                onClick={() => setActiveCategory('block')}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  activeCategory === 'block'
                    ? 'bg-[#21409A] text-[#F8F8F8]'
                    : 'bg-[#F8F8F8] text-gray-600 border border-gray-200'
                }`}
              >
                Block
              </button>
              <button
                onClick={() => setActiveCategory('steals')}
                className={`px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  activeCategory === 'steals'
                    ? 'bg-[#21409A] text-[#F8F8F8]'
                    : 'bg-[#F8F8F8] text-gray-600 border border-gray-200'
                }`}
              >
                Steals
              </button>
            </div>

            {/* Player Cards */}
            <div className="flex gap-[23px] mb-6" style={{ marginTop: '42px', marginLeft: '80px' }}>
              {players.map((player) => (
                <div
                  key={player.id}
                  className={`rounded-2xl overflow-hidden ${
                    player.team === 'yellow' ? 'bg-[#FFCA69]' : 'bg-[#80B7D5]'
                  }`}
                  style={{ width: '335px', height: '374px' }}
                >
                  <div className="p-4">
                    <div className="text-white font-medium mb-1">{player.name}</div>
                    <div className="text-white font-bold text-lg mb-1">{player.surname}</div>
                    <div className="bg-white text-gray-900 font-bold text-sm px-3 py-1 rounded-md inline-block">
                      {player.number}
                    </div>
                  </div>
                   <div className="relative" style={{ height: '400px' }}>
                     <img
                       src={player.image}
                       alt={`${player.name} ${player.surname}`}
                       className="w-[21rem] ml-0 mx-auto absolute mt-[-3.5rem]"
                     />
                   </div>
                </div>
              ))}
            </div>

            {/* View Box Score Button */}
            <div className="text-center">
              <button
                onClick={handleViewBoxScore}
                className="px-10 py-3 bg-[#21409A] hover:opacity-90 text-white font-medium rounded-lg transition-colors"
              >
                View Box Score
              </button>
            </div>
          </div>
        )}

        {/* Box Score Section - Only shown when Box Score is active */}
        {showBoxScore && (
          <div className="rounded-lg shadow-sm p-6 border" style={{ background: '#FCFEFF', border: '1px solid #A9A9A91A' }}>
            {/* Box Score Header */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Box Score</h2>
                <button
                  onClick={() => setShowBoxScore(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              {/* Team Tabs */}
              <div className="flex justify-center">
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-full max-w-7xl">
                  <button
                    onClick={() => setActiveTeam('A')}
                    className={`flex-1 py-2 rounded-md font-medium text-sm transition-all duration-200 ${
                      activeTeam === 'A'
                        ? 'bg-[#21409A] text-white shadow-sm'
                        : 'bg-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    {homeTeamName}
                  </button>
                  <button
                    onClick={() => setActiveTeam('B')}
                    className={`flex-1 py-2 rounded-md font-medium text-sm transition-all duration-200 ${
                      activeTeam === 'B'
                        ? 'bg-[#21409A] text-white shadow-sm'
                        : 'bg-transparent text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    {awayTeamName}
                  </button>
                </div>
              </div>
            </div>

            {/* Box Score Table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#EEF3FF' }}>
                    <th className="text-left py-3 px-3 text-xs font-bold text-blue-900">#</th>
                    <th className="text-left py-3 px-3 text-xs font-bold text-blue-900">PLAYER</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">PTS</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">FG</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">2PT FG</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">3PT FG</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">FT</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">REB</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">OREB</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">DREB</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">AST</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">STL</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">BLK</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">PF</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">TO</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">+/-</th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-blue-900">EFF</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6].map((playerNum) => (
                    <tr 
                      key={playerNum}
                      className={`${playerNum % 2 === 1 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50 cursor-pointer transition-colors`}
                      onClick={() => handlePlayerClick(playerNum)}
                    >
                      <td className="py-3 px-3 text-sm font-bold text-blue-900">8</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden">
                            <img 
                              src="/player1.png" 
                              alt="Player" 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className="text-sm font-bold text-blue-900">Name Surname</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">
                        <div>3/6</div>
                        <div>(50%)</div>
                      </td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">
                        <div>3/6</div>
                        <div>(50%)</div>
                      </td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">
                        <div>3/6</div>
                        <div>(50%)</div>
                      </td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">
                        <div>3/6</div>
                        <div>(50%)</div>
                      </td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                      <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                    </tr>
                  ))}
                  {/* Total Row */}
                  <tr style={{ background: '#F5F8FF' }}>
                    <td className="py-3 px-3 text-sm font-bold text-blue-900"></td>
                    <td className="py-3 px-3 text-sm font-bold text-blue-900">Total</td>
                    <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                    <td className="text-center py-3 px-3 text-sm text-gray-700">
                      <div>3/6</div>
                      <div>(50%)</div>
                    </td>
                    <td className="text-center py-3 px-3 text-sm text-gray-700">
                      <div>3/6</div>
                      <div>(50%)</div>
                    </td>
                    <td className="text-center py-3 px-3 text-sm text-gray-700">
                      <div>3/6</div>
                      <div>(50%)</div>
                    </td>
                    <td className="text-center py-3 px-3 text-sm text-gray-700">
                      <div>3/6</div>
                      <div>(50%)</div>
                    </td>
                    <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                    <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                    <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                    <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                    <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                    <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                    <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                    <td className="text-center py-3 px-3 text-sm text-gray-700">8</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Coaching Staff Section */}
            <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200">
              <div className="grid grid-cols-2 gap-8 p-4" style={{ background: '#F8F8F8' }}>
                <div>
                  <div className="text-sm font-bold text-blue-900 mb-2">Coach</div>
                  <div className="text-sm text-gray-700">Name Surname</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-blue-900 mb-2">Assistant(s)</div>
                  <div className="text-sm text-gray-700">Name Surname</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Game Stats Section - Hidden when Box Score or Shot Chart is shown */}
        {!showBoxScore && activeTab !== 'shotchart' && (
          <div className="max-w-4xl mx-auto rounded-lg shadow-sm p-6 border mt-8" style={{ background: '#FCFEFF', border: '1px solid #A9A9A91A' }}>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Game Stats</h2>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-8">
            <button className="px-10 py-2 rounded-lg font-medium text-sm bg-[#21409A] text-white">
              Final
            </button>
            <button className="px-10 py-2 rounded-lg font-medium text-sm bg-[#F8F8F8] text-gray-600 border border-gray-200">
              Q1
            </button>
            <button className="px-10 py-2 rounded-lg font-medium text-sm bg-[#F8F8F8] text-gray-600 border border-gray-200">
              Q2
            </button>
            <button className="px-10 py-2 rounded-lg font-medium text-sm bg-[#F8F8F8] text-gray-600 border border-gray-200">
              Q3
            </button>
            <button className="px-10 py-2 rounded-lg font-medium text-sm bg-[#F8F8F8] text-gray-600 border border-gray-200">
              Q4
            </button>
          </div>
        
        {/* Divider */}
        <hr className="my-16 border-gray-200" />


          {/* Circular Progress Indicators */}
          <div className="flex justify-center gap-16 mb-8">
            {/* Team A FG% */}
            <div className="text-center">
              <div className="relative w-32 h-32 mb-2">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#E5E7EB"
                    strokeWidth="8"
                    fill="none"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#FFCA69"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray="251.2"
                    strokeDashoffset="125.6"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-800">FG%</div>
                  </div>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-800">50</div>
            </div>

            {/* Team B FG% */}
            <div className="text-center">
              <div className="relative w-32 h-32 mb-2">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#E5E7EB"
                    strokeWidth="8"
                    fill="none"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#80B7D5"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray="251.2"
                    strokeDashoffset="125.6"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-800">FG%</div>
                  </div>
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-800">50</div>
            </div>
          </div>

          {/* Divider */}
          <hr className="my-16 w-[45rem] mx-auto border-gray-200" />

          {/* Horizontal Comparison Bars */}
          <div className="space-y-6">
            {/* 3pt Bar */}
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              
              {/* Center Label */}
              <div className="px-4">
                <span className="text-sm font-medium text-gray-800 bg-[#F8F8F8] px-3 py-1 rounded shadow-sm">3pt</span>
              </div>
              
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-gray-200 overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2pt Bar */}
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              
              {/* Center Label */}
              <div className="px-4">
                <span className="text-sm font-medium text-gray-800 bg-[#F8F8F8] px-3 py-1 rounded shadow-sm">2pt</span>
              </div>
              
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* FT Bar */}
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              
              {/* Center Label */}
              <div className="px-4">
                <span className="text-sm font-medium text-gray-800 bg-[#F8F8F8] px-3 py-1 rounded shadow-sm">FT</span>
              </div>
              
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* Divider */}
        <hr className="my-16 w-[45rem] mx-auto border-gray-200" />
        
         {/* Horizontal Comparison Bars more View */}
           <div className="space-y-6">
             {/* Total rebounds */}
             <div className="text-center mb-4">
               <h3 className="text-sm font-bold text-gray-700">Total rebounds</h3>
             </div>
             <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              
             
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-gray-200 overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Offensive rebounds */}
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-gray-700">Offensive rebounds</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Defensive rebounds */}
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-gray-700">Defensive rebounds</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assists */}
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-gray-700">Assists</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Blocks */}
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-gray-700">Blocks</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Steals */}
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-gray-700">Steals</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Turnovers */}
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-gray-700">Turnovers</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Points in the paint */}
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-gray-700">Points in the paint</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Foul - Personal */}
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-gray-700">Foul - Personal</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        {/* Divider */}
        <hr className="my-16 w-[45rem] mx-auto border-gray-200" />

        {/* Additional Team Comparison Bars */}
        <div className="space-y-8">
          {/* Points off turnovers */}
          <div>
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-gray-700">Points off turnovers</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Points from the bench */}
          <div>
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-gray-700">Points from the bench</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Second chance points */}
          <div>
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-gray-700">Second chance points</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fast break points */}
          <div>
            <div className="text-center mb-4">
              <h3 className="text-sm font-bold text-gray-700">Fast break points</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              {/* Left Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
              {/* Right Progress Bar */}
              <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                  <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

         {/* Divider */}
         <hr className="my-16 w-[45rem] mx-auto border-gray-200" />

         {/* Additional Team Comparison Bars */}
         <div className="space-y-8">
           {/* Time leading */}
           <div>
             <div className="text-center mb-4">
               <h3 className="text-sm font-bold text-gray-700">Time leading</h3>
             </div>
             <div className="flex items-center justify-center gap-4">
               {/* Left Progress Bar */}
               <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                 <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                   <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                     <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                   </div>
                 </div>
               </div>
               {/* Right Progress Bar */}
               <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                 <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                   <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                     <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                   </div>
                 </div>
               </div>
             </div>
           </div>

           {/* Biggest Lead */}
           <div>
             <div className="text-center mb-4">
               <h3 className="text-sm font-bold text-gray-700">Biggest Lead</h3>
             </div>
             <div className="flex items-center justify-center gap-4">
               {/* Left Progress Bar */}
               <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                 <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                   <div className="h-full w-1/2 bg-[#FFCA69]"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                     <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                   </div>
                 </div>
               </div>
               {/* Right Progress Bar */}
               <div className="flex-1 relative" style={{ maxWidth: '290px' }}>
                 <div className="h-4 bg-[#D9D9D9] overflow-hidden relative">
                   <div className="h-full w-1/2 bg-[#80B7D5]"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                     <span className="bg-[#F8F8F8] text-gray-700 text-xs px-2 py-1 rounded">50%</span>
                   </div>
                 </div>
               </div>
             </div>
           </div>
         </div>

        </div>
        )}
      </div>
      
      {/* Bottom Spacing */}
      <div className="h-32"></div>
    </div>  
  );
};

export default GameScorePage;
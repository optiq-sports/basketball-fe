import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// Basketball Icon Component
const BasketballIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M12 2C12 2 8 6 8 12C8 18 12 22 12 22" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M12 2C12 2 16 6 16 12C16 18 12 22 12 22" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    <path d="M2 12H22" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M4 7H20" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M4 17H20" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

// Copy Icon Component
const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface Team {
  id: number;
  name: string;
  color: string;
  gp: number;
  w: number;
  l: number;
  percent: number;
  points: number;
}

interface Match {
  id: number;
  teamA: string;
  teamAColor: string;
  teamB: string;
  teamBColor: string;
  venue: string;
  time: string;
  hasStarted: boolean;
}

const CompetitionDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeGroup, setActiveGroup] = useState('A');
  const [matchCode] = useState('ABC123XYZ');
  const [showSchedules, setShowSchedules] = useState(true);

  const teams: Team[] = [
    { id: 1, name: 'TEAM', color: 'yellow', gp: 0, w: 0, l: 0, percent: 0, points: 0 },
    { id: 2, name: 'TEAM', color: 'yellow', gp: 0, w: 0, l: 0, percent: 0, points: 0 },
    { id: 3, name: 'TEAM', color: 'yellow', gp: 0, w: 0, l: 0, percent: 0, points: 0 },
    { id: 4, name: 'TEAM', color: 'blue', gp: 0, w: 0, l: 0, percent: 0, points: 0 },
    { id: 5, name: 'TEAM', color: 'blue', gp: 0, w: 0, l: 0, percent: 0, points: 0 },
  ];

  const matches: Match[] = [
    { id: 1, teamA: 'TEAM A', teamAColor: 'yellow', teamB: 'TEAM B', teamBColor: 'blue', venue: 'Match Venue', time: '12:40PM, 11 November 2025', hasStarted: false },
    { id: 2, teamA: 'TEAM A', teamAColor: 'yellow', teamB: 'TEAM B', teamBColor: 'blue', venue: 'Match Venue', time: '12:40PM, 11 November 2025', hasStarted: false },
    { id: 3, teamA: 'TEAM A', teamAColor: 'yellow', teamB: 'TEAM B', teamBColor: 'blue', venue: 'Match Venue', time: '12:40PM, 11 November 2025', hasStarted: true },
  ];

  interface TournamentLeader {
    id: number;
    name: string;
    surname: string;
    stat: number;
    statLabel: string;
    bgColor: string;
    image: string;
  }

  const tournamentLeaders: TournamentLeader[] = [
    { id: 1, name: 'Name', surname: 'Surname', stat: 11, statLabel: 'PPG', bgColor: '#FFCA69', image: '/player1.png' },
    { id: 2, name: 'Name', surname: 'Surname', stat: 23, statLabel: 'PPG', bgColor: '#80B7D5', image: '/player2.png' },
    { id: 3, name: 'Name', surname: 'Surname', stat: 5, statLabel: 'PPG', bgColor: '#7FD99A', image: '/player3.png' },
  ];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(matchCode);
    alert('Match code copied!');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-800">Competition Name</h1>
          <button
            onClick={() => navigate(`/tournaments/${id ?? '1'}/fixtures`)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            View Fixtures
          </button>
        </div>

        {/* Ongoing Game Card */}
        <div 
          className="rounded-lg shadow-sm p-6 mb-6 border cursor-pointer hover:shadow-md transition-shadow" 
          style={{ background: '#FCFEFF', border: '1px solid #A9A9A91A' }}
          onClick={() => navigate(`/tournaments/${id ?? '1'}/match/1`)}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold text-gray-700">Ongoing Game</h2>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleCopyCode();
              }}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              <span>Copy Match Code</span>
              <CopyIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center">
                <img src="/ball1.png" alt="Basketball" style={{ width: '35px', height: '35px' }} className="object-contain" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">TEAM A</div>
                <div className="text-4xl font-bold text-gray-900">17</div>
              </div>
            </div>
            
            <div className="text-lg text-gray-400 font-medium">VS</div>
            
            <div className="flex items-center gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1 text-right">TEAM B</div>
                <div className="text-4xl font-bold text-gray-900">12</div>
              </div>
              <div className="flex items-center justify-center">
                <img src="/ball2.png" alt="Basketball" style={{ width: '35px', height: '35px' }} className="object-contain" />
              </div>
            </div>
          </div>

          <div className="text-center mt-4 text-xs text-gray-400">
            Tournament Name | 12:40PM, 11 November 2025
          </div>
        </div>

        {/* Group Tabs */}
          <div className="flex justify-center gap-2 mb-6">
            {['A', 'B', 'C', 'D'].map((group) => (
              <button
                key={group}
                onClick={() => setActiveGroup(group)}
                className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                  activeGroup === group
                    ? 'bg-[#21409A] text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Group {group}
              </button>
            ))}
          </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Standings Table */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Teams</h2>
            <div className="rounded-lg shadow-sm p-6 border" style={{ background: '#FCFEFF', border: '1px solid #A9A9A91A' }}>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Group {activeGroup}</h2>
              <p className="text-sm text-gray-500">0/10 Games Played</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 text-xs font-semibold text-gray-600">Team</th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">GP</th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">W</th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">L</th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">%</th>
                    <th className="text-center py-3 px-2 text-xs font-semibold text-gray-600">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team) => (
                    <tr key={team.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center">
                            <img 
                              src={team.color === 'yellow' ? '/ball1.png' : '/ball2.png'} 
                              alt="Basketball" 
                              style={{ width: '35px', height: '35px' }} 
                              className="object-contain" 
                            />
                          </div>
                          <span className="text-sm text-gray-700">{team.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2 text-sm text-gray-700">{team.gp}</td>
                      <td className="text-center py-3 px-2 text-sm text-gray-700">{team.w}</td>
                      <td className="text-center py-3 px-2 text-sm text-gray-700">{team.l}</td>
                      <td className="text-center py-3 px-2 text-sm text-gray-700">{team.percent}</td>
                      <td className="text-center py-3 px-2 text-sm text-gray-700">{team.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          </div>

          {/* Fixtures List */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowSchedules(!showSchedules)}
                  className="text-gray-600 hover:text-gray-800 cursor-pointer"
                >
                  <span className="text-lg">{showSchedules ? '▼' : '▶'}</span>
                </button>
                <h2 className="text-lg font-semibold text-gray-800">Schedules ({matches.length})</h2>
              </div>
              <button 
                onClick={() => navigate(`/tournaments/${id ?? '1'}/schedules`)}
                className="text-sm text-[#21409A] hover:underline font-medium cursor-pointer"
              >
                View All
              </button>
            </div>
            {showSchedules && (
            <div className="space-y-4">
            {matches.map((match) => (
              <div 
                key={match.id} 
                className="rounded-lg shadow-sm p-5 border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-1 hover:ring-gray-300" 
                style={{ background: '#F8F8F8', border: '1px solid #A9A9A91A' }}
                onClick={() => navigate(match.hasStarted 
                  ? `/tournaments/${id ?? '1'}/match/${match.id}` 
                  : `/tournaments/${id ?? '1'}/match/${match.id}/pending`
                )}
              >
                <div className="flex justify-between items-start">
                  {/* Teams (left) */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center">
                        <img 
                          src={match.teamAColor === 'yellow' ? '/ball1.png' : '/ball2.png'} 
                          alt="Basketball" 
                          style={{ width: '35px', height: '35px' }} 
                          className="object-contain" 
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{match.teamA}</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center">
                        <img 
                          src={match.teamBColor === 'yellow' ? '/ball1.png' : '/ball2.png'} 
                          alt="Basketball" 
                          style={{ width: '35px', height: '35px' }} 
                          className="object-contain" 
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700">{match.teamB}</span>
                    </div>
                  </div>

                  {/* Venue/Time (right) */}
                  <div className="text-xs text-gray-500 text-left self-center space-y-1">
                    <div>{match.venue}</div>
                    <div>{match.time}</div>
                  </div>
                </div>
              </div>
            ))}
            </div>
            )}
          </div>
        </div>

        {/* Tournament Leaders Section */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Tournament Leaders</h2>
          
          {/* Stats Tabs */}
          <div className="flex gap-2 mb-6">
            <button className="px-6 py-2.5 rounded-lg font-medium bg-[#21409A] text-white shadow-md">
              Points
            </button>
            <button className="px-6 py-2.5 rounded-lg font-medium bg-white text-gray-600 hover:bg-gray-100">
              Rebounds
            </button>
            <button className="px-6 py-2.5 rounded-lg font-medium bg-white text-gray-600 hover:bg-gray-100">
              Assists
            </button>
            <button className="px-6 py-2.5 rounded-lg font-medium bg-white text-gray-600 hover:bg-gray-100">
              Block
            </button>
            <button className="px-6 py-2.5 rounded-lg font-medium bg-white text-gray-600 hover:bg-gray-100">
              Steals
            </button>
          </div>

          {/* Player Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournamentLeaders.map((player) => {
              const firstMatchId = matches.length > 0 ? matches[0].id : 1;
              return (
                <div
                  key={player.id}
                  className="rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ width: '335px', height: '374px', backgroundColor: player.bgColor }}
                  onClick={() => {
                    navigate(`/tournaments/${id ?? '1'}/match/${firstMatchId}/player/${player.id}`, {
                      state: { from: 'tournament-leaders', tournamentId: id ?? '1' }
                    });
                  }}
                >
                  <div className="p-4">
                    <div className="text-white font-medium mb-1">{player.name}</div>
                    <div className="text-white font-bold text-lg mb-1">{player.surname}</div>
                    <div className="bg-white text-gray-900 font-bold text-sm px-3 py-1 rounded-md inline-block">
                      {player.stat} <span className='font-light'>{player.statLabel}</span>
                    </div>
                  </div>
                  <div className="relative" style={{ height: '400px' }}>
                    <img
                      src={player.image}
                      alt={`${player.name} ${player.surname}`}
                      className="w-[21rem] ml-0 mx-auto absolute mt-[-2rem]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetitionDetailPage;
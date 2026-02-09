import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMapPin, FiCalendar, FiUsers, FiAward, FiTrendingUp, FiEdit2, FiTrash } from 'react-icons/fi';
import { GiBasketballBall, GiTrophy } from 'react-icons/gi';
import { useTeam, usePlayers, useCreatePlayerForTeam, useRemovePlayerFromTeam, useDeleteTeam } from '../../api/hooks';
import type { Player as ApiPlayer } from '../../types/api';

const POSITION_OPTIONS = [
  { value: 'POINT_GUARD', label: 'Point Guard' },
  { value: 'SHOOTING_GUARD', label: 'Shooting Guard' },
  { value: 'SMALL_FORWARD', label: 'Small Forward' },
  { value: 'POWER_FORWARD', label: 'Power Forward' },
  { value: 'CENTER', label: 'Center' },
] as const;

interface MatchHistory {
  id: number;
  opponent: string;
  opponentColor: string;
  date: string;
  venue: string;
  score: string;
  result: 'win' | 'loss';
  tournament: string;
  tournamentId: number;
  season?: string;
}

interface Championship {
  id: number;
  year: string;
  tournament: string;
  opponent: string;
  score: string;
}

interface SeasonStats {
  season: string;
  wins: number;
  losses: number;
  winPercentage: number;
  pointsFor: number;
  pointsAgainst: number;
  tournament: string;
}

interface PlayerDisplay {
  id: string;
  name: string;
  surname: string;
  number: string;
  position: string;
  image: string;
}

interface CoachingStaff {
  id: number;
  name: string;
  role: string;
  country: string;
}

function mapApiPlayerToDisplay(p: ApiPlayer): PlayerDisplay {
  return {
    id: p.id,
    name: p.firstName,
    surname: p.lastName,
    number: String(p.jerseyNumber ?? ''),
    position: typeof p.position === 'string' && p.position.includes('_') ? p.position.replace(/_/g, ' ') : (p.position as string),
    image: '/player1.png',
  };
}

const TeamDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'players' | 'stats'>('overview');
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({ name: '', surname: '', number: '', position: 'POINT_GUARD' as string });
  const [releasingPlayer, setReleasingPlayer] = useState<PlayerDisplay | null>(null);
  const [releaseDate, setReleaseDate] = useState('');

  const teamQuery = useTeam(id ?? null);
  const playersQuery = usePlayers(id ?? undefined);
  const createPlayer = useCreatePlayerForTeam();
  const removePlayer = useRemovePlayerFromTeam();
  const deleteTeam = useDeleteTeam();

  const team = teamQuery.data;
  const teamPlayers = useMemo(() => (playersQuery.data ?? []).map(mapApiPlayerToDisplay), [playersQuery.data]);

  const teamData = useMemo(() => {
    if (!team) return null;
    return {
      id: team.id,
      name: team.name,
      shortTeamCode: team.code ?? '',
      longTeamCode: team.code ?? '',
      teamColor: team.color ?? '#552583',
      country: team.country ?? '',
      state: team.state ?? '',
      city: team.state ?? '',
      coach: team.coach,
      assistantCoach: team.assistantCoach,
      tournamentId: id ?? '1',
      totalMatches: 0,
      wins: 0,
      losses: 0,
      championships: 0,
      winPercentage: 0,
      pointsPerGame: 0,
      pointsAllowedPerGame: 0,
      homeRecord: '—',
      awayRecord: '—',
      currentStreak: '—',
      founded: '—',
      email: '—',
      phone: '—',
      website: '—',
      arena: '—',
      capacity: '—',
      logo: null as string | null,
    };
  }, [team, id]);

  const matchHistory: MatchHistory[] = [
    {
      id: 1,
      opponent: 'Warriors',
      opponentColor: '#1D428A',
      date: '11 November 2025',
      venue: 'Crypto.com Arena',
      score: '120 - 98',
      result: 'win',
      tournament: 'KCBL Club Championship',
      tournamentId: 1,
      season: '2024-25',
    },
    {
      id: 2,
      opponent: 'Bulls',
      opponentColor: '#CE1141',
      date: '10 November 2025',
      venue: 'Crypto.com Arena',
      score: '105 - 112',
      result: 'loss',
      tournament: 'KCBL Club Championship',
      tournamentId: 1,
      season: '2024-25',
    },
    {
      id: 3,
      opponent: 'Celtics',
      opponentColor: '#007A33',
      date: '8 November 2025',
      venue: 'TD Garden',
      score: '115 - 108',
      result: 'win',
      tournament: 'KCBL Club Championship',
      tournamentId: 1,
      season: '2024-25',
    },
    {
      id: 4,
      opponent: 'Heat',
      opponentColor: '#98002E',
      date: '5 November 2025',
      venue: 'Crypto.com Arena',
      score: '98 - 95',
      result: 'win',
      tournament: 'KCBL Club Championship',
      tournamentId: 1,
      season: '2024-25',
    },
    {
      id: 5,
      opponent: 'Nets',
      opponentColor: '#000000',
      date: '2 November 2025',
      venue: 'Barclays Center',
      score: '110 - 125',
      result: 'loss',
      tournament: 'KCBL Club Championship',
      tournamentId: 1,
      season: '2024-25',
    },
    {
      id: 6,
      opponent: 'Rockets',
      opponentColor: '#CE1141',
      date: '30 October 2025',
      venue: 'Crypto.com Arena',
      score: '112 - 105',
      result: 'win',
      tournament: 'KCBL Club Championship',
      tournamentId: 1,
      season: '2024-25',
    },
    {
      id: 7,
      opponent: 'Spurs',
      opponentColor: '#C4CED4',
      date: '28 October 2025',
      venue: 'AT&T Center',
      score: '108 - 102',
      result: 'win',
      tournament: 'KCBL Club Championship',
      tournamentId: 1,
      season: '2024-25',
    },
    {
      id: 8,
      opponent: 'Thunder',
      opponentColor: '#007AC1',
      date: '25 October 2025',
      venue: 'Crypto.com Arena',
      score: '95 - 100',
      result: 'loss',
      tournament: 'KCBL Club Championship',
      tournamentId: 1,
      season: '2024-25',
    },
  ];

  const championships: Championship[] = [
    { id: 1, year: '2024', tournament: 'KCBL Club Championship', opponent: 'Celtics', score: '108 - 95' },
    { id: 2, year: '2023', tournament: 'KCBL Club Championship', opponent: 'Warriors', score: '112 - 105' },
    { id: 3, year: '2022', tournament: 'Premier League', opponent: 'Heat', score: '106 - 93' },
  ];

  const seasonStats: SeasonStats[] = [
    { season: '2024-25', wins: 45, losses: 12, winPercentage: 78.9, pointsFor: 6185, pointsAgainst: 5831, tournament: 'KCBL Club Championship' },
    { season: '2023-24', wins: 52, losses: 20, winPercentage: 72.2, pointsFor: 7488, pointsAgainst: 7056, tournament: 'KCBL Club Championship' },
    { season: '2022-23', wins: 48, losses: 24, winPercentage: 66.7, pointsFor: 6912, pointsAgainst: 6720, tournament: 'Premier League' },
  ];

  const coachingStaff: CoachingStaff[] = teamData?.coach || teamData?.assistantCoach
    ? [
        ...(teamData.coach ? [{ id: 1, name: teamData.coach, role: 'Coach', country: teamData.country }] : []),
        ...(teamData.assistantCoach ? [{ id: 2, name: teamData.assistantCoach, role: 'Assistant Coach', country: teamData.country }] : []),
      ]
    : [];

  if (teamQuery.isPending && !team) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Loading team...</p>
      </div>
    );
  }
  if (teamQuery.error || (!teamQuery.isPending && !team && id)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-red-600">{teamQuery.error?.message ?? 'Team not found'}</p>
        <button onClick={() => navigate('/teams-management')} className="ml-4 text-blue-600">Back to Teams</button>
      </div>
    );
  }
  if (!teamData) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header Section */}
      <div 
        className="relative pt-8 pb-12 px-8 overflow-hidden"
        style={{ backgroundColor: teamData.teamColor }}
      >
        {/* Abstract curved lines background */}
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
            <path d="M0,100 Q100,50 200,100 T400,100" stroke="white" strokeWidth="3" fill="none" opacity="0.5"/>
            <path d="M0,120 Q150,70 300,120 T400,120" stroke="white" strokeWidth="3" fill="none" opacity="0.3"/>
            <path d="M0,80 Q120,30 240,80 T400,80" stroke="white" strokeWidth="3" fill="none" opacity="0.4"/>
          </svg>
        </div>

        {/* Content Container */}
        <div className="relative z-10 max-w-7xl mx-auto">
          {/* Back Button and Actions */}
          <div className="mb-6 flex justify-between items-center">
            <button
              onClick={() => navigate('/teams-management')}
              className="flex items-center gap-2 text-white hover:text-gray-200 transition-colors"
            >
              <FiArrowLeft size={20} />
              <span className="font-medium">Back to Teams</span>
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  // Navigate to edit mode or open edit modal
                  alert('Edit team functionality - would open edit modal or navigate to edit page');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors backdrop-blur-sm"
                title="Edit Team"
              >
                <FiEdit2 size={18} />
                <span className="font-medium">Edit</span>
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete ${teamData.name}? This action cannot be undone.`)) {
                    deleteTeam.mutate(teamData.id, { onSuccess: () => navigate('/teams-management'), onError: (e) => alert(e.message) });
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/80 hover:bg-red-600/90 text-white rounded-lg transition-colors backdrop-blur-sm"
                title="Delete Team"
              >
                <FiTrash size={18} />
                <span className="font-medium">Delete</span>
              </button>
            </div>
          </div>

          {/* Team Profile */}
          <div className="rounded-2xl shadow-sm overflow-hidden mb-4 bg-white/10 backdrop-blur-sm relative">
            <div className="p-8 flex justify-between items-start">
              {/* Team Info */}
              <div className="flex-1">
                <span className="text-sm text-white/80">Team</span>
                <h2 className="text-4xl font-bold text-white mt-2">{teamData.name}</h2>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-white/90">
                    <span className="font-medium">Code:</span>
                    <span>{teamData.shortTeamCode} / {teamData.longTeamCode}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/90">
                    <FiMapPin size={16} />
                    <span>{teamData.city}, {teamData.state}, {teamData.country}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/90">
                    <FiCalendar size={16} />
                    <span>Founded: {teamData.founded}</span>
                  </div>
                </div>
              </div>

              {/* Team Logo */}
              <div className="relative">
                <div className="w-40 h-40 relative">
                  {teamData.logo ? (
                    <img
                      src={teamData.logo}
                      alt={teamData.name}
                      className="relative z-10 w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/20 rounded-2xl flex items-center justify-center">
                      <GiBasketballBall className="text-white text-8xl opacity-80" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Team Stats Grid */}
            <div className="p-8 relative bg-white/10 backdrop-blur-sm">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <p className="text-sm text-white/80">Total Matches</p>
                  <p className="text-2xl font-bold text-white">{teamData.totalMatches}</p>
                </div>
                <div>
                  <p className="text-sm text-white/80">Wins</p>
                  <p className="text-2xl font-bold text-green-300">{teamData.wins}</p>
                </div>
                <div>
                  <p className="text-sm text-white/80">Losses</p>
                  <p className="text-2xl font-bold text-red-300">{teamData.losses}</p>
                </div>
                <div>
                  <p className="text-sm text-white/80">Championships</p>
                  <p className="text-2xl font-bold text-yellow-300">{teamData.championships}</p>
                </div>
                <div>
                  <p className="text-sm text-white/80">Win %</p>
                  <p className="text-2xl font-bold text-white">{teamData.winPercentage}%</p>
                </div>
                <div>
                  <p className="text-sm text-white/80">PPG</p>
                  <p className="text-2xl font-bold text-white">{teamData.pointsPerGame}</p>
                </div>
                <div>
                  <p className="text-sm text-white/80">PAPG</p>
                  <p className="text-2xl font-bold text-white">{teamData.pointsAllowedPerGame}</p>
                </div>
                <div>
                  <p className="text-sm text-white/80">Streak</p>
                  <p className="text-2xl font-bold text-green-300">{teamData.currentStreak}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Tabs */}
          <div className="mb-8">
            <div className="flex gap-2 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'overview'
                    ? 'border-b-2 border-blue-900 text-blue-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'history'
                    ? 'border-b-2 border-blue-900 text-blue-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                History
              </button>
              <button
                onClick={() => setActiveTab('players')}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'players'
                    ? 'border-b-2 border-blue-900 text-blue-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Players
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'stats'
                    ? 'border-b-2 border-blue-900 text-blue-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Statistics
              </button>
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Team Information Card */}
              <div className="mb-8 bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Team Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-1">Arena</p>
                      <p className="text-lg font-semibold text-gray-900">{teamData.arena}</p>
                      <p className="text-sm text-gray-500">Capacity: {teamData.capacity}</p>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-1">Home Record</p>
                      <p className="text-lg font-semibold text-gray-900">{teamData.homeRecord}</p>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-1">Away Record</p>
                      <p className="text-lg font-semibold text-gray-900">{teamData.awayRecord}</p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-1">Contact Email</p>
                      <p className="text-lg font-semibold text-gray-900">{teamData.email}</p>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-1">Phone</p>
                      <p className="text-lg font-semibold text-gray-900">{teamData.phone}</p>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-1">Website</p>
                      <p className="text-lg font-semibold text-blue-600 hover:underline">{teamData.website}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Players Section */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Current Players</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamPlayers.map((player) => (
                <div
                  key={player.id}
                  onClick={() => navigate(`/players-management`)}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden">
                      <img
                        src={player.image}
                        alt={`${player.name} ${player.surname}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-blue-900">#{player.number}</span>
                        <h3 className="text-sm font-semibold text-gray-900">
                          {player.name} {player.surname}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-600">{player.position}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coaching Staff Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Coaching Staff</h2>
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {coachingStaff.map((staff) => (
                  <div key={staff.id} className="text-center">
                    <div className="mb-2">
                      <FiUsers className="text-3xl text-gray-400 mx-auto" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{staff.name}</h3>
                    <p className="text-sm text-gray-600 mb-1">{staff.role}</p>
                    <p className="text-xs text-gray-500">{staff.country}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
            </>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <>
              {/* Championships Section */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <GiTrophy className="text-yellow-500" />
                  Championships
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {championships.map((champ) => (
                    <div
                      key={champ.id}
                      className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6 border border-yellow-200"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <GiTrophy className="text-3xl text-yellow-600" />
                        <div>
                          <p className="text-2xl font-bold text-gray-900">{champ.year}</p>
                          <p className="text-sm text-gray-600">{champ.tournament}</p>
                        </div>
                      </div>
                      <div className="border-t border-yellow-300 pt-4">
                        <p className="text-sm text-gray-600 mb-1">Defeated</p>
                        <p className="text-lg font-semibold text-gray-900">{champ.opponent}</p>
                        <p className="text-sm text-gray-700 mt-2">Score: {champ.score}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Match History Section */}
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Match History</h2>
                <div className="space-y-4">
                  {matchHistory.map((match) => (
                    <div
                      key={match.id}
                      className="bg-gray-50 rounded-lg p-5 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/tournaments/${match.tournamentId}/match/${match.id}`)}
                    >
                      <div className="flex justify-between items-center">
                        {/* Left side - Teams and Scores */}
                        <div className="space-y-3 flex-1">
                          {/* Team (Lakers) */}
                          <div className="flex items-center gap-3">
                            <div 
                              className="flex items-center justify-center w-10 h-10 rounded"
                              style={{ backgroundColor: teamData.teamColor }}
                            >
                              <img
                                src="/ball1.png"
                                alt="Basketball"
                                className="w-7 h-7 object-contain"
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700 w-24">{teamData.name}</span>
                            <span className={`text-sm font-semibold ${
                              match.result === 'win' ? 'text-green-600' : 'text-gray-800'
                            }`}>
                              {match.score.split(' - ')[0]}
                            </span>
                          </div>

                          {/* Opponent */}
                          <div className="flex items-center gap-3">
                            <div 
                              className="flex items-center justify-center w-10 h-10 rounded"
                              style={{ backgroundColor: match.opponentColor }}
                            >
                              <img
                                src="/ball2.png"
                                alt="Basketball"
                                className="w-7 h-7 object-contain"
                              />
                            </div>
                            <span className="text-sm font-medium text-gray-700 w-24">{match.opponent}</span>
                            <span className={`text-sm font-semibold ${
                              match.result === 'loss' ? 'text-red-600' : 'text-gray-800'
                            }`}>
                              {match.score.split(' - ')[1]}
                            </span>
                          </div>
                        </div>

                        {/* Right side - Match Info */}
                        <div className="text-right text-xs text-gray-500">
                          <p className="font-medium text-gray-700 mb-1">{match.tournament}</p>
                          <p>{match.venue}</p>
                          <p>{match.date}</p>
                          {match.season && <p className="text-gray-400">{match.season}</p>}
                          <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                            match.result === 'win' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {match.result === 'win' ? 'Win' : 'Loss'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Players Tab */}
          {activeTab === 'players' && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Current Players</h2>
                <button
                  onClick={() => setIsAddPlayerOpen(true)}
                  className="px-5 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
                >
                  Add Player
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {playersQuery.isPending ? (
                  <p className="text-gray-500 col-span-full">Loading players...</p>
                ) : (
                teamPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden">
                        <img
                          src={player.image}
                          alt={`${player.name} ${player.surname}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-blue-900">#{player.number}</span>
                          <h3 className="text-sm font-semibold text-gray-900">
                            {player.name} {player.surname}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-600">{player.position}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/players-management`);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Player"
                        >
                          <FiEdit2 size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReleasingPlayer(player);
                            setReleaseDate('');
                          }}
                          className="p-2 text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors"
                          title="Remove from team"
                        >
                          <span className="text-sm font-bold">R</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
                )}
              </div>
            </div>
          )}

          {/* Release Player Modal */}
          {releasingPlayer && (
            <div className="fixed inset-0 bg-white/20 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg w-full max-w-md overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-xl font-semibold text-gray-900">Release Player</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Select release date for {releasingPlayer.name} {releasingPlayer.surname}
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <input
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                  <button
                    onClick={() => setReleasingPlayer(null)}
                    className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!id) return;
                      removePlayer.mutate(
                        { playerId: releasingPlayer.id, teamId: id },
                        { onSuccess: () => { setReleasingPlayer(null); setReleaseDate(''); }, onError: (e) => alert(e.message) }
                      );
                    }}
                    disabled={removePlayer.isPending}
                    className="px-5 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-70"
                  >
                    {removePlayer.isPending ? 'Removing...' : 'Remove from team'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Player Modal */}
          {isAddPlayerOpen && (
            <div className="fixed inset-0 bg-white/20 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg w-full max-w-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">Add Player</h3>
                  <button
                    onClick={() => setIsAddPlayerOpen(false)}
                    className="text-gray-500 hover:text-gray-800"
                    title="Close"
                  >
                    ×
                  </button>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="First Name"
                    value={newPlayer.name}
                    onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={newPlayer.surname}
                    onChange={(e) => setNewPlayer({ ...newPlayer, surname: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    placeholder="Jersey Number"
                    value={newPlayer.number}
                    onChange={(e) => setNewPlayer({ ...newPlayer, number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <select
                    value={newPlayer.position}
                    onChange={(e) => setNewPlayer({ ...newPlayer, position: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    {POSITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                  <button
                    onClick={() => setIsAddPlayerOpen(false)}
                    className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!newPlayer.name || !newPlayer.surname || !newPlayer.number || !id) {
                        alert('Please fill first name, last name and jersey number');
                        return;
                      }
                      const jerseyNum = parseInt(newPlayer.number, 10);
                      if (Number.isNaN(jerseyNum)) {
                        alert('Jersey number must be a number');
                        return;
                      }
                      createPlayer.mutate(
                        {
                          teamId: id,
                          firstName: newPlayer.name,
                          lastName: newPlayer.surname,
                          jerseyNumber: jerseyNum,
                          position: newPlayer.position as 'POINT_GUARD' | 'SHOOTING_GUARD' | 'SMALL_FORWARD' | 'POWER_FORWARD' | 'CENTER',
                        },
                        {
                          onSuccess: () => {
                            setNewPlayer({ name: '', surname: '', number: '', position: 'POINT_GUARD' });
                            setIsAddPlayerOpen(false);
                          },
                          onError: (e) => alert(e.message),
                        }
                      );
                    }}
                    disabled={createPlayer.isPending}
                    className="px-5 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-70"
                  >
                    {createPlayer.isPending ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Statistics Tab */}
          {activeTab === 'stats' && (
            <>
              {/* Season Statistics */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <FiTrendingUp className="text-blue-600" />
                  Season Statistics
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full bg-white rounded-lg border border-gray-200">
                    <thead>
                      <tr style={{ background: '#F5F8FF' }}>
                        <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">Season</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-blue-900">Wins</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-blue-900">Losses</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-blue-900">Win %</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-blue-900">Points For</th>
                        <th className="text-center py-3 px-4 text-xs font-bold text-blue-900">Points Against</th>
                        <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">Tournament</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seasonStats.map((stat, index) => (
                        <tr key={stat.season} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="py-3 px-4 text-sm font-semibold text-gray-900">{stat.season}</td>
                          <td className="text-center py-3 px-4 text-sm text-green-600 font-semibold">{stat.wins}</td>
                          <td className="text-center py-3 px-4 text-sm text-red-600 font-semibold">{stat.losses}</td>
                          <td className="text-center py-3 px-4 text-sm text-gray-700">{stat.winPercentage}%</td>
                          <td className="text-center py-3 px-4 text-sm text-gray-700">{stat.pointsFor.toLocaleString()}</td>
                          <td className="text-center py-3 px-4 text-sm text-gray-700">{stat.pointsAgainst.toLocaleString()}</td>
                          <td className="py-3 px-4 text-sm text-gray-700">{stat.tournament}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Team Achievements */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <FiAward className="text-purple-600" />
                  Achievements
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200 text-center">
                    <GiTrophy className="text-4xl text-blue-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{teamData.championships}</p>
                    <p className="text-sm text-gray-600">Championships</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200 text-center">
                    <FiTrendingUp className="text-4xl text-green-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{teamData.winPercentage}%</p>
                    <p className="text-sm text-gray-600">Win Percentage</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200 text-center">
                    <FiAward className="text-4xl text-purple-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{teamData.totalMatches}</p>
                    <p className="text-sm text-gray-600">Total Matches</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6 border border-yellow-200 text-center">
                    <FiCalendar className="text-4xl text-yellow-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900">{teamData.founded}</p>
                    <p className="text-sm text-gray-600">Founded</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamDetails;

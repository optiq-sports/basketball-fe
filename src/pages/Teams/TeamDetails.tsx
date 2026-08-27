import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiMapPin, FiCalendar, FiUsers, FiAward, FiTrendingUp, FiEdit2, FiTrash, FiUserMinus } from 'react-icons/fi';
import { GiBasketballBall, GiTrophy } from 'react-icons/gi';
import type { ColumnDef } from '@tanstack/react-table';
import { useTeam, usePlayers, useCreatePlayerForTeam, useRemovePlayerFromTeam, useDeleteTeam, useAssignPlayerToTeam, useSetTeamCaptain, useUpdatePlayer, useUploadFile, useUpdateTeam } from '../../api/hooks';
import type { Player as ApiPlayer } from '../../types/api';
import { resolvePlayerPhotoUrl, handlePhotoLoadError } from '../../utils/playerPhotoPlaceholder';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import DataTable from '../../components/ui/DataTable';

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
  country: string;
  height: string;
  dob: string;
  isCaptain?: boolean;
}

interface CoachingStaff {
  id: number;
  name: string;
  role: string;
  country: string;
}

const seasonStatsColumns: ColumnDef<SeasonStats>[] = [
  { accessorKey: 'season', header: 'Season' },
  {
    accessorKey: 'wins',
    header: 'Wins',
    cell: ({ row }) => <span className="font-semibold text-green-600 dark:text-green-400">{row.original.wins}</span>,
  },
  {
    accessorKey: 'losses',
    header: 'Losses',
    cell: ({ row }) => <span className="font-semibold text-red-600 dark:text-red-400">{row.original.losses}</span>,
  },
  {
    accessorKey: 'winPercentage',
    header: 'Win %',
    cell: ({ row }) => `${row.original.winPercentage}%`,
  },
  {
    accessorKey: 'pointsFor',
    header: 'Points For',
    cell: ({ row }) => row.original.pointsFor.toLocaleString(),
  },
  {
    accessorKey: 'pointsAgainst',
    header: 'Points Against',
    cell: ({ row }) => row.original.pointsAgainst.toLocaleString(),
  },
  { accessorKey: 'tournament', header: 'Tournament' },
];

function mapApiPlayerToDisplay(p: ApiPlayer): PlayerDisplay {
  const rawDob = p.dateOfBirth;
  const dobInput = rawDob ? (typeof rawDob === 'string' && rawDob.length >= 10 ? rawDob.slice(0, 10) : String(rawDob)) : '';
  return {
    id: p.id,
    name: p.firstName,
    surname: p.lastName,
    number: String(p.jerseyNumber ?? ''),
    position: typeof p.position === 'string' ? p.position : (p.position as string),
    image: resolvePlayerPhotoUrl((p as { photo?: string }).photo, p.id),
    country: (p as { country?: string }).country ?? '',
    height: p.height ?? '',
    dob: dobInput,
    isCaptain: (p as { isCaptain?: boolean }).isCaptain,
  };
}

const TeamDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'players' | 'stats'>('overview');
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [addPlayerSelectedId, setAddPlayerSelectedId] = useState('');
  const [addPlayerJersey, setAddPlayerJersey] = useState('');
  const [newPlayer, setNewPlayer] = useState({ name: '', surname: '', number: '', position: 'POINT_GUARD' as string });
  const [releasingPlayer, setReleasingPlayer] = useState<PlayerDisplay | null>(null);
  const [releaseDate, setReleaseDate] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<PlayerDisplay | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    jerseyNumber: '',
    position: 'POINT_GUARD',
    country: '',
    height: '',
    dob: '',
  });
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPortraitPreview, setEditPortraitPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const teamQuery = useTeam(id ?? null);
  const playersQuery = usePlayers(id ?? undefined);
  const unassignedPlayersQuery = usePlayers(undefined, { unassigned: true });
  const createPlayer = useCreatePlayerForTeam();
  const assignPlayer = useAssignPlayerToTeam();
  const removePlayer = useRemovePlayerFromTeam();
  const deleteTeam = useDeleteTeam();
  const setCaptain = useSetTeamCaptain();
  const updatePlayer = useUpdatePlayer();
  const uploadFile = useUploadFile();
  const updateTeam = useUpdateTeam();
  const { confirm, dialogProps } = useConfirmDialog();
  const toast = useToast();

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
      logo: (team as { logo?: string }).logo ?? null,
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
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading team...</p>
      </div>
    );
  }
  if (teamQuery.error || (!teamQuery.isPending && !team && id)) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <p className="text-error-600 dark:text-error-500">{teamQuery.error?.message ?? 'Team not found'}</p>
        <button onClick={() => navigate('/teams-management')} className="ml-4 text-brand-600 dark:text-brand-400">Back to Teams</button>
      </div>
    );
  }
  if (!teamData) return null;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
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
                  toast.info('Edit team functionality - would open edit modal or navigate to edit page');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors backdrop-blur-sm"
                title="Edit Team"
              >
                <FiEdit2 size={18} />
                <span className="font-medium">Edit</span>
              </button>
              <button
                onClick={async () => {
                  const ok = await confirm({
                    description: `Are you sure you want to delete ${teamData.name}? This action cannot be undone.`,
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  });
                  if (ok) {
                    deleteTeam.mutate(teamData.id, { onSuccess: () => navigate('/teams-management'), onError: (e) => toast.error(e.message) });
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
                <label className="mt-2 inline-block px-3 py-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 text-white rounded-lg cursor-pointer transition-colors">
                  {logoFile || updateTeam.isPending ? (updateTeam.isPending ? 'Uploading...' : 'Selected') : 'Change logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label="Upload team logo"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !id) return;
                      setLogoFile(file);
                      try {
                        const res = await uploadFile.mutateAsync(file);
                        await updateTeam.mutateAsync({ id, data: { logo: res.url } });
                        teamQuery.refetch();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Upload failed');
                      } finally {
                        setLogoFile(null);
                        e.target.value = '';
                      }
                    }}
                    disabled={updateTeam.isPending}
                  />
                </label>
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
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'overview'
                    ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'history'
                    ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                History
              </button>
              <button
                onClick={() => setActiveTab('players')}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'players'
                    ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                Players
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-6 py-3 font-medium text-sm transition-colors ${
                  activeTab === 'stats'
                    ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
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
              <div className="mb-8 bg-white rounded-lg p-6 border border-gray-200 shadow-sm dark:bg-gray-900 dark:border-gray-800">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Team Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Arena</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{teamData.arena}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Capacity: {teamData.capacity}</p>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Home Record</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{teamData.homeRecord}</p>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Away Record</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{teamData.awayRecord}</p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Contact Email</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{teamData.email}</p>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Phone</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{teamData.phone}</p>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Website</p>
                      <p className="text-lg font-semibold text-brand-600 dark:text-brand-300 hover:underline">{teamData.website}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Players Section */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Current Players</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamPlayers.map((player) => (
                <div
                  key={player.id}
                  onClick={() => navigate(`/players-management/${player.id}`)}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow dark:bg-white/[0.02] dark:border-gray-800"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden">
                      <img
                        src={player.image}
                        onError={handlePhotoLoadError(player.id)}
                        alt={`${player.name} ${player.surname}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-900 dark:text-white">#{player.number}</span>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {player.name} {player.surname}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{player.position}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coaching Staff Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Coaching Staff</h2>
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 dark:bg-white/[0.02] dark:border-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {coachingStaff.map((staff) => (
                  <div key={staff.id} className="text-center">
                    <div className="mb-2">
                      <FiUsers className="text-3xl text-gray-400 dark:text-gray-500 mx-auto" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{staff.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{staff.role}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{staff.country}</p>
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
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                  <GiTrophy className="text-yellow-500" />
                  Championships
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {championships.map((champ) => (
                    <div
                      key={champ.id}
                      className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6 border border-yellow-200 dark:from-yellow-500/10 dark:to-yellow-500/5 dark:border-yellow-500/30"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <GiTrophy className="text-3xl text-yellow-600 dark:text-yellow-500" />
                        <div>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{champ.year}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{champ.tournament}</p>
                        </div>
                      </div>
                      <div className="border-t border-yellow-300 dark:border-yellow-500/30 pt-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Defeated</p>
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">{champ.opponent}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">Score: {champ.score}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Match History Section */}
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Match History</h2>
                <div className="space-y-4">
                  {matchHistory.map((match) => (
                    <div
                      key={match.id}
                      className="bg-gray-50 rounded-lg p-5 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow dark:bg-white/[0.02] dark:border-gray-800"
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
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">{teamData.name}</span>
                            <span className={`text-sm font-semibold ${
                              match.result === 'win' ? 'text-green-600 dark:text-green-400' : 'text-gray-800 dark:text-gray-200'
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
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">{match.opponent}</span>
                            <span className={`text-sm font-semibold ${
                              match.result === 'loss' ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'
                            }`}>
                              {match.score.split(' - ')[1]}
                            </span>
                          </div>
                        </div>

                        {/* Right side - Match Info */}
                        <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                          <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">{match.tournament}</p>
                          <p>{match.venue}</p>
                          <p>{match.date}</p>
                          {match.season && <p className="text-gray-400 dark:text-gray-500">{match.season}</p>}
                          <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                            match.result === 'win' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400' 
                              : 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400'
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
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Current Players</h2>
                <button
                  onClick={() => setIsAddPlayerOpen(true)}
                  className="px-5 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors"
                >
                  Add Player
                </button>
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Team captain</label>
                <select
                  aria-label="Team captain"
                  value={teamPlayers.find((p) => p.isCaptain)?.id ?? ''}
                  onChange={(e) => {
                    const playerId = e.target.value;
                    if (!id || !playerId) return;
                    setCaptain.mutate(
                      { teamId: id, playerId, body: { isCaptain: true } },
                      { onError: (err) => toast.error(err.message) }
                    );
                  }}
                  disabled={setCaptain.isPending || teamPlayers.length === 0}
                  className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">Select captain</option>
                  {teamPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.surname} {p.number ? `#${p.number}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {playersQuery.isPending ? (
                  <p className="text-gray-500 dark:text-gray-400 col-span-full">Loading players...</p>
                ) : (
                teamPlayers.map((player) => (
                  <div
                    key={player.id}
                    onClick={() => navigate(`/players-management/${player.id}`)}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow dark:bg-white/[0.02] dark:border-gray-800"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full overflow-hidden">
                        <img
                          src={player.image}
                          onError={handlePhotoLoadError(player.id)}
                          alt={`${player.name} ${player.surname}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-gray-900 dark:text-white">#{player.number}</span>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {player.name} {player.surname}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {POSITION_OPTIONS.find((o) => o.value === player.position)?.label ?? player.position.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPlayer(player);
                            setEditForm({
                              firstName: player.name,
                              lastName: player.surname,
                              jerseyNumber: player.number,
                              position: (() => {
                                const pos = player.position.replace(/ /g, '_').toUpperCase();
                                return POSITION_OPTIONS.some((o) => o.value === pos) ? pos : 'POINT_GUARD';
                              })(),
                              country: player.country,
                              height: player.height,
                              dob: player.dob,
                            });
                            setEditPhotoFile(null);
                            setEditPortraitPreview(null);
                          }}
                          className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors dark:text-brand-400 dark:hover:bg-brand-500/10"
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
                          className="p-2 text-warning-600 hover:bg-warning-50 rounded-lg transition-colors dark:text-warning-500 dark:hover:bg-warning-500/10"
                          title="Remove from team"
                        >
                          <FiUserMinus size={18} />
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
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg w-full max-w-md overflow-hidden dark:bg-gray-900">
                <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Release Player</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Select release date for {releasingPlayer.name} {releasingPlayer.surname}
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  <input
                    type="date"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                  />
                </div>
                <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                  <button
                    onClick={() => setReleasingPlayer(null)}
                    className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!id) return;
                      removePlayer.mutate(
                        { playerId: releasingPlayer.id, teamId: id },
                        { onSuccess: () => { setReleasingPlayer(null); setReleaseDate(''); }, onError: (e) => toast.error(e.message) }
                      );
                    }}
                    disabled={removePlayer.isPending}
                    className="px-5 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors disabled:opacity-70"
                  >
                    {removePlayer.isPending ? 'Removing...' : 'Remove from team'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add Player Modal - assign unassigned player */}
          {isAddPlayerOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg w-full max-w-lg overflow-hidden dark:bg-gray-900">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between dark:border-gray-800">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add Player</h3>
                  <button
                    onClick={() => { setIsAddPlayerOpen(false); setAddPlayerSelectedId(''); setAddPlayerJersey(''); }}
                    className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                    title="Close"
                  >
                    ×
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Select player (unassigned)</label>
                    <select
                      value={addPlayerSelectedId}
                      onChange={(e) => setAddPlayerSelectedId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      aria-label="Select unassigned player"
                    >
                      <option value="">Select a player</option>
                      {(unassignedPlayersQuery.data ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName}
                          {(p as { email?: string }).email ? ` (${(p as { email?: string }).email})` : ''}
                        </option>
                      ))}
                    </select>
                    {unassignedPlayersQuery.isPending && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Loading players...</p>}
                    {!unassignedPlayersQuery.isPending && (unassignedPlayersQuery.data ?? []).length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">No unassigned players. Create one from Players.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Jersey number (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 24"
                      value={addPlayerJersey}
                      onChange={(e) => setAddPlayerJersey(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                  <button
                    onClick={() => { setIsAddPlayerOpen(false); setAddPlayerSelectedId(''); setAddPlayerJersey(''); }}
                    className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!addPlayerSelectedId || !id) {
                        toast.error('Please select a player');
                        return;
                      }
                      const jerseyNum = addPlayerJersey.trim() ? parseInt(addPlayerJersey, 10) : undefined;
                      if (addPlayerJersey.trim() && Number.isNaN(jerseyNum!)) {
                        toast.error('Jersey number must be a number');
                        return;
                      }
                      assignPlayer.mutate(
                        {
                          playerId: addPlayerSelectedId,
                          teamId: id,
                          body: jerseyNum != null ? { jerseyNumber: jerseyNum } : undefined,
                        },
                        {
                          onSuccess: () => {
                            setAddPlayerSelectedId('');
                            setAddPlayerJersey('');
                            setIsAddPlayerOpen(false);
                          },
                          onError: (e) => toast.error(e.message),
                        }
                      );
                    }}
                    disabled={assignPlayer.isPending || !addPlayerSelectedId}
                    className="px-5 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors disabled:opacity-70"
                  >
                    {assignPlayer.isPending ? 'Assigning...' : 'Assign to team'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Player Modal - aligned with system Players tab */}
          {editingPlayer && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-900">
                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Player</h3>
                  <button
                    onClick={() => {
                      setEditingPlayer(null);
                      setEditPhotoFile(null);
                      setEditPortraitPreview(null);
                    }}
                    className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                    title="Close"
                  >
                    ×
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Player portrait (optional)</label>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border border-gray-300 flex-shrink-0 dark:bg-white/5 dark:border-gray-700">
                        {editPortraitPreview ? (
                          <img src={editPortraitPreview} alt="Portrait preview" className="w-full h-full object-cover" />
                        ) : (
                          <img
                            src={editingPlayer.image}
                            onError={handlePhotoLoadError(editingPlayer.id)}
                            alt="Current portrait"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/*"
                        className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-brand-50 file:text-brand-700 dark:file:bg-brand-500/10 dark:file:text-brand-400"
                        aria-label="Upload player photo"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setEditPhotoFile(file);
                            setEditPortraitPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">First name *</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Last name *</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Jersey number *</label>
                    <input
                      type="text"
                      value={editForm.jerseyNumber}
                      onChange={(e) => setEditForm((f) => ({ ...f, jerseyNumber: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Position</label>
                    <select
                      aria-label="Position"
                      value={editForm.position}
                      onChange={(e) => setEditForm((f) => ({ ...f, position: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    >
                      {POSITION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Country</label>
                    <input
                      type="text"
                      placeholder="Enter country"
                      value={editForm.country}
                      onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Height</label>
                    <input
                      type="text"
                      placeholder="e.g. 6'3&quot;"
                      value={editForm.height}
                      onChange={(e) => setEditForm((f) => ({ ...f, height: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Date of birth</label>
                    <input
                      type="date"
                      value={editForm.dob}
                      onChange={(e) => setEditForm((f) => ({ ...f, dob: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                    />
                  </div>
                </div>
                <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setEditingPlayer(null);
                      setEditPhotoFile(null);
                      setEditPortraitPreview(null);
                    }}
                    className="px-5 py-2.5 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!editingPlayer) return;
                      let photoUrl: string | undefined;
                      if (editPhotoFile) {
                        try {
                          const res = await uploadFile.mutateAsync(editPhotoFile);
                          photoUrl = res.url;
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Photo upload failed');
                          return;
                        }
                      }
                      const jerseyNum = editForm.jerseyNumber.trim() ? parseInt(editForm.jerseyNumber, 10) : undefined;
                      updatePlayer.mutate(
                        {
                          id: editingPlayer.id,
                          data: {
                            firstName: editForm.firstName,
                            lastName: editForm.lastName,
                            ...(jerseyNum != null && !Number.isNaN(jerseyNum) ? { jerseyNumber: jerseyNum } : {}),
                            ...(id ? { teamId: id } : {}),
                            ...(photoUrl ? { photo: photoUrl } : {}),
                            position: editForm.position as ApiPlayer['position'],
                            country: editForm.country || undefined,
                            height: editForm.height || undefined,
                            dateOfBirth: editForm.dob || undefined,
                          },
                        },
                        {
                          onSuccess: () => {
                            setEditingPlayer(null);
                            setEditPhotoFile(null);
                            setEditPortraitPreview(null);
                          },
                          onError: (e) => toast.error(e.message),
                        }
                      );
                    }}
                    disabled={updatePlayer.isPending || uploadFile.isPending}
                    className="px-5 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors disabled:opacity-70"
                  >
                    {updatePlayer.isPending || uploadFile.isPending ? 'Saving...' : 'Save'}
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
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                  <FiTrendingUp className="text-blue-600 dark:text-brand-400" />
                  Season Statistics
                </h2>
                <DataTable columns={seasonStatsColumns} data={seasonStats} emptyMessage="No season statistics yet." />
              </div>

              {/* Team Achievements */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                  <FiAward className="text-purple-600 dark:text-purple-400" />
                  Achievements
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200 text-center dark:from-blue-500/10 dark:to-blue-500/5 dark:border-blue-500/30">
                    <GiTrophy className="text-4xl text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{teamData.championships}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Championships</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200 text-center dark:from-green-500/10 dark:to-green-500/5 dark:border-green-500/30">
                    <FiTrendingUp className="text-4xl text-green-600 dark:text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{teamData.winPercentage}%</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Win Percentage</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200 text-center dark:from-purple-500/10 dark:to-purple-500/5 dark:border-purple-500/30">
                    <FiAward className="text-4xl text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{teamData.totalMatches}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Matches</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6 border border-yellow-200 text-center dark:from-yellow-500/10 dark:to-yellow-500/5 dark:border-yellow-500/30">
                    <FiCalendar className="text-4xl text-yellow-600 dark:text-yellow-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{teamData.founded}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Founded</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default TeamDetails;

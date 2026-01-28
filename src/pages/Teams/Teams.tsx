import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFilter, FiChevronDown, FiMapPin, FiEdit2, FiTrash } from 'react-icons/fi';
import { GiBasketballBall } from 'react-icons/gi';
import { MdCancel } from 'react-icons/md';

// Simple country/state data for dropdowns
const countriesData: Record<string, string[]> = {
  'United States': ['California', 'Texas', 'Florida', 'New York', 'Illinois', 'Massachusetts', 'Oklahoma'],
  'Canada': ['Ontario', 'Quebec', 'British Columbia', 'Alberta'],
  'United Kingdom': ['England', 'Scotland', 'Wales'],
};

interface Team {
  id: number;
  name: string;
  shortName: string;
  shortTeamCode: string;
  longTeamCode: string;
  teamColor: string;
  country: string;
  state: string;
  logo: string | null;
  tournamentId: number;
  tournamentName: string;
  session?: string;
  status: 'active' | 'inactive';
  coachingStaff?: {
    id: number;
    name: string;
    role: string;
    country: string;
  }[];
}

const Teams: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [tournamentFilter, setTournamentFilter] = useState<string>('All');
  const [sessionFilter, setSessionFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const itemsPerPage = 9;

  // Initialize teams data
  React.useEffect(() => {
    setTeams([
    {
      id: 1,
      name: 'Lakers',
      shortName: 'LAL',
      shortTeamCode: 'LAL',
      longTeamCode: 'LAKERS',
      teamColor: '#552583',
      country: 'United States',
      state: 'California',
      logo: null,
      tournamentId: 1,
      tournamentName: 'KCBL Club Championship',
      session: '2024-2025',
      status: 'active',
    },
    {
      id: 2,
      name: 'Warriors',
      shortName: 'GSW',
      shortTeamCode: 'GSW',
      longTeamCode: 'WARRIORS',
      teamColor: '#1D428A',
      country: 'United States',
      state: 'California',
      logo: null,
      tournamentId: 1,
      tournamentName: 'KCBL Club Championship',
      session: '2024-2025',
      status: 'active',
    },
    {
      id: 3,
      name: 'Bulls',
      shortName: 'CHI',
      shortTeamCode: 'CHI',
      longTeamCode: 'BULLS',
      teamColor: '#CE1141',
      country: 'United States',
      state: 'Illinois',
      logo: null,
      tournamentId: 1,
      tournamentName: 'KCBL Club Championship',
      session: '2024-2025',
      status: 'active',
    },
    {
      id: 4,
      name: 'Celtics',
      shortName: 'BOS',
      shortTeamCode: 'BOS',
      longTeamCode: 'CELTICS',
      teamColor: '#007A33',
      country: 'United States',
      state: 'Massachusetts',
      logo: null,
      tournamentId: 2,
      tournamentName: 'Premier League',
      session: '2023-2024',
      status: 'active',
    },
    {
      id: 5,
      name: 'Heat',
      shortName: 'MIA',
      shortTeamCode: 'MIA',
      longTeamCode: 'HEAT',
      teamColor: '#98002E',
      country: 'United States',
      state: 'Florida',
      logo: null,
      tournamentId: 2,
      tournamentName: 'Premier League',
      session: '2023-2024',
      status: 'active',
    },
    {
      id: 6,
      name: 'Nets',
      shortName: 'BKN',
      shortTeamCode: 'BKN',
      longTeamCode: 'NETS',
      teamColor: '#000000',
      country: 'United States',
      state: 'New York',
      logo: null,
      tournamentId: 2,
      tournamentName: 'Premier League',
      session: '2023-2024',
      status: 'inactive',
    },
    {
      id: 7,
      name: 'Rockets',
      shortName: 'HOU',
      shortTeamCode: 'HOU',
      longTeamCode: 'ROCKETS',
      teamColor: '#CE1141',
      country: 'United States',
      state: 'Texas',
      logo: null,
      tournamentId: 3,
      tournamentName: 'Division 1',
      session: '2024-2025',
      status: 'active',
    },
    {
      id: 8,
      name: 'Spurs',
      shortName: 'SAS',
      shortTeamCode: 'SAS',
      longTeamCode: 'SPURS',
      teamColor: '#C4CED4',
      country: 'United States',
      state: 'Texas',
      logo: null,
      tournamentId: 3,
      tournamentName: 'Division 1',
      session: '2024-2025',
      status: 'active',
    },
    {
      id: 9,
      name: 'Thunder',
      shortName: 'OKC',
      shortTeamCode: 'OKC',
      longTeamCode: 'THUNDER',
      teamColor: '#007AC1',
      country: 'United States',
      state: 'Oklahoma',
      logo: null,
      tournamentId: 3,
      tournamentName: 'Division 1',
      session: '2024-2025',
      status: 'inactive',
    },
    {
      id: 10,
      name: 'Knicks',
      shortName: 'NYK',
      shortTeamCode: 'NYK',
      longTeamCode: 'KNICKS',
      teamColor: '#F58426',
      country: 'United States',
      state: 'New York',
      logo: null,
      tournamentId: 1,
      tournamentName: 'KCBL Club Championship',
      session: '2024-2025',
      status: 'active',
    },
    {
      id: 11,
      name: 'Mavericks',
      shortName: 'DAL',
      shortTeamCode: 'DAL',
      longTeamCode: 'MAVERICKS',
      teamColor: '#00538C',
      country: 'United States',
      state: 'Texas',
      logo: null,
      tournamentId: 2,
      tournamentName: 'Premier League',
      session: '2023-2024',
      status: 'active',
    },
    {
      id: 12,
      name: 'Clippers',
      shortName: 'LAC',
      shortTeamCode: 'LAC',
      longTeamCode: 'CLIPPERS',
      teamColor: '#C8102E',
      country: 'United States',
      state: 'California',
      logo: null,
      tournamentId: 1,
      tournamentName: 'KCBL Club Championship',
      session: '2024-2025',
      status: 'inactive',
    },
    ]);
  }, []);

  // Form state for Add/Edit Team
  const [formData, setFormData] = useState({
    name: '',
    shortTeamCode: '',
    longTeamCode: '',
    teamColor: '#21409A',
    country: '',
    state: '',
    tournamentId: 1,
    tournamentName: '',
    session: '',
    status: 'active' as 'active' | 'inactive',
    coachingStaff: [
      { id: 1, name: '', role: 'Coach', country: '' },
      { id: 2, name: '', role: 'Assistant Coach', country: '' },
    ] as { id: number; name: string; role: string; country: string }[],
  });

  // Get unique tournaments and sessions for filters / dropdowns
  const uniqueTournaments = Array.from(new Set(teams.map(t => t.tournamentName))).sort();
  const uniqueSessions = Array.from(new Set(teams.map(t => t.session).filter(Boolean))).sort();
  const seasonOptions = uniqueSessions.length > 0 ? uniqueSessions : ['2023-2024', '2024-2025'];

  // Filter teams by search query and filters
  const filteredTeams = useMemo(() => {
    let filtered = teams;

    // Filter by status
    if (statusFilter !== 'All') {
      filtered = filtered.filter(team => team.status === statusFilter.toLowerCase());
    }

    // Filter by tournament
    if (tournamentFilter !== 'All') {
      filtered = filtered.filter(team => team.tournamentName === tournamentFilter);
    }

    // Filter by session
    if (sessionFilter !== 'All') {
      filtered = filtered.filter(team => team.session === sessionFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(team =>
        team.name.toLowerCase().includes(query) ||
        team.shortTeamCode.toLowerCase().includes(query) ||
        team.longTeamCode.toLowerCase().includes(query) ||
        team.tournamentName.toLowerCase().includes(query) ||
        team.country.toLowerCase().includes(query) ||
        team.state.toLowerCase().includes(query) ||
        (team.session && team.session.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [searchQuery, statusFilter, tournamentFilter, sessionFilter, teams]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredTeams.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTeams = filteredTeams.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, tournamentFilter, sessionFilter, searchQuery]);

  const handleTeamClick = (team: Team) => {
    navigate(`/teams-management/${team.id}`);
  };

  const handleAddTeam = () => {
    setEditingTeam(null);
    setFormData({
      name: '',
      shortTeamCode: '',
      longTeamCode: '',
      teamColor: '#21409A',
      country: '',
      state: '',
      tournamentId: 1,
      tournamentName: '',
      session: '',
      status: 'active',
      coachingStaff: [
        { id: 1, name: '', role: 'Coach', country: '' },
        { id: 2, name: '', role: 'Assistant Coach', country: '' },
      ],
    });
    setIsModalOpen(true);
  };

  const handleEditTeam = (team: Team, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTeam(team);
    setFormData({
      name: team.name,
      shortTeamCode: team.shortTeamCode,
      longTeamCode: team.longTeamCode,
      teamColor: team.teamColor,
      country: team.country,
      state: team.state,
      tournamentId: team.tournamentId,
      tournamentName: team.tournamentName,
      session: team.session || '',
      status: team.status,
      coachingStaff:
        team.coachingStaff && team.coachingStaff.length > 0
          ? team.coachingStaff
          : [
              { id: 1, name: '', role: 'Coach', country: '' },
              { id: 2, name: '', role: 'Assistant Coach', country: '' },
            ],
    });
    setIsModalOpen(true);
  };

  const handleDeleteTeam = (team: Team, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete ${team.name}? This action cannot be undone.`)) {
      setTeams(teams.filter(t => t.id !== team.id));
      alert('Team deleted successfully!');
    }
  };

  const handleSaveTeam = () => {
    if (!formData.name || !formData.shortTeamCode || !formData.longTeamCode) {
      alert('Please fill in all required fields');
      return;
    }

    if (editingTeam) {
      setTeams(teams.map(t => 
        t.id === editingTeam.id 
          ? { 
              ...t, 
              name: formData.name,
              shortTeamCode: formData.shortTeamCode,
              longTeamCode: formData.longTeamCode,
              teamColor: formData.teamColor,
              country: formData.country,
              state: formData.state,
              tournamentId: formData.tournamentId,
              tournamentName: formData.tournamentName,
              session: formData.session,
              status: formData.status,
              coachingStaff: formData.coachingStaff
            }
          : t
      ));
      alert('Team updated successfully!');
    } else {
      const newTeam: Team = {
        id: Math.max(...teams.map(t => t.id), 0) + 1,
        name: formData.name,
        shortName: formData.shortTeamCode,
        shortTeamCode: formData.shortTeamCode,
        longTeamCode: formData.longTeamCode,
        teamColor: formData.teamColor,
        country: formData.country,
        state: formData.state,
        logo: null,
        tournamentId: formData.tournamentId,
        tournamentName: formData.tournamentName,
        session: formData.session,
        status: formData.status,
        coachingStaff: formData.coachingStaff,
      };
      setTeams([...teams, newTeam]);
      alert('Team created successfully!');
    }

    setIsModalOpen(false);
    setEditingTeam(null);
    setFormData({
      name: '',
      shortTeamCode: '',
      longTeamCode: '',
      teamColor: '#21409A',
      country: '',
      state: '',
      tournamentId: 1,
      tournamentName: '',
      session: '',
      status: 'active',
      coachingStaff: [
        { id: 1, name: '', role: 'Coach', country: '' },
        { id: 2, name: '', role: 'Assistant Coach', country: '' },
      ],
    });
  };

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Teams</h1>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {/* Add Team Button */}
        <button 
          onClick={handleAddTeam}
          className="px-6 py-3 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors whitespace-nowrap"
        >
          Add Team
        </button>

        {/* Search Bar - Reduced Width */}
        <div className="relative" style={{ width: '250px', minWidth: '200px' }}>
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search Team"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer min-w-[140px]"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        </div>

        {/* Tournament Filter */}
        <div className="relative">
          <select
            value={tournamentFilter}
            onChange={(e) => setTournamentFilter(e.target.value)}
            className="appearance-none pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer min-w-[180px]"
          >
            <option value="All">All Tournaments</option>
            {uniqueTournaments.map((tournament) => (
              <option key={tournament} value={tournament}>{tournament}</option>
            ))}
          </select>
          <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        </div>

        {/* Session Filter */}
        <div className="relative">
          <select
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            className="appearance-none pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer min-w-[160px]"
          >
            <option value="All">All Sessions</option>
            {uniqueSessions.map((session) => (
              <option key={session} value={session}>{session}</option>
            ))}
          </select>
          <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        </div>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {paginatedTeams.map((team) => (
          <div
            key={team.id}
            onClick={() => handleTeamClick(team)}
            className="bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
          >
            {/* Team Logo/Color Section */}
            <div 
              className="w-full h-48 relative flex items-center justify-center"
              style={{ backgroundColor: team.teamColor }}
            >
              {team.logo ? (
                <img
                  src={team.logo}
                  alt={team.name}
                  className="w-24 h-24 object-contain"
                />
              ) : (
                <GiBasketballBall className="text-white text-6xl opacity-80" />
              )}
              {/* Status Badge */}
              <div className="absolute top-3 right-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTeams(teams.map(t => 
                      t.id === team.id 
                        ? { ...t, status: t.status === 'active' ? 'inactive' : 'active' }
                        : t
                    ));
                  }}
                  className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                    team.status === 'active' 
                      ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                  title="Click to toggle status"
                >
                  {team.status === 'active' ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold text-gray-900">{team.name}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleEditTeam(team, e)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Team"
                  >
                    <FiEdit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteTeam(team, e)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Team"
                  >
                      <FiTrash size={16} />
                  </button>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Code:</span>
                  <span>{team.shortTeamCode} / {team.longTeamCode}</span>
                </div>
                <div>
                  <span className="font-medium">Tournament:</span>
                  <span className="ml-2">{team.tournamentName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FiMapPin size={16} className="text-gray-400" />
                  <span>{team.state}, {team.country}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {paginatedTeams.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No teams found</p>
          <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentPage === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Previous
          </button>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                currentPage === page
                  ? 'bg-blue-900 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              currentPage === totalPages
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            Next
          </button>
        </div>
      )}

      {/* Add/Edit Team Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-semibold text-gray-900">
                {editingTeam ? 'Edit Team' : 'Add Team'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTeam(null);
                  setFormData({
                    name: '',
                    shortTeamCode: '',
                    longTeamCode: '',
                    teamColor: '#21409A',
                    country: '',
                    state: '',
                    tournamentId: 1,
                    tournamentName: 'KCBL Club Championship',
                    status: 'active',
                  });
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <MdCancel size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Team Name *</label>
                  <input
                    type="text"
                    placeholder="Enter team name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Short Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Short Team Code *</label>
                  <input
                    type="text"
                    placeholder="e.g., LAL"
                    value={formData.shortTeamCode}
                    onChange={(e) => setFormData({ ...formData, shortTeamCode: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={10}
                  />
                </div>

                {/* Long Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Long Team Code *</label>
                  <input
                    type="text"
                    placeholder="e.g., LAKERS"
                    value={formData.longTeamCode}
                    onChange={(e) => setFormData({ ...formData, longTeamCode: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={20}
                  />
                </div>

                {/* Team Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Team Color</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={formData.teamColor}
                      onChange={(e) => setFormData({ ...formData, teamColor: e.target.value })}
                      className="w-20 h-10 border border-gray-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.teamColor}
                      onChange={(e) => setFormData({ ...formData, teamColor: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="#21409A"
                    />
                  </div>
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <select
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        country: e.target.value,
                        state: '',
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select country</option>
                    {Object.keys(countriesData).map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>

                {/* State */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    disabled={!formData.country}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select state</option>
                    {formData.country &&
                      countriesData[formData.country]?.map((stateName) => (
                        <option key={stateName} value={stateName}>
                          {stateName}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Tournament */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Competition</label>
                  <select
                    value={formData.tournamentName}
                    onChange={(e) => setFormData({ ...formData, tournamentName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select competition</option>
                    {(uniqueTournaments.length ? uniqueTournaments : ['KCBL Club Championship', 'Premier League', 'Division 1']).map(
                      (tournament) => (
                        <option key={tournament} value={tournament}>
                          {tournament}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* Session */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Season</label>
                  <select
                    value={formData.session}
                    onChange={(e) => setFormData({ ...formData, session: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select season</option>
                    {seasonOptions.map((season) => (
                      <option key={season} value={season}>
                        {season}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                {/* Coaching Staff */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Coaching Staff</label>
                    <button
                      type="button"
                      onClick={() => {
                        const nextId =
                          Math.max(0, ...formData.coachingStaff.map((s) => s.id)) + 1;
                        setFormData({
                          ...formData,
                          coachingStaff: [
                            ...formData.coachingStaff,
                            { id: nextId, name: '', role: 'Assistant Coach', country: '' },
                          ],
                        });
                      }}
                      className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      Add Staff
                    </button>
                  </div>

                  <div className="space-y-3">
                    {formData.coachingStaff.map((staff) => (
                      <div
                        key={staff.id}
                        className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-gray-50 border border-gray-200 rounded-lg p-3"
                      >
                        <div className="md:col-span-5">
                          <input
                            type="text"
                            placeholder="Name Surname"
                            value={staff.name}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                coachingStaff: formData.coachingStaff.map((s) =>
                                  s.id === staff.id ? { ...s, name: e.target.value } : s
                                ),
                              });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>

                        <div className="md:col-span-4">
                          <select
                            value={staff.role}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                coachingStaff: formData.coachingStaff.map((s) =>
                                  s.id === staff.id ? { ...s, role: e.target.value } : s
                                ),
                              });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                          >
                            <option value="Coach">Coach</option>
                            <option value="Head Coach">Head Coach</option>
                            <option value="Assistant Coach">Assistant Coach</option>
                            <option value="Trainer">Trainer</option>
                          </select>
                        </div>

                        <div className="md:col-span-3 flex items-center gap-2">
                          <select
                            value={staff.country}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                coachingStaff: formData.coachingStaff.map((s) =>
                                  s.id === staff.id ? { ...s, country: e.target.value } : s
                                ),
                              });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                          >
                            <option value="">Country</option>
                            {Object.keys(countriesData).map((country) => (
                              <option key={country} value={country}>
                                {country}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                coachingStaff: formData.coachingStaff.filter((s) => s.id !== staff.id),
                              });
                            }}
                            className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            title="Remove"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-4 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTeam(null);
                  setFormData({
                    name: '',
                    shortTeamCode: '',
                    longTeamCode: '',
                    teamColor: '#21409A',
                    country: '',
                    state: '',
                    tournamentId: 1,
                    tournamentName: '',
                    session: '',
                    status: 'active',
                    coachingStaff: [
                      { id: 1, name: '', role: 'Coach', country: '' },
                      { id: 2, name: '', role: 'Assistant Coach', country: '' },
                    ],
                  });
                }}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTeam}
                className="px-6 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
              >
                {editingTeam ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teams;

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFilter, FiChevronDown, FiEdit2, FiTrash, FiLogOut } from 'react-icons/fi';
import { MdCancel } from 'react-icons/md';

interface Player {
  id: number;
  name: string;
  surname: string;
  number: string;
  image: string;
  teamId: number;
  teamName: string;
  tournamentId: number;
  tournamentName: string;
  position: string;
  country: string;
  height: string;
  dob: string;
  status: 'active' | 'inactive';
  releaseDate?: string;
}

const Players: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [teamFilter, setTeamFilter] = useState<string>('All');
  const [tournamentFilter, setTournamentFilter] = useState<string>('All');
  const [positionFilter, setPositionFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [releasePlayer, setReleasePlayer] = useState<Player | null>(null);
  const [releaseDate, setReleaseDate] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([
    {
      id: 1,
      name: 'John',
      surname: 'Doe',
      number: '23',
      image: '/player1.png',
      teamId: 1,
      teamName: 'Lakers',
      tournamentId: 1,
      tournamentName: 'KCBL Club Championship',
      position: 'Point Guard',
      country: 'United States',
      height: '6\'3"',
      dob: '1995-05-15',
      status: 'active',
    },
    {
      id: 2,
      name: 'Jane',
      surname: 'Smith',
      number: '24',
      image: '/player1.png',
      teamId: 1,
      teamName: 'Lakers',
      tournamentId: 1,
      tournamentName: 'KCBL Club Championship',
      position: 'Shooting Guard',
      country: 'United States',
      height: '6\'0"',
      dob: '1997-08-20',
      status: 'active',
    },
    {
      id: 3,
      name: 'Mike',
      surname: 'Johnson',
      number: '30',
      image: '/player1.png',
      teamId: 2,
      teamName: 'Warriors',
      tournamentId: 1,
      tournamentName: 'KCBL Club Championship',
      position: 'Small Forward',
      country: 'United States',
      height: '6\'7"',
      dob: '1993-12-10',
      status: 'active',
    },
    {
      id: 4,
      name: 'Sarah',
      surname: 'Williams',
      number: '11',
      image: '/player1.png',
      teamId: 2,
      teamName: 'Warriors',
      tournamentId: 1,
      tournamentName: 'KCBL Club Championship',
      position: 'Power Forward',
      country: 'United States',
      height: '6\'2"',
      dob: '1996-03-25',
      status: 'active',
    },
    {
      id: 5,
      name: 'David',
      surname: 'Brown',
      number: '15',
      image: '/player1.png',
      teamId: 3,
      teamName: 'Bulls',
      tournamentId: 1,
      tournamentName: 'KCBL Club Championship',
      position: 'Center',
      country: 'United States',
      height: '6\'11"',
      dob: '1994-07-05',
      status: 'active',
    },
    {
      id: 6,
      name: 'Emily',
      surname: 'Davis',
      number: '7',
      image: '/player1.png',
      teamId: 3,
      teamName: 'Bulls',
      tournamentId: 1,
      tournamentName: 'KCBL Club Championship',
      position: 'Point Guard',
      country: 'United States',
      height: '5\'10"',
      dob: '1998-01-18',
      status: 'inactive',
    },
    {
      id: 7,
      name: 'Chris',
      surname: 'Miller',
      number: '33',
      image: '/player1.png',
      teamId: 4,
      teamName: 'Celtics',
      tournamentId: 2,
      tournamentName: 'Premier League',
      position: 'Shooting Guard',
      country: 'United States',
      height: '6\'4"',
      dob: '1992-09-30',
      status: 'active',
    },
    {
      id: 8,
      name: 'Lisa',
      surname: 'Wilson',
      number: '21',
      image: '/player1.png',
      teamId: 4,
      teamName: 'Celtics',
      tournamentId: 2,
      tournamentName: 'Premier League',
      position: 'Small Forward',
      country: 'United States',
      height: '6\'1"',
      dob: '1995-11-12',
      status: 'active',
    },
    {
      id: 9,
      name: 'Robert',
      surname: 'Moore',
      number: '5',
      image: '/player1.png',
      teamId: 5,
      teamName: 'Heat',
      tournamentId: 2,
      tournamentName: 'Premier League',
      position: 'Power Forward',
      country: 'United States',
      height: '6\'8"',
      dob: '1991-04-22',
      status: 'active',
    },
    {
      id: 10,
      name: 'Amanda',
      surname: 'Taylor',
      number: '9',
      image: '/player1.png',
      teamId: 5,
      teamName: 'Heat',
      tournamentId: 2,
      tournamentName: 'Premier League',
      position: 'Center',
      country: 'United States',
      height: '6\'5"',
      dob: '1997-06-08',
      status: 'inactive',
    },
    {
      id: 11,
      name: 'James',
      surname: 'Anderson',
      number: '13',
      image: '/player1.png',
      teamId: 6,
      teamName: 'Nets',
      tournamentId: 2,
      tournamentName: 'Premier League',
      position: 'Point Guard',
      country: 'United States',
      height: '6\'0"',
      dob: '1993-02-14',
      status: 'active',
    },
    {
      id: 12,
      name: 'Jessica',
      surname: 'Thomas',
      number: '3',
      image: '/player1.png',
      teamId: 7,
      teamName: 'Rockets',
      tournamentId: 3,
      tournamentName: 'Division 1',
      position: 'Shooting Guard',
      country: 'United States',
      height: '5\'11"',
      dob: '1996-10-28',
      status: 'active',
    },
  ]);
  const itemsPerPage = 10;

  // Form state for Add/Edit Player
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    number: '',
    image: '/player1.png',
    teamId: 1,
    teamName: 'Lakers',
    tournamentId: 1,
    tournamentName: 'KCBL Club Championship',
    position: 'Point Guard',
    country: '',
    height: '',
    dob: '',
    status: 'active' as 'active' | 'inactive',
  });

  // Get unique teams and tournaments for filter
  const uniqueTeams = Array.from(new Set(players.map(p => p.teamName))).sort();
  const uniqueTournaments = Array.from(new Set(players.map(p => p.tournamentName))).sort();
  const uniquePositions = Array.from(new Set(players.map(p => p.position))).sort();

  // Filter players by search query and filters
  const filteredPlayers = useMemo(() => {
    let filtered = players;

    // Filter by status
    if (statusFilter !== 'All') {
      filtered = filtered.filter(player => player.status === statusFilter.toLowerCase());
    }

    // Filter by team
    if (teamFilter !== 'All') {
      filtered = filtered.filter(player => player.teamName === teamFilter);
    }

    // Filter by tournament
    if (tournamentFilter !== 'All') {
      filtered = filtered.filter(player => player.tournamentName === tournamentFilter);
    }

    // Filter by position
    if (positionFilter !== 'All') {
      filtered = filtered.filter(player => player.position === positionFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(player =>
        player.name.toLowerCase().includes(query) ||
        player.surname.toLowerCase().includes(query) ||
        player.number.toLowerCase().includes(query) ||
        player.teamName.toLowerCase().includes(query) ||
        player.tournamentName.toLowerCase().includes(query) ||
        player.position.toLowerCase().includes(query) ||
        player.country.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [searchQuery, statusFilter, teamFilter, tournamentFilter, positionFilter, players]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPlayers = filteredPlayers.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, teamFilter, tournamentFilter, positionFilter, searchQuery]);

  const handlePlayerClick = (player: Player) => {
    navigate(`/tournaments/${player.tournamentId}/match/1/player/${player.id}`, {
      state: { from: 'players-page' }
    });
  };

  const handleEditPlayer = (player: Player, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPlayer(player);
    setFormData({
      name: player.name,
      surname: player.surname,
      number: player.number,
      image: player.image,
      teamId: player.teamId,
      teamName: player.teamName,
      tournamentId: player.tournamentId,
      tournamentName: player.tournamentName,
      position: player.position,
      country: player.country,
      height: player.height,
      dob: player.dob,
      status: player.status,
    });
    setIsModalOpen(true);
  };

  const handleDeletePlayer = (player: Player, e: React.MouseEvent) => {
    e.stopPropagation();
    // Open release modal instead of hard delete
    setReleasePlayer(player);
    setReleaseDate('');
  };

  const handleConfirmRelease = () => {
    if (!releasePlayer) return;
    if (!releaseDate) {
      alert('Please select a release date.');
      return;
    }

    setPlayers(players.map(p =>
      p.id === releasePlayer.id
        ? {
            ...p,
            status: 'inactive',
            teamId: 0,
            teamName: 'Free Agent',
            releaseDate,
          }
        : p
    ));

    alert(`Player ${releasePlayer.name} ${releasePlayer.surname} released successfully!`);
    setReleasePlayer(null);
    setReleaseDate('');
  };

  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setFormData({
      name: '',
      surname: '',
      number: '',
      image: '/player1.png',
      teamId: 1,
      teamName: 'Lakers',
      tournamentId: 1,
      tournamentName: 'KCBL Club Championship',
      position: 'Point Guard',
      country: '',
      height: '',
      dob: '',
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleSavePlayer = () => {
    if (!formData.name || !formData.surname || !formData.number) {
      alert('Please fill in all required fields');
      return;
    }

    // Duplication checks
    // Check for duplicate jersey number in the same team
    const duplicateJersey = players.find(p => 
      p.teamId === formData.teamId && 
      p.number === formData.number &&
      (!editingPlayer || p.id !== editingPlayer.id)
    );
    if (duplicateJersey) {
      alert(`Jersey number ${formData.number} is already taken by another player in ${formData.teamName}. Please choose a different number.`);
      return;
    }

    // Check for duplicate name and surname in the same team (optional but recommended)
    const duplicateName = players.find(p => 
      p.teamId === formData.teamId && 
      p.name.toLowerCase() === formData.name.toLowerCase() &&
      p.surname.toLowerCase() === formData.surname.toLowerCase() &&
      (!editingPlayer || p.id !== editingPlayer.id)
    );
    if (duplicateName) {
      const confirmDuplicate = window.confirm(
        `A player named ${formData.name} ${formData.surname} already exists in ${formData.teamName}. Do you want to continue anyway?`
      );
      if (!confirmDuplicate) {
        return;
      }
    }

    if (editingPlayer) {
      setPlayers(players.map(p => 
        p.id === editingPlayer.id 
          ? { 
              ...p, 
              name: formData.name,
              surname: formData.surname,
              number: formData.number,
              image: formData.image,
              teamId: formData.teamId,
              teamName: formData.teamName,
              tournamentId: formData.tournamentId,
              tournamentName: formData.tournamentName,
              position: formData.position,
              country: formData.country,
              height: formData.height,
              dob: formData.dob,
              status: formData.status
            }
          : p
      ));
      alert('Player updated successfully!');
    } else {
      const newPlayer: Player = {
        id: Math.max(...players.map(p => p.id), 0) + 1,
        name: formData.name,
        surname: formData.surname,
        number: formData.number,
        image: formData.image,
        teamId: formData.teamId,
        teamName: formData.teamName,
        tournamentId: formData.tournamentId,
        tournamentName: formData.tournamentName,
        position: formData.position,
        country: formData.country,
        height: formData.height,
        dob: formData.dob,
        status: formData.status,
      };
      setPlayers([...players, newPlayer]);
      alert('Player created successfully!');
    }

    setIsModalOpen(false);
    setEditingPlayer(null);
    setFormData({
      name: '',
      surname: '',
      number: '',
      image: '/player1.png',
      teamId: 1,
      teamName: 'Lakers',
      tournamentId: 1,
      tournamentName: 'KCBL Club Championship',
      position: 'Point Guard',
      country: '',
      height: '',
      dob: '',
      status: 'active',
    });
  };


  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Players</h1>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {/* Add Player Button */}
        <button 
          onClick={handleAddPlayer}
          className="px-6 py-3 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors whitespace-nowrap"
        >
          Add Player
        </button>

        {/* Search Bar - Reduced Width */}
        <div className="relative" style={{ width: '250px', minWidth: '200px' }}>
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search Player"
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

        {/* Team Filter */}
        <div className="relative">
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="appearance-none pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer min-w-[160px]"
          >
            <option value="All">All Teams</option>
            {uniqueTeams.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
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

        {/* Position Filter */}
        <div className="relative">
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="appearance-none pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer min-w-[160px]"
          >
            <option value="All">All Positions</option>
            {uniquePositions.map((position) => (
              <option key={position} value={position}>{position}</option>
            ))}
          </select>
          <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        </div>
      </div>

      {/* Players Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 mb-8">
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F5F8FF' }}>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">#</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">PLAYER</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">TEAM</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">TOURNAMENT</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">POSITION</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">COUNTRY</th>
              <th className="text-center py-3 px-4 text-xs font-bold text-blue-900">HEIGHT</th>
              <th className="text-center py-3 px-4 text-xs font-bold text-blue-900">STATUS</th>
              <th className="text-center py-3 px-4 text-xs font-bold text-blue-900">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPlayers.length > 0 ? (
              paginatedPlayers.map((player, index) => (
                <tr 
                  key={player.id}
                  className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50 cursor-pointer transition-colors`}
                  onClick={() => handlePlayerClick(player)}
                >
                  <td className="py-3 px-4 text-sm font-bold text-blue-900">{player.number}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden">
                        <img 
                          src={player.image} 
                          alt={`${player.name} ${player.surname}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-blue-900">{player.name} {player.surname}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">{player.teamName}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{player.tournamentName}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{player.position}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{player.country}</td>
                  <td className="text-center py-3 px-4 text-sm text-gray-700">{player.height}</td>
                  <td className="text-center py-3 px-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlayers(players.map(p => 
                          p.id === player.id 
                            ? { ...p, status: p.status === 'active' ? 'inactive' : 'active' }
                            : p
                        ));
                      }}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                        player.status === 'active' 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                      title="Click to toggle status"
                    >
                      {player.status === 'active' ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="text-center py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => handleEditPlayer(player, e)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Player"
                      >
                        <FiEdit2 size={18} />
                      </button>
                      <button
                        onClick={(e) => handleDeletePlayer(player, e)}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Release Player"
                      >
                        <FiLogOut size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="text-center py-12">
                  <p className="text-gray-500 text-lg">No players found</p>
                  <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filter criteria</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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

      {/* Release Player Modal */}
      {releasePlayer && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Release Player</h2>
              <button
                onClick={() => {
                  setReleasePlayer(null);
                  setReleaseDate('');
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <MdCancel size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700">
                Select a release date for{' '}
                <span className="font-semibold">
                  {releasePlayer.name} {releasePlayer.surname}
                </span>
                . After this date, the player will be available to join another team.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Release date *</label>
                <input
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setReleasePlayer(null);
                  setReleaseDate('');
                }}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRelease}
                className="px-5 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
              >
                Confirm Release
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Player Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-semibold text-gray-900">
                {editingPlayer ? 'Edit Player' : 'Add Player'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingPlayer(null);
                  setFormData({
                    name: '',
                    surname: '',
                    number: '',
                    image: '/player1.png',
                    teamId: 1,
                    teamName: 'Lakers',
                    tournamentId: 1,
                    tournamentName: 'KCBL Club Championship',
                    position: 'Point Guard',
                    country: '',
                    height: '',
                    dob: '',
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
                  <input
                    type="text"
                    placeholder="Enter first name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Surname */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
                  <input
                    type="text"
                    placeholder="Enter last name"
                    value={formData.surname}
                    onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Jersey Number *</label>
                  <input
                    type="text"
                    placeholder="Enter jersey number"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="Point Guard">Point Guard</option>
                    <option value="Shooting Guard">Shooting Guard</option>
                    <option value="Small Forward">Small Forward</option>
                    <option value="Power Forward">Power Forward</option>
                    <option value="Center">Center</option>
                  </select>
                </div>

                {/* Team */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
                  <input
                    type="text"
                    placeholder="Enter team name"
                    value={formData.teamName}
                    onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Tournament */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tournament</label>
                  <input
                    type="text"
                    placeholder="Enter tournament name"
                    value={formData.tournamentName}
                    onChange={(e) => setFormData({ ...formData, tournamentName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <input
                    type="text"
                    placeholder="Enter country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Height */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Height</label>
                  <input
                    type="text"
                    placeholder="e.g., 6'3&quot;"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
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
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-4 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingPlayer(null);
                  setFormData({
                    name: '',
                    surname: '',
                    number: '',
                    image: '/player1.png',
                    teamId: 1,
                    teamName: 'Lakers',
                    tournamentId: 1,
                    tournamentName: 'KCBL Club Championship',
                    position: 'Point Guard',
                    country: '',
                    height: '',
                    dob: '',
                    status: 'active',
                  });
                }}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlayer}
                className="px-6 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
              >
                {editingPlayer ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Players;

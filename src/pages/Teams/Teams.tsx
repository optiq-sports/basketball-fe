import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFilter, FiChevronDown, FiMapPin, FiEdit2, FiTrash } from 'react-icons/fi';
import { GiBasketballBall } from 'react-icons/gi';
import { MdCancel } from 'react-icons/md';
import { useTeams, useCreateTeam, useUpdateTeam, useDeleteTeam } from '../../api/hooks';
import type { Team as ApiTeam } from '../../types/api';

const countriesData: Record<string, string[]> = {
  'United States': ['California', 'Texas', 'Florida', 'New York', 'Illinois', 'Massachusetts', 'Oklahoma'],
  'Canada': ['Ontario', 'Quebec', 'British Columbia', 'Alberta'],
  'United Kingdom': ['England', 'Scotland', 'Wales'],
};

const Teams: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<ApiTeam | null>(null);
  const itemsPerPage = 9;

  const teamsQuery = useTeams();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const teams = teamsQuery.data ?? [];

  // Filter teams by search query (client-side)
  const filteredTeams = useMemo(() => {
    let filtered = teams;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (team) =>
          team.name.toLowerCase().includes(query) ||
          (team.code && team.code.toLowerCase().includes(query)) ||
          (team.country && team.country.toLowerCase().includes(query)) ||
          (team.state && team.state.toLowerCase().includes(query))
      );
    }
    return filtered;
  }, [searchQuery, teams]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredTeams.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTeams = filteredTeams.slice(startIndex, endIndex);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const [formData, setFormData] = useState({
    name: '',
    shortTeamCode: '',
    teamColor: '#21409A',
    country: '',
    state: '',
    coach: '',
    assistantCoach: '',
  });

  const handleTeamClick = (team: ApiTeam) => {
    navigate(`/teams-management/${team.id}`);
  };

  const handleAddTeam = () => {
    setEditingTeam(null);
    setFormData({
      name: '',
      shortTeamCode: '',
      teamColor: '#21409A',
      country: '',
      state: '',
      coach: '',
      assistantCoach: '',
    });
    setIsModalOpen(true);
  };

  const handleEditTeam = (team: ApiTeam, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTeam(team);
    setFormData({
      name: team.name,
      shortTeamCode: team.code ?? '',
      teamColor: team.color ?? '#21409A',
      country: team.country ?? '',
      state: team.state ?? '',
      coach: team.coach ?? '',
      assistantCoach: team.assistantCoach ?? '',
    });
    setIsModalOpen(true);
  };

  const handleDeleteTeam = (team: ApiTeam, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete ${team.name}? This action cannot be undone.`)) {
      deleteTeam.mutate(team.id);
    }
  };

  const handleSaveTeam = () => {
    if (!formData.name || !formData.shortTeamCode) {
      alert('Please fill in team name and code');
      return;
    }
    const payload = {
      name: formData.name,
      code: formData.shortTeamCode,
      color: formData.teamColor,
      country: formData.country || 'USA',
      state: formData.state,
      coach: formData.coach || undefined,
      assistantCoach: formData.assistantCoach || undefined,
    };
    if (editingTeam) {
      updateTeam.mutate(
        { id: editingTeam.id, data: payload },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setEditingTeam(null);
            setFormData({ name: '', shortTeamCode: '', teamColor: '#21409A', country: '', state: '', coach: '', assistantCoach: '' });
          },
          onError: (err) => alert(err.message),
        }
      );
    } else {
      createTeam.mutate(payload, {
        onSuccess: () => {
          setIsModalOpen(false);
          setFormData({ name: '', shortTeamCode: '', teamColor: '#21409A', country: '', state: '', coach: '', assistantCoach: '' });
        },
        onError: (err) => alert(err.message),
      });
    }
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Teams</h1>
      </div>

      {teamsQuery.error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {teamsQuery.error.message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <button
          onClick={handleAddTeam}
          className="px-6 py-3 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors whitespace-nowrap"
        >
          Add Team
        </button>
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
      </div>

      {teamsQuery.isPending ? (
        <div className="py-12 text-center text-gray-500">Loading teams...</div>
      ) : (
        <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {paginatedTeams.map((team) => (
          <div
            key={team.id}
            onClick={() => handleTeamClick(team)}
            className="bg-white rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
          >
            <div
              className="w-full h-48 relative flex items-center justify-center"
              style={{ backgroundColor: team.color ?? '#21409A' }}
            >
              <GiBasketballBall className="text-white text-6xl opacity-80" />
            </div>
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
                  <span>{team.code ?? '—'}</span>
                </div>
                {(team.coach || team.assistantCoach) && (
                  <div>
                    <span className="font-medium">Coach:</span>
                    <span className="ml-2">{[team.coach, team.assistantCoach].filter(Boolean).join(' / ') || '—'}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <FiMapPin size={16} className="text-gray-400" />
                  <span>{(team.state && team.country) ? `${team.state}, ${team.country}` : team.country || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {paginatedTeams.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No teams found</p>
          <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filter criteria</p>
        </div>
      )}

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
        </>
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
                  setFormData({ name: '', shortTeamCode: '', teamColor: '#21409A', country: '', state: '', coach: '', assistantCoach: '' });
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <MdCancel size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-6">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Team Code *</label>
                  <input
                    type="text"
                    placeholder="e.g., LAL"
                    value={formData.shortTeamCode}
                    onChange={(e) => setFormData({ ...formData, shortTeamCode: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={10}
                  />
                </div>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <select
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value, state: '' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select country</option>
                    {Object.keys(countriesData).map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    disabled={!formData.country}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select state</option>
                    {formData.country && countriesData[formData.country]?.map((stateName) => (
                      <option key={stateName} value={stateName}>{stateName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Coach</label>
                  <input
                    type="text"
                    placeholder="Coach name"
                    value={formData.coach}
                    onChange={(e) => setFormData({ ...formData, coach: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assistant Coach</label>
                  <input
                    type="text"
                    placeholder="Assistant coach name"
                    value={formData.assistantCoach}
                    onChange={(e) => setFormData({ ...formData, assistantCoach: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingTeam(null);
                  setFormData({ name: '', shortTeamCode: '', teamColor: '#21409A', country: '', state: '', coach: '', assistantCoach: '' });
                }}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTeam}
                disabled={createTeam.isPending || updateTeam.isPending}
                className="px-6 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-70"
              >
                {createTeam.isPending || updateTeam.isPending ? 'Saving...' : editingTeam ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Teams;

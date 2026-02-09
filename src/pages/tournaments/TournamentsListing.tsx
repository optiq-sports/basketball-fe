import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMapMarkerAlt, FaCalendar } from 'react-icons/fa';
import { FiEdit2, FiTrash } from 'react-icons/fi';
import { useTournaments, useCreateTournament, useUpdateTournament, useDeleteTournament } from '../../api/hooks';
import type { Tournament } from '../../types/api';

function formatDateRange(start?: string, end?: string): string {
  if (!start && !end) return 'TBA';
  if (!end || start === end) {
    if (!start) return 'TBA';
    try {
      return new Date(start).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return start;
    }
  }
  try {
    const s = new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const e = new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    return `${s} – ${e}`;
  } catch {
    return `${start} – ${end}`;
  }
}

const DEFAULT_NUM_GAMES = 10;
const DEFAULT_QUARTERS = 4;
const DEFAULT_QUARTER_DURATION = 10;
const DEFAULT_OVERTIME_DURATION = 5;

const TournamentsListing: React.FC = () => {
  const navigate = useNavigate();
  const { data: tournamentsRaw, isPending, error } = useTournaments();
  const createTournament = useCreateTournament();
  const updateTournament = useUpdateTournament();
  const deleteTournament = useDeleteTournament();

  const [searchQuery, setSearchQuery] = useState('');
  const [seasonFilter, setSeasonFilter] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    division: 'PREMIER' as string,
    numberOfGames: DEFAULT_NUM_GAMES,
    numberOfQuarters: DEFAULT_QUARTERS,
    quarterDuration: DEFAULT_QUARTER_DURATION,
    overtimeDuration: DEFAULT_OVERTIME_DURATION,
    startDate: '',
    endDate: '',
    venue: '',
    crewChief: '',
    umpire1: '',
    umpire2: '',
    commissioner: '',
  });

  const seasons = useMemo(() => ['2023-2024', '2024-2025'], []);

  const filteredTournaments = useMemo(() => {
    let list = tournamentsRaw ?? [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        (t.venue && t.venue.toLowerCase().includes(q)) ||
        formatDateRange(t.startDate, t.endDate).toLowerCase().includes(q)
      );
    }
    return list;
  }, [tournamentsRaw, searchQuery, seasonFilter]);

  const handleTournamentClick = (tournamentId: string) => {
    navigate(`/tournaments/${tournamentId}`);
  };

  const handleAddTournament = () => {
    setEditingTournament(null);
    setFormData({
      name: '',
      division: 'PREMIER',
      numberOfGames: DEFAULT_NUM_GAMES,
      numberOfQuarters: DEFAULT_QUARTERS,
      quarterDuration: DEFAULT_QUARTER_DURATION,
      overtimeDuration: DEFAULT_OVERTIME_DURATION,
      startDate: '',
      endDate: '',
      venue: '',
      crewChief: '',
      umpire1: '',
      umpire2: '',
      commissioner: '',
    });
    setIsModalOpen(true);
  };

  const handleEditTournament = (t: Tournament, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTournament(t);
    setFormData({
      name: t.name,
      division: t.division ?? 'PREMIER',
      numberOfGames: (t.numberOfGames as number) ?? DEFAULT_NUM_GAMES,
      numberOfQuarters: (t.numberOfQuarters as number) ?? DEFAULT_QUARTERS,
      quarterDuration: (t.quarterDuration as number) ?? DEFAULT_QUARTER_DURATION,
      overtimeDuration: (t.overtimeDuration as number) ?? DEFAULT_OVERTIME_DURATION,
      startDate: t.startDate ? t.startDate.slice(0, 10) : '',
      endDate: t.endDate ? t.endDate.slice(0, 10) : '',
      venue: t.venue ?? '',
      crewChief: (t.crewChief as string) ?? '',
      umpire1: (t.umpire1 as string) ?? '',
      umpire2: (t.umpire2 as string) ?? '',
      commissioner: (t.commissioner as string) ?? '',
    });
    setIsModalOpen(true);
  };

  const handleDeleteTournament = (t: Tournament, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete tournament "${t.name}"? This cannot be undone.`)) return;
    deleteTournament.mutate(t.id, {
      onSuccess: () => {},
      onError: (err) => alert(err.message),
    });
  };

  const handleSaveTournament = () => {
    if (!formData.name.trim() || !formData.venue.trim() || !formData.startDate || !formData.endDate) {
      alert('Please fill in name, venue, start date and end date.');
      return;
    }
    const startDate = new Date(formData.startDate).toISOString().slice(0, 10);
    const endDate = new Date(formData.endDate).toISOString().slice(0, 10);
    const payload = {
      name: formData.name.trim(),
      division: formData.division,
      numberOfGames: formData.numberOfGames,
      numberOfQuarters: formData.numberOfQuarters,
      quarterDuration: formData.quarterDuration,
      overtimeDuration: formData.overtimeDuration,
      startDate,
      endDate,
      venue: formData.venue.trim(),
      ...(formData.crewChief && { crewChief: formData.crewChief }),
      ...(formData.umpire1 && { umpire1: formData.umpire1 }),
      ...(formData.umpire2 && { umpire2: formData.umpire2 }),
      ...(formData.commissioner && { commissioner: formData.commissioner }),
    };
    if (editingTournament) {
      updateTournament.mutate(
        { id: editingTournament.id, data: payload },
        {
          onSuccess: () => { setIsModalOpen(false); setEditingTournament(null); },
          onError: (err) => alert(err.message),
        }
      );
    } else {
      createTournament.mutate(payload as Parameters<typeof createTournament.mutate>[0], {
        onSuccess: () => { setIsModalOpen(false); setEditingTournament(null); },
        onError: (err) => alert(err.message),
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-normal text-gray-800">Tournaments</h1>
          <button
            onClick={handleAddTournament}
            className="px-4 py-2.5 bg-[#21409A] text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
          >
            Add Tournament
          </button>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <div className="relative" style={{ width: '260px', minWidth: '200px' }}>
            <input
              type="text"
              placeholder="Search tournaments"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="relative">
            <select
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer text-sm min-w-[160px]"
            >
              <option value="All">All Seasons</option>
              {seasons.map((season) => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error instanceof Error ? error.message : 'Failed to load tournaments'}
          </div>
        )}

        {isPending && (
          <div className="text-gray-500 py-8">Loading tournaments…</div>
        )}

        {!isPending && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament) => (
            <div
              key={tournament.id}
              onClick={() => handleTournamentClick(tournament.id)}
              style={{
                width: '310px',
                height: '413px',
                opacity: 1,
                borderRadius: '16px',
                borderWidth: '1px',
                background: '#FCFEFF',
                border: '1px solid #A9A9A91A'
              }}
              className="hover:shadow-md transition-shadow duration-200 cursor-pointer overflow-hidden relative group"
            >
              <div className="absolute top-2 right-2 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleEditTournament(tournament, e)}
                  className="p-2 bg-white rounded-lg shadow border border-gray-200 hover:bg-gray-50"
                  title="Edit"
                >
                  <FiEdit2 size={18} className="text-gray-700" />
                </button>
                <button
                  onClick={(e) => handleDeleteTournament(tournament, e)}
                  className="p-2 bg-white rounded-lg shadow border border-gray-200 hover:bg-red-50"
                  title="Delete"
                >
                  <FiTrash size={18} className="text-red-600" />
                </button>
              </div>
               <div className="relative h-79 overflow-hidden">
                 <img
                   src="/flyer.png"
                   alt="Tournament Flyer"
                   style={{ width: '286px', height: '300px', top: '14px', left: '12px', opacity: 1, borderRadius: '6px' }}
                   className="absolute object-cover"
                 />
               </div>
               <div className="p-4">
                 <h3 className="text-lg font-semibold text-gray-800 mb-3">{tournament.name}</h3>
                <div className="flex items-center justify-start gap-4">
                  <div className="flex items-center text-gray-600">
                    <FaMapMarkerAlt className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-sm">{tournament.venue}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <FaCalendar className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-sm">{formatDateRange(tournament.startDate, tournament.endDate)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">{editingTournament ? 'Edit Tournament' : 'Add Tournament'}</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Tournament name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                  <select
                    value={formData.division}
                    onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="PREMIER">Premier</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start date *</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End date *</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue *</label>
                  <input
                    type="text"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Venue"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of games</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.numberOfGames}
                      onChange={(e) => setFormData({ ...formData, numberOfGames: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quarters</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.numberOfQuarters}
                      onChange={(e) => setFormData({ ...formData, numberOfQuarters: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quarter duration (min)</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.quarterDuration}
                      onChange={(e) => setFormData({ ...formData, quarterDuration: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Overtime duration (min)</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.overtimeDuration}
                      onChange={(e) => setFormData({ ...formData, overtimeDuration: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={() => { setIsModalOpen(false); setEditingTournament(null); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTournament}
                  disabled={createTournament.isPending || updateTournament.isPending}
                  className="px-4 py-2 bg-[#21409A] text-white rounded-lg font-medium hover:bg-blue-800 disabled:opacity-70"
                >
                  {createTournament.isPending || updateTournament.isPending ? 'Saving…' : editingTournament ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentsListing;

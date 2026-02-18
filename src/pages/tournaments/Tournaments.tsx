import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTournament, useMatches, useTeams, useUpdateTournament, useDeleteTournament, useTournamentAddTeams } from '../../api/hooks';
import type { Match as ApiMatch } from '../../types/api';

// Copy Icon Component
const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface DisplayTeam {
  id: string;
  name: string;
  color: string;
  gp: number;
  w: number;
  l: number;
  percent: number;
  points: number;
}

interface DisplayMatch {
  id: string;
  teamA: string;
  teamAColor: string;
  teamB: string;
  teamBColor: string;
  venue: string;
  time: string;
  hasStarted: boolean;
  totalHome?: number;
  totalAway?: number;
  matchCode?: string;
}

function formatMatchTime(scheduledDate?: string): string {
  if (!scheduledDate) return 'TBA';
  try {
    const d = new Date(scheduledDate);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return scheduledDate;
  }
}

const CompetitionDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: tournamentId } = useParams<{ id: string }>();
  const [activeGroup, setActiveGroup] = useState('A');
  const [matchCode] = useState('ABC123XYZ');
  const [showSchedules, setShowSchedules] = useState(true);

  const tournamentQuery = useTournament(tournamentId);
  const matchesQuery = useMatches(tournamentId);
  const teamsQuery = useTeams();
  const updateTournament = useUpdateTournament();
  const deleteTournament = useDeleteTournament();
  const addTeams = useTournamentAddTeams();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddTeamsModal, setShowAddTeamsModal] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [editForm, setEditForm] = useState({
    name: '',
    division: 'PREMIER' as string,
    numberOfGames: 10,
    numberOfQuarters: 4,
    quarterDuration: 10,
    overtimeDuration: 5,
    startDate: '',
    endDate: '',
    venue: '',
  });

  const teamMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    (teamsQuery.data ?? []).forEach((t) => map.set(t.id, { name: t.name, color: t.color ?? '#gray' }));
    return map;
  }, [teamsQuery.data]);

  const tournament = tournamentQuery.data;
  const matchesRaw = matchesQuery.data ?? [];
  const matches: DisplayMatch[] = useMemo(() => {
    return matchesRaw.map((m: ApiMatch) => {
      const home = teamMap.get(m.homeTeamId);
      const away = teamMap.get(m.awayTeamId);
      return {
        id: m.id,
        teamA: home?.name ?? 'TBD',
        teamAColor: home?.color === 'yellow' || home?.color === 'blue' ? home.color : 'yellow',
        teamB: away?.name ?? 'TBD',
        teamBColor: away?.color === 'yellow' || away?.color === 'blue' ? away.color : 'blue',
        venue: m.venue ?? '—',
        time: formatMatchTime(m.scheduledDate),
        hasStarted: m.status === 'LIVE' || m.status === 'COMPLETED',
        totalHome: m.totalHome,
        totalAway: m.totalAway,
        matchCode: (m as { code?: string }).code ?? m.id,
      };
    });
  }, [matchesRaw, teamMap]);

  const ongoingMatch = useMemo(() => matches.find((m) => m.hasStarted) ?? null, [matches]);

  const teams: DisplayTeam[] = useMemo(() => {
    const list = teamsQuery.data ?? [];
    const tournamentTeamIds = (tournament as { teamIds?: string[] })?.teamIds;
    const ids = Array.isArray(tournamentTeamIds) && tournamentTeamIds.length > 0 ? tournamentTeamIds : [];
    const filtered = ids.length > 0 ? list.filter((t) => ids.includes(t.id)) : [];
    return filtered.map((t, i) => ({
      id: t.id,
      name: t.name,
      color: t.color === 'yellow' || t.color === 'blue' ? t.color : (i % 2 === 0 ? 'yellow' : 'blue'),
      gp: 0,
      w: 0,
      l: 0,
      percent: 0,
      points: 0,
    }));
  }, [teamsQuery.data, tournament]);

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

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(matchCode);
    alert('Match code copied!');
  };

  const openEditModal = () => {
    const t = tournamentQuery.data;
    if (!t) return;
    setEditForm({
      name: t.name,
      division: (t.division as string) ?? 'PREMIER',
      numberOfGames: (t.numberOfGames as number) ?? 10,
      numberOfQuarters: (t.numberOfQuarters as number) ?? 4,
      quarterDuration: (t.quarterDuration as number) ?? 10,
      overtimeDuration: (t.overtimeDuration as number) ?? 5,
      startDate: t.startDate ? t.startDate.slice(0, 10) : '',
      endDate: t.endDate ? t.endDate.slice(0, 10) : '',
      venue: t.venue ?? '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!tournamentId || !editForm.name.trim() || !editForm.venue.trim() || !editForm.startDate || !editForm.endDate) {
      alert('Please fill name, venue, start and end date.');
      return;
    }
    updateTournament.mutate(
      {
        id: tournamentId,
        data: {
          name: editForm.name.trim(),
          division: editForm.division,
          numberOfGames: editForm.numberOfGames,
          numberOfQuarters: editForm.numberOfQuarters,
          quarterDuration: editForm.quarterDuration,
          overtimeDuration: editForm.overtimeDuration,
          startDate: editForm.startDate,
          endDate: editForm.endDate,
          venue: editForm.venue.trim(),
        },
      },
      { onSuccess: () => setShowEditModal(false), onError: (e) => alert(e.message) }
    );
  };

  const handleDeleteTournament = () => {
    if (!tournamentId || !window.confirm(`Delete tournament "${tournament?.name}"? This cannot be undone.`)) return;
    deleteTournament.mutate(tournamentId, {
      onSuccess: () => navigate('/tournaments'),
      onError: (e) => alert(e.message),
    });
  };

  const handleAddTeams = () => {
    if (!tournamentId || selectedTeamIds.length === 0) {
      alert('Please select at least one team.');
      return;
    }
    addTeams.mutate(
      { tournamentId, body: { teamIds: selectedTeamIds } },
      {
        onSuccess: () => {
          setShowAddTeamsModal(false);
          setSelectedTeamIds([]);
        },
        onError: (e) => alert(e.message),
      }
    );
  };

  if (tournamentQuery.isPending || !tournamentId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto text-gray-500">Loading tournament…</div>
      </div>
    );
  }
  if (tournamentQuery.error || !tournamentQuery.data) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto text-red-600">
          {tournamentQuery.error instanceof Error ? tournamentQuery.error.message : 'Tournament not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-gray-800">{tournament.name}</h1>
          <div className="flex gap-2">
            <button
              onClick={openEditModal}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Edit Tournament
            </button>
            <button
              onClick={handleDeleteTournament}
              disabled={deleteTournament.isPending}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-70"
            >
              {deleteTournament.isPending ? 'Deleting…' : 'Delete Tournament'}
            </button>
            <button
              onClick={() => setShowAddTeamsModal(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Add Teams
            </button>
            <button
              onClick={() => navigate(`/tournaments/${tournamentId}/fixtures`)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#21409A] text-white hover:bg-blue-800 transition-colors"
            >
              View Fixtures
            </button>
          </div>
        </div>

        {showAddTeamsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">Add Teams to Tournament</h2>
              </div>
              <div className="p-6 space-y-2 max-h-64 overflow-y-auto">
                {(teamsQuery.data ?? []).map((team) => (
                  <label key={team.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedTeamIds.includes(team.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTeamIds((prev) => [...prev, team.id]);
                        } else {
                          setSelectedTeamIds((prev) => prev.filter((id) => id !== team.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-[#21409A] focus:ring-[#21409A]"
                    />
                    <span className="text-sm font-medium text-gray-800">{team.name}</span>
                  </label>
                ))}
                {(teamsQuery.data ?? []).length === 0 && (
                  <p className="text-sm text-gray-500">No teams available. Create teams first from Teams Management.</p>
                )}
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button onClick={() => { setShowAddTeamsModal(false); setSelectedTeamIds([]); }} className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleAddTeams} disabled={addTeams.isPending || selectedTeamIds.length === 0} className="px-4 py-2 bg-[#21409A] text-white rounded-lg font-medium hover:bg-blue-800 disabled:opacity-70 disabled:cursor-not-allowed">{addTeams.isPending ? 'Adding…' : 'Add Teams'}</button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">Edit Tournament</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue *</label>
                  <input
                    type="text"
                    value={editForm.venue}
                    onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start date *</label>
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End date *</label>
                    <input
                      type="date"
                      value={editForm.endDate}
                      onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of games</label>
                    <input
                      type="number"
                      min={1}
                      value={editForm.numberOfGames}
                      onChange={(e) => setEditForm({ ...editForm, numberOfGames: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quarters</label>
                    <input
                      type="number"
                      min={1}
                      value={editForm.numberOfQuarters}
                      onChange={(e) => setEditForm({ ...editForm, numberOfQuarters: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveEdit} disabled={updateTournament.isPending} className="px-4 py-2 bg-[#21409A] text-white rounded-lg font-medium hover:bg-blue-800 disabled:opacity-70">{updateTournament.isPending ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        {matchesQuery.isPending && <div className="text-gray-500 mb-4">Loading matches…</div>}
        {matchesQuery.error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {matchesQuery.error instanceof Error ? matchesQuery.error.message : 'Failed to load matches'}
          </div>
        )}

        {ongoingMatch && (
        <div
          className="rounded-lg shadow-sm p-6 mb-6 border cursor-pointer hover:shadow-md transition-shadow"
          style={{ background: '#FCFEFF', border: '1px solid #A9A9A91A' }}
          onClick={() => navigate(`/tournaments/${tournamentId}/match/${ongoingMatch.id}`)}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold text-gray-700">Ongoing Game</h2>
            <button
              onClick={handleCopyCode}
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
                <div className="text-xs text-gray-500 mb-1">{ongoingMatch.teamA}</div>
                <div className="text-4xl font-bold text-gray-900">{ongoingMatch.totalHome ?? 0}</div>
              </div>
            </div>

            <div className="text-lg text-gray-400 font-medium">VS</div>

            <div className="flex items-center gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1 text-right">{ongoingMatch.teamB}</div>
                <div className="text-4xl font-bold text-gray-900">{ongoingMatch.totalAway ?? 0}</div>
              </div>
              <div className="flex items-center justify-center">
                <img src="/ball2.png" alt="Basketball" style={{ width: '35px', height: '35px' }} className="object-contain" />
              </div>
            </div>
          </div>

          <div className="text-center mt-4 text-xs text-gray-400">
            {tournament.name} | {ongoingMatch.time}
          </div>
        </div>
        )}

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
                onClick={() => navigate(`/tournaments/${tournamentId}/fixtures`)}
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
                className="rounded-lg shadow-sm p-5 border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-1 hover:ring-gray-300 relative"
                style={{ background: '#F8F8F8', border: '1px solid #A9A9A91A' }}
                onClick={() => navigate(match.hasStarted ? `/tournaments/${tournamentId}/match/${match.id}` : `/tournaments/${tournamentId}/match/${match.id}/pending`)}
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(match.matchCode ?? match.id); alert('Match code copied!'); }}
                  className="absolute top-3 right-3 p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                  title="Copy match code"
                >
                  <CopyIcon className="w-4 h-4" />
                </button>
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
              const firstMatchId = matches.length > 0 ? matches[0].id : '';
              return (
                <div
                  key={player.id}
                  className="rounded-2xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ width: '335px', height: '374px', backgroundColor: player.bgColor }}
                  onClick={() => {
                    if (firstMatchId) {
                      navigate(`/tournaments/${tournamentId}/match/${firstMatchId}/player/${player.id}`, {
                        state: { from: 'tournament-leaders', tournamentId }
                      });
                    }
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
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMatches, useUpdateMatch } from '../../api/hooks';
import type { Match } from '../../types/api';

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface EditState {
  day: string;
  month: string;
  year: string;
  time: string;
  period: 'AM' | 'PM';
  venue: string;
}

function parseDateToEditState(scheduledDate: string, venue: string): EditState {
  const d = new Date(scheduledDate);
  const hours = d.getHours();
  const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return {
    day: d.getDate().toString(),
    month: (d.getMonth() + 1).toString(),
    year: d.getFullYear().toString(),
    time: `${hour12}:${d.getMinutes().toString().padStart(2, '0')}`,
    period,
    venue,
  };
}

function editStateToISO(state: EditState): string {
  const hour = parseInt(state.time.split(':')[0]) || 0;
  const minute = parseInt(state.time.split(':')[1]) || 0;
  const hour24 = state.period === 'PM'
    ? (hour === 12 ? 12 : hour + 12)
    : (hour === 12 ? 0 : hour);
  const m = String(state.month).padStart(2, '0');
  const d = String(state.day).padStart(2, '0');
  const h = String(hour24).padStart(2, '0');
  const min = String(minute).padStart(2, '0');
  return `${state.year}-${m}-${d}T${h}:${min}:00`;
}

function formatDisplayDateTime(scheduledDate: string): string {
  try {
    return new Date(scheduledDate).toLocaleString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return scheduledDate;
  }
}

const isStarted = (status: string) => status === 'LIVE' || status === 'COMPLETED';

const Schedules: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const matchesQuery = useMatches(id);
  const updateMatch = useUpdateMatch();

  const [activeGroup, setActiveGroup] = useState('A');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unplayed'>('all');
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});

  const handleCopyCode = (matchCode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(matchCode);
    alert('Match code copied!');
  };

  const openEdit = (match: Match) => {
    setEditStates(prev => ({
      ...prev,
      [match.id]: parseDateToEditState(match.scheduledDate, match.venue ?? ''),
    }));
    setEditingIds(prev => new Set(prev).add(match.id));
  };

  const discardEdit = (matchId: string) => {
    setEditingIds(prev => { const s = new Set(prev); s.delete(matchId); return s; });
  };

  const handleFieldChange = (matchId: string, field: keyof EditState, value: string) => {
    setEditStates(prev => ({ ...prev, [matchId]: { ...prev[matchId], [field]: value } }));
  };

  const handleSave = (matchId: string) => {
    const state = editStates[matchId];
    if (!state) return;
    updateMatch.mutate(
      { id: matchId, data: { scheduledDate: editStateToISO(state), venue: state.venue || undefined } },
      { onSuccess: () => discardEdit(matchId) },
    );
  };

  const allMatches = matchesQuery.data ?? [];
  const unplayedCount = allMatches.filter(m => m.status === 'SCHEDULED' || m.status === 'POSTPONED').length;
  const visibleMatches = activeFilter === 'unplayed'
    ? allMatches.filter(m => m.status === 'SCHEDULED' || m.status === 'POSTPONED')
    : allMatches;

  if (matchesQuery.isPending) {
    return <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center text-gray-500">Loading schedules…</div>;
  }

  if (matchesQuery.isError) {
    return <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center text-red-500">Failed to load schedules.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-600 hover:text-gray-800 flex items-center gap-2 cursor-pointer"
            >
              <span>←</span> Back to Tournament
            </button>
            <button
              onClick={() => navigate(`/tournaments/${id}/fixtures`)}
              className="text-sm text-[#21409A] hover:underline font-medium cursor-pointer"
            >
              Edit Fixture
            </button>
          </div>
          <h1 className="text-3xl font-semibold text-gray-800">Schedule</h1>
        </div>

        {/* Tabs */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2">
            {['A', 'B', 'C', 'D'].map(group => (
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
          <div className="flex gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                activeFilter === 'all'
                  ? 'bg-[#21409A] text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              All ({allMatches.length})
            </button>
            <button
              onClick={() => setActiveFilter('unplayed')}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                activeFilter === 'unplayed'
                  ? 'bg-[#21409A] text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Unplayed ({unplayedCount})
            </button>
          </div>
        </div>

        {/* Match list */}
        {visibleMatches.length === 0 ? (
          <div className="text-center text-gray-500 py-12">No matches found.</div>
        ) : (
          <div className="space-y-4">
            {visibleMatches.map(match => {
              const homeTeamName = match.homeTeam?.name ?? 'Home Team';
              const awayTeamName = match.awayTeam?.name ?? 'Away Team';
              const matchCode = match.matchCode ?? match.id;
              const isEditing = editingIds.has(match.id);
              const editState = editStates[match.id];
              const started = isStarted(match.status);

              return (
                <div
                  key={match.id}
                  className="bg-[#F8F8F8] rounded-lg shadow-sm p-6 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow relative"
                  onClick={() => navigate(started
                    ? `/tournaments/${id}/match/${match.id}`
                    : `/tournaments/${id}/match/${match.id}/pending`
                  )}
                >
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleCopyCode(matchCode, e); }}
                    className="absolute top-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50 transition-all shadow-sm z-10"
                    title={`Copy match code: ${matchCode}`}
                  >
                    <CopyIcon className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </button>

                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      {/* Teams */}
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-3">
                          <img src="/ball1.png" alt="Basketball" style={{ width: '35px', height: '35px' }} className="object-contain" />
                          <span className="text-sm font-medium text-gray-700">{homeTeamName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <img src="/ball2.png" alt="Basketball" style={{ width: '35px', height: '35px' }} className="object-contain" />
                          <span className="text-sm font-medium text-gray-700">{awayTeamName}</span>
                        </div>
                      </div>

                      {/* Edit form */}
                      {isEditing && editState && (
                        <div onClick={e => e.stopPropagation()}>
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                              <div className="flex gap-2">
                                <input type="text" placeholder="Day" value={editState.day}
                                  onChange={e => handleFieldChange(match.id, 'day', e.target.value)}
                                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <input type="text" placeholder="Month" value={editState.month}
                                  onChange={e => handleFieldChange(match.id, 'month', e.target.value)}
                                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <input type="text" placeholder="Year" value={editState.year}
                                  onChange={e => handleFieldChange(match.id, 'year', e.target.value)}
                                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                              <div className="flex gap-2">
                                <input type="text" placeholder="10:17" value={editState.time}
                                  onChange={e => handleFieldChange(match.id, 'time', e.target.value)}
                                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <button
                                  onClick={() => handleFieldChange(match.id, 'period', 'AM')}
                                  className={`px-4 py-2.5 border border-gray-300 rounded-lg ${editState.period === 'AM' ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-500'}`}
                                >
                                  AM
                                </button>
                                <button
                                  onClick={() => handleFieldChange(match.id, 'period', 'PM')}
                                  className={`px-4 py-2.5 border border-gray-300 rounded-lg ${editState.period === 'PM' ? 'bg-gray-100 text-gray-700' : 'bg-white text-gray-500'}`}
                                >
                                  PM
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">Venue</label>
                              <input type="text" placeholder="Court" value={editState.venue}
                                onChange={e => handleFieldChange(match.id, 'venue', e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => discardEdit(match.id)}
                              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 font-medium cursor-pointer"
                            >
                              Discard
                            </button>
                            <button
                              onClick={() => handleSave(match.id)}
                              disabled={updateMatch.isPending}
                              className="px-6 py-2.5 bg-[#21409A] text-white rounded-lg font-medium hover:bg-blue-800 transition-colors cursor-pointer disabled:opacity-60"
                            >
                              {updateMatch.isPending ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right side */}
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{match.venue ?? '—'}</p>
                        <p className="text-xs text-gray-500">{formatDisplayDateTime(match.scheduledDate)}</p>
                      </div>
                      {!isEditing && !started && (
                        <button
                          onClick={e => { e.stopPropagation(); openEdit(match); }}
                          className="px-4 py-1.5 border border-[#21409A] text-[#21409A] rounded-lg text-sm font-medium hover:bg-blue-50 cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Schedules;

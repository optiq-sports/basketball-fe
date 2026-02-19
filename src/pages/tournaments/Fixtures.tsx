import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash } from 'react-icons/fi';
import { useMatches, useTeams, useCreateMatch, useUpdateMatch, useDeleteMatch } from '../../api/hooks';
import type { Match as ApiMatch } from '../../types/api';

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

interface DisplayGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  venue: string;
  isExpanded: boolean;
  matchCode: string;
}

function formatMatchDateTime(scheduledDate?: string): { date: string; time: string } {
  if (!scheduledDate) return { date: '—', time: '—' };
  try {
    const d = new Date(scheduledDate);
    return {
      date: d.toLocaleDateString(undefined, { dateStyle: 'medium' }),
      time: d.toLocaleTimeString(undefined, { timeStyle: 'short' }),
    };
  } catch {
    return { date: scheduledDate, time: '—' };
  }
}

const Fixtures: React.FC = () => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeGroup, setActiveGroup] = useState('A');
  const [format, setFormat] = useState('Round Robin');
  const [round, setRound] = useState('Group stage');
  const [showAddGame, setShowAddGame] = useState(false);
  const [newHomeTeamId, setNewHomeTeamId] = useState('');
  const [newAwayTeamId, setNewAwayTeamId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newVenue, setNewVenue] = useState('');

  const matchesQuery = useMatches(tournamentId);
  const teamsQuery = useTeams();
  const createMatch = useCreateMatch();
  const updateMatch = useUpdateMatch();
  const deleteMatch = useDeleteMatch();
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editStatus, setEditStatus] = useState<'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED'>('SCHEDULED');

  const teamMap = useMemo(() => {
    const map = new Map<string, string>();
    (teamsQuery.data ?? []).forEach((t) => map.set(t.id, t.name));
    return map;
  }, [teamsQuery.data]);

  const teams = teamsQuery.data ?? [];

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const games: DisplayGame[] = useMemo(() => {
    const list = matchesQuery.data ?? [];
    return list.map((m: ApiMatch) => {
      const { date, time } = formatMatchDateTime(m.scheduledDate);
      return {
        id: m.id,
        homeTeam: teamMap.get(m.homeTeamId) ?? 'TBD',
        awayTeam: teamMap.get(m.awayTeamId) ?? 'TBD',
        date,
        time,
        venue: m.venue ?? '—',
        isExpanded: expandedIds.has(m.id),
        matchCode: (m as { code?: string }).code ?? m.id,
      };
    });
  }, [matchesQuery.data, teamMap, expandedIds]);

  const toggleGame = (gameId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  };

  const handleAddGame = () => {
    if (!tournamentId || !newHomeTeamId || !newAwayTeamId || !newDate) {
      alert('Please select home team, away team and date.');
      return;
    }
    const t = newTime || '12:00';
    const scheduledDate = `${newDate}T${t.length === 5 ? `${t}:00` : t}`;
    createMatch.mutate(
      {
        tournamentId,
        homeTeamId: newHomeTeamId,
        awayTeamId: newAwayTeamId,
        scheduledDate,
        status: 'SCHEDULED',
        venue: newVenue || undefined,
      },
      {
        onSuccess: () => {
          setShowAddGame(false);
          setNewHomeTeamId('');
          setNewAwayTeamId('');
          setNewDate('');
          setNewTime('');
          setNewVenue('');
        },
        onError: (e) => alert(e.message),
      }
    );
  };

  const openEditMatch = (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const m = (matchesQuery.data ?? []).find((x: ApiMatch) => x.id === matchId) as ApiMatch | undefined;
    if (!m) return;
    const d = m.scheduledDate ? new Date(m.scheduledDate) : null;
    setEditDate(d ? d.toISOString().slice(0, 10) : '');
    setEditTime(d ? d.toTimeString().slice(0, 5) : '12:00');
    setEditVenue(m.venue ?? '');
    setEditStatus((m.status as 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED') ?? 'SCHEDULED');
    setEditingMatchId(matchId);
  };

  const handleSaveEditMatch = () => {
    if (!editingMatchId) return;
    const scheduledDate = `${editDate}T${editTime || '12:00'}`;
    updateMatch.mutate(
      {
        id: editingMatchId,
        data: { scheduledDate, venue: editVenue || undefined, status: editStatus },
      },
      { onSuccess: () => setEditingMatchId(null), onError: (e) => alert(e.message) }
    );
  };

  const handleDeleteMatch = (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this match? This cannot be undone.')) return;
    deleteMatch.mutate(matchId, { onError: (e) => alert(e.message) });
  };

  if (!tournamentId) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto text-red-600">Missing tournament ID</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate(`/tournaments/${tournamentId}`)}
            className="text-gray-600 hover:text-gray-800 mb-4 flex items-center gap-2 cursor-pointer"
          >
            <span>←</span> Back to Tournament
          </button>
          <h1 className="text-2xl font-semibold text-gray-800">Fixtures</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Round Robin">Round Robin</option>
              <option value="Knockout">Knockout</option>
              <option value="League">League</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Round</label>
            <select
              value={round}
              onChange={(e) => setRound(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Group stage">Group stage</option>
              <option value="Quarter Finals">Quarter Finals</option>
              <option value="Semi Finals">Semi Finals</option>
              <option value="Finals">Finals</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {['A', 'B', 'C', 'D'].map((group) => (
            <button
              key={group}
              onClick={() => setActiveGroup(group)}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                activeGroup === group ? 'bg-[#21409A] text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Group {group}
            </button>
          ))}
        </div>

        {matchesQuery.isPending && <div className="text-gray-500 py-4">Loading fixtures…</div>}
        {matchesQuery.error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {matchesQuery.error instanceof Error ? matchesQuery.error.message : 'Failed to load matches'}
          </div>
        )}

        <div className="space-y-6">
          {games.map((game, index) => (
            <div key={game.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div
                className="flex items-center gap-3 mb-4 cursor-pointer"
                onClick={() => toggleGame(game.id)}
              >
                <div className={`w-2 h-2 rounded-full ${game.isExpanded ? 'bg-green-500' : 'bg-gray-400'}`} />
                <h3 className="text-base font-semibold text-gray-800">Game {index + 1}</h3>
                <span className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(game.matchCode); alert('Match code copied!'); }}
                    className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 text-gray-600"
                    title="Copy match code"
                  >
                    <CopyIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => openEditMatch(game.id, e)}
                    className="p-1.5 rounded border border-gray-200 hover:bg-gray-100 text-gray-600"
                    title="Edit match"
                  >
                    <FiEdit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteMatch(game.id, e)}
                    disabled={deleteMatch.isPending}
                    className="p-1.5 rounded border border-red-200 hover:bg-red-50 text-red-600 disabled:opacity-70"
                    title="Delete match"
                  >
                    <FiTrash size={16} />
                  </button>
                  <span className="text-gray-600">{game.isExpanded ? '▼' : '▶'}</span>
                </span>
              </div>
              <div
                className="flex items-center gap-4 cursor-pointer hover:opacity-90"
                onClick={() => navigate(`/tournaments/${tournamentId}/match/${game.id}`)}
              >
                <div className="flex items-center gap-2">
                  <img src="/ball1.png" alt="" className="w-7 h-7 object-contain" />
                  <span className="text-sm font-medium text-gray-700">{game.homeTeam}</span>
                </div>
                <span className="text-gray-400">vs</span>
                <div className="flex items-center gap-2">
                  <img src="/ball2.png" alt="" className="w-7 h-7 object-contain" />
                  <span className="text-sm font-medium text-gray-700">{game.awayTeam}</span>
                </div>
                <span className="ml-auto text-xs text-gray-500">{game.date} · {game.time}</span>
                <span className="text-xs text-gray-500">{game.venue}</span>
              </div>
              {game.isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">
                  <div>Venue: {game.venue}</div>
                  <div>{game.date} at {game.time}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {editingMatchId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Match</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                  <input type="text" value={editVenue} onChange={(e) => setEditVenue(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Court" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as typeof editStatus)} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white">
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="LIVE">Live</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="POSTPONED">Postponed</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setEditingMatchId(null)} className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveEditMatch} disabled={updateMatch.isPending} className="px-4 py-2 bg-[#21409A] text-white rounded-lg font-medium hover:bg-blue-800 disabled:opacity-70">{updateMatch.isPending ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        {showAddGame && (
          <div className="mt-8 p-6 bg-white rounded-lg border border-gray-200 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Add Game</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Home team *</label>
                <select
                  value={newHomeTeamId}
                  onChange={(e) => setNewHomeTeamId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Select team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Away team *</label>
                <select
                  value={newAwayTeamId}
                  onChange={(e) => setNewAwayTeamId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Select team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                <input
                  type="text"
                  value={newVenue}
                  onChange={(e) => setNewVenue(e.target.value)}
                  placeholder="Court"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAddGame}
                disabled={createMatch.isPending}
                className="px-6 py-2.5 bg-[#21409A] text-white rounded-lg font-medium hover:bg-blue-800 disabled:opacity-70"
              >
                {createMatch.isPending ? 'Creating…' : 'Create match'}
              </button>
              <button
                onClick={() => setShowAddGame(false)}
                className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-4 mt-8">
          <button
            onClick={() => setShowAddGame(true)}
            className="px-6 py-3 bg-[#21409A] text-white rounded-lg font-medium hover:bg-blue-800 transition-colors cursor-pointer"
          >
            Add Game
          </button>
          <button
            onClick={() => navigate('/tournaments')}
            className="px-6 py-3 bg-[#21409A] text-white rounded-lg font-medium hover:bg-blue-800 transition-colors cursor-pointer"
          >
            Back to Tournaments
          </button>
        </div>
      </div>
    </div>
  );
};

export default Fixtures;

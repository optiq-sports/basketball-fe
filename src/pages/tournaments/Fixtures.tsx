import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash, FiChevronLeft, FiPlus, FiCalendar, FiMapPin } from 'react-icons/fi';
import { useMatches, useTeams, useCreateMatch, useUpdateMatch, useDeleteMatch } from '../../api/hooks';
import type { Match as ApiMatch } from '../../types/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

type MatchStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';

interface DisplayGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: MatchStatus;
  date: string;
  time: string;
  venue: string;
  matchCode: string;
}

const STATUS_BADGE: Record<MatchStatus, { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' }> = {
  SCHEDULED: { label: 'Scheduled', tone: 'neutral' },
  LIVE: { label: 'Live', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'error' },
  POSTPONED: { label: 'Postponed', tone: 'error' },
};

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
  const teamsQuery = useTeams(tournamentId);
  const createMatch = useCreateMatch();
  const updateMatch = useUpdateMatch();
  const deleteMatch = useDeleteMatch();
  const { confirm, dialogProps } = useConfirmDialog();
  const toast = useToast();
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

  const games: DisplayGame[] = useMemo(() => {
    const list = matchesQuery.data ?? [];
    return list.map((m: ApiMatch) => {
      const { date, time } = formatMatchDateTime(m.scheduledDate);
      return {
        id: m.id,
        homeTeam: teamMap.get(m.homeTeamId) ?? 'TBD',
        awayTeam: teamMap.get(m.awayTeamId) ?? 'TBD',
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: (m.status as MatchStatus) ?? 'SCHEDULED',
        date,
        time,
        venue: m.venue ?? '—',
        matchCode: (m as { code?: string }).code ?? m.id,
      };
    });
  }, [matchesQuery.data, teamMap]);

  const handleAddGame = () => {
    if (!tournamentId || !newHomeTeamId || !newAwayTeamId || !newDate) {
      toast.error('Please select home team, away team and date.');
      return;
    }
    const t = newTime || '12:00';
    const [year, month, day] = newDate.split('-').map(Number);
    const [hour, min] = (t.length === 5 ? `${t}:00` : t).split(':').map(Number);
    const localDate = new Date(year, month - 1, day, hour, min, 0, 0);
    const scheduledDate = localDate.toISOString();
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
        onError: (e) => toast.error(e.message),
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
    const [year, month, day] = editDate.split('-').map(Number);
    const timeStr = editTime || '12:00';
    const [hour, min] = (timeStr.length === 5 ? `${timeStr}:00` : timeStr).split(':').map(Number);
    const localDate = new Date(year, month - 1, day, hour, min, 0, 0);
    const scheduledDate = localDate.toISOString();
    updateMatch.mutate(
      {
        id: editingMatchId,
        data: { scheduledDate, venue: editVenue || undefined, status: editStatus },
      },
      { onSuccess: () => setEditingMatchId(null), onError: (e) => toast.error(e.message) }
    );
  };

  const handleDeleteMatch = async (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      description: 'Delete this match? This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    deleteMatch.mutate(matchId, { onError: (e) => toast.error(e.message) });
  };

  if (!tournamentId) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto text-error-600 dark:text-error-500">Missing tournament ID</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate(`/tournaments/${tournamentId}`)}
          className="mb-3 flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <FiChevronLeft className="size-4" />
          Tournament
        </button>

        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fixtures</h1>
          <button
            onClick={() => setShowAddGame(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
          >
            <FiPlus className="size-4" />
            Add Game
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              <option value="Round Robin">Round Robin</option>
              <option value="Knockout">Knockout</option>
              <option value="League">League</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Round</label>
            <select
              value={round}
              onChange={(e) => setRound(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              <option value="Group stage">Group stage</option>
              <option value="Quarter Finals">Quarter Finals</option>
              <option value="Semi Finals">Semi Finals</option>
              <option value="Finals">Finals</option>
            </select>
          </div>
        </div>

        <div className="mb-6 inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
          {['A', 'B', 'C', 'D'].map((group) => (
            <button
              key={group}
              onClick={() => setActiveGroup(group)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeGroup === group
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
              }`}
            >
              Group {group}
            </button>
          ))}
        </div>

        {matchesQuery.isPending && <div className="text-gray-500 dark:text-gray-400 py-4">Loading fixtures…</div>}
        {matchesQuery.error && (
          <div className="mb-4 p-4 bg-error-50 border border-error-100 rounded-lg text-error-700 text-sm dark:bg-error-500/10 dark:border-error-500/30 dark:text-error-500">
            {matchesQuery.error instanceof Error ? matchesQuery.error.message : 'Failed to load matches'}
          </div>
        )}

        {!matchesQuery.isPending && games.length === 0 && (
          <div className="text-center py-12 rounded-2xl border border-gray-200 bg-gray-50 dark:bg-white/[0.02] dark:border-gray-800">
            <p className="text-gray-500 dark:text-gray-400 text-sm">No games scheduled yet.</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {games.map((game, index) => {
            const hasScore = game.homeScore != null && game.awayScore != null;
            const badge = STATUS_BADGE[game.status];
            return (
            <div
              key={game.id}
              className="group rounded-2xl border border-gray-200 bg-white transition-colors hover:border-gray-300 dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700"
            >
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600">
                    Game {index + 1}
                  </span>
                  <StatusBadge label={badge.label} tone={badge.tone} />
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(game.matchCode); toast.success('Match code copied!'); }}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
                    title="Copy match code"
                  >
                    <CopyIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => openEditMatch(game.id, e)}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
                    title="Edit match"
                  >
                    <FiEdit2 size={16} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteMatch(game.id, e)}
                    disabled={deleteMatch.isPending}
                    className="p-1.5 rounded-lg text-error-500 hover:bg-error-50 disabled:opacity-70 dark:hover:bg-error-500/10"
                    title="Delete match"
                  >
                    <FiTrash size={16} />
                  </button>
                </div>
              </div>

              <div
                className="cursor-pointer px-5 py-5"
                onClick={() => navigate(`/tournaments/${tournamentId}/match/${game.id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 flex-col items-center gap-2 min-w-0">
                    <div className="flex size-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
                      <img src="/ball1.png" alt="" className="size-7 object-contain" />
                    </div>
                    <span className="max-w-full truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{game.homeTeam}</span>
                  </div>

                  <div className="shrink-0 px-2 text-center">
                    {hasScore ? (
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">
                        {game.homeScore}<span className="mx-1 text-gray-300 dark:text-gray-700">–</span>{game.awayScore}
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-gray-400 dark:text-gray-600">VS</div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col items-center gap-2 min-w-0">
                    <div className="flex size-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
                      <img src="/ball2.png" alt="" className="size-7 object-contain" />
                    </div>
                    <span className="max-w-full truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{game.awayTeam}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 border-t border-gray-100 px-5 py-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <FiCalendar className="size-3.5" />
                  {game.date} · {game.time}
                </span>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <span className="flex items-center gap-1.5">
                  <FiMapPin className="size-3.5" />
                  {game.venue}
                </span>
              </div>
            </div>
            );
          })}
        </div>

        <Modal open={!!editingMatchId} onClose={() => setEditingMatchId(null)} title="Edit Match" size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
              <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
              <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Venue</label>
              <input type="text" value={editVenue} onChange={(e) => setEditVenue(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]" placeholder="Court" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as typeof editStatus)} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
                <option value="SCHEDULED">Scheduled</option>
                <option value="LIVE">Live</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="POSTPONED">Postponed</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setEditingMatchId(null)} className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">Cancel</button>
            <button onClick={handleSaveEditMatch} disabled={updateMatch.isPending} className="px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-70">{updateMatch.isPending ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>

        <Modal open={showAddGame} onClose={() => setShowAddGame(false)} title="Add Game" size="md">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Home team *</label>
                <select
                  value={newHomeTeamId}
                  onChange={(e) => setNewHomeTeamId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">Select team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Away team *</label>
                <select
                  value={newAwayTeamId}
                  onChange={(e) => setNewAwayTeamId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                >
                  <option value="">Select team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Venue</label>
                <input
                  type="text"
                  value={newVenue}
                  onChange={(e) => setNewVenue(e.target.value)}
                  placeholder="Court"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAddGame}
                disabled={createMatch.isPending}
                className="px-6 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-70"
              >
                {createMatch.isPending ? 'Creating…' : 'Create match'}
              </button>
              <button
                onClick={() => setShowAddGame(false)}
                className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default Fixtures;

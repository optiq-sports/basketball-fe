import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiMapPin, FiCalendar, FiEdit2, FiTrash2, FiUserPlus, FiChevronLeft, FiChevronDown } from 'react-icons/fi';
import { LuTrophy } from 'react-icons/lu';
import type { ColumnDef } from '@tanstack/react-table';
import { useTournament, useMatches, useTeams, useUpdateTournament, useDeleteTournament, useTournamentAddTeams } from '../../api/hooks';
import type { Match as ApiMatch, TournamentDivision } from '../../types/api';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import DataTable from '../../components/ui/DataTable';

// Copy Icon Component
const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

type LeaderStat = 'points' | 'rebounds' | 'assists' | 'blocks' | 'steals';

const LEADER_STAT_LABELS: Record<LeaderStat, string> = {
  points: 'PTS',
  rebounds: 'REB',
  assists: 'AST',
  blocks: 'BLK',
  steals: 'STL',
};

const LEADER_COLORS = ['#FFCA69', '#80B7D5', '#7FD99A'];

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
  homeScore?: number;
  awayScore?: number;
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

function formatDateOnly(date?: string): string {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return date;
  }
}

const CompetitionDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id: tournamentId } = useParams<{ id: string }>();
  const [activeGroup, setActiveGroup] = useState('A');
  const [activeLeaderStat, setActiveLeaderStat] = useState<LeaderStat>('points');
  const [showSchedules, setShowSchedules] = useState(true);

  const tournamentQuery = useTournament(tournamentId);
  const matchesQuery = useMatches(tournamentId);
  const teamsQuery = useTeams();
  const updateTournament = useUpdateTournament();
  const deleteTournament = useDeleteTournament();
  const { confirm, dialogProps } = useConfirmDialog();
  const toast = useToast();
  const addTeams = useTournamentAddTeams();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddTeamsModal, setShowAddTeamsModal] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [editForm, setEditForm] = useState({
    name: '',
    division: 'PREMIER' as TournamentDivision,
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
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        matchCode: m.matchCode ?? m.id,
      };
    });
  }, [matchesRaw, teamMap]);

  const ongoingMatch = useMemo(() => matches.find((m) => m.hasStarted) ?? null, [matches]);

  const existingTeamIds = useMemo<Set<string>>(() => {
    const tournamentTeams = (tournament as Record<string, unknown> | undefined)?.teams as Array<{ teamId: string }> | undefined ?? [];
    return new Set(tournamentTeams.map((tt) => tt.teamId));
  }, [tournament]);

  const teams: DisplayTeam[] = useMemo(() => {
    if (!tournament) return [];
    const tournamentTeams = (tournament as Record<string, unknown>).teams as Array<{ teamId: string; team: { id: string; name: string; color: string } }> ?? [];
    const completedMatches = matchesRaw.filter(m => m.status === 'COMPLETED');

    const statsMap: Record<string, { gp: number; w: number; l: number }> = {};
    for (const tt of tournamentTeams) statsMap[tt.teamId] = { gp: 0, w: 0, l: 0 };

    for (const m of completedMatches) {
      const home = m.homeTeamId;
      const away = m.awayTeamId;
      if (!statsMap[home]) statsMap[home] = { gp: 0, w: 0, l: 0 };
      if (!statsMap[away]) statsMap[away] = { gp: 0, w: 0, l: 0 };
      statsMap[home].gp++;
      statsMap[away].gp++;
      const hs = m.homeScore ?? 0;
      const as_ = m.awayScore ?? 0;
      if (hs > as_) { statsMap[home].w++; statsMap[away].l++; }
      else if (as_ > hs) { statsMap[away].w++; statsMap[home].l++; }
    }

    return tournamentTeams
      .map((tt, i) => {
        const s = statsMap[tt.teamId] ?? { gp: 0, w: 0, l: 0 };
        const pct = s.gp > 0 ? Math.round((s.w / s.gp) * 1000) / 10 : 0;
        return {
          id: tt.team.id,
          name: tt.team.name,
          color: tt.team.color === 'yellow' || tt.team.color === 'blue' ? tt.team.color : (i % 2 === 0 ? 'yellow' : 'blue'),
          gp: s.gp,
          w: s.w,
          l: s.l,
          percent: pct,
          points: s.w * 2,
        };
      })
      .sort((a, b) => b.points - a.points || b.percent - a.percent);
  }, [tournament, matchesRaw]);

  const tournamentLeaders = useMemo(() => {
    const playerMap: Record<string, {
      playerId: string; name: string; matchId: string;
      points: number; rebounds: number; assists: number; blocks: number; steals: number; gp: number;
    }> = {};

    for (const m of matchesRaw) {
      const stats = (m as Record<string, unknown>).stats as Array<{
        playerId: string; points: number; rebounds: number; assists: number; blocks: number; steals: number;
        player?: { firstName: string; lastName: string };
      }> | undefined;
      if (!stats) continue;
      for (const s of stats) {
        if (!playerMap[s.playerId]) {
          playerMap[s.playerId] = {
            playerId: s.playerId,
            name: s.player ? `${s.player.firstName} ${s.player.lastName}` : '—',
            matchId: m.id,
            points: 0, rebounds: 0, assists: 0, blocks: 0, steals: 0, gp: 0,
          };
        }
        playerMap[s.playerId].points += s.points ?? 0;
        playerMap[s.playerId].rebounds += s.rebounds ?? 0;
        playerMap[s.playerId].assists += s.assists ?? 0;
        playerMap[s.playerId].blocks += s.blocks ?? 0;
        playerMap[s.playerId].steals += s.steals ?? 0;
        playerMap[s.playerId].gp++;
      }
    }

    return Object.values(playerMap)
      .sort((a, b) => b[activeLeaderStat] - a[activeLeaderStat])
      .slice(0, 3);
  }, [matchesRaw, activeLeaderStat]);

  const openEditModal = () => {
    const t = tournamentQuery.data;
    if (!t) return;
    setEditForm({
      name: t.name,
      division: t.division ?? 'PREMIER',
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
      toast.error('Please fill name, venue, start and end date.');
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
      { onSuccess: () => setShowEditModal(false), onError: (e) => toast.error(e.message) }
    );
  };

  const handleDeleteTournament = async () => {
    if (!tournamentId) return;
    const ok = await confirm({
      description: `Delete tournament "${tournament?.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    deleteTournament.mutate(tournamentId, {
      onSuccess: () => navigate('/tournaments'),
      onError: (e) => toast.error(e.message),
    });
  };

  const handleAddTeams = () => {
    if (!tournamentId || selectedTeamIds.length === 0) {
      toast.error('Please select at least one team.');
      return;
    }
    addTeams.mutate(
      { tournamentId, body: { teamIds: selectedTeamIds } },
      {
        onSuccess: () => {
          setShowAddTeamsModal(false);
          setSelectedTeamIds([]);
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  if (tournamentQuery.isPending || !tournamentId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto text-gray-500 dark:text-gray-400">Loading tournament…</div>
      </div>
    );
  }
  if (tournamentQuery.error || !tournament) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto text-error-600 dark:text-error-500">
          {tournamentQuery.error instanceof Error ? tournamentQuery.error.message : 'Tournament not found'}
        </div>
      </div>
    );
  }

  const standingsColumns: ColumnDef<DisplayTeam>[] = [
    {
      accessorKey: 'name',
      header: 'Team',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <img
            src={row.original.color === 'yellow' ? '/ball1.png' : '/ball2.png'}
            alt="Basketball"
            style={{ width: '28px', height: '28px' }}
            className="object-contain"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">{row.original.name}</span>
        </div>
      ),
    },
    { accessorKey: 'gp', header: 'GP' },
    { accessorKey: 'w', header: 'W' },
    { accessorKey: 'l', header: 'L' },
    { accessorKey: 'percent', header: '%' },
    { accessorKey: 'points', header: 'Points' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {tournament.flyer && (
          <div className="mb-6 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800" style={{ maxHeight: '220px' }}>
            <img src={tournament.flyer} alt="Tournament flyer" className="w-full object-cover object-top" style={{ maxHeight: '220px' }} />
          </div>
        )}

        <button
          onClick={() => navigate('/tournaments')}
          className="mb-3 flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <FiChevronLeft className="size-4" />
          Tournaments
        </button>

        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{tournament.name}</h1>
            {(tournament.venue || tournament.startDate) && (
              <div className="mt-1.5 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                {tournament.venue && (
                  <span className="flex items-center gap-1.5">
                    <FiMapPin className="size-3.5" />
                    {tournament.venue}
                  </span>
                )}
                {tournament.startDate && (
                  <span className="flex items-center gap-1.5">
                    <FiCalendar className="size-3.5" />
                    {formatDateOnly(tournament.startDate)}
                    {tournament.endDate && tournament.endDate !== tournament.startDate
                      ? ` – ${formatDateOnly(tournament.endDate)}`
                      : ''}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openEditModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-white/5"
            >
              <FiEdit2 className="size-4" />
              Edit
            </button>
            <button
              onClick={() => setShowAddTeamsModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-white/5"
            >
              <FiUserPlus className="size-4" />
              Add Teams
            </button>
            <button
              onClick={() => navigate(`/tournaments/${tournamentId}/fixtures`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
            >
              <FiCalendar className="size-4" />
              View Fixtures
            </button>
            <button
              onClick={handleDeleteTournament}
              disabled={deleteTournament.isPending}
              title="Delete tournament"
              className="flex items-center justify-center size-9 rounded-lg text-error-500 hover:bg-error-50 transition-colors disabled:opacity-70 dark:hover:bg-error-500/10"
            >
              <FiTrash2 className="size-4" />
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Teams', value: teams.length },
            { label: 'Games played', value: matchesRaw.filter((m) => m.status === 'COMPLETED').length },
            { label: 'Total games', value: (tournament.numberOfGames as number) ?? matchesRaw.length },
            { label: 'Division', value: (tournament.division as string)?.replace(/_/g, ' ') ?? '—' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{stat.label}</p>
              <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white capitalize">{stat.value}</p>
            </div>
          ))}
        </div>

        {showAddTeamsModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto dark:bg-gray-900">
              <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Add Teams to Tournament</h2>
              </div>
              <div className="p-6 space-y-2 max-h-64 overflow-y-auto">
                {(teamsQuery.data ?? []).filter((team) => !existingTeamIds.has(team.id)).map((team) => (
                  <label key={team.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
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
                      className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-700"
                    />
                    <span className="text-sm font-medium text-gray-800 dark:text-white">{team.name}</span>
                  </label>
                ))}
                {(teamsQuery.data ?? []).filter((team) => !existingTeamIds.has(team.id)).length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(teamsQuery.data ?? []).length === 0
                      ? 'No teams available. Create teams first from Teams Management.'
                      : 'All teams are already in this tournament.'}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
                <button onClick={() => { setShowAddTeamsModal(false); setSelectedTeamIds([]); }} className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">Cancel</button>
                <button onClick={handleAddTeams} disabled={addTeams.isPending || selectedTeamIds.length === 0} className="px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-70 disabled:cursor-not-allowed">{addTeams.isPending ? 'Adding…' : 'Add Teams'}</button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto dark:bg-gray-900">
              <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Edit Tournament</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Name *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Venue *</label>
                  <input
                    type="text"
                    value={editForm.venue}
                    onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Start date *</label>
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">End date *</label>
                    <input
                      type="date"
                      value={editForm.endDate}
                      onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Number of games</label>
                    <input
                      type="number"
                      min={1}
                      value={editForm.numberOfGames}
                      onChange={(e) => setEditForm({ ...editForm, numberOfGames: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Quarters</label>
                    <input
                      type="number"
                      min={1}
                      value={editForm.numberOfQuarters}
                      onChange={(e) => setEditForm({ ...editForm, numberOfQuarters: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
                <button onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5">Cancel</button>
                <button onClick={handleSaveEdit} disabled={updateTournament.isPending} className="px-4 py-2 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-70">{updateTournament.isPending ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        {matchesQuery.isPending && <div className="text-gray-500 dark:text-gray-400 mb-4">Loading matches…</div>}
        {matchesQuery.error && (
          <div className="mb-4 p-4 bg-error-50 border border-error-100 rounded-lg text-error-700 text-sm dark:bg-error-500/10 dark:border-error-500/30 dark:text-error-500">
            {matchesQuery.error instanceof Error ? matchesQuery.error.message : 'Failed to load matches'}
          </div>
        )}

        {ongoingMatch && (
        <div
          className="rounded-2xl p-6 mb-6 border border-gray-200 bg-white cursor-pointer transition-colors hover:border-gray-300 dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700"
          onClick={() => navigate(`/tournaments/${tournamentId}/match/${ongoingMatch.id}`)}
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ongoing Game</h2>
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(ongoingMatch.matchCode ?? ongoingMatch.id); toast.success('Match code copied!'); }}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors dark:text-gray-400 dark:hover:text-gray-200"
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
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{ongoingMatch.teamA}</div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">{ongoingMatch.homeScore ?? 0}</div>
              </div>
            </div>

            <div className="text-lg text-gray-400 dark:text-gray-500 font-medium">VS</div>

            <div className="flex items-center gap-4">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 text-right">{ongoingMatch.teamB}</div>
                <div className="text-4xl font-bold text-gray-900 dark:text-white">{ongoingMatch.awayScore ?? 0}</div>
              </div>
              <div className="flex items-center justify-center">
                <img src="/ball2.png" alt="Basketball" style={{ width: '35px', height: '35px' }} className="object-contain" />
              </div>
            </div>
          </div>

          <div className="text-center mt-4 text-xs text-gray-400 dark:text-gray-500">
            {tournament.name} | {ongoingMatch.time}
          </div>
        </div>
        )}

        {/* Group Tabs */}
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

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Standings Table */}
          <div className="rounded-2xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800">
            <div className="border-b border-gray-100 p-5 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Group {activeGroup} Standings</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {matchesRaw.filter(m => m.status === 'COMPLETED').length}/{tournament.numberOfGames as number ?? '—'} games played
              </p>
            </div>
            <div className="p-5 pt-0">
              <DataTable
                columns={standingsColumns}
                data={teams}
                pageSize={20}
                emptyMessage="No teams in this tournament yet."
              />
            </div>
          </div>

          {/* Fixtures List */}
          <div className="rounded-2xl border border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-800">
            <div className="flex justify-between items-center border-b border-gray-100 p-5 dark:border-gray-800">
              <button
                onClick={() => setShowSchedules(!showSchedules)}
                className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white"
              >
                <FiChevronDown className={`size-4 text-gray-400 transition-transform ${showSchedules ? '' : '-rotate-90'}`} />
                Schedules ({matches.length})
              </button>
              <button
                onClick={() => navigate(`/tournaments/${tournamentId}/fixtures`)}
                className="text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium cursor-pointer"
              >
                View All
              </button>
            </div>
            {showSchedules && (
            <div className="space-y-3 p-5">
            {matches.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No matches scheduled yet.</p>
            )}
            {matches.map((match) => (
              <div
                key={match.id}
                className="rounded-xl border border-gray-200 bg-gray-50 p-4 cursor-pointer transition-colors hover:border-gray-300 dark:bg-white/[0.02] dark:border-gray-800 dark:hover:border-gray-700"
                onClick={() => navigate(match.hasStarted ? `/tournaments/${tournamentId}/match/${match.id}` : `/tournaments/${tournamentId}/match/${match.id}/pending`)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-1 items-center justify-center gap-3 min-w-0">
                    <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
                      <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{match.teamA}</span>
                      <img
                        src={match.teamAColor === 'yellow' ? '/ball1.png' : '/ball2.png'}
                        alt=""
                        className="size-6 shrink-0 object-contain"
                      />
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-gray-400 dark:text-gray-600">VS</span>
                    <div className="flex flex-1 items-center gap-2 min-w-0">
                      <img
                        src={match.teamBColor === 'yellow' ? '/ball1.png' : '/ball2.png'}
                        alt=""
                        className="size-6 shrink-0 object-contain"
                      />
                      <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{match.teamB}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(match.matchCode ?? match.id); toast.success('Match code copied!'); }}
                    className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-white hover:text-gray-600 dark:hover:bg-white/5 dark:hover:text-gray-300"
                    title="Copy match code"
                  >
                    <CopyIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-2.5 flex items-center justify-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>{match.venue}</span>
                  <span className="text-gray-300 dark:text-gray-700">•</span>
                  <span>{match.time}</span>
                </div>
              </div>
            ))}
            </div>
            )}
          </div>
        </div>

        {/* Tournament Leaders Section */}
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Tournament Leaders</h2>

          {/* Stats Tabs */}
          <div className="mb-6 inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
            {(['points', 'rebounds', 'assists', 'blocks', 'steals'] as LeaderStat[]).map((stat) => (
              <button
                key={stat}
                onClick={() => setActiveLeaderStat(stat)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeLeaderStat === stat
                    ? 'bg-brand-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5'
                }`}
              >
                {stat.charAt(0).toUpperCase() + stat.slice(1)}
              </button>
            ))}
          </div>

          {/* Player Cards */}
          {tournamentLeaders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center py-12 bg-gray-50 rounded-2xl border border-gray-200 dark:bg-white/[0.02] dark:border-gray-800">
              <LuTrophy className="size-8 text-gray-300 dark:text-gray-700" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">No stats recorded yet for this tournament.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {tournamentLeaders.map((player, i) => (
                <div
                  key={player.playerId}
                  className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 cursor-pointer transition-colors hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
                  onClick={() => navigate(
                    `/tournaments/${tournamentId}/match/${player.matchId}/player/${player.playerId}`,
                    { state: { from: 'tournament-leaders', tournamentId } }
                  )}
                >
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                    style={{ backgroundColor: LEADER_COLORS[i % LEADER_COLORS.length] }}
                  >
                    #{i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-gray-900 dark:text-white">{player.name}</div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold text-brand-600 dark:text-brand-400">{player[activeLeaderStat]}</span>{' '}
                      {LEADER_STAT_LABELS[activeLeaderStat]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default CompetitionDetailPage;
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFilter, FiChevronDown, FiEdit2, FiTrash, FiUserMinus, FiUpload, FiCopy, FiCheck } from 'react-icons/fi';
import { MdCancel } from 'react-icons/md';
import { Country } from 'country-state-city';
import type { ColumnDef } from '@tanstack/react-table';
import { usePlayers, useTeams, useCreatePlayerForTeam, useUpdatePlayer, useDeletePlayer, useRemovePlayerFromTeam, useUploadPlayersExcel, useUploadFile, useMergePlayers } from '../../api/hooks';
import type { Player as ApiPlayer } from '../../types/api';
import { resolvePlayerPhotoUrl, handlePhotoLoadError } from '../../utils/playerPhotoPlaceholder';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import DataTable from '../../components/ui/DataTable';
import PlayerProfileModal from './PlayerProfileModal';

const allCountries = Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name));

/** Display-only formatting — position data stays as-is for filtering/matching. */
function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

const POSITION_OPTIONS = [
  { value: 'POINT_GUARD', label: 'Point Guard' },
  { value: 'SHOOTING_GUARD', label: 'Shooting Guard' },
  { value: 'SMALL_FORWARD', label: 'Small Forward' },
  { value: 'POWER_FORWARD', label: 'Power Forward' },
  { value: 'CENTER', label: 'Center' },
] as const;

interface PlayerDisplay {
  id: string;
  name: string;
  surname: string;
  number: string;
  image: string;
  teamId: string;
  teamName: string;
  position: string;
  country: string;
  height: string;
  dob: string;
}

const Players: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('All');
  const [positionFilter, setPositionFilter] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerDisplay | null>(null);
  const [releasePlayer, setReleasePlayer] = useState<PlayerDisplay | null>(null);
  const [releaseDate, setReleaseDate] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTeamId, setUploadTeamId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<import('../../types/api').PlayerUploadResult | null>(null);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeDuplicateId, setMergeDuplicateId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 250);

  const playersQuery = usePlayers();
  const teamsQuery = useTeams();
  const createPlayer = useCreatePlayerForTeam();
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();
  const removePlayerFromTeam = useRemovePlayerFromTeam();
  const uploadPlayersExcel = useUploadPlayersExcel();
  const uploadImageFile = useUploadFile();
  const mergePlayers = useMergePlayers();
  const { confirm, dialogProps } = useConfirmDialog();
  const toast = useToast();

  const teamMap = useMemo(() => {
    const map = new Map<string, string>();
    (teamsQuery.data ?? []).forEach((t) => map.set(t.id, t.name));
    return map;
  }, [teamsQuery.data]);

  const players = useMemo(() => {
    return (playersQuery.data ?? []).map((p: ApiPlayer): PlayerDisplay => {
      const topLevelTeamName = (p as { teamName?: string | null }).teamName ?? undefined;
      const resolvedTeamName =
        topLevelTeamName ??
        (p.teamId && teamMap.get(p.teamId as string)) ??
        '—';
      return {
        id: p.id,
        name: p.firstName,
        surname: p.lastName,
        number: String(p.jerseyNumber ?? ''),
        image: resolvePlayerPhotoUrl((p as { photo?: string }).photo, p.id),
        teamId: (p.teamId as string) ?? '',
        teamName: resolvedTeamName,
        position:
          typeof p.position === 'string' && p.position.includes('_')
            ? p.position.replace(/_/g, ' ')
            : (p.position as string),
        country: (p as { country?: string }).country ?? '',
        height: p.height ?? '',
        dob: p.dateOfBirth ?? '',
      };
    });
  }, [playersQuery.data, teamMap]);

  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    number: '',
    teamId: '',
    teamName: '',
    position: 'POINT_GUARD' as string,
    country: '',
    height: '',
    dob: '',
  });
  const [portraitFile, setPortraitFile] = useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);

  const uniqueTeams = useMemo(() => (teamsQuery.data ?? []).map((t) => ({ id: t.id, name: t.name })), [teamsQuery.data]);
  const uniquePositions = POSITION_OPTIONS.map((o) => o.label);

  const filteredPlayers = useMemo(() => {
    let filtered = players;
    if (teamFilter !== 'All') {
      filtered = filtered.filter((p) => p.teamName === teamFilter || p.teamId === teamFilter);
    }
    if (positionFilter !== 'All') {
      const posValue = POSITION_OPTIONS.find((o) => o.label === positionFilter)?.value ?? positionFilter;
      filtered = filtered.filter((p) => p.position === positionFilter || p.position.replace(/\s/g, '_') === posValue);
    }
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.surname.toLowerCase().includes(q) ||
          p.number.includes(q) ||
          p.teamName.toLowerCase().includes(q) ||
          p.position.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [debouncedSearchQuery, teamFilter, positionFilter, players]);

  const handlePlayerClick = useCallback((player: PlayerDisplay) => {
    setSelectedPlayerId(player.id);
  }, []);

  const handleEditPlayer = (player: PlayerDisplay, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPlayer(player);
    const posValue = POSITION_OPTIONS.find((o) => o.label === player.position)?.value ?? player.position.replace(/\s/g, '_');
    setFormData({
      name: player.name,
      surname: player.surname,
      number: player.number,
      teamId: player.teamId,
      teamName: player.teamName,
      position: posValue,
      country: player.country,
      height: player.height,
      dob: player.dob,
    });
    setIsModalOpen(true);
  };

  const handleDeletePlayer = async (player: PlayerDisplay, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({
      description: `Delete ${player.name} ${player.surname}? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (ok) {
      deletePlayer.mutate(player.id, { onError: (err) => toast.error(err.message) });
    }
  };

  const handleReleaseClick = (player: PlayerDisplay, e: React.MouseEvent) => {
    e.stopPropagation();
    setReleasePlayer(player);
    setReleaseDate('');
  };

  const handleConfirmRelease = () => {
    if (!releasePlayer || !releasePlayer.teamId) return;
    removePlayerFromTeam.mutate(
      { playerId: releasePlayer.id, teamId: releasePlayer.teamId },
      { onSuccess: () => { setReleasePlayer(null); setReleaseDate(''); }, onError: (e) => toast.error(e.message) }
    );
  };

  const handleOpenUploadModal = () => {
    setUploadTeamId(uniqueTeams[0]?.id ?? '');
    setUploadFile(null);
    setUploadResult(null);
    setIsUploadModalOpen(true);
  };

  const handleUploadExcel = () => {
    if (!uploadTeamId) {
      toast.error('Please select a team');
      return;
    }
    if (!uploadFile) {
      toast.error('Please select an Excel file (.xlsx)');
      return;
    }
    const ext = uploadFile.name.toLowerCase().split('.').pop();
    if (ext !== 'xlsx') {
      toast.error('Only .xlsx files are supported');
      return;
    }
    uploadPlayersExcel.mutate(
      { teamId: uploadTeamId, file: uploadFile },
      {
        onSuccess: (data) => {
          setUploadResult(data ?? null);
        },
        onError: () => {
          setUploadResult(null);
        },
      }
    );
  };

  const handleCloseUploadModal = () => {
    setIsUploadModalOpen(false);
    setUploadTeamId('');
    setUploadFile(null);
    setUploadResult(null);
    setCopiedToClipboard(false);
  };

  const handleCopyUploadResult = () => {
    if (!uploadResult?.details?.length) return;
    const lines: string[] = ['Duplicate players (skipped):'];
    uploadResult.details.forEach((d) => {
      lines.push(`  Row ${d.row}: ${d.player}`);
    });
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedToClipboard(true);
      window.setTimeout(() => setCopiedToClipboard(false), 2000);
    }).catch(() => {});
  };

  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setPortraitFile(null);
    setPortraitPreview(null);
    setFormData({
      name: '',
      surname: '',
      number: '',
      teamId: uniqueTeams[0]?.id ?? '',
      teamName: uniqueTeams[0]?.name ?? '',
      position: 'POINT_GUARD',
      country: '',
      height: '',
      dob: '',
    });
    setIsModalOpen(true);
  };

  const handleSavePlayer = () => {
    if (!formData.name || !formData.surname || !formData.number) {
      toast.error('Please fill in first name, last name and jersey number');
      return;
    }
    const jerseyNum = parseInt(formData.number, 10);
    if (Number.isNaN(jerseyNum)) {
      toast.error('Jersey number must be a number');
      return;
    }
    const position = formData.position as 'POINT_GUARD' | 'SHOOTING_GUARD' | 'SMALL_FORWARD' | 'POWER_FORWARD' | 'CENTER';

    const doUpdate = async (photoUrl?: string) => {
      const data: Parameters<typeof updatePlayer.mutate>[0]['data'] = {
        firstName: formData.name,
        lastName: formData.surname,
        position,
        height: formData.height || undefined,
        dateOfBirth: formData.dob || undefined,
      };
      if (photoUrl) data.photo = photoUrl;
      updatePlayer.mutate(
        { id: editingPlayer!.id, data },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setEditingPlayer(null);
            setPortraitFile(null);
            setPortraitPreview(null);
            setFormData({ name: '', surname: '', number: '', teamId: '', teamName: '', position: 'POINT_GUARD', country: '', height: '', dob: '' });
          },
          onError: (e) => toast.error(e.message),
        }
      );
    };

    const doCreate = async (photoUrl?: string) => {
      const payload: Parameters<typeof createPlayer.mutate>[0] = {
        teamId: formData.teamId,
        firstName: formData.name,
        lastName: formData.surname,
        jerseyNumber: jerseyNum,
        position,
        height: formData.height || undefined,
        dateOfBirth: formData.dob || undefined,
        photo: photoUrl || undefined,
      };
      createPlayer.mutate(payload, {
        onSuccess: () => {
          setIsModalOpen(false);
          setPortraitFile(null);
          setPortraitPreview(null);
          setFormData({ name: '', surname: '', number: '', teamId: '', teamName: '', position: 'POINT_GUARD', country: '', height: '', dob: '' });
        },
        onError: (e) => toast.error(e.message),
      });
    };

    const runSubmit = async () => {
      if (editingPlayer) {
        // For edits, keep current behavior: upload (if any) then update.
        let photoUrl: string | undefined;
        if (portraitFile) {
          try {
            const res = await uploadImageFile.mutateAsync(portraitFile);
            photoUrl = res.url;
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Photo upload failed');
            return;
          }
        }
        doUpdate(photoUrl);
        return;
      }

      // For creates, avoid uploading images before we know the user can create players.
      if (!formData.teamId) {
        toast.error('Please select a team');
        return;
      }

      // 1) Create player without photo first.
      let created: ApiPlayer | undefined;
      try {
        const payload: Parameters<typeof createPlayer.mutateAsync>[0] = {
          teamId: formData.teamId,
          firstName: formData.name,
          lastName: formData.surname,
          jerseyNumber: jerseyNum,
          position,
          height: formData.height || undefined,
          dateOfBirth: formData.dob || undefined,
        };
        created = await createPlayer.mutateAsync(payload);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create player');
        return;
      }

      // 2) If no portrait selected, we're done.
      if (!portraitFile || !created) {
        setIsModalOpen(false);
        setPortraitFile(null);
        setPortraitPreview(null);
        setFormData({
          name: '',
          surname: '',
          number: '',
          teamId: '',
          teamName: '',
          position: 'POINT_GUARD',
          country: '',
          height: '',
          dob: '',
        });
        return;
      }

      // 3) If portrait exists, upload and then patch the player with the photo URL.
      try {
        const res = await uploadImageFile.mutateAsync(portraitFile);
        await updatePlayer.mutateAsync({
          id: created.id,
          data: { photo: res.url },
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Photo upload failed');
        // Even if photo upload fails, the player was created successfully.
      } finally {
        setIsModalOpen(false);
        setPortraitFile(null);
        setPortraitPreview(null);
        setFormData({
          name: '',
          surname: '',
          number: '',
          teamId: '',
          teamName: '',
          position: 'POINT_GUARD',
          country: '',
          height: '',
          dob: '',
        });
      }
    };

    runSubmit();
  };

  const columns = useMemo<ColumnDef<PlayerDisplay>[]>(
    () => [
      {
        accessorKey: 'number',
        header: '#',
        cell: ({ row }) => <span className="font-bold text-gray-900 dark:text-white">{row.original.number}</span>,
      },
      {
        accessorKey: 'name',
        header: 'Player',
        cell: ({ row }) => {
          const player = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                <img
                  src={player.image}
                  onError={handlePhotoLoadError(player.id)}
                  alt={`${player.name} ${player.surname}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="font-bold text-gray-900 dark:text-white">
                {player.name} {player.surname}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'teamName',
        header: 'Team',
        cell: ({ row }) => {
          const player = row.original;
          return player.teamId ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/teams-management/${player.teamId}`);
              }}
              className="text-brand-600 dark:text-brand-300 hover:underline font-medium text-left"
            >
              {player.teamName}
            </button>
          ) : (
            <span>{player.teamName}</span>
          );
        },
      },
      {
        accessorKey: 'position',
        header: 'Position',
        cell: ({ row }) => toTitleCase(row.original.position),
      },
      { accessorKey: 'country', header: 'Country' },
      {
        accessorKey: 'height',
        header: 'Height',
        cell: ({ row }) => row.original.height || '—',
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => {
          const player = row.original;
          return (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleEditPlayer(player, e)}
                className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors dark:text-brand-400 dark:hover:bg-brand-500/10"
                title="Edit Player"
              >
                <FiEdit2 size={18} />
              </button>
              {player.teamId && (
                <button
                  onClick={(e) => handleReleaseClick(player, e)}
                  className="p-2 text-warning-600 hover:bg-warning-50 rounded-lg transition-colors dark:text-warning-500 dark:hover:bg-warning-500/10"
                  title="Remove from team"
                >
                  <FiUserMinus size={18} />
                </button>
              )}
              <button
                onClick={(e) => handleDeletePlayer(player, e)}
                className="p-2 text-error-600 hover:bg-error-50 rounded-lg transition-colors dark:text-error-500 dark:hover:bg-error-500/10"
                title="Delete player"
              >
                <FiTrash size={18} />
              </button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate],
  );

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-950">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Players</h1>
      </div>

      {playersQuery.error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-error-50 border border-error-100 text-error-700 text-sm dark:bg-error-500/10 dark:border-error-500/30 dark:text-error-500">
          {playersQuery.error.message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <button
          onClick={handleAddPlayer}
          className="px-6 py-3 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors whitespace-nowrap"
        >
          Add Player
        </button>
        <button
          onClick={handleOpenUploadModal}
          disabled={uniqueTeams.length === 0}
          className="px-6 py-3 bg-white text-brand-600 border border-brand-500 rounded-lg font-medium hover:bg-brand-50 transition-colors whitespace-nowrap flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-900 dark:text-brand-400 dark:border-brand-500 dark:hover:bg-brand-500/10"
        >
          <FiUpload size={18} />
          Upload Excel
        </button>
        <button
          onClick={() => { setMergeDuplicateId(''); setMergeTargetId(''); setShowMergeModal(true); }}
          disabled={players.length < 2}
          className="px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-white/5"
        >
          Merge Players
        </button>
        <div className="relative" style={{ width: '250px', minWidth: '200px' }}>
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search Player"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
        <div className="relative">
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="appearance-none pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white text-gray-900 cursor-pointer min-w-[160px] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="All">All Teams</option>
            {uniqueTeams.map((team) => (
              <option key={team.id} value={team.name}>{team.name}</option>
            ))}
          </select>
          <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" size={18} />
          <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" size={18} />
        </div>
        <div className="relative">
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            className="appearance-none pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white text-gray-900 cursor-pointer min-w-[160px] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="All">All Positions</option>
            {uniquePositions.map((position) => (
              <option key={position} value={position}>{position}</option>
            ))}
          </select>
          <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" size={18} />
          <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" size={18} />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredPlayers}
        onRowClick={handlePlayerClick}
        isLoading={playersQuery.isPending}
        error={playersQuery.error ? (playersQuery.error as Error).message || 'Failed to load players.' : null}
        onRetry={() => playersQuery.refetch()}
        emptyMessage="No players found. Try adjusting your search or filter criteria."
      />

      {/* Merge Players Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md dark:bg-gray-900">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Merge Players</h2>
              <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
                The duplicate player's stats and team assignments are moved to the target player, then the duplicate is removed.
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Duplicate player (will be removed)</label>
                <select
                  value={mergeDuplicateId}
                  onChange={e => setMergeDuplicateId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  <option value="">Select duplicate…</option>
                  {players.filter(p => p.id !== mergeTargetId).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.surname} {p.number ? `#${p.number}` : ''} — {p.teamName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">Target player (will be kept)</label>
                <select
                  value={mergeTargetId}
                  onChange={e => setMergeTargetId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  <option value="">Select target…</option>
                  {players.filter(p => p.id !== mergeDuplicateId).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.surname} {p.number ? `#${p.number}` : ''} — {p.teamName}
                    </option>
                  ))}
                </select>
              </div>
              {mergeDuplicateId && mergeTargetId && (
                <div className="p-3 bg-warning-50 border border-warning-100 rounded-lg text-sm text-warning-700 dark:bg-warning-500/10 dark:border-warning-500/30 dark:text-warning-500">
                  <strong>{players.find(p => p.id === mergeDuplicateId)?.name} {players.find(p => p.id === mergeDuplicateId)?.surname}</strong> will be merged into <strong>{players.find(p => p.id === mergeTargetId)?.name} {players.find(p => p.id === mergeTargetId)?.surname}</strong> and permanently deleted.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                disabled={!mergeDuplicateId || !mergeTargetId || mergePlayers.isPending}
                onClick={() => {
                  mergePlayers.mutate(
                    { duplicatePlayerId: mergeDuplicateId, targetPlayerId: mergeTargetId },
                    {
                      onSuccess: () => { setShowMergeModal(false); setMergeDuplicateId(''); setMergeTargetId(''); },
                      onError: (e) => toast.error(e.message),
                    }
                  );
                }}
                className="px-4 py-2 bg-error-500 text-white rounded-lg font-medium hover:bg-error-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mergePlayers.isPending ? 'Merging…' : 'Confirm Merge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Release Player Modal */}
      {releasePlayer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-lg dark:bg-gray-900">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Release Player</h2>
              <button
                onClick={() => {
                  setReleasePlayer(null);
                  setReleaseDate('');
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors dark:text-gray-400 dark:hover:text-white"
              >
                <MdCancel size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Remove{' '}
                <span className="font-semibold">
                  {releasePlayer.name} {releasePlayer.surname}
                </span>
                {' '}from this team? They can be assigned to another team later.
              </p>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => { setReleasePlayer(null); setReleaseDate(''); }}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRelease}
                disabled={removePlayerFromTeam.isPending}
                className="px-5 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors disabled:opacity-70"
              >
                {removePlayerFromTeam.isPending ? 'Removing...' : 'Remove from team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Excel Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-lg dark:bg-gray-900">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Upload Player List (Excel)</h2>
              <button onClick={handleCloseUploadModal} className="text-gray-600 hover:text-gray-900 transition-colors dark:text-gray-400 dark:hover:text-white">
                <MdCancel size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {uploadResult ? (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  <div className="px-4 py-3 rounded-lg bg-success-50 border border-success-100 text-success-700 text-sm dark:bg-success-500/10 dark:border-success-500/30 dark:text-success-500">
                    <p><strong>Upload complete.</strong></p>
                    <p>
                      Processed: {uploadResult.totalProcessed ?? 0} |
                      Created: {uploadResult.created ?? uploadResult.createdCount ?? 0} |
                      <span className="text-error-600 dark:text-error-500"> Duplicates: {uploadResult.duplicatesFound ?? uploadResult.duplicatesCount ?? 0}</span>
                    </p>
                  </div>
                  {uploadResult.details && uploadResult.details.length > 0 && (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Upload details</h3>
                          <button
                            onClick={handleCopyUploadResult}
                            className={`p-1.5 rounded transition-colors ${copiedToClipboard ? 'text-success-600 bg-success-50 dark:text-success-500 dark:bg-success-500/10' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-white/5'}`}
                            title={copiedToClipboard ? 'Copied!' : 'Copy to clipboard'}
                            aria-label={copiedToClipboard ? 'Copied to clipboard' : 'Copy upload result to clipboard'}
                          >
                            {copiedToClipboard ? <FiCheck size={16} /> : <FiCopy size={16} />}
                          </button>
                        </div>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1.5 max-h-48 overflow-y-auto rounded border border-gray-200 p-3 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]">
                          {uploadResult.details.map((d, i) => (
                            <li key={i} className="flex flex-wrap gap-x-2 gap-y-0.5">
                              <span className="font-medium text-gray-800 dark:text-gray-200">Row {d.row}:</span>
                              <span>{d.player}</span>
                              {d.matchScore != null && <span className="text-gray-500 dark:text-gray-400">({d.matchScore}% match)</span>}
                              {d.action && <span className="text-warning-600 dark:text-warning-500">— {d.action}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {(() => {
                        const potentialDuplicates = (uploadResult.details ?? []).filter(
                          (d) => d.existingPlayerId && (d.matchScore != null || (d.action && /flag|potential|review|low/i.test(d.action)))
                        );
                        if (potentialDuplicates.length === 0) return null;
                        return (
                          <div>
                            <h3 className="text-sm font-semibold text-warning-700 dark:text-warning-500 mb-2">Potential duplicates (review)</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Lower-confidence matches. Merge into existing player or create as new.</p>
                            <ul className="text-sm space-y-2 max-h-48 overflow-y-auto rounded border border-warning-100 p-3 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/10">
                              {potentialDuplicates.map((d, i) => (
                                <li key={i} className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-gray-800 dark:text-gray-200">Row {d.row}:</span>
                                  <span>{d.player}</span>
                                  {d.matchScore != null && <span className="text-gray-600 dark:text-gray-400">({d.matchScore}% match)</span>}
                                  <span className="text-gray-500 dark:text-gray-400">→ existing ID: {d.existingPlayerId}</span>
                                  <span className="flex gap-1 ml-auto">
                                    {d.newPlayerId && d.existingPlayerId && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          mergePlayers.mutate(
                                            { duplicatePlayerId: d.newPlayerId!, targetPlayerId: d.existingPlayerId! },
                                            {
                                              onSuccess: () => {
                                                setUploadResult((prev) => prev ? {
                                                  ...prev,
                                                  details: (prev.details ?? []).filter((x) => !(x.row === d.row && x.existingPlayerId === d.existingPlayerId)),
                                                } : null);
                                              },
                                              onError: (e) => toast.error(e.message),
                                            }
                                          );
                                        }}
                                        disabled={mergePlayers.isPending}
                                        className="px-2 py-1 text-xs font-medium bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-70"
                                      >
                                        Merge with existing
                                      </button>
                                    )}
                                    <span className="text-xs text-gray-500 dark:text-gray-400 self-center" title="Add manually from Players if needed">Create as new (add from Players)</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })()}
                    </>
                  )}
                  {/* {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-red-700 mb-2">Errors</h3>
                      <ul className="text-sm text-red-600 space-y-1.5 max-h-32 overflow-y-auto rounded border border-red-200 p-3 bg-red-50">
                        {uploadResult.errors.map((e, i) => (
                          <li key={i}>
                            <span className="font-medium">Row {e.row}:</span> {e.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )} */}
                  <button
                    onClick={handleCloseUploadModal}
                    className="w-full px-4 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Team *</label>
                    <select
                      value={uploadTeamId}
                      onChange={(e) => setUploadTeamId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      aria-label="Select team for upload"
                    >
                      <option value="">Select team</option>
                      {uniqueTeams.map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Excel file (.xlsx) *</label>
                    <input
                      type="file"
                      accept=".xlsx"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-brand-50 file:text-brand-700 dark:border-gray-700 dark:text-white dark:file:bg-brand-500/10 dark:file:text-brand-400"
                    />
                    {uploadFile && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{uploadFile.name}</p>}
                  </div>
                  {uploadPlayersExcel.error && (
                    <div className="px-4 py-3 rounded-lg bg-error-50 border border-error-100 text-error-700 text-sm dark:bg-error-500/10 dark:border-error-500/30 dark:text-error-500">
                      {uploadPlayersExcel.error.message}
                    </div>
                  )}
                </>
              )}
            </div>
            {!uploadResult && (
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
                <button
                  onClick={handleCloseUploadModal}
                  className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadExcel}
                  disabled={uploadPlayersExcel.isPending || !uploadTeamId || !uploadFile}
                  className="px-5 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {uploadPlayersExcel.isPending ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Player Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {editingPlayer ? 'Edit Player' : 'Add Player'}
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingPlayer(null);
                  setPortraitFile(null);
                  setPortraitPreview(null);
                  setFormData({ name: '', surname: '', number: '', teamId: '', teamName: '', position: 'POINT_GUARD', country: '', height: '', dob: '' });
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors dark:text-gray-400 dark:hover:text-white"
              >
                <MdCancel size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Player portrait (PNG) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Player portrait (optional)</label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border border-gray-300 flex-shrink-0 dark:bg-white/5 dark:border-gray-700">
                      {portraitPreview ? (
                        <img src={portraitPreview} alt="Portrait preview" className="w-full h-full object-cover" />
                      ) : (
                        <img
                          src={
                            editingPlayer
                              ? editingPlayer.image
                              : resolvePlayerPhotoUrl(
                                  undefined,
                                  `new-${formData.name}-${formData.surname}-${formData.number}`
                                )
                          }
                          onError={handlePhotoLoadError(
                            editingPlayer?.id ?? `new-${formData.name}-${formData.surname}-${formData.number}`
                          )}
                          alt={editingPlayer ? 'Player portrait' : 'Default portrait preview'}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPortraitFile(file);
                            const url = URL.createObjectURL(file);
                            setPortraitPreview(url);
                          }
                        }}
                        className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-brand-50 file:text-brand-700 dark:file:bg-brand-500/10 dark:file:text-brand-400"
                      />
                      <p className="text-xs text-gray-500 mt-1 dark:text-gray-400">PNG or JPEG recommended</p>
                    </div>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">First Name *</label>
                  <input
                    type="text"
                    placeholder="Enter first name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                {/* Surname */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Last Name *</label>
                  <input
                    type="text"
                    placeholder="Enter last name"
                    value={formData.surname}
                    onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                {/* Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Jersey Number *</label>
                  <input
                    type="text"
                    placeholder="Enter jersey number"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Position</label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    {POSITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {!editingPlayer && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Team *</label>
                  <select
                    value={formData.teamId}
                    onChange={(e) => {
                      const team = uniqueTeams.find((t) => t.id === e.target.value);
                      setFormData({ ...formData, teamId: e.target.value, teamName: team?.name ?? '' });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">Select team</option>
                    {uniqueTeams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
                )}

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Country</label>
                  <select
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="">Select country</option>
                    {allCountries.map((c) => (
                      <option key={c.isoCode} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Height */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Height</label>
                  <input
                    type="text"
                    placeholder="e.g., 6'3&quot;"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingPlayer(null);
                  setPortraitFile(null);
                  setPortraitPreview(null);
                  setFormData({ name: '', surname: '', number: '', teamId: '', teamName: '', position: 'POINT_GUARD', country: '', height: '', dob: '' });
                }}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlayer}
                disabled={createPlayer.isPending || updatePlayer.isPending}
                className="px-6 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors disabled:opacity-70"
              >
                {createPlayer.isPending || updatePlayer.isPending ? 'Saving...' : editingPlayer ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog {...dialogProps} />
      <PlayerProfileModal playerId={selectedPlayerId} onClose={() => setSelectedPlayerId(null)} />
    </div>
  );
};

export default Players;

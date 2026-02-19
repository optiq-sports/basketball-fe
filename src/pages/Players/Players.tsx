import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFilter, FiChevronDown, FiEdit2, FiTrash, FiUserMinus, FiUpload, FiCopy, FiCheck } from 'react-icons/fi';
import { MdCancel } from 'react-icons/md';
import { usePlayers, useTeams, useCreatePlayerForTeam, useUpdatePlayer, useDeletePlayer, useRemovePlayerFromTeam, useUploadPlayersExcel } from '../../api/hooks';
import type { Player as ApiPlayer } from '../../types/api';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<PlayerDisplay | null>(null);
  const [releasePlayer, setReleasePlayer] = useState<PlayerDisplay | null>(null);
  const [releaseDate, setReleaseDate] = useState<string>('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadTeamId, setUploadTeamId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<import('../../types/api').PlayerUploadResult | null>(null);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const itemsPerPage = 10;

  const playersQuery = usePlayers();
  const teamsQuery = useTeams();
  const createPlayer = useCreatePlayerForTeam();
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();
  const removePlayerFromTeam = useRemovePlayerFromTeam();
  const uploadPlayersExcel = useUploadPlayersExcel();

  const teamMap = useMemo(() => {
    const map = new Map<string, string>();
    (teamsQuery.data ?? []).forEach((t) => map.set(t.id, t.name));
    return map;
  }, [teamsQuery.data]);

  const players = useMemo(() => {
    return (playersQuery.data ?? []).map((p: ApiPlayer): PlayerDisplay => ({
      id: p.id,
      name: p.firstName,
      surname: p.lastName,
      number: String(p.jerseyNumber ?? ''),
      image: '/player1.png',
      teamId: (p.teamId as string) ?? '',
      teamName: (p.teamId && teamMap.get(p.teamId as string)) ?? '—',
      position: typeof p.position === 'string' && p.position.includes('_') ? p.position.replace(/_/g, ' ') : (p.position as string),
      country: (p as { country?: string }).country ?? '',
      height: p.height ?? '',
      dob: p.dateOfBirth ?? '',
    }));
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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
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
  }, [searchQuery, teamFilter, positionFilter, players]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPlayers = filteredPlayers.slice(startIndex, endIndex);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [teamFilter, positionFilter, searchQuery]);

  const handlePlayerClick = (player: PlayerDisplay) => {
    navigate(`/players-management/${player.id}`);
  };

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

  const handleDeletePlayer = (player: PlayerDisplay, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete ${player.name} ${player.surname}? This cannot be undone.`)) {
      deletePlayer.mutate(player.id, { onError: (err) => alert(err.message) });
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
      { onSuccess: () => { setReleasePlayer(null); setReleaseDate(''); }, onError: (e) => alert(e.message) }
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
      alert('Please select a team');
      return;
    }
    if (!uploadFile) {
      alert('Please select an Excel file (.xlsx)');
      return;
    }
    const ext = uploadFile.name.toLowerCase().split('.').pop();
    if (ext !== 'xlsx') {
      alert('Only .xlsx files are supported');
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
      alert('Please fill in first name, last name and jersey number');
      return;
    }
    const jerseyNum = parseInt(formData.number, 10);
    if (Number.isNaN(jerseyNum)) {
      alert('Jersey number must be a number');
      return;
    }
    const position = formData.position as 'POINT_GUARD' | 'SHOOTING_GUARD' | 'SMALL_FORWARD' | 'POWER_FORWARD' | 'CENTER';

    const applyPortrait = (payload: Record<string, unknown>) => {
      if (!portraitFile) return payload;
      return new Promise<Record<string, unknown>>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ ...payload, image: reader.result as string });
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(portraitFile);
      });
    };

    const doUpdate = (data: Record<string, unknown>) => {
      updatePlayer.mutate(
        {
          id: editingPlayer!.id,
          data: data as Parameters<typeof updatePlayer.mutate>[0]['data'],
        },
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setEditingPlayer(null);
            setPortraitFile(null);
            setPortraitPreview(null);
            setFormData({ name: '', surname: '', number: '', teamId: '', teamName: '', position: 'POINT_GUARD', country: '', height: '', dob: '' });
          },
          onError: (e) => alert(e.message),
        }
      );
    };

    const doCreate = (payload: Record<string, unknown>) => {
      createPlayer.mutate(
        payload as Parameters<typeof createPlayer.mutate>[0],
        {
          onSuccess: () => {
            setIsModalOpen(false);
            setPortraitFile(null);
            setPortraitPreview(null);
            setFormData({ name: '', surname: '', number: '', teamId: '', teamName: '', position: 'POINT_GUARD', country: '', height: '', dob: '' });
          },
          onError: (e) => alert(e.message),
        }
      );
    };

    if (editingPlayer) {
      const baseData = {
        firstName: formData.name,
        lastName: formData.surname,
        position,
        height: formData.height || undefined,
        dateOfBirth: formData.dob || undefined,
      };
      applyPortrait(baseData).then(doUpdate);
    } else {
      if (!formData.teamId) {
        alert('Please select a team');
        return;
      }
      const basePayload = {
        teamId: formData.teamId,
        firstName: formData.name,
        lastName: formData.surname,
        jerseyNumber: jerseyNum,
        position,
        height: formData.height || undefined,
        dateOfBirth: formData.dob || undefined,
      };
      applyPortrait(basePayload).then(doCreate);
    }
  };


  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900">Players</h1>
      </div>

      {playersQuery.error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {playersQuery.error.message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <button
          onClick={handleAddPlayer}
          className="px-6 py-3 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors whitespace-nowrap"
        >
          Add Player
        </button>
        <button
          onClick={handleOpenUploadModal}
          disabled={uniqueTeams.length === 0}
          className="px-6 py-3 bg-white text-blue-900 border border-blue-900 rounded-lg font-medium hover:bg-blue-50 transition-colors whitespace-nowrap flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FiUpload size={18} />
          Upload Excel
        </button>
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
        <div className="relative">
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="appearance-none pl-10 pr-8 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white cursor-pointer min-w-[160px]"
          >
            <option value="All">All Teams</option>
            {uniqueTeams.map((team) => (
              <option key={team.id} value={team.name}>{team.name}</option>
            ))}
          </select>
          <FiFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
          <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
        </div>
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

      {playersQuery.isPending ? (
        <div className="py-12 text-center text-gray-500">Loading players...</div>
      ) : (
      <div className="overflow-x-auto rounded-lg border border-gray-200 mb-8">
        <table className="w-full">
          <thead>
            <tr style={{ background: '#F5F8FF' }}>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">#</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">PLAYER</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">TEAM</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">POSITION</th>
              <th className="text-left py-3 px-4 text-xs font-bold text-blue-900">COUNTRY</th>
              <th className="text-center py-3 px-4 text-xs font-bold text-blue-900">HEIGHT</th>
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
                        <img src={player.image} alt={`${player.name} ${player.surname}`} className="w-full h-full object-cover" />
                      </div>
                      <div className="text-sm font-bold text-blue-900">{player.name} {player.surname}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {player.teamId ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/teams-management/${player.teamId}`); }}
                        className="text-[#21409A] hover:underline font-medium text-left"
                      >
                        {player.teamName}
                      </button>
                    ) : (
                      <span>{player.teamName}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">{player.position}</td>
                  <td className="py-3 px-4 text-sm text-gray-700">{player.country}</td>
                  <td className="text-center py-3 px-4 text-sm text-gray-700">{player.height || '—'}</td>
                  <td className="text-center py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => handleEditPlayer(player, e)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Player"
                      >
                        <FiEdit2 size={18} />
                      </button>
                      {player.teamId && (
                        <button
                          onClick={(e) => handleReleaseClick(player, e)}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Remove from team"
                        >
                          <FiUserMinus size={18} />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDeletePlayer(player, e)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete player"
                      >
                        <FiTrash size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <p className="text-gray-500 text-lg">No players found</p>
                  <p className="text-gray-400 text-sm mt-2">Try adjusting your search or filter criteria</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
                Remove{' '}
                <span className="font-semibold">
                  {releasePlayer.name} {releasePlayer.surname}
                </span>
                {' '}from this team? They can be assigned to another team later.
              </p>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => { setReleasePlayer(null); setReleaseDate(''); }}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRelease}
                disabled={removePlayerFromTeam.isPending}
                className="px-5 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-70"
              >
                {removePlayerFromTeam.isPending ? 'Removing...' : 'Remove from team'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Excel Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-white/20 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-lg shadow-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Upload Player List (Excel)</h2>
              <button onClick={handleCloseUploadModal} className="text-gray-600 hover:text-gray-900 transition-colors">
                <MdCancel size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {uploadResult ? (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
                    <p><strong>Upload complete.</strong></p>
                    <p>
                      Processed: {uploadResult.totalProcessed ?? 0} |
                      Created: {uploadResult.created ?? uploadResult.createdCount ?? 0} |
                      <span className="text-red-600"> Duplicates: {uploadResult.duplicatesFound ?? uploadResult.duplicatesCount ?? 0}</span>
                    </p>
                  </div>
                  {uploadResult.details && uploadResult.details.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-700">Duplicate players (skipped)</h3>
                        <button
                          onClick={handleCopyUploadResult}
                          className={`p-1.5 rounded transition-colors ${copiedToClipboard ? 'text-green-600 bg-green-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                          title={copiedToClipboard ? 'Copied!' : 'Copy to clipboard'}
                          aria-label={copiedToClipboard ? 'Copied to clipboard' : 'Copy upload result to clipboard'}
                        >
                          {copiedToClipboard ? <FiCheck size={16} /> : <FiCopy size={16} />}
                        </button>
                      </div>
                      <ul className="text-sm text-gray-600 space-y-1.5 max-h-48 overflow-y-auto rounded border border-gray-200 p-3 bg-gray-50">
                        {uploadResult.details.map((d, i) => (
                          <li key={i} className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <span className="font-medium text-gray-800">Row {d.row}:</span>
                            <span>{d.player}</span>
                            {d.matchScore != null && <span className="text-gray-500">({d.matchScore}% match)</span>}
                            {d.action && <span className="text-amber-600">— {d.action}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
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
                    className="w-full px-4 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Team *</label>
                    <select
                      value={uploadTeamId}
                      onChange={(e) => setUploadTeamId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      aria-label="Select team for upload"
                    >
                      <option value="">Select team</option>
                      {uniqueTeams.map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Excel file (.xlsx) *</label>
                    <input
                      type="file"
                      accept=".xlsx"
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700"
                    />
                    {uploadFile && <p className="mt-1 text-sm text-gray-600">{uploadFile.name}</p>}
                  </div>
                  {uploadPlayersExcel.error && (
                    <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                      {uploadPlayersExcel.error.message}
                    </div>
                  )}
                </>
              )}
            </div>
            {!uploadResult && (
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <button
                  onClick={handleCloseUploadModal}
                  className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadExcel}
                  disabled={uploadPlayersExcel.isPending || !uploadTeamId || !uploadFile}
                  className="px-5 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 disabled:opacity-70 disabled:cursor-not-allowed"
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
                  setPortraitFile(null);
                  setPortraitPreview(null);
                  setFormData({ name: '', surname: '', number: '', teamId: '', teamName: '', position: 'POINT_GUARD', country: '', height: '', dob: '' });
                }}
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <MdCancel size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Player portrait (PNG) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Player portrait (optional)</label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border border-gray-300 flex-shrink-0">
                      {portraitPreview ? (
                        <img src={portraitPreview} alt="Portrait preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">No photo</div>
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
                        className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700"
                      />
                      <p className="text-xs text-gray-500 mt-1">PNG or JPEG recommended</p>
                    </div>
                  </div>
                </div>

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
                    {POSITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {!editingPlayer && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Team *</label>
                  <select
                    value={formData.teamId}
                    onChange={(e) => {
                      const team = uniqueTeams.find((t) => t.id === e.target.value);
                      setFormData({ ...formData, teamId: e.target.value, teamName: team?.name ?? '' });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
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
              </div>
            </div>

            <div className="flex justify-end gap-4 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingPlayer(null);
                  setPortraitFile(null);
                  setPortraitPreview(null);
                  setFormData({ name: '', surname: '', number: '', teamId: '', teamName: '', position: 'POINT_GUARD', country: '', height: '', dob: '' });
                }}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlayer}
                disabled={createPlayer.isPending || updatePlayer.isPending}
                className="px-6 py-2.5 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-70"
              >
                {createPlayer.isPending || updatePlayer.isPending ? 'Saving...' : editingPlayer ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Players;

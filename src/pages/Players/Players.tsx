import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiChevronDown, FiEdit2, FiFilter, FiSearch, FiUpload, FiUserMinus } from 'react-icons/fi';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  useCreatePlayerForTeam,
  useDeletePlayer,
  useMergePlayers,
  usePlayersPage,
  useTeams,
  useUpdatePlayer,
} from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { Player, PlayerCreateForTeam, PlayerUpdateBody } from '../../types/api';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import { PlayerAvatar } from '../../components/players/PlayerAvatar';
import { positionLabel } from '../../components/players/player-form';
import PlayerFormDialog from '../../components/players/PlayerFormDialog';
import MergePlayersDialog from '../../components/players/MergePlayersDialog';
import UploadPlayersDialog from '../../components/players/UploadPlayersDialog';
import ReleasePlayerDialog, { type ReleaseTarget } from '../../components/players/ReleasePlayerDialog';
import PlayerProfileModal from './PlayerProfileModal';
import { PlayerCard, PLAYER_GRID } from '../../components/players/PlayerCard';
import { SortGroup, type SortOption } from '../../components/ui/SortGroup';
import { ViewToggle, type ListView } from '../../components/ui/ViewToggle';
import { normalizeName } from '../../lib/text';

const PAGE_SIZE = 12;
const VIEW_KEY = 'players_view';

/**
 * Sort fields the list offers, and the column each maps to on the backend. The backend hands `sortBy`
 * straight to Prisma, so only columns on the player table work — jersey number and team name live on
 * the join table and answer 400 (Gap 37), which is why those two headers have no sort control.
 *
 * `createdAt` is deliberately absent even though it is a real column: `PlayersService.findAll`
 * excludes that one value by name and falls back to alphabetical, so an "Added" sort would look like
 * it worked and do nothing (Gap 56).
 */
const SORTS = {
  name: 'lastName',
  position: 'position',
  nationality: 'nationality',
} as const;
type SortKey = keyof typeof SORTS;
const isSortKey = (v: string | null): v is SortKey => v !== null && v in SORTS;
const SORT_OPTIONS: ReadonlyArray<SortOption<SortKey>> = [
  { key: 'name', label: 'Name' },
  { key: 'position', label: 'Position' },
  { key: 'nationality', label: 'Nationality' },
];

/**
 * The chosen view, in order: the URL, then what was chosen last time, then the table — which is the
 * layout this page has, so an admin who has never touched the toggle sees it unchanged. `localStorage`
 * is read inside a `try` because a private window can throw on access, and the page has to render anyway.
 */
const initialView = (fromUrl: string | null): ListView => {
  if (fromUrl === 'table' || fromUrl === 'cards') return fromUrl;
  try {
    return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'table';
  } catch {
    return 'table';
  }
};

/**
 * Every player, one server page at a time. The page is back to its pre-redesign layout — full-bleed
 * white panel, large title, `brand`-toned controls, the search box with its inset magnifier, and the
 * shared `DataTable` with icon row actions — while the behaviour added since stays in place:
 *
 * - **The server does the paging, sorting and searching.** The old page pulled every player and
 *   filtered in the browser, which stops being honest past a few hundred rows. `DataTable` now takes
 *   the page it is given and reports header clicks back instead of reordering the rows itself.
 * - **"Release", not "Delete".** `DELETE /players/:id` only deactivates a player's team assignments
 *   and leaves the profile and every recorded stat alone, so there is one honest action rather than
 *   the old pair where "Delete … cannot be undone" did exactly what "Remove from team" did.
 * - **Nationality, not Country.** The old column read a `country` field the backend has never sent,
 *   so it was blank for everyone. The data is `nationality`.
 * - **Zod validation** through `player-form`, and edits that send only what changed.
 * - **Search, sort, team filter, view and page live in the URL**, so a refresh or a shared link shows
 *   the same list. The cards ⇄ table choice is also remembered locally, for arriving with no `?view=`.
 * - **Two views.** The table is the default, as the old page was, and sorts through its own headers;
 *   cards are the browsing view and sort through the buttons in the toolbar. Both read the same server
 *   page, and the choice is remembered.
 *
 * There is no position filter: the backend rejects one with a 400, and filtering a page of twelve in
 * the browser would quietly give the wrong answer across every other page (Gap 37).
 */
const Players: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const sortParam = params.get('sort');
  const sort: SortKey = isSortKey(sortParam) ? sortParam : 'name';
  const dir: 'asc' | 'desc' = params.get('dir') === 'desc' ? 'desc' : 'asc';
  const team = params.get('team') ?? '';
  const unassigned = params.get('unassigned') === '1';
  const pageParam = Number(params.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;
  const [view, setView] = useState<ListView>(() => initialView(params.get('view')));

  const setParam = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  // Typing stays local and reaches the server — and the URL — after a pause, so a keystroke is
  // neither a request nor a navigation.
  const [searchQuery, setSearchQuery] = useState(params.get('q') ?? '');
  const search = useDebouncedValue(searchQuery.trim(), 300);
  const q = params.get('q') ?? '';
  useEffect(() => {
    if (search === q) return;
    setParam({ q: search || null, page: null });
    // setParam reads the live params; `search` settling is the only trigger that matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const playersQuery = usePlayersPage({
    search: search || undefined,
    sortBy: SORTS[sort],
    sortOrder: dir,
    page,
    limit: PAGE_SIZE,
    // The backend treats these as alternatives, so only one is ever sent.
    ...(unassigned ? { unassigned: true } : team ? { teamId: team } : {}),
  });
  const teamsQuery = useTeams();

  const createPlayer = useCreatePlayerForTeam();
  const updatePlayer = useUpdatePlayer();
  const releasePlayer = useDeletePlayer();
  const mergePlayers = useMergePlayers();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<ReleaseTarget | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const players: Player[] = playersQuery.data?.items ?? [];
  const meta = playersQuery.data?.meta;
  const hasFilter = search.length > 0 || !!team || unassigned;

  const uniqueTeams = useMemo(
    () =>
      (teamsQuery.data ?? [])
        .map((t) => ({ id: t.id, name: normalizeName(t.name) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [teamsQuery.data],
  );

  const playerName = (p: Player) => `${normalizeName(p.firstName)} ${normalizeName(p.lastName)}`;

  const handleAddPlayer = () => {
    setEditingPlayer(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeForm = () => {
    setIsModalOpen(false);
    setEditingPlayer(null);
  };

  const handleCreate = (body: PlayerCreateForTeam) => {
    setFormError(null);
    createPlayer.mutate(body, {
      onSuccess: (created) => {
        toast.success(`${normalizeName(created.firstName)} ${normalizeName(created.lastName)} added.`);
        closeForm();
      },
      onError: (err) => setFormError(err.message),
    });
  };

  const handleUpdate = (body: PlayerUpdateBody) => {
    if (!editingPlayer) return;
    setFormError(null);
    if (Object.keys(body).length === 0) {
      closeForm();
      return;
    }
    updatePlayer.mutate(
      { id: editingPlayer.id, data: body },
      {
        onSuccess: () => {
          toast.success(`${playerName(editingPlayer)} saved.`);
          closeForm();
        },
        onError: (err) => setFormError(err.message),
      },
    );
  };

  const releaseTargetOf = (p: Player): ReleaseTarget => ({
    id: p.id,
    name: playerName(p),
    teams: (p.playerTeams ?? []).filter((pt) => pt.isActive && pt.team).map((pt) => normalizeName(pt.team!.name)),
  });

  const handleConfirmRelease = () => {
    if (!releaseTarget) return;
    const target = releaseTarget;
    releasePlayer.mutate(target.id, {
      onSuccess: () => {
        toast.success(`${target.name} released.`);
        setReleaseTarget(null);
      },
      onError: (err) => {
        toast.error(`Couldn’t release ${target.name}: ${err.message}`);
        setReleaseTarget(null);
      },
    });
  };

  const handleConfirmMerge = (duplicateId: string, targetId: string) => {
    setMergeError(null);
    mergePlayers.mutate(
      { duplicatePlayerId: duplicateId, targetPlayerId: targetId },
      {
        onSuccess: (kept) => {
          toast.success(`Merged into ${normalizeName(kept.firstName)} ${normalizeName(kept.lastName)}.`);
          setShowMergeModal(false);
        },
        onError: (err) => setMergeError(err.message),
      },
    );
  };

  // The table's sort is the URL's sort. A header click asks the server for a differently ordered
  // page; it never reshuffles the twelve rows on screen.
  const sorting: SortingState = [{ id: sort, desc: dir === 'desc' }];
  const handleSortingChange = (next: SortingState) => {
    const first = next[0];
    if (!first || !isSortKey(first.id)) return;
    setParam({ sort: first.id, dir: first.desc ? 'desc' : 'asc', page: null });
  };

  // The URL wins when it names a view (a shared link), otherwise the local choice stands.
  useEffect(() => {
    const fromUrl = params.get('view');
    if ((fromUrl === 'cards' || fromUrl === 'table') && fromUrl !== view) setView(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('view')]);

  const chooseView = (next: ListView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // A private window can refuse to store; the view still changes for this visit.
    }
    setParam({ view: next === 'table' ? null : next });
  };

  /** The cards view's sort buttons. Clicking the active field flips the direction. */
  const handleSort = (key: SortKey) => {
    setParam({ sort: key, dir: key === sort && dir === 'asc' ? 'desc' : 'asc', page: null });
  };

  const columns = useMemo<ColumnDef<Player>[]>(
    () => [
      {
        id: 'jerseyNumber',
        header: '#',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-bold text-gray-900 dark:text-white">
            {row.original.jerseyNumber != null ? row.original.jerseyNumber : '—'}
          </span>
        ),
      },
      {
        id: 'name',
        // The accessor is what makes the column sortable at all; the server does the ordering.
        accessorFn: (p) => p.lastName ?? '',
        header: 'Player',
        cell: ({ row }) => {
          const player = row.original;
          return (
            <div className="flex items-center gap-3">
              <PlayerAvatar firstName={player.firstName} lastName={player.lastName} photo={player.photo} size="sm" />
              <div className="font-bold text-gray-900 dark:text-white">{playerName(player)}</div>
            </div>
          );
        },
      },
      {
        id: 'teamName',
        header: 'Team',
        enableSorting: false,
        cell: ({ row }) => {
          const player = row.original;
          return player.teamId && player.teamName ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/teams-management/${player.teamId}`);
              }}
              className="cursor-pointer text-left font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              {normalizeName(player.teamName)}
            </button>
          ) : (
            <span>No team</span>
          );
        },
      },
      {
        id: 'position',
        accessorFn: (p) => p.position ?? '',
        header: 'Position',
        cell: ({ row }) => positionLabel(row.original.position) || '—',
      },
      {
        id: 'nationality',
        accessorFn: (p) => p.nationality ?? '',
        header: 'Nationality',
        cell: ({ row }) => row.original.nationality || '—',
      },
      {
        id: 'height',
        header: 'Height',
        enableSorting: false,
        cell: ({ row }) => row.original.height || '—',
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => {
          const player = row.original;
          const name = playerName(player);
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditPlayer(player);
                }}
                className="cursor-pointer rounded-lg p-2 text-brand-600 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
                title={`Edit ${name}`}
                aria-label={`Edit ${name}`}
              >
                <FiEdit2 size={18} />
              </button>
              {player.teamId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReleaseTarget(releaseTargetOf(player));
                  }}
                  className="cursor-pointer rounded-lg p-2 text-warning-600 transition-colors hover:bg-warning-50 dark:text-warning-500 dark:hover:bg-warning-500/10"
                  title={`Release ${name}`}
                  aria-label={`Release ${name}`}
                >
                  <FiUserMinus size={18} />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    // The cells only close over `navigate` and setters, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navigate],
  );

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-950">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Players</h1>
      </div>

      {playersQuery.error && (
        <div className="mb-6 rounded-lg border border-error-100 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-500">
          {(playersQuery.error as Error).message}
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleAddPlayer}
          className="cursor-pointer whitespace-nowrap rounded-lg bg-brand-500 px-6 py-3 font-medium text-white transition-colors hover:bg-brand-600"
        >
          Add Player
        </button>
        <button
          type="button"
          onClick={() => setIsUploadModalOpen(true)}
          disabled={uniqueTeams.length === 0}
          className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-brand-500 bg-white px-6 py-3 font-medium text-brand-600 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-500 dark:bg-gray-900 dark:text-brand-400 dark:hover:bg-brand-500/10"
        >
          <FiUpload size={18} />
          Upload Excel
        </button>
        <button
          type="button"
          onClick={() => { setMergeError(null); setShowMergeModal(true); }}
          className="cursor-pointer whitespace-nowrap rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
        >
          Merge Players
        </button>

        <div className="relative" style={{ width: '250px', minWidth: '200px' }}>
          <label htmlFor="player-search" className="sr-only">Search players by name</label>
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" size={20} />
          <input
            id="player-search"
            type="text"
            placeholder="Search Player"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>

        <div className="relative">
          <label htmlFor="player-team" className="sr-only">Filter by team</label>
          <select
            id="player-team"
            value={unassigned ? '__none' : team}
            onChange={(e) => {
              const v = e.target.value;
              setParam({
                team: v === '__none' || v === '' ? null : v,
                unassigned: v === '__none' ? '1' : null,
                page: null,
              });
            }}
            className="min-w-[160px] cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-8 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="">All Teams</option>
            <option value="__none">No team</option>
            {uniqueTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <FiFilter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" size={18} />
          <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" size={18} />
        </div>

        {/* Cards have no headers to click, so the sort moves into the toolbar for that view only. */}
        {view === 'cards' && <SortGroup options={SORT_OPTIONS} active={sort} dir={dir} onSort={handleSort} />}

        <ViewToggle view={view} onChange={chooseView} className="ml-auto" />
      </div>

      {view === 'cards' ? (
        <>
          {playersQuery.isPending ? (
            <div className="py-12 text-center text-gray-500 dark:text-gray-400">Loading players...</div>
          ) : players.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-lg text-gray-500 dark:text-gray-400">No players found</p>
              <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
                {hasFilter
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Add one, or upload a team’s spreadsheet to add the whole squad at once.'}
              </p>
            </div>
          ) : (
            <ul className={`mb-8 ${PLAYER_GRID}`} aria-label="Players">
              {players.map((player) => (
                <li key={player.id} className="min-w-0">
                  <PlayerCard
                    player={player}
                    onEdit={() => handleEditPlayer(player)}
                    onRelease={() => setReleaseTarget(releaseTargetOf(player))}
                  />
                </li>
              ))}
            </ul>
          )}

          <Pagination
            currentPage={meta?.page ?? page}
            totalPages={meta?.pageCount ?? 1}
            totalItems={meta?.itemCount ?? players.length}
            pageSize={PAGE_SIZE}
            onPageChange={(p) => setParam({ page: p <= 1 ? null : String(p) })}
          />
        </>
      ) : (
      <DataTable
        columns={columns}
        data={players}
        onRowClick={(player) => setSelectedPlayerId(player.id)}
        isLoading={playersQuery.isPending}
        error={playersQuery.error ? (playersQuery.error as Error).message || 'Failed to load players.' : null}
        onRetry={() => void playersQuery.refetch()}
        label="Players"
        emptyMessage={
          hasFilter
            ? 'No players found. Try adjusting your search or filter criteria.'
            : 'No players yet. Add one, or upload a team’s spreadsheet to add the whole squad at once.'
        }
        sorting={sorting}
        onSortingChange={handleSortingChange}
        pageIndex={(meta?.page ?? page) - 1}
        pageCount={meta?.pageCount ?? 1}
        totalItems={meta?.itemCount ?? players.length}
        pageSize={PAGE_SIZE}
        onPageChange={(p) => setParam({ page: p <= 1 ? null : String(p) })}
      />
      )}

      <PlayerFormDialog
        open={isModalOpen}
        onClose={closeForm}
        initial={editingPlayer}
        isSaving={createPlayer.isPending || updatePlayer.isPending}
        serverError={formError}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />

      <ReleasePlayerDialog
        target={releaseTarget}
        isReleasing={releasePlayer.isPending}
        onCancel={() => setReleaseTarget(null)}
        onConfirm={handleConfirmRelease}
      />

      <MergePlayersDialog
        open={showMergeModal}
        isMerging={mergePlayers.isPending}
        serverError={mergeError}
        onCancel={() => { setShowMergeModal(false); setMergeError(null); }}
        onConfirm={handleConfirmMerge}
      />

      <UploadPlayersDialog open={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} />

      <PlayerProfileModal playerId={selectedPlayerId} onClose={() => setSelectedPlayerId(null)} />
    </div>
  );
};

export default Players;

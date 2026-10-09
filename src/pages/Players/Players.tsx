import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCreatePlayerForTeam,
  useDeletePlayer,
  useMergePlayers,
  usePlayersPage,
  useTeams,
  useUpdatePlayer,
} from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import type { Player, PlayerCreateForTeam, PlayerUpdateBody } from '../../types/api';
import { PageHeader, ListSkeleton, EmptyState, ErrorState, NoResultsState } from '../../components/admin/page-states';
import Pagination from '../../components/ui/Pagination';
import { Button } from '../../components/ui/primitives/button';
import { PlayerCard, PLAYER_GRID } from '../../components/players/PlayerCard';
import { PlayersTable } from '../../components/players/PlayersTable';
import PlayerFormDialog from '../../components/players/PlayerFormDialog';
import MergePlayersDialog from '../../components/players/MergePlayersDialog';
import UploadPlayersDialog from '../../components/players/UploadPlayersDialog';
import ReleasePlayerDialog, { type ReleaseTarget } from '../../components/players/ReleasePlayerDialog';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';

const PAGE_SIZE = 12;

/**
 * Sort fields the list offers. Each has to be a column on the player table — the backend hands
 * `sortBy` straight to Prisma, so jersey number and team name (which live on the join table) answer
 * 400 rather than sorting.
 */
const SORTS = {
  name: 'lastName',
  position: 'position',
  nationality: 'nationality',
  createdAt: 'createdAt',
} as const;
type SortKey = keyof typeof SORTS;
const isSortKey = (v: string | null): v is SortKey => v !== null && v in SORTS;

type View = 'cards' | 'table';
const VIEW_KEY = 'players.view';

/** The view in the URL wins; without one, the last choice on this device; failing that, cards. */
function readView(fromUrl: string | null): View {
  if (fromUrl === 'table' || fromUrl === 'cards') return fromUrl;
  try {
    return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'cards';
  } catch {
    return 'cards';
  }
}

/**
 * Every player, one page at a time from the server, as cards or as a table. Search, sort, team filter and page all live in
 * the URL, so a refresh or a shared link shows the same list.
 *
 * Only the filters the backend actually supports are offered — a team, or players with no team. It
 * rejects anything else (a position, say) with a 400, and filtering one page of twelve in the browser
 * would quietly give the wrong answer across the other pages, so there is no position filter here
 * (Gap 37).
 */
const Players: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const sortParam = params.get('sort');
  const sort: SortKey = isSortKey(sortParam) ? sortParam : 'name';
  const dir: 'asc' | 'desc' =
    params.get('dir') === 'asc' ? 'asc' : params.get('dir') === 'desc' ? 'desc' : sort === 'createdAt' ? 'desc' : 'asc';
  const q = params.get('q') ?? '';
  const view = readView(params.get('view'));
  const team = params.get('team') ?? '';
  const unassigned = params.get('unassigned') === '1';
  const pageParam = Number(params.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  const setParam = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  // Search types locally and writes to the URL after a pause, so each keystroke doesn't fire a request.
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    if (draft === q) return;
    const id = window.setTimeout(() => setParam({ q: draft.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
    // setParam is stable enough for this debounce; q and draft are the real inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const query = usePlayersPage({
    search: q || undefined,
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

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<ReleaseTarget | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const rows: Player[] = query.data?.items ?? [];
  const meta = query.data?.meta;
  const hasFilter = q.length > 0 || !!team || unassigned;

  const teams = useMemo(
    () =>
      (teamsQuery.data ?? [])
        .map((t) => ({ id: t.id, name: normalizeName(t.name) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [teamsQuery.data],
  );

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };
  const openEdit = (p: Player) => {
    setEditing(p);
    setFormError(null);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const playerName = (p: Player) => `${normalizeName(p.firstName)} ${normalizeName(p.lastName)}`;

  const releaseTargetOf = (p: Player): ReleaseTarget => ({
    id: p.id,
    name: playerName(p),
    teams: (p.playerTeams ?? []).filter((pt) => pt.isActive && pt.team).map((pt) => normalizeName(pt.team!.name)),
  });

  const create = (body: PlayerCreateForTeam) => {
    setFormError(null);
    createPlayer.mutate(body, {
      onSuccess: (created) => {
        toast.success(`${normalizeName(created.firstName)} ${normalizeName(created.lastName)} added.`);
        closeForm();
      },
      onError: (err) => setFormError(err.message),
    });
  };

  const update = (body: PlayerUpdateBody) => {
    if (!editing) return;
    setFormError(null);
    if (Object.keys(body).length === 0) {
      closeForm();
      return;
    }
    updatePlayer.mutate(
      { id: editing.id, data: body },
      {
        onSuccess: () => {
          toast.success(`${playerName(editing)} saved.`);
          closeForm();
        },
        onError: (err) => setFormError(err.message),
      },
    );
  };

  const confirmRelease = () => {
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

  const confirmMerge = (duplicateId: string, targetId: string) => {
    setMergeError(null);
    mergePlayers.mutate(
      { duplicatePlayerId: duplicateId, targetPlayerId: targetId },
      {
        onSuccess: (kept) => {
          toast.success(`Merged into ${normalizeName(kept.firstName)} ${normalizeName(kept.lastName)}.`);
          setMergeOpen(false);
        },
        onError: (err) => setMergeError(err.message),
      },
    );
  };

  const chooseView = (next: View) => {
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* the URL still carries the choice */
    }
    setParam({ view: next === 'cards' ? null : next });
  };

  const toggleSort = (key: SortKey) => {
    const nextDir = sort === key && dir === 'asc' ? 'desc' : sort === key && dir === 'desc' ? 'asc' : key === 'createdAt' ? 'desc' : 'asc';
    setParam({ sort: key, dir: nextDir, page: null });
  };

  const sortable: Array<{ key: SortKey; label: string }> = [
    { key: 'name', label: 'Name' },
    { key: 'position', label: 'Position' },
    { key: 'nationality', label: 'Nationality' },
    { key: 'createdAt', label: 'Added' },
  ];

  const showEmpty = !query.isPending && !query.isError && rows.length === 0 && !hasFilter;
  const showNoResults = !query.isPending && !query.isError && rows.length === 0 && hasFilter;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Players"
        description="Everyone on record. Open a player to see their profile and match history."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setMergeOpen(true)}>Merge duplicates</Button>
            <Button variant="secondary" onClick={() => setUploadOpen(true)}>Upload spreadsheet</Button>
            <Button onClick={openCreate}>Add player</Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full md:max-w-sm">
          <label htmlFor="player-search" className="sr-only">Search players by name</label>
          <input
            id="player-search"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by name"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>

        <div>
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
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="">All teams</option>
            <option value="__none">No team</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {view === 'cards' && (
          <div role="group" aria-label="Sort by" className="flex flex-wrap items-center gap-1.5">
            {sortable.map((s) => {
              const active = sort === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSort(s.key)}
                  aria-label={`Sort by ${s.label}${active ? `, ${dir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
                  className={cn(
                    'h-9 rounded-md px-3 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50',
                    active
                      ? 'bg-court-700 text-white dark:bg-court-400 dark:text-court-950'
                      : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800',
                  )}
                >
                  {s.label}{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              );
            })}
          </div>
        )}

        <div role="group" aria-label="View" className="ml-auto flex rounded-md border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-900">
          {(['cards', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => chooseView(v)}
              className={cn(
                'h-8 rounded px-3 text-sm font-semibold capitalize outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50',
                view === v ? 'bg-court-700 text-white dark:bg-court-400 dark:text-court-950' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {query.isPending && <ListSkeleton columns={4} rows={PAGE_SIZE} label="Loading players" />}
      {query.isError && <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />}
      {showEmpty && (
        <EmptyState
          title="No players yet"
          description="Add them one at a time, or upload a team's spreadsheet to add the whole squad at once."
          action={{ label: 'Add player', onClick: openCreate }}
        />
      )}
      {showNoResults && <NoResultsState query={q} onClear={() => setParams(new URLSearchParams(), { replace: true })} />}

      {!query.isPending && !query.isError && rows.length > 0 && (
        <>
          {view === 'cards' ? (
            <ul className={cn(PLAYER_GRID, query.isFetching && 'opacity-70 transition-opacity')} aria-label="Players">
              {rows.map((p) => (
                <li key={p.id} className="min-w-0">
                  <PlayerCard player={p} onEdit={() => openEdit(p)} onRelease={() => setReleaseTarget(releaseTargetOf(p))} />
                </li>
              ))}
            </ul>
          ) : (
            <PlayersTable
              players={rows}
              sort={sort}
              dir={dir}
              onSort={toggleSort}
              onEdit={openEdit}
              onRelease={(p) => setReleaseTarget(releaseTargetOf(p))}
              busy={query.isFetching}
            />
          )}

          {meta && meta.pageCount > 1 && (
            <Pagination
              currentPage={meta.page}
              totalPages={meta.pageCount}
              totalItems={meta.itemCount}
              pageSize={PAGE_SIZE}
              onPageChange={(p) => setParam({ page: p <= 1 ? null : String(p) })}
            />
          )}
        </>
      )}

      <PlayerFormDialog
        open={formOpen}
        onClose={closeForm}
        initial={editing}
        isSaving={createPlayer.isPending || updatePlayer.isPending}
        serverError={formError}
        onCreate={create}
        onUpdate={update}
      />

      <ReleasePlayerDialog
        target={releaseTarget}
        isReleasing={releasePlayer.isPending}
        onCancel={() => setReleaseTarget(null)}
        onConfirm={confirmRelease}
      />

      <MergePlayersDialog
        open={mergeOpen}
        isMerging={mergePlayers.isPending}
        serverError={mergeError}
        onCancel={() => { setMergeOpen(false); setMergeError(null); }}
        onConfirm={confirmMerge}
      />

      <UploadPlayersDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
};

export default Players;

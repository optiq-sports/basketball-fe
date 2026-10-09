import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateTournament, useDeleteTournament, useTournamentsPage, useUpdateTournament } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import type { Tournament, TournamentCreate } from '../../types/api';
import { PageHeader, ListSkeleton, EmptyState, ErrorState, NoResultsState } from '../../components/admin/page-states';
import Pagination from '../../components/ui/Pagination';
import { Button } from '../../components/ui/primitives/button';
import TournamentFormDialog from '../../components/tournaments/TournamentFormDialog';
import { TournamentCard, TOURNAMENT_GRID } from '../../components/tournaments/TournamentCard';
import DeleteTournamentDialog, { type DeleteTarget } from '../../components/tournaments/DeleteTournamentDialog';
import { cn } from '../../lib/utils';
import { normalizeName } from '../../lib/text';

const PAGE_SIZE = 10;

/** Sort fields the list offers. The backend accepts any column name, so the URL can't pick anything else. */
const SORTS = {
  name: 'name',
  division: 'division',
  startDate: 'startDate',
  createdAt: 'createdAt',
} as const;
type SortKey = keyof typeof SORTS;
const isSortKey = (v: string | null): v is SortKey => v !== null && v in SORTS;

/**
 * Every tournament, one page at a time from the server. Search, sort and page are in the URL, so a
 * refresh or a shared link shows the same list. Creating, editing and deleting each report progress on
 * the control that started them, and deletes remove the row at once, putting it back if the server says no.
 */
const TournamentsListing: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const sortParam = params.get('sort');
  const sort: SortKey = isSortKey(sortParam) ? sortParam : 'createdAt';
  const dir: 'asc' | 'desc' = params.get('dir') === 'asc' ? 'asc' : params.get('dir') === 'desc' ? 'desc' : sort === 'name' || sort === 'division' ? 'asc' : 'desc';
  const q = params.get('q') ?? '';
  const pageParam = Number(params.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

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

  const setParam = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  const query = useTournamentsPage({
    search: q || undefined,
    sortBy: SORTS[sort],
    sortOrder: dir,
    page,
    limit: PAGE_SIZE,
  });

  const createTournament = useCreateTournament();
  const updateTournament = useUpdateTournament();
  const deleteTournament = useDeleteTournament();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tournament | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const rows: Tournament[] = query.data?.items ?? [];
  const meta = query.data?.meta;
  const hasFilter = q.length > 0;

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };

  // "Start New" (the sidebar and the dashboard) arrives here as `?new=1`. Open the form once and drop the
  // flag, so a refresh or the back button doesn't open it again.
  const asked = params.get('new') === '1';
  useEffect(() => {
    if (!asked) return;
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
    // only the arrival matters; the params object is rebuilt on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked]);
  const openEdit = (t: Tournament) => {
    setEditing(t);
    setFormError(null);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const saveForm = (body: TournamentCreate) => {
    setFormError(null);
    if (editing) {
      updateTournament.mutate(
        { id: editing.id, data: body },
        {
          onSuccess: () => {
            toast.success(`${body.name} saved.`);
            closeForm();
          },
          onError: (err) => setFormError(err.message),
        },
      );
    } else {
      createTournament.mutate(body, {
        onSuccess: (created) => {
          toast.success(`${created.name} created. Add its teams next.`);
          closeForm();
          // The next step of setting up a tournament is its teams, so land on that tab.
          if (created.id) navigate(`/tournaments/${created.id}?tab=teams`);
        },
        onError: (err) => setFormError(err.message),
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteTournament.mutate(target.id, {
      onSuccess: () => {
        toast.success(`${target.name} deleted.`);
        setDeleteTarget(null);
      },
      onError: (err) => {
        toast.error(`Couldn’t delete ${target.name}: ${err.message}`);
        setDeleteTarget(null);
      },
    });
  };

  const toggleSort = (key: SortKey) => {
    const nextDir = sort === key && dir === 'asc' ? 'desc' : sort === key && dir === 'desc' ? 'asc' : key === 'name' || key === 'division' ? 'asc' : 'desc';
    setParam({ sort: key, dir: nextDir, page: null });
  };


  const sortable: Array<{ key: SortKey; label: string }> = [
    { key: 'name', label: 'Name' },
    { key: 'division', label: 'Division' },
    { key: 'startDate', label: 'Dates' },
  ];

  const showEmpty = !query.isPending && !query.isError && rows.length === 0 && !hasFilter;
  const showNoResults = !query.isPending && !query.isError && rows.length === 0 && hasFilter;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tournaments"
        description="Competitions your organisation runs. Open one to manage its teams and fixtures."
        actions={<Button onClick={openCreate}>New tournament</Button>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full md:max-w-sm">
          <label htmlFor="tournament-search" className="sr-only">Search tournaments by name</label>
          <input
            id="tournament-search"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by name"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
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
                  active ? 'bg-court-700 text-white dark:bg-court-400 dark:text-court-950' : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800',
                )}
              >
                {s.label}{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            );
          })}
        </div>
      </div>

      {query.isPending && <ListSkeleton columns={7} rows={PAGE_SIZE} label="Loading tournaments" />}
      {query.isError && <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />}
      {showEmpty && <EmptyState title="No tournaments yet" description="Create your first tournament to add teams and schedule fixtures." action={{ label: 'New tournament', onClick: openCreate }} />}
      {showNoResults && <NoResultsState query={q} onClear={() => setParams(new URLSearchParams(), { replace: true })} />}

      {!query.isPending && !query.isError && rows.length > 0 && (
        <>
          <ul className={cn(TOURNAMENT_GRID, query.isFetching && 'opacity-70 transition-opacity')} aria-label="Tournaments">
            {rows.map((t) => (
              <li key={t.id} className="min-w-0">
                <TournamentCard
                  tournament={t}
                  onEdit={() => openEdit(t)}
                  onDelete={() => setDeleteTarget({ id: t.id, name: normalizeName(t.name), matches: t._count?.matches ?? 0, teams: t._count?.teams ?? 0 })}
                />
              </li>
            ))}
          </ul>

          {meta && meta.pageCount > 1 && (
            <Pagination currentPage={meta.page} totalPages={meta.pageCount} totalItems={meta.itemCount} pageSize={PAGE_SIZE} onPageChange={(p) => setParam({ page: p <= 1 ? null : String(p) })} />
          )}
        </>
      )}

      <TournamentFormDialog
        open={formOpen}
        onClose={closeForm}
        initial={editing}
        isSaving={createTournament.isPending || updateTournament.isPending}
        serverError={formError}
        onSubmit={saveForm}
      />

      <DeleteTournamentDialog
        target={deleteTarget}
        isDeleting={deleteTournament.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default TournamentsListing;

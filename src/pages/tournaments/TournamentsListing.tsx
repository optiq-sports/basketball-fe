import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateTournament, useDeleteTournament, useTournamentsPage, useUpdateTournament } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { Tournament, TournamentCreate } from '../../types/api';
import Pagination from '../../components/ui/Pagination';
import { errorBanner } from '../../components/ui/formStyles';
import TournamentFormDialog from '../../components/tournaments/TournamentFormDialog';
import { TournamentCard, TOURNAMENT_GRID } from '../../components/tournaments/TournamentCard';
import DeleteTournamentDialog, { type DeleteTarget } from '../../components/tournaments/DeleteTournamentDialog';
import { normalizeName } from '../../lib/text';
import { SortGroup, type SortOption } from '../../components/ui/SortGroup';

const PAGE_SIZE = 12;

/**
 * Sort fields. Each is a real column on the tournament table — the service hands `sortBy` to Prisma
 * untouched, so anything else answers 400.
 */
const SORTS = { name: 'name', division: 'division', startDate: 'startDate', createdAt: 'createdAt' } as const;
type SortKey = keyof typeof SORTS;
const isSortKey = (v: string | null): v is SortKey => v !== null && v in SORTS;
const SORT_OPTIONS: ReadonlyArray<SortOption<SortKey>> = [
  { key: 'createdAt', label: 'Newest' },
  { key: 'name', label: 'Name' },
  { key: 'division', label: 'Division' },
  { key: 'startDate', label: 'Dates' },
];
/** A name or a division reads A–Z; a date field reads newest first. */
const defaultDir = (key: SortKey): 'asc' | 'desc' => (key === 'name' || key === 'division' ? 'asc' : 'desc');

/**
 * Every tournament, back to the pre-redesign layout: the `max-w-7xl` page, the `text-3xl` title with
 * Add Tournament beside it, a plain 260px search box, and the square flyer tiles four to a row.
 *
 * **The old page's Season filter was decoration.** Its options were the hardcoded strings
 * `['2023-2024', '2024-2025']`, `seasonFilter` appeared in the filter's dependency list and was never
 * read inside it, and no tournament carries a season at all — there is no such column. It is not
 * restored. Search is the one filter this screen can honestly offer.
 *
 * **Sort buttons sit beside the search box.** The field and direction live in the URL, so a sorted list
 * can be linked and survives a reload. Newest first is the default, as the old page's order was.
 *
 * One narrowing, stated plainly: the server matches `search` against the tournament **name** only
 * (`searchFields: ["name"]`), while the old in-browser filter also matched the venue and the printed
 * date range. The box therefore says name — widening it is a one-line backend change (Gap 58).
 *
 * **Kept from the redesign:** server-side paging, the Zod form with its flyer upload, the type-the-name
 * delete with the real number of matches and teams it takes with it, and `?new=1` from the sidebar and
 * dashboard opening the form once (Fix 120).
 */
const TournamentsListing: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const pageParam = Number(params.get('page'));
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  const sortParam = params.get('sort');
  const sort: SortKey = isSortKey(sortParam) ? sortParam : 'createdAt';
  const dirParam = params.get('dir');
  const dir: 'asc' | 'desc' = dirParam === 'asc' || dirParam === 'desc' ? dirParam : defaultDir(sort);

  const setParam = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  const [searchQuery, setSearchQuery] = useState(params.get('q') ?? '');
  const search = useDebouncedValue(searchQuery.trim(), 300);
  const q = params.get('q') ?? '';
  useEffect(() => {
    if (search === q) return;
    setParam({ q: search || null, page: null });
    // `search` settling is the only trigger that matters; setParam reads the live params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const query = useTournamentsPage({
    search: search || undefined,
    sortBy: SORTS[sort],
    sortOrder: dir,
    page,
    limit: PAGE_SIZE,
  });

  // Clicking the field already sorted on flips the direction; a new field starts at its own default.
  const handleSort = (key: SortKey) => {
    const next = key === sort ? (dir === 'asc' ? 'desc' : 'asc') : defaultDir(key);
    setParam({ sort: key === 'createdAt' ? null : key, dir: next === defaultDir(key) ? null : next, page: null });
  };

  const createTournament = useCreateTournament();
  const updateTournament = useUpdateTournament();
  const deleteTournament = useDeleteTournament();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const tournaments: Tournament[] = query.data?.items ?? [];
  const meta = query.data?.meta;

  const handleAddTournament = () => {
    setEditingTournament(null);
    setFormError(null);
    setIsModalOpen(true);
  };
  const handleEditTournament = (t: Tournament) => {
    setEditingTournament(t);
    setFormError(null);
    setIsModalOpen(true);
  };
  const closeForm = () => {
    setIsModalOpen(false);
    setEditingTournament(null);
  };

  // "Start New" (the sidebar and the dashboard) arrives here as `?new=1`. Open the form once and drop
  // the flag, so a refresh or the back button doesn't open it again.
  const asked = params.get('new') === '1';
  useEffect(() => {
    if (!asked) return;
    setEditingTournament(null);
    setFormError(null);
    setIsModalOpen(true);
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
    // only the arrival matters; the params object is rebuilt on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asked]);

  const saveForm = (body: TournamentCreate) => {
    setFormError(null);
    if (editingTournament) {
      updateTournament.mutate(
        { id: editingTournament.id, data: body },
        {
          onSuccess: () => { toast.success(`${normalizeName(body.name)} saved.`); closeForm(); },
          onError: (err) => setFormError(err.message),
        },
      );
    } else {
      createTournament.mutate(body, {
        onSuccess: (created) => {
          toast.success(`${normalizeName(created.name)} created. Add its teams next.`);
          closeForm();
          // The next step is its teams, which are on the tournament's own page.
          if (created.id) navigate(`/tournaments/${created.id}`);
        },
        onError: (err) => setFormError(err.message),
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteTournament.mutate(target.id, {
      onSuccess: () => { toast.success(`${target.name} deleted.`); setDeleteTarget(null); },
      onError: (err) => { toast.error(`Couldn’t delete ${target.name}: ${err.message}`); setDeleteTarget(null); },
    });
  };

  return (
    <div className="min-h-screen bg-white p-6 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tournaments</h1>
          <button
            type="button"
            onClick={handleAddTournament}
            className="cursor-pointer whitespace-nowrap rounded-lg bg-brand-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-600"
          >
            Add Tournament
          </button>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="relative" style={{ width: '260px', minWidth: '200px' }}>
            <label htmlFor="tournament-search" className="sr-only">Search tournaments by name</label>
            <input
              id="tournament-search"
              type="text"
              placeholder="Search tournament name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>

          <SortGroup options={SORT_OPTIONS} active={sort} dir={dir} onSort={handleSort} />
        </div>

        {query.error && (
          <div className={`mb-6 ${errorBanner}`}>
            {(query.error as Error).message || 'Failed to load tournaments'}
          </div>
        )}

        {query.isPending ? (
          <div className="py-8 text-gray-500 dark:text-gray-400">Loading tournaments...</div>
        ) : (
          <>
            {tournaments.length > 0 && (
              <div className={TOURNAMENT_GRID}>
                {tournaments.map((t) => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    onEdit={() => handleEditTournament(t)}
                    onDelete={() =>
                      setDeleteTarget({
                        id: t.id,
                        name: normalizeName(t.name),
                        matches: t._count?.matches ?? 0,
                        teams: t._count?.teams ?? 0,
                      })
                    }
                  />
                ))}
              </div>
            )}

            {tournaments.length === 0 && !query.error && (
              <div className="py-12 text-center">
                <p className="text-lg text-gray-500 dark:text-gray-400">No tournaments found</p>
                <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
                  {q ? 'Try a different tournament name.' : 'Create your first tournament to add teams and schedule fixtures.'}
                </p>
              </div>
            )}

            {meta && meta.pageCount > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={meta.page}
                  totalPages={meta.pageCount}
                  totalItems={meta.itemCount}
                  pageSize={PAGE_SIZE}
                  onPageChange={(p) => setParam({ page: p <= 1 ? null : String(p) })}
                />
              </div>
            )}
          </>
        )}
      </div>

      <TournamentFormDialog
        open={isModalOpen}
        onClose={closeForm}
        initial={editingTournament}
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

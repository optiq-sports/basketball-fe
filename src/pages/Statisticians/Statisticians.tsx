import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiChevronDown, FiFilter, FiSearch } from 'react-icons/fi';
import {
  useCreateStatistician,
  useDeleteStatistician,
  useStatisticians,
  useUpdateStatistician,
} from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { Statistician, StatisticianCreateBody, StatisticianUpdateBody } from '../../types/api';
import Pagination from '../../components/ui/Pagination';
import { btnPrimaryLg, errorBanner } from '../../components/ui/formStyles';
import { StatisticianCard, STATISTICIAN_GRID } from '../../components/statisticians/StatisticianCard';
import StatisticianFormDialog from '../../components/statisticians/StatisticianFormDialog';
import DeactivateStatisticianDialog, { type DeactivateTarget } from '../../components/statisticians/DeactivateStatisticianDialog';
import { displayName, locationOf } from '../../components/statisticians/statistician-form';
import StatisticianProfileModal from './StatisticianProfileModal';

const PAGE_SIZE = 9;

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;
type FilterValue = (typeof FILTERS)[number]['value'];
const isFilter = (v: string | null): v is FilterValue => !!v && FILTERS.some((f) => f.value === v);

/**
 * Every statistician, back to the pre-redesign layout: the full-bleed white panel, the large title, the
 * `brand` Add button beside a wide search box, the status filter framed by its funnel and chevron, and
 * the square photo tiles nine to a page. Clicking a tile opens their profile in a modal, as it did.
 *
 * **"All" now actually works.** `StatisticianService.findAll` defaults `where.status` to ACTIVE when no
 * status is asked for, so the old page's "All" option filtered a list that only ever contained active
 * accounts — an inactive statistician was unreachable from this screen. Both statuses are fetched here
 * and combined, so All means all.
 *
 * **Deactivate, not delete.** `DELETE /statistician/:id` only sets the status to INACTIVE. The old tile
 * offered "Delete … This cannot be undone", which was never what happened. An inactive statistician can
 * be reactivated from their tile.
 *
 * Search and paging happen in the browser. `GET /statistician` does apply `search` now (on name and
 * email), but the whole list is already here — `ApiClient.statistician.getAll` walks every page — and
 * filtering locally also matches a phone number and a location, which the server does not.
 */
const Statisticians: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const statusParam = params.get('status');
  const filter: FilterValue = isFilter(statusParam) ? statusParam : 'all';
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

  const [searchQuery, setSearchQuery] = useState(params.get('q') ?? '');
  const search = useDebouncedValue(searchQuery.trim(), 300);

  // Two cached queries, one per status. "All" combines them; either tab uses just the one.
  const activeQuery = useStatisticians('ACTIVE');
  const inactiveQuery = useStatisticians('INACTIVE');
  const wanted = filter === 'active' ? [activeQuery] : filter === 'inactive' ? [inactiveQuery] : [activeQuery, inactiveQuery];
  const isPending = wanted.some((q) => q.isPending);
  const error = wanted.find((q) => q.error)?.error as Error | undefined;

  const createStatistician = useCreateStatistician();
  const updateStatistician = useUpdateStatistician();
  const deactivate = useDeleteStatistician();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStatistician, setEditingStatistician] = useState<Statistician | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<DeactivateTarget | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [selectedStatisticianId, setSelectedStatisticianId] = useState<string | null>(null);

  const statisticians = useMemo(() => {
    const byId = new Map<string, Statistician>();
    for (const q of wanted) for (const s of q.data ?? []) byId.set(s.id, s);
    return [...byId.values()];
    // `wanted` is rebuilt each render from the two queries; their data is the real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, activeQuery.data, inactiveQuery.data]);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase();
    const matches = needle
      ? statisticians.filter((s) =>
          [displayName(s), s.email ?? '', locationOf(s), s.profile?.phone ?? ''].some((f) => f.toLowerCase().includes(needle)),
        )
      : statisticians;
    return [...matches].sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [statisticians, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleAddStatistician = () => {
    setEditingStatistician(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleEditStatistician = (s: Statistician) => {
    setEditingStatistician(s);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeForm = () => {
    setIsModalOpen(false);
    setEditingStatistician(null);
  };

  const create = (body: StatisticianCreateBody) => {
    setFormError(null);
    createStatistician.mutate(body, {
      onSuccess: (created) => { toast.success(`${displayName(created)} added.`); closeForm(); },
      onError: (err) => setFormError(err.message),
    });
  };

  const update = (body: StatisticianUpdateBody) => {
    if (!editingStatistician) return;
    setFormError(null);
    if (Object.keys(body).length === 0) {
      closeForm();
      return;
    }
    const target = editingStatistician;
    updateStatistician.mutate(
      { id: target.id, data: body },
      {
        onSuccess: () => { toast.success(`${displayName(target)} saved.`); closeForm(); },
        onError: (err) => setFormError(err.message),
      },
    );
  };

  const confirmDeactivate = () => {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    deactivate.mutate(target.id, {
      onSuccess: () => { toast.success(`${target.name} deactivated.`); setDeactivateTarget(null); },
      onError: (err) => { toast.error(`Couldn’t deactivate ${target.name}: ${err.message}`); setDeactivateTarget(null); },
    });
  };

  const reactivate = (s: Statistician) => {
    setReactivatingId(s.id);
    updateStatistician.mutate(
      { id: s.id, data: { status: 'ACTIVE' } },
      {
        onSuccess: () => toast.success(`${displayName(s)} reactivated.`),
        onError: (err) => toast.error(`Couldn’t reactivate ${displayName(s)}: ${err.message}`),
        onSettled: () => setReactivatingId(null),
      },
    );
  };

  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-950">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Statisticians</h1>
      </div>

      {error && <div className={`mb-6 ${errorBanner}`}>{error.message}</div>}

      <div className="mb-8 flex flex-wrap items-center gap-4">
        <button type="button" onClick={handleAddStatistician} className={btnPrimaryLg}>
          Add Statistician
        </button>

        <div className="relative min-w-[16rem] flex-1">
          <label htmlFor="statistician-search" className="sr-only">Search statisticians</label>
          <FiSearch aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" size={20} />
          <input
            id="statistician-search"
            type="text"
            placeholder="Search Statistician"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setParam({ q: e.target.value.trim() || null, page: null }); }}
            className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>

        <div className="relative">
          <label htmlFor="statistician-status" className="sr-only">Filter by status</label>
          <select
            id="statistician-status"
            value={filter}
            onChange={(e) => setParam({ status: e.target.value === 'all' ? null : e.target.value, page: null })}
            className="min-w-[140px] cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-8 text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <FiFilter aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" size={18} />
          <FiChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" size={18} />
        </div>
      </div>

      {isPending ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">Loading statisticians...</div>
      ) : (
        <>
          <div className={`mb-8 ${STATISTICIAN_GRID}`}>
            {paginated.length > 0 ? (
              paginated.map((s) => (
                <StatisticianCard
                  key={s.id}
                  statistician={s}
                  onOpen={() => setSelectedStatisticianId(s.id)}
                  onEdit={() => handleEditStatistician(s)}
                  onDeactivate={() => setDeactivateTarget({ id: s.id, name: displayName(s) })}
                  onReactivate={() => reactivate(s)}
                  busy={reactivatingId === s.id}
                />
              ))
            ) : (
              <div className="col-span-full py-12 text-center">
                <p className="text-lg text-gray-500 dark:text-gray-400">No statisticians found</p>
                <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
                  {statisticians.length === 0
                    ? 'Add the people who will score your games. They sign in with the email and password you set.'
                    : 'Try adjusting your search or filter'}
                </p>
              </div>
            )}
          </div>

          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={(p) => setParam({ page: p <= 1 ? null : String(p) })}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
          />
        </>
      )}

      <StatisticianFormDialog
        open={isModalOpen}
        onClose={closeForm}
        initial={editingStatistician}
        isSaving={createStatistician.isPending || updateStatistician.isPending}
        serverError={formError}
        onCreate={create}
        onUpdate={update}
      />

      <DeactivateStatisticianDialog
        target={deactivateTarget}
        isWorking={deactivate.isPending}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={confirmDeactivate}
      />

      <StatisticianProfileModal statisticianId={selectedStatisticianId} onClose={() => setSelectedStatisticianId(null)} />
    </div>
  );
};

export default Statisticians;

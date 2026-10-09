import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useCreateStatistician,
  useDeleteStatistician,
  useStatisticians,
  useUpdateStatistician,
} from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import type { Statistician, StatisticianCreateBody, StatisticianUpdateBody } from '../../types/api';
import { PageHeader, ListSkeleton, EmptyState, ErrorState, NoResultsState } from '../../components/admin/page-states';
import Pagination from '../../components/ui/Pagination';
import { Button } from '../../components/ui/primitives/button';
import { StatisticianCard, STATISTICIAN_GRID } from '../../components/statisticians/StatisticianCard';
import StatisticianFormDialog from '../../components/statisticians/StatisticianFormDialog';
import DeactivateStatisticianDialog, { type DeactivateTarget } from '../../components/statisticians/DeactivateStatisticianDialog';
import { displayName, locationOf } from '../../components/statisticians/statistician-form';
import { cn } from '../../lib/utils';

const PAGE_SIZE = 12;

const TABS = [
  { key: 'active', label: 'Active', status: 'ACTIVE' },
  { key: 'inactive', label: 'Inactive', status: 'INACTIVE' },
] as const;

/**
 * Every statistician, one status at a time. The status tab, search and page live in the URL, so a
 * refresh or a shared link shows the same list.
 *
 * Unlike players, search and paging happen here rather than on the server: `GET /statistician` takes
 * a `search` parameter but never applies it, so asking the server would return the same page whatever
 * was typed. The full list for a status is fetched once (statisticians are people, not thousands of
 * rows) and filtered in the browser, which is accurate across every page. When the backend applies
 * `search` (Gap 39), this can move to server-side paging like the players list.
 */
const Statisticians: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const toast = useToast();

  const tab = TABS.find((t) => t.key === params.get('status')) ?? TABS[0];
  const q = params.get('q') ?? '';
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

  // Search types locally and writes to the URL after a pause, so each keystroke doesn't re-filter the URL.
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  useEffect(() => {
    if (draft === q) return;
    const id = window.setTimeout(() => setParam({ q: draft.trim() || null, page: null }), 300);
    return () => window.clearTimeout(id);
    // setParam is stable enough for this debounce; q and draft are the real inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const query = useStatisticians(tab.status);
  const createStatistician = useCreateStatistician();
  const updateStatistician = useUpdateStatistician();
  const deactivate = useDeleteStatistician();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Statistician | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<DeactivateTarget | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const all: Statistician[] = useMemo(() => query.data ?? [], [query.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matches = needle
      ? all.filter((s) =>
          [displayName(s), s.email ?? '', locationOf(s), s.profile?.phone ?? ''].some((f) => f.toLowerCase().includes(needle)),
        )
      : all;
    return [...matches].sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [all, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    setFormOpen(true);
  };
  const openEdit = (s: Statistician) => {
    setEditing(s);
    setFormError(null);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const create = (body: StatisticianCreateBody) => {
    setFormError(null);
    createStatistician.mutate(body, {
      onSuccess: (created) => {
        toast.success(`${displayName(created)} added.`);
        closeForm();
      },
      onError: (err) => setFormError(err.message),
    });
  };

  const update = (body: StatisticianUpdateBody) => {
    if (!editing) return;
    setFormError(null);
    if (Object.keys(body).length === 0) {
      closeForm();
      return;
    }
    const target = editing;
    updateStatistician.mutate(
      { id: target.id, data: body },
      {
        onSuccess: () => {
          toast.success(`${displayName(target)} saved.`);
          closeForm();
        },
        onError: (err) => setFormError(err.message),
      },
    );
  };

  const confirmDeactivate = () => {
    if (!deactivateTarget) return;
    const target = deactivateTarget;
    deactivate.mutate(target.id, {
      onSuccess: () => {
        toast.success(`${target.name} deactivated.`);
        setDeactivateTarget(null);
      },
      onError: (err) => {
        toast.error(`Couldn’t deactivate ${target.name}: ${err.message}`);
        setDeactivateTarget(null);
      },
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

  const showEmpty = !query.isPending && !query.isError && all.length === 0;
  const showNoResults = !query.isPending && !query.isError && all.length > 0 && filtered.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Statisticians"
        description="The people who score games. Assign them to matches from a fixture."
        actions={<Button onClick={openCreate}>Add statistician</Button>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Status" className="flex gap-1.5">
          {TABS.map((t) => {
            const active = t.key === tab.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setParam({ status: t.key === 'active' ? null : t.key, page: null })}
                className={cn(
                  'h-9 rounded-md px-3 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50',
                  active
                    ? 'bg-court-700 text-white dark:bg-court-400 dark:text-court-950'
                    : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800',
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="w-full md:max-w-sm">
          <label htmlFor="statistician-search" className="sr-only">Search statisticians</label>
          <input
            id="statistician-search"
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by name, email or place"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
      </div>

      {query.isPending && <ListSkeleton columns={3} rows={6} label="Loading statisticians" />}
      {query.isError && <ErrorState message={(query.error as Error).message} onRetry={() => void query.refetch()} />}
      {showEmpty && tab.key === 'active' && (
        <EmptyState
          title="No statisticians yet"
          description="Add the people who will score your games. They sign in with the email and password you set."
          action={{ label: 'Add statistician', onClick: openCreate }}
        />
      )}
      {showEmpty && tab.key === 'inactive' && (
        <EmptyState title="No inactive statisticians" description="Anyone you deactivate shows up here, and can be reactivated." />
      )}
      {showNoResults && (
        <NoResultsState query={q} onClear={() => { setDraft(''); setParam({ q: null, page: null }); }} />
      )}

      {!query.isPending && !query.isError && rows.length > 0 && (
        <>
          <ul className={cn(STATISTICIAN_GRID, query.isFetching && 'opacity-70 transition-opacity')} aria-label="Statisticians">
            {rows.map((s) => (
              <li key={s.id} className="min-w-0">
                <StatisticianCard
                  statistician={s}
                  onEdit={() => openEdit(s)}
                  onDeactivate={() => setDeactivateTarget({ id: s.id, name: displayName(s) })}
                  onReactivate={() => reactivate(s)}
                  busy={reactivatingId === s.id}
                />
              </li>
            ))}
          </ul>

          {pageCount > 1 && (
            <Pagination
              currentPage={safePage}
              totalPages={pageCount}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={(p) => setParam({ page: p <= 1 ? null : String(p) })}
            />
          )}
        </>
      )}

      <StatisticianFormDialog
        open={formOpen}
        onClose={closeForm}
        initial={editing}
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
    </div>
  );
};

export default Statisticians;

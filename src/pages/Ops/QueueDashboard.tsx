import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useQueueHealth, useQueueLag, useRequeueDeadLetter, useWarmSession, queryKeys } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import DataTable from '../../components/ui/DataTable';
import Spinner from '../../components/ui/Spinner';
import Skeleton from '../../components/ui/Skeleton';
import { errorBanner } from '../../components/ui/formStyles';
import { cn } from '../../lib/utils';
import { QUEUE_LABELS, REQUEUE_LIMIT, clampLimit, formatMs, lagTone } from './queue-format';

const COUNTS: Array<{ key: string; label: string; cls: string }> = [
  { key: 'active', label: 'Active', cls: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-500/10' },
  { key: 'waiting', label: 'Waiting', cls: 'text-warning-700 bg-warning-50 dark:text-warning-500 dark:bg-warning-500/10' },
  { key: 'failed', label: 'Failed', cls: 'text-error-600 bg-error-50 dark:text-error-500 dark:bg-error-500/10' },
  { key: 'delayed', label: 'Delayed', cls: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-500/10' },
  { key: 'completed', label: 'Done', cls: 'text-success-700 bg-success-50 dark:text-success-500 dark:bg-success-500/10' },
];

const inputClass =
  'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-white/5';

function RedisBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        enabled
          ? 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500'
          : 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500',
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', enabled ? 'bg-success-500' : 'bg-error-500')} />
      {enabled ? 'Redis connected' : 'Redis disabled'}
    </span>
  );
}

interface LagRow {
  name: string;
  label: string;
  waiting: number;
  oldestWaitingMs: number;
}

const lagColumns: ColumnDef<LagRow>[] = [
  { accessorKey: 'label', header: 'Queue' },
  { accessorKey: 'waiting', header: 'Waiting' },
  {
    accessorKey: 'oldestWaitingMs',
    header: 'Oldest waiting',
    cell: ({ row }) => {
      const ms = row.original.oldestWaitingMs;
      const tone = lagTone(ms);
      return (
        <span
          className={cn(
            'font-medium',
            tone === 'stuck' && 'text-error-600 dark:text-error-500',
            tone === 'slow' && 'text-warning-700 dark:text-warning-500',
            tone === 'ok' && 'text-gray-600 dark:text-gray-400',
          )}
        >
          {formatMs(ms)}
        </span>
      );
    },
  },
];

/**
 * Health of the BullMQ / Redis queues behind StatDash, plus two operator actions — back to the
 * pre-redesign layout: the `max-w-5xl` page, the title with its subtitle, the pill Redis badge beside a
 * `brand` Refresh, the three white count cards, the lag table, and the two action cards.
 *
 * **Everything the redesign added to make the actions safe is kept**, because all of it is substance:
 *
 * - Both actions change server state, so they are disabled while Redis is off. With Redis off the
 *   backend answers `{ requeued: 0 }` and `{ warmed: true }` without having done anything (Gap 44), so
 *   an enabled button there would report success for nothing.
 * - Requeueing asks first, and says how many jobs it will move.
 * - A last-updated time, so a stale page is obvious.
 * - The dead-letter queue is **not** in the health response (Gap 44), so there is no count of what a
 *   requeue would pick up. The card says so rather than implying the number is somewhere above.
 *
 * **Added here:** a banner when a queue has failed jobs. The whole point of this screen is to notice
 * that, and the counts alone are easy to read past — the live backend currently reports 76 failures
 * across the three queues with zero completions, which is what Gap 47 looks like from this side.
 */
const QueueDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const health = useQueueHealth();
  const lag = useQueueLag();
  const requeue = useRequeueDeadLetter();
  const warm = useWarmSession();

  const [limit, setLimit] = useState<string>(String(REQUEUE_LIMIT.default));
  const [sessionId, setSessionId] = useState('');

  const enabled = health.data?.enabled === true;
  const queues = health.data?.queues ?? {};
  const lagData = lag.data?.lag ?? {};
  const refreshing = health.isFetching || lag.isFetching;
  const loading = health.isPending || lag.isPending;
  const failedToLoad = health.isError || lag.isError;

  /** Failures across every queue, and which queues have them — the thing worth noticing here. */
  const failures = useMemo(() => {
    const perQueue = Object.entries(QUEUE_LABELS)
      .map(([name, label]) => ({ label, failed: ((queues[name] ?? {}) as Record<string, number>).failed ?? 0 }))
      .filter((q) => q.failed > 0);
    return { total: perQueue.reduce((n, q) => n + q.failed, 0), perQueue };
  }, [queues]);

  const lagRows = useMemo<LagRow[]>(
    () =>
      Object.keys(QUEUE_LABELS).map((name) => {
        const entry = lagData[name] ?? { waiting: 0, oldestWaitingMs: 0 };
        return { name, label: QUEUE_LABELS[name], waiting: entry.waiting, oldestWaitingMs: entry.oldestWaitingMs };
      }),
    [lagData],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.ops.health });
    void queryClient.invalidateQueries({ queryKey: queryKeys.ops.lag });
  };

  const doRequeue = async () => {
    const n = clampLimit(limit);
    setLimit(String(n));
    const ok = await confirm({
      title: 'Requeue dead-letter jobs?',
      description: `Up to ${n} failed job${n === 1 ? '' : 's'} will be moved out of the dead-letter queue and run again. Each one is removed from the dead-letter queue as it is requeued.`,
      confirmLabel: 'Requeue',
    });
    if (!ok) return;
    requeue.mutate(n, {
      onSuccess: (res) =>
        toast.success(res.requeued === 0 ? 'Nothing to requeue.' : `${res.requeued} job${res.requeued === 1 ? '' : 's'} requeued.`),
      onError: (err) => toast.error(`Couldn’t requeue: ${err.message}`),
    });
  };

  const doWarm = () => {
    const id = sessionId.trim();
    if (!id) return;
    warm.mutate(id, {
      onSuccess: () => {
        toast.success('Cache warm queued for that session.');
        setSessionId('');
      },
      onError: (err) => toast.error(`Couldn’t warm the cache: ${err.message}`),
    });
  };

  const updated = Math.max(health.dataUpdatedAt, lag.dataUpdatedAt);

  return (
    <div className="mx-auto min-h-screen max-w-5xl space-y-6 p-6 dark:bg-gray-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Queue Dashboard</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            BullMQ / Redis queue health and operations. Updates every 30 seconds
            {updated > 0 ? ` — last updated ${new Date(updated).toLocaleTimeString()}` : ''}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {health.data !== undefined && <RedisBadge enabled={enabled} />}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing && <Spinner />}
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {failedToLoad && (
        <div className={errorBanner}>
          Couldn’t load queue data. Check that the backend is reachable.{' '}
          <button type="button" onClick={refresh} className="cursor-pointer font-semibold underline">Try again</button>
        </div>
      )}

      {health.data && !enabled && (
        <p role="note" className="rounded-lg border border-warning-100 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-500">
          Redis is switched off on the backend, so nothing is queued and the actions below are unavailable.
        </p>
      )}

      {failures.total > 0 && (
        <div role="alert" className="rounded-lg border border-error-100 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-500">
          <p className="font-semibold">
            {failures.total} failed job{failures.total === 1 ? '' : 's'} across{' '}
            {failures.perQueue.length} queue{failures.perQueue.length === 1 ? '' : 's'}.
          </p>
          <p className="mt-1">
            {failures.perQueue.map((q) => `${q.label}: ${q.failed}`).join(' · ')}. A failed match stat sync is why a
            finished game's score can stay off the match record. The errors themselves are in the dead-letter queue,
            which this screen can't read yet.
          </p>
        </div>
      )}

      <section aria-labelledby="health-heading">
        <h2 id="health-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Queue Health
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {loading
            ? Object.keys(QUEUE_LABELS).map((name) => <Skeleton key={name} className="h-48 w-full rounded-xl" />)
            : Object.entries(QUEUE_LABELS).map(([name, label]) => {
                const counts = (queues[name] ?? {}) as Record<string, number>;
                return (
                  <div
                    key={name}
                    aria-label={label}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
                  >
                    <p className="mb-3 text-sm font-semibold text-gray-800 dark:text-white">{label}</p>
                    <dl className="space-y-1.5">
                      {COUNTS.map((c) => (
                        <div key={c.key} className="flex items-center justify-between">
                          <dt className="text-xs text-gray-500 dark:text-gray-400">{c.label}</dt>
                          <dd className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', c.cls)}>
                            {counts[c.key] ?? 0}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
        </div>
      </section>

      <section aria-labelledby="lag-heading">
        <h2 id="lag-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Queue Lag
        </h2>
        <DataTable
          columns={lagColumns}
          data={lagRows}
          label="Queue lag"
          isLoading={loading}
          error={lag.isError ? 'Failed to load queue lag data.' : null}
          onRetry={refresh}
        />
      </section>

      <section aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Actions
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">Requeue Dead-Letter Jobs</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Moves failed jobs from the dead-letter queue back into their source queues for retry. The dead-letter
                queue isn’t in the counts above, so you can’t see how many are waiting.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="requeue-limit" className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">Up to</label>
              <input
                id="requeue-limit"
                type="number"
                inputMode="numeric"
                min={REQUEUE_LIMIT.min}
                max={REQUEUE_LIMIT.max}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                onBlur={() => setLimit(String(clampLimit(limit)))}
                disabled={!enabled || requeue.isPending}
                className={cn(inputClass, 'w-20')}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">jobs</span>
              <button
                type="button"
                onClick={() => void doRequeue()}
                disabled={!enabled || requeue.isPending}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-warning-500 px-4 py-1.5 text-sm text-white transition-colors hover:bg-warning-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {requeue.isPending && <Spinner />}
                {requeue.isPending ? 'Requeueing...' : 'Requeue'}
              </button>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-white">Warm Session Cache</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Enqueues a projection rebuild, replay backfill, and match stat sync for a given session.
              </p>
            </div>
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                doWarm();
              }}
            >
              <label htmlFor="warm-session" className="sr-only">Session ID</label>
              <input
                id="warm-session"
                type="text"
                placeholder="Session ID"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                disabled={!enabled || warm.isPending}
                className={cn(inputClass, 'min-w-0 flex-1')}
              />
              <button
                type="submit"
                disabled={!enabled || warm.isPending || !sessionId.trim()}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {warm.isPending && <Spinner />}
                {warm.isPending ? 'Warming...' : 'Warm'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default QueueDashboard;

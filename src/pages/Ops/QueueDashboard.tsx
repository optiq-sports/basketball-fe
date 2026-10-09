import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useQueueHealth, useQueueLag, useRequeueDeadLetter, useWarmSession, queryKeys } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { PageHeader, ErrorState } from '../../components/admin/page-states';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import DataTable from '../../components/ui/DataTable';
import Spinner from '../../components/ui/Spinner';
import Skeleton from '../../components/ui/Skeleton';
import { Button } from '../../components/ui/primitives/button';
import { Badge } from '../../components/ui/primitives/badge';
import { Card, CardDescription, CardTitle } from '../../components/ui/primitives/card';
import { cn } from '../../lib/utils';
import { QUEUE_LABELS, REQUEUE_LIMIT, clampLimit, formatMs, lagTone } from './queue-format';

const COUNTS: Array<{ key: string; label: string; tone: 'live' | 'warning' | 'danger' | 'neutral' | 'success' }> = [
  { key: 'active', label: 'Active', tone: 'live' },
  { key: 'waiting', label: 'Waiting', tone: 'warning' },
  { key: 'failed', label: 'Failed', tone: 'danger' },
  { key: 'delayed', label: 'Delayed', tone: 'neutral' },
  { key: 'completed', label: 'Done', tone: 'success' },
];

const inputClass =
  'rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

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
            tone === 'stuck' && 'text-rose-600 dark:text-rose-400',
            tone === 'slow' && 'text-amber-700 dark:text-amber-400',
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
 * Health of the BullMQ / Redis queues behind StatDash, plus two operator actions. Both actions change
 * server state, so they are disabled while Redis is off — the backend would answer "0 requeued" and
 * "warmed" without having done anything — and requeueing asks first.
 *
 * The dead-letter queue itself isn't in the health response (Gap 44), so there is no count of what a
 * requeue would pick up; the page says so rather than implying it.
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
  const failed = health.isError || lag.isError;

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Queue ops"
        description="Health of the queues behind live scoring. Updates every 30 seconds."
        actions={
          <>
            {health.data !== undefined && (
              <Badge variant={enabled ? 'success' : 'danger'}>{enabled ? 'Redis connected' : 'Redis disabled'}</Badge>
            )}
            <Button variant="secondary" onClick={refresh} disabled={refreshing}>
              {refreshing && <Spinner />}
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </>
        }
      />

      {updated > 0 && <p className="-mt-3 text-xs text-gray-500">Last updated {new Date(updated).toLocaleTimeString()}</p>}

      {failed && <ErrorState message="Couldn’t load queue data. Check that the backend is reachable." onRetry={refresh} />}

      {health.data && !enabled && (
        <p role="note" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          Redis is switched off on the backend, so nothing is queued and the actions below are unavailable.
        </p>
      )}

      <section aria-labelledby="health-heading" className="flex flex-col gap-3">
        <h2 id="health-heading" className="text-sm font-semibold uppercase tracking-wide text-gray-500">Queue health</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {loading
            ? Object.keys(QUEUE_LABELS).map((name) => <Skeleton key={name} className="h-48 w-full rounded-xl" />)
            : Object.entries(QUEUE_LABELS).map(([name, label]) => {
                const counts = (queues[name] ?? {}) as Record<string, number>;
                return (
                  <Card key={name} className="gap-3 p-4" aria-label={label}>
                    <CardTitle>{label}</CardTitle>
                    <dl className="flex flex-col gap-1.5">
                      {COUNTS.map((c) => (
                        <div key={c.key} className="flex items-center justify-between">
                          <dt className="text-xs text-gray-500">{c.label}</dt>
                          <dd><Badge variant={c.tone}>{counts[c.key] ?? 0}</Badge></dd>
                        </div>
                      ))}
                    </dl>
                  </Card>
                );
              })}
        </div>
      </section>

      <section aria-labelledby="lag-heading" className="flex flex-col gap-3">
        <h2 id="lag-heading" className="text-sm font-semibold uppercase tracking-wide text-gray-500">Queue lag</h2>
        <DataTable columns={lagColumns} data={lagRows} isLoading={loading} error={lag.isError ? 'Failed to load queue lag data.' : null} onRetry={refresh} />
      </section>

      <section aria-labelledby="actions-heading" className="flex flex-col gap-3">
        <h2 id="actions-heading" className="text-sm font-semibold uppercase tracking-wide text-gray-500">Actions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="gap-3 p-4">
            <div>
              <CardTitle>Requeue dead-letter jobs</CardTitle>
              <CardDescription>
                Moves failed jobs from the dead-letter queue back into their source queues. The dead-letter queue isn’t in the counts above, so you can’t see how many are waiting.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="requeue-limit" className="text-xs text-gray-500">Up to</label>
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
                className={cn(inputClass, 'w-24')}
              />
              <span className="text-xs text-gray-500">jobs</span>
              <Button variant="secondary" onClick={() => void doRequeue()} disabled={!enabled || requeue.isPending}>
                {requeue.isPending && <Spinner />}
                {requeue.isPending ? 'Requeueing…' : 'Requeue'}
              </Button>
            </div>
          </Card>

          <Card className="gap-3 p-4">
            <div>
              <CardTitle>Warm a session’s cache</CardTitle>
              <CardDescription>Queues a projection rebuild, a replay backfill and a match stat sync for one StatDash session.</CardDescription>
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
              <Button type="submit" variant="secondary" disabled={!enabled || warm.isPending || !sessionId.trim()}>
                {warm.isPending && <Spinner />}
                {warm.isPending ? 'Queueing…' : 'Warm'}
              </Button>
            </form>
          </Card>
        </div>
      </section>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default QueueDashboard;

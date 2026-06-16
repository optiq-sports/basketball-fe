import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useQueueHealth,
  useQueueLag,
  useRequeueDeadLetter,
  useWarmSession,
  queryKeys,
} from '../../api/hooks';

const QUEUE_LABELS: Record<string, string> = {
  'statdash-projections': 'Projection Rebuild',
  'statdash-recompute': 'Session Recompute',
  'statdash-matchstat-sync': 'Match Stat Sync',
};

function formatMs(ms: number): string {
  if (ms === 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
        enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-green-500' : 'bg-red-400'}`} />
      {enabled ? 'Redis connected' : 'Redis disabled'}
    </span>
  );
}

const COUNT_LABELS: Array<[string, string, string]> = [
  ['active', 'Active', 'text-blue-600 bg-blue-50'],
  ['waiting', 'Waiting', 'text-yellow-700 bg-yellow-50'],
  ['failed', 'Failed', 'text-red-600 bg-red-50'],
  ['delayed', 'Delayed', 'text-purple-600 bg-purple-50'],
  ['completed', 'Done', 'text-green-700 bg-green-50'],
];

const QueueDashboard: React.FC = () => {
  const queryClient = useQueryClient();
  const health = useQueueHealth();
  const lag = useQueueLag();
  const requeue = useRequeueDeadLetter();
  const warm = useWarmSession();

  const [requeueLimit, setRequeueLimit] = useState(25);
  const [sessionId, setSessionId] = useState('');
  const [warmResult, setWarmResult] = useState<string | null>(null);
  const [requeueResult, setRequeueResult] = useState<string | null>(null);

  const queues = health.data?.queues ?? {};
  const lagData = lag.data?.lag ?? {};
  const queueNames = Object.keys(QUEUE_LABELS);

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: queryKeys.ops.health });
    queryClient.invalidateQueries({ queryKey: queryKeys.ops.lag });
  }

  async function handleRequeue() {
    setRequeueResult(null);
    try {
      const res = await requeue.mutateAsync(requeueLimit);
      setRequeueResult(`${res.requeued} job${res.requeued !== 1 ? 's' : ''} requeued`);
    } catch (err) {
      setRequeueResult(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
    }
  }

  async function handleWarm() {
    if (!sessionId.trim()) return;
    setWarmResult(null);
    try {
      await warm.mutateAsync(sessionId.trim());
      setWarmResult('Cache warm enqueued');
    } catch (err) {
      setWarmResult(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
    }
  }

  const isLoading = health.isLoading || lag.isLoading;
  const isError = health.isError || lag.isError;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Queue Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">BullMQ / Redis queue health and operations</p>
        </div>
        <div className="flex items-center gap-3">
          {health.data !== undefined && <StatusBadge enabled={health.data.enabled} />}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          Failed to load queue data. Check that the backend is reachable.
        </div>
      )}

      {/* Queue Health */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Queue Health</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {queueNames.map((name) => {
            const counts = queues[name] ?? {};
            return (
              <div key={name} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-sm font-semibold text-gray-800 mb-3">{QUEUE_LABELS[name]}</p>
                <div className="space-y-1.5">
                  {COUNT_LABELS.map(([key, label, cls]) => {
                    const val = (counts as Record<string, number>)[key] ?? 0;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{label}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
                          {val}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Queue Lag */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Queue Lag</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Queue</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Waiting</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Oldest waiting</th>
              </tr>
            </thead>
            <tbody>
              {queueNames.map((name, i) => {
                const entry = lagData[name] ?? { waiting: 0, oldestWaitingMs: 0 };
                const isLast = i === queueNames.length - 1;
                return (
                  <tr key={name} className={!isLast ? 'border-b border-gray-100' : ''}>
                    <td className="px-4 py-3 text-gray-800 font-medium">{QUEUE_LABELS[name]}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{entry.waiting}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-medium ${
                          entry.oldestWaitingMs > 60_000
                            ? 'text-red-600'
                            : entry.oldestWaitingMs > 10_000
                            ? 'text-yellow-700'
                            : 'text-gray-600'
                        }`}
                      >
                        {formatMs(entry.oldestWaitingMs)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Actions */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Requeue dead-letter jobs */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Requeue Dead-Letter Jobs</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Moves failed jobs from the DLQ back into their source queues for retry.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">Limit</label>
              <input
                type="number"
                min={1}
                max={200}
                value={requeueLimit}
                onChange={(e) => setRequeueLimit(Math.max(1, parseInt(e.target.value, 10) || 25))}
                className="w-20 text-sm px-2 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleRequeue}
                disabled={requeue.isPending}
                className="text-sm px-4 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {requeue.isPending ? 'Requeueing…' : 'Requeue'}
              </button>
            </div>
            {requeueResult && (
              <p className={`text-xs font-medium ${requeueResult.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>
                {requeueResult}
              </p>
            )}
          </div>

          {/* Warm session cache */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Warm Session Cache</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Enqueues a projection rebuild, replay backfill, and match stat sync for a given session.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Session ID"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="flex-1 text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleWarm}
                disabled={warm.isPending || !sessionId.trim()}
                className="text-sm px-4 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {warm.isPending ? 'Warming…' : 'Warm'}
              </button>
            </div>
            {warmResult && (
              <p className={`text-xs font-medium ${warmResult.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>
                {warmResult}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default QueueDashboard;

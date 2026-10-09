/** Friendly names for the three BullMQ work queues `GET /ops/queues/health` reports. */
export const QUEUE_LABELS: Record<string, string> = {
  'statdash-projections': 'Projection rebuild',
  'statdash-recompute': 'Session recompute',
  'statdash-matchstat-sync': 'Match stat sync',
};

export const REQUEUE_LIMIT = { min: 1, max: 200, default: 25 } as const;

export function formatMs(ms: number): string {
  if (ms === 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

/** How worrying an oldest-waiting job is: over a minute is a stuck queue, over ten seconds is slow. */
export function lagTone(ms: number): 'ok' | 'slow' | 'stuck' {
  return ms > 60_000 ? 'stuck' : ms > 10_000 ? 'slow' : 'ok';
}

/** Keeps the requeue limit a whole number the backend will accept; blank or junk falls back to the default. */
export function clampLimit(raw: string): number {
  const n = Math.trunc(Number(raw));
  if (!Number.isFinite(n) || raw.trim() === '') return REQUEUE_LIMIT.default;
  return Math.min(REQUEUE_LIMIT.max, Math.max(REQUEUE_LIMIT.min, n));
}

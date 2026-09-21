import { StatDashApiError } from './client';

export interface VersionConflictInfo {
  /** The session's real current version, when the server said what it is. */
  latestVersion: number | null;
}

/**
 * Recognizes the backend's optimistic-concurrency rejection ("Stale version. Expected 1, latest
 * is 2", HTTP 409) and pulls out the session's real current version.
 *
 * The server's error body carries only `statusCode` and `message` — no `code` field — so matching
 * on a code never works; the status plus the message is what actually identifies it. The number
 * in the message comes from a read inside the same transaction that rejected the command, so
 * unlike GET /state (served from a 30 s cache) it can be trusted as current.
 *
 * Returns null for any other error, including other 409s (e.g. a reused idempotency key), which
 * must NOT be retried as if the version were the problem.
 */
export function parseVersionConflict(error: unknown): VersionConflictInfo | null {
  if (!(error instanceof StatDashApiError) || error.status !== 409) return null;

  const isVersionConflict =
    error.code === 'VERSION_CONFLICT' ||
    error.code === 'SD_VERSION_CONFLICT' ||
    /stale version/i.test(error.message);
  if (!isVersionConflict) return null;

  const details = error.details as { latestVersion?: unknown } | null | undefined;
  if (typeof details?.latestVersion === 'number') return { latestVersion: details.latestVersion };

  const match = /latest is (\d+)/i.exec(error.message);
  return { latestVersion: match ? Number(match[1]) : null };
}

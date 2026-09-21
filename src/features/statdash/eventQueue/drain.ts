import { parseVersionConflict, sessionsApi, StatDashApiError, type CommandAcceptedResponse } from '../../../services/statdash';
import type { QueuedEvent } from './types';

let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** How many times one command may be re-sent with a corrected version before we give up. */
export const MAX_CONFLICT_RETRIES = 3;

export function clearDrainRetryTimer(): void {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetry(callback: () => void): void {
  clearDrainRetryTimer();
  retryTimer = setTimeout(callback, 3000);
}

// A command's true expectedVersion can only be known at the moment it's actually sent,
// not when it was enqueued: the backend bumps the session version by however many events
// a command emits (e.g. a made free throw with an assist emits 2 events, not 1), so a
// version pre-computed at enqueue time assuming "+1 per command" goes stale the moment an
// earlier queued command consumes more than one version slot. Always trust the caller's
// live-tracked latest confirmed version instead of the value frozen on the event itself.
export function resolveExpectedVersion(event: QueuedEvent, latestKnownVersion: number): number {
  void event;
  return latestKnownVersion;
}

function rebasePendingEvents(queue: QueuedEvent[], baseVersion: number): QueuedEvent[] {
  let versionCursor = baseVersion;
  return queue
    .slice()
    .sort((a, b) => a.enqueuedAt - b.enqueuedAt)
    .map((event) => {
      // 'sent' and 'failed' are both terminal — a failed command was rejected for a
      // reason a version bump can't fix (e.g. a validation error) and must not be
      // resurrected. Reviving it here would burn a version slot on a doomed retry
      // and throw off the version assigned to every real pending command after it.
      if (event.status === 'sent' || event.status === 'failed') return event;
      const rebased = {
        ...event,
        expectedVersion: versionCursor,
        status: 'pending' as const,
      };
      versionCursor += 1;
      return rebased;
    });
}

export interface DrainQueueOptions {
  /** Always returns the LIVE queue — events enqueued mid-drain must be visible here. */
  getQueue: () => QueuedEvent[];
  /**
   * Applies a functional update to the live queue and persists it. The drain must
   * never replace the queue with its own snapshot: commands enqueued while a send
   * was in flight would be silently erased (they'd stay in the game log but never
   * reach the backend).
   */
  applyQueueUpdate: (updater: (prev: QueuedEvent[]) => QueuedEvent[]) => QueuedEvent[];
  getIsOnline: () => boolean;
  /** Live-tracked "next expectedVersion to send" — updated by the caller after every
   * confirmed response (including ones outside this drain, e.g. corrections/reversals). */
  getLatestVersion: () => number;
  /** Called whenever the drain learns the session's real version from the server (a confirmed
   * command or a version-conflict rejection), so the caller's own copy can move forward too. */
  onVersionObserved?: (version: number) => void;
  /** An entry that no longer has anything to do (e.g. undoing a play the server never applied) is
   * marked done without being sent. */
  shouldSkip?: (event: QueuedEvent) => boolean;
  sendCommand: (event: QueuedEvent) => Promise<CommandAcceptedResponse>;
  onCommandAccepted: (event: QueuedEvent, response: CommandAcceptedResponse) => void;
  onCommandFailed: (event: QueuedEvent, error: unknown) => void;
}

function patchEvent(targetId: string, patch: Partial<QueuedEvent>) {
  return (prev: QueuedEvent[]): QueuedEvent[] =>
    prev.map((event) => (event.localId === targetId ? { ...event, ...patch } : event));
}

export async function drainQueue(options: DrainQueueOptions): Promise<void> {
  const { getIsOnline, getQueue, applyQueueUpdate, getLatestVersion, onVersionObserved, shouldSkip, onCommandAccepted, onCommandFailed, sendCommand } = options;
  if (!getIsOnline()) return;

  // Tracked locally for this drain run, seeded from the caller's persisted value, and
  // kept in sync on every confirmed response or version-conflict rebase. A command can
  // consume more than one version slot (see resolveExpectedVersion above), so the very
  // next send in this same loop needs the up-to-date number immediately — it can't wait
  // for the caller's own state/storage to catch up via onCommandAccepted.
  let knownVersion = getLatestVersion();
  const conflictRetries = new Map<string, number>();

  while (getIsOnline()) {
    // Re-read the live queue every iteration so events enqueued while the previous
    // send was awaiting the network are drained in the same loop.
    const queueNow = getQueue()
      .slice()
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
    const nextPending = queueNow.find((event) => event.status === 'pending');
    if (!nextPending) return;

    if (shouldSkip?.(nextPending)) {
      applyQueueUpdate(patchEvent(nextPending.localId, { status: 'sent', lastError: undefined }));
      continue;
    }

    const inflight = {
      ...nextPending,
      status: 'inflight' as const,
      attempts: nextPending.attempts + 1,
      // Resolved at send time, not enqueue time — see resolveExpectedVersion above.
      expectedVersion: resolveExpectedVersion(nextPending, knownVersion),
      lastError: undefined,
    };
    applyQueueUpdate(patchEvent(nextPending.localId, inflight));

    try {
      console.groupCollapsed(`[statdash] ▶ ${inflight.commandType}`);
      console.log('sessionId      :', inflight.sessionId);
      console.log('commandType    :', inflight.commandType);
      console.log('expectedVersion:', inflight.expectedVersion);
      console.log('idempotencyKey :', inflight.localId);
      console.log('payload        :', inflight.payload);
      console.groupEnd();
      const response = await sendCommand(inflight);
      applyQueueUpdate(
        patchEvent(inflight.localId, {
          status: 'sent',
          lastError: undefined,
          backendEventIds: response.emittedEvents?.map((e) => e.id),
        }),
      );
      knownVersion = response.version;
      onVersionObserved?.(response.version);
      onCommandAccepted(inflight, response);
      continue;
    } catch (error) {
      // A stale-version rejection means our copy of the version was behind, not that the command is
      // bad: re-send it with the server's real version. Recoverable, so it doesn't surface as a
      // failure unless we give up below.
      const conflict = parseVersionConflict(error);
      if (conflict) {
        const tries = (conflictRetries.get(inflight.localId) ?? 0) + 1;
        conflictRetries.set(inflight.localId, tries);
        if (tries > MAX_CONFLICT_RETRIES) {
          onCommandFailed(inflight, error);
          applyQueueUpdate(
            patchEvent(inflight.localId, {
              status: 'failed',
              lastError: `Version conflict — gave up after ${MAX_CONFLICT_RETRIES} retries`,
            }),
          );
          continue;
        }

        try {
          // Prefer the version the server reported in the rejection itself: it was read inside the
          // rejecting transaction. GET /state is a fallback only — the backend serves it from a
          // cache that can lag behind, which is exactly how the version got stale to begin with.
          const latest =
            conflict.latestVersion ?? (await sessionsApi.getSessionState(inflight.sessionId)).version;
          knownVersion = latest;
          onVersionObserved?.(latest);
          applyQueueUpdate((prev) => rebasePendingEvents(prev, latest));
          continue;
        } catch (innerError) {
          applyQueueUpdate(
            patchEvent(inflight.localId, {
              status: 'pending',
              lastError: innerError instanceof Error ? innerError.message : 'Failed to rebase version',
            }),
          );
          scheduleRetry(() => {
            void drainQueue(options);
          });
          return;
        }
      }

      onCommandFailed(inflight, error);

      if (error instanceof StatDashApiError && error.status === 0) {
        applyQueueUpdate(patchEvent(inflight.localId, { status: 'pending', lastError: error.message }));
        scheduleRetry(() => {
          void drainQueue(options);
        });
        return;
      }

      if (error instanceof StatDashApiError && error.status >= 400 && error.status < 500) {
        applyQueueUpdate(patchEvent(inflight.localId, { status: 'failed', lastError: error.message }));
        console.warn('[statdash] queue event failed validation', inflight.commandType, error.message);
        continue;
      }

      applyQueueUpdate(
        patchEvent(inflight.localId, {
          status: 'pending',
          lastError: error instanceof Error ? error.message : 'Unknown queue error',
        }),
      );
      scheduleRetry(() => {
        void drainQueue(options);
      });
      return;
    }
  }
}

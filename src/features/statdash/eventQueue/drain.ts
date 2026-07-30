import { sessionsApi, StatDashApiError, type CommandAcceptedResponse } from '../../../services/statdash';
import type { QueuedEvent } from './types';

let retryTimer: ReturnType<typeof setTimeout> | null = null;

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

export function resolveExpectedVersion(event: QueuedEvent, latestKnownVersion: number): number {
  void latestKnownVersion;
  return event.expectedVersion;
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
  sendCommand: (event: QueuedEvent) => Promise<CommandAcceptedResponse>;
  onCommandAccepted: (event: QueuedEvent, response: CommandAcceptedResponse) => void;
  onCommandFailed: (event: QueuedEvent, error: unknown) => void;
}

function patchEvent(targetId: string, patch: Partial<QueuedEvent>) {
  return (prev: QueuedEvent[]): QueuedEvent[] =>
    prev.map((event) => (event.localId === targetId ? { ...event, ...patch } : event));
}

export async function drainQueue(options: DrainQueueOptions): Promise<void> {
  const { getIsOnline, getQueue, applyQueueUpdate, onCommandAccepted, onCommandFailed, sendCommand } = options;
  if (!getIsOnline()) return;

  while (getIsOnline()) {
    // Re-read the live queue every iteration so events enqueued while the previous
    // send was awaiting the network are drained in the same loop.
    const queueNow = getQueue()
      .slice()
      .sort((a, b) => a.enqueuedAt - b.enqueuedAt);
    const nextPending = queueNow.find((event) => event.status === 'pending');
    if (!nextPending) return;

    const inflight = {
      ...nextPending,
      status: 'inflight' as const,
      attempts: nextPending.attempts + 1,
      expectedVersion: resolveExpectedVersion(nextPending, nextPending.expectedVersion),
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
      applyQueueUpdate(patchEvent(inflight.localId, { status: 'sent', lastError: undefined }));
      onCommandAccepted(inflight, response);
      continue;
    } catch (error) {
      onCommandFailed(inflight, error);

      if (error instanceof StatDashApiError && error.code === 'VERSION_CONFLICT') {
        if (inflight.attempts > 1) {
          applyQueueUpdate(
            patchEvent(inflight.localId, { status: 'failed', lastError: 'Version conflict after retry' }),
          );
          continue;
        }

        try {
          const latest = await sessionsApi.getSessionState(inflight.sessionId);
          applyQueueUpdate((prev) => rebasePendingEvents(prev, latest.version));
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

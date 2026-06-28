import { sessionsApi, StatDashApiError, type CommandAcceptedResponse } from '../../../services/statdash';
import type { QueuedEvent } from './types';
import { loadQueue, saveQueue } from './storage';

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

function updateQueue(
  queue: QueuedEvent[],
  targetId: string,
  patch: Partial<QueuedEvent>,
): QueuedEvent[] {
  return queue.map((event) => (event.localId === targetId ? { ...event, ...patch } : event));
}

function rebasePendingEvents(queue: QueuedEvent[], baseVersion: number): QueuedEvent[] {
  let versionCursor = baseVersion;
  return queue
    .slice()
    .sort((a, b) => a.enqueuedAt - b.enqueuedAt)
    .map((event) => {
      if (event.status === 'sent') return event;
      const rebased = {
        ...event,
        expectedVersion: versionCursor,
        status: 'pending' as const,
      };
      versionCursor += 1;
      return rebased;
    });
}

export async function drainQueue(options: {
  queue: QueuedEvent[];
  onQueueChange: (next: QueuedEvent[]) => void;
  getIsOnline: () => boolean;
  sendCommand: (event: QueuedEvent) => Promise<CommandAcceptedResponse>;
  onCommandAccepted: (event: QueuedEvent, response: CommandAcceptedResponse) => void;
  onCommandFailed: (event: QueuedEvent, error: unknown) => void;
}): Promise<void> {
  const { getIsOnline, onQueueChange, onCommandAccepted, onCommandFailed, sendCommand } = options;
  if (!getIsOnline()) return;

  let currentQueue = options.queue.slice().sort((a, b) => a.enqueuedAt - b.enqueuedAt);

  while (getIsOnline()) {
    const nextPending = currentQueue.find((event) => event.status === 'pending');
    if (!nextPending) return;

    const inflight = {
      ...nextPending,
      status: 'inflight' as const,
      attempts: nextPending.attempts + 1,
      expectedVersion: resolveExpectedVersion(nextPending, nextPending.expectedVersion),
      lastError: undefined,
    };
    currentQueue = updateQueue(currentQueue, nextPending.localId, inflight);
    onQueueChange(currentQueue);
    saveQueue(currentQueue);

    try {
      console.groupCollapsed(`[statdash] ▶ ${inflight.commandType}`);
      console.log('sessionId      :', inflight.sessionId);
      console.log('commandType    :', inflight.commandType);
      console.log('expectedVersion:', inflight.expectedVersion);
      console.log('idempotencyKey :', inflight.localId);
      console.log('payload        :', inflight.payload);
      console.groupEnd();
      const response = await sendCommand(inflight);
      currentQueue = updateQueue(currentQueue, inflight.localId, { status: 'sent', lastError: undefined });
      onQueueChange(currentQueue);
      saveQueue(currentQueue);
      onCommandAccepted(inflight, response);
      continue;
    } catch (error) {
      onCommandFailed(inflight, error);

      if (error instanceof StatDashApiError && error.code === 'VERSION_CONFLICT') {
        if (inflight.attempts > 1) {
          currentQueue = updateQueue(currentQueue, inflight.localId, {
            status: 'failed',
            lastError: 'Version conflict after retry',
          });
          onQueueChange(currentQueue);
          saveQueue(currentQueue);
          continue;
        }

        try {
          const latest = await sessionsApi.getSessionState(inflight.sessionId);
          currentQueue = rebasePendingEvents(currentQueue, latest.version);
          onQueueChange(currentQueue);
          saveQueue(currentQueue);
          continue;
        } catch (innerError) {
          currentQueue = updateQueue(currentQueue, inflight.localId, {
            status: 'pending',
            lastError: innerError instanceof Error ? innerError.message : 'Failed to rebase version',
          });
          onQueueChange(currentQueue);
          saveQueue(currentQueue);
          scheduleRetry(() => {
            void drainQueue({ ...options, queue: loadQueue() });
          });
          return;
        }
      }

      if (error instanceof StatDashApiError && error.status === 0) {
        currentQueue = updateQueue(currentQueue, inflight.localId, {
          status: 'pending',
          lastError: error.message,
        });
        onQueueChange(currentQueue);
        saveQueue(currentQueue);
        scheduleRetry(() => {
          void drainQueue({ ...options, queue: loadQueue() });
        });
        return;
      }

      if (error instanceof StatDashApiError && error.status >= 400 && error.status < 500) {
        currentQueue = updateQueue(currentQueue, inflight.localId, {
          status: 'failed',
          lastError: error.message,
        });
        onQueueChange(currentQueue);
        saveQueue(currentQueue);
        console.warn('[statdash] queue event failed validation', inflight.commandType, error.message);
        continue;
      }

      currentQueue = updateQueue(currentQueue, inflight.localId, {
        status: 'pending',
        lastError: error instanceof Error ? error.message : 'Unknown queue error',
      });
      onQueueChange(currentQueue);
      saveQueue(currentQueue);
      scheduleRetry(() => {
        void drainQueue({ ...options, queue: loadQueue() });
      });
      return;
    }
  }
}

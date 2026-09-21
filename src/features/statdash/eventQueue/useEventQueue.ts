import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { commandsApi, StatDashApiError, type CommandAcceptedResponse } from '../../../services/statdash';
import { clearDrainRetryTimer, drainQueue } from './drain';
import { clearSentEvents, loadQueue, saveQueue } from './storage';
import type { QueuedEvent } from './types';

type EnqueueInput = Omit<QueuedEvent, 'localId' | 'enqueuedAt' | 'status' | 'attempts'> & {
  localId?: string;
};

interface UseEventQueueOptions {
  /** Live-tracked "next expectedVersion to send" — see drain.ts's resolveExpectedVersion. */
  getLatestVersion: () => number;
  /** The drain learned the session's real version from the server; keep the caller's copy in step. */
  onVersionObserved?: (version: number) => void;
  onCommandAccepted?: (event: QueuedEvent, response: CommandAcceptedResponse) => void;
  onCommandFailed?: (event: QueuedEvent, error: unknown) => void;
}

export interface UseEventQueueReturn {
  enqueue: (event: EnqueueInput) => void;
  /** TEMP/dev: empty queue + localStorage; does not fix session version vs server. */
  clearQueue: () => void;
  queue: QueuedEvent[];
  pendingCount: number;
  failedCount: number;
  isOnline: boolean;
  retryFailed: () => void;
  /** Removes one event from the queue by localId, without contacting the backend.
   * Only safe for an event the backend never applied — e.g. status 'failed' (a
   * rejected command that will never get a backendEventId and so can never be
   * corrected or reversed server-side). Never use this on 'pending'/'inflight'/'sent'. */
  discardEvent: (localId: string) => void;
  /** Amends a queued entry in place. Only meaningful for one that hasn't been sent yet. */
  updateEvent: (localId: string, patch: Partial<QueuedEvent>) => void;
  /** The queue right now, including changes made a moment ago that haven't re-rendered yet. */
  getQueue: () => QueuedEvent[];
}

const DEFAULT_OPTIONS: UseEventQueueOptions = { getLatestVersion: () => 0 };

export function useEventQueue(
  options: UseEventQueueOptions = DEFAULT_OPTIONS,
): UseEventQueueReturn {
  const [queue, setQueue] = useState<QueuedEvent[]>(() => loadQueue());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const isDrainingRef = useRef(false);
  // Live queue mirror. Every mutation goes through applyQueueUpdate so the drain
  // (which runs across awaits) always reads current state instead of a stale
  // snapshot — a stale write-back used to erase events enqueued mid-drain.
  const queueRef = useRef<QueuedEvent[]>(queue);
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  const applyQueueUpdate = useCallback(
    (updater: (prev: QueuedEvent[]) => QueuedEvent[]): QueuedEvent[] => {
      const next = updater(queueRef.current);
      queueRef.current = next;
      setQueue(next);
      saveQueue(next);
      return next;
    },
    [],
  );

  // The real id of the event a reverse/correct entry refers to: given directly (a play restored
  // after a reload) or read off the queued command it targets once that has been sent.
  const resolveTargetBackendId = useCallback((event: QueuedEvent): string | undefined => {
    if (event.targetBackendEventId) return event.targetBackendEventId;
    if (!event.targetLocalId) return undefined;
    return queueRef.current.find((q) => q.localId === event.targetLocalId)?.backendEventIds?.[0];
  }, []);

  const runDrain = useCallback(async () => {
    if (isDrainingRef.current) return;
    if (!isOnlineRef.current) return;
    isDrainingRef.current = true;
    try {
      await drainQueue({
        getQueue: () => queueRef.current,
        applyQueueUpdate,
        getIsOnline: () => isOnlineRef.current,
        getLatestVersion: options.getLatestVersion,
        onVersionObserved: options.onVersionObserved,
        // An undo/edit whose target was never applied (it failed, or was cancelled) has nothing to
        // do — finish it quietly rather than reporting a failure for something already moot.
        shouldSkip: (event) => {
          if (event.kind !== 'reverse' && event.kind !== 'correct') return false;
          if (resolveTargetBackendId(event)) return false;
          if (!event.targetLocalId) return false;
          const target = queueRef.current.find((q) => q.localId === event.targetLocalId);
          return !target || target.status === 'failed';
        },
        sendCommand: async (event) => {
          if (event.kind === 'reverse' || event.kind === 'correct') {
            const targetId = resolveTargetBackendId(event);
            if (!targetId) {
              throw new StatDashApiError('The play this refers to is not on the server yet', 400);
            }
            const result =
              event.kind === 'reverse'
                ? await commandsApi.reverseEvent(targetId, { reason: event.reason ?? 'Undone from StatDash' })
                : await commandsApi.correctEvent(targetId, {
                    reason: event.reason ?? 'Corrected from StatDash',
                    correctedPayload: event.correctedPayload ?? {},
                  });
            return { sessionId: result.sessionId, version: result.version, score: result.score, emittedEvents: [] };
          }
          // A child command (a free throw) is linked to its parent's real event id now, so the
          // link exists even when the parent was still syncing at the moment it was recorded.
          const parentEventId =
            event.parentEventId ??
            (event.parentLocalId
              ? queueRef.current.find((q) => q.localId === event.parentLocalId)?.backendEventIds?.[0]
              : undefined);
          return commandsApi.sendCommand({
            sessionId: event.sessionId,
            commandType: event.commandType,
            payload: event.payload,
            expectedVersion: event.expectedVersion,
            idempotencyKey: event.localId,
            parentEventId,
          });
        },
        onCommandAccepted: (event, response) => {
          options.onCommandAccepted?.(event, response);
        },
        onCommandFailed: (event, error) => {
          options.onCommandFailed?.(event, error);
        },
      });
    } finally {
      isDrainingRef.current = false;
    }
  }, [applyQueueUpdate, options, resolveTargetBackendId]);

  const enqueue = useCallback(
    (event: EnqueueInput) => {
      const localId =
        event.localId ??
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

      applyQueueUpdate((prev) => [
        ...prev,
        {
          ...event,
          localId,
          enqueuedAt: Date.now(),
          status: 'pending',
          attempts: 0,
        },
      ]);
    },
    [applyQueueUpdate],
  );

  const retryFailed = useCallback(() => {
    applyQueueUpdate((prev) =>
      prev.map((event) =>
        event.status === 'failed'
          ? { ...event, status: 'pending', attempts: 0, lastError: undefined }
          : event,
      ),
    );
  }, [applyQueueUpdate]);

  const clearQueue = useCallback(() => {
    clearDrainRetryTimer();
    applyQueueUpdate(() => []);
  }, [applyQueueUpdate]);

  const discardEvent = useCallback(
    (localId: string) => {
      applyQueueUpdate((prev) => prev.filter((event) => event.localId !== localId));
    },
    [applyQueueUpdate],
  );

  const getQueue = useCallback(() => queueRef.current, []);

  const updateEvent = useCallback(
    (localId: string, patch: Partial<QueuedEvent>) => {
      applyQueueUpdate((prev) => prev.map((event) => (event.localId === localId ? { ...event, ...patch } : event)));
    },
    [applyQueueUpdate],
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearDrainRetryTimer();
    };
  }, []);

  useEffect(() => {
    clearSentEvents();
  }, [queue]);

  useEffect(() => {
    if (!isOnline) return;
    if (queue.length === 0) return;
    void runDrain();
  }, [isOnline, queue, runDrain]);

  const pendingCount = useMemo(
    () => queue.filter((event) => event.status === 'pending' || event.status === 'inflight').length,
    [queue],
  );
  const failedCount = useMemo(
    () => queue.filter((event) => event.status === 'failed').length,
    [queue],
  );

  return {
    enqueue,
    clearQueue,
    queue,
    pendingCount,
    failedCount,
    isOnline,
    retryFailed,
    discardEvent,
    updateEvent,
    getQueue,
  };
}

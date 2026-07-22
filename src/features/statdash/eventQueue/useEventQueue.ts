import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { commandsApi, type CommandAcceptedResponse } from '../../../services/statdash';
import { clearDrainRetryTimer, drainQueue } from './drain';
import { clearSentEvents, loadQueue, saveQueue } from './storage';
import type { QueuedEvent } from './types';

type EnqueueInput = Omit<QueuedEvent, 'localId' | 'enqueuedAt' | 'status' | 'attempts'> & {
  localId?: string;
};

interface UseEventQueueOptions {
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
}

export function useEventQueue(options: UseEventQueueOptions = {}): UseEventQueueReturn {
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

  const runDrain = useCallback(async () => {
    if (isDrainingRef.current) return;
    if (!isOnlineRef.current) return;
    isDrainingRef.current = true;
    try {
      await drainQueue({
        getQueue: () => queueRef.current,
        applyQueueUpdate,
        getIsOnline: () => isOnlineRef.current,
        sendCommand: async (event) =>
          commandsApi.sendCommand({
            sessionId: event.sessionId,
            commandType: event.commandType,
            payload: event.payload,
            expectedVersion: event.expectedVersion,
            idempotencyKey: event.localId,
          }),
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
  }, [applyQueueUpdate, options]);

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
          ? { ...event, status: 'pending', lastError: undefined }
          : event,
      ),
    );
  }, [applyQueueUpdate]);

  const clearQueue = useCallback(() => {
    clearDrainRetryTimer();
    applyQueueUpdate(() => []);
  }, [applyQueueUpdate]);

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

  return { enqueue, clearQueue, queue, pendingCount, failedCount, isOnline, retryFailed };
}

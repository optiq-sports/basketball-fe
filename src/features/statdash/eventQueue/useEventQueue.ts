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

  const onQueueChange = useCallback((next: QueuedEvent[]) => {
    setQueue(next);
  }, []);

  const runDrain = useCallback(async () => {
    if (isDrainingRef.current) return;
    if (!isOnline) return;
    isDrainingRef.current = true;
    try {
      await drainQueue({
        queue,
        onQueueChange,
        getIsOnline: () => isOnline,
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
  }, [isOnline, onQueueChange, options, queue]);

  const enqueue = useCallback((event: EnqueueInput) => {
    const localId =
      event.localId ??
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);

    setQueue((prev) => [
      ...prev,
      {
        ...event,
        localId,
        enqueuedAt: Date.now(),
        status: 'pending',
        attempts: 0,
      },
    ]);
  }, []);

  const retryFailed = useCallback(() => {
    setQueue((prev) =>
      prev.map((event) =>
        event.status === 'failed'
          ? { ...event, status: 'pending', lastError: undefined }
          : event,
      ),
    );
  }, []);

  const clearQueue = useCallback(() => {
    clearDrainRetryTimer();
    saveQueue([]);
    setQueue([]);
  }, []);

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
    saveQueue(queue);
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

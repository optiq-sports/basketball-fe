import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatDashApiError } from '../../../services/statdash';
import { clearDrainRetryTimer, drainQueue } from './drain';
import { clearSentEvents, loadQueue, saveQueue } from './storage';
import type { QueuedEvent } from './types';
import { useEventQueue } from './useEventQueue';

vi.mock('../../../services/statdash', async () => {
  const original = await vi.importActual('../../../services/statdash');
  return {
    ...(original as object),
    commandsApi: { sendCommand: vi.fn() },
    sessionsApi: { getSessionState: vi.fn() },
  };
});

function makeEvent(partial: Partial<QueuedEvent> = {}): QueuedEvent {
  return {
    localId: partial.localId ?? crypto.randomUUID(),
    sessionId: partial.sessionId ?? 's1',
    commandType: partial.commandType ?? 'shot',
    payload: partial.payload ?? {},
    expectedVersion: partial.expectedVersion ?? 1,
    enqueuedAt: partial.enqueuedAt ?? Date.now(),
    status: partial.status ?? 'pending',
    attempts: partial.attempts ?? 0,
    lastError: partial.lastError,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('event queue', () => {
  beforeEach(() => {
    localStorage.removeItem('statdash_event_queue_v1');
    vi.clearAllMocks();
    clearDrainRetryTimer();
  });

  it('enqueue adds pending event and persists', async () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    const { result } = renderHook(() => useEventQueue(), { wrapper });
    act(() => {
      result.current.enqueue({
        sessionId: 's1',
        commandType: 'shot',
        payload: {},
        expectedVersion: 1,
      });
    });
    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].status).toBe('pending');
    expect(loadQueue()).toHaveLength(1);
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });

  /** Live-queue harness matching the useEventQueue wiring of getQueue/applyQueueUpdate. */
  function makeLiveQueue(initial: QueuedEvent[]) {
    let current = initial;
    const changes: QueuedEvent[][] = [];
    return {
      getQueue: () => current,
      applyQueueUpdate: (updater: (prev: QueuedEvent[]) => QueuedEvent[]) => {
        current = updater(current);
        changes.push(current);
        return current;
      },
      changes,
      get current() {
        return current;
      },
    };
  }

  it('drainQueue processes FIFO order', async () => {
    const queue = [makeEvent({ enqueuedAt: 2 }), makeEvent({ enqueuedAt: 1 })];
    const live = makeLiveQueue(queue);
    const sent: string[] = [];
    await drainQueue({
      getQueue: live.getQueue,
      applyQueueUpdate: live.applyQueueUpdate,
      getIsOnline: () => true,
      sendCommand: async (event) => {
        sent.push(event.localId);
        return { sessionId: event.sessionId, version: event.expectedVersion + 1, score: { home: 0, away: 0 }, emittedEvents: [] };
      },
      onCommandAccepted: () => undefined,
      onCommandFailed: () => undefined,
    });
    expect(sent).toEqual([queue[1].localId, queue[0].localId]);
  });

  it('drainQueue skips when offline', async () => {
    const send = vi.fn();
    const live = makeLiveQueue([makeEvent()]);
    await drainQueue({
      getQueue: live.getQueue,
      applyQueueUpdate: live.applyQueueUpdate,
      getIsOnline: () => false,
      sendCommand: send,
      onCommandAccepted: () => undefined,
      onCommandFailed: () => undefined,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('drainQueue sends events enqueued while a previous send was in flight', async () => {
    const first = makeEvent({ enqueuedAt: 1 });
    const late = makeEvent({ enqueuedAt: 2 });
    const live = makeLiveQueue([first]);
    const sent: string[] = [];
    await drainQueue({
      getQueue: live.getQueue,
      applyQueueUpdate: live.applyQueueUpdate,
      getIsOnline: () => true,
      sendCommand: async (event) => {
        sent.push(event.localId);
        if (event.localId === first.localId) {
          // Simulate a command arriving while this send is awaiting the network.
          live.applyQueueUpdate((prev) => [...prev, late]);
        }
        return { sessionId: event.sessionId, version: event.expectedVersion + 1, score: { home: 0, away: 0 }, emittedEvents: [] };
      },
      onCommandAccepted: () => undefined,
      onCommandFailed: () => undefined,
    });
    expect(sent).toEqual([first.localId, late.localId]);
    expect(live.current.every((event) => event.status === 'sent')).toBe(true);
  });

  it('VERSION_CONFLICT rebases versions and retries', async () => {
    const { sessionsApi } = await import('../../../services/statdash');
    vi.mocked(sessionsApi.getSessionState).mockResolvedValue({
      sessionId: 's1',
      matchId: 'm1',
      status: 'IN_PROGRESS',
      quarter: 1,
      clockSecondsRemaining: 1,
      version: 10,
      score: { home: 0, away: 0 },
      orientation: { homeOnLeft: true, homeAttacksLeft: true },
      recentEvents: [],
    });
    const queue = [makeEvent({ expectedVersion: 1 }), makeEvent({ expectedVersion: 2, enqueuedAt: Date.now() + 1 })];
    const live = makeLiveQueue(queue);
    const versions: number[] = [];
    let first = true;
    await drainQueue({
      getQueue: live.getQueue,
      applyQueueUpdate: live.applyQueueUpdate,
      getIsOnline: () => true,
      sendCommand: async (event) => {
        versions.push(event.expectedVersion);
        if (first) {
          first = false;
          throw new StatDashApiError('conflict', 409, 'VERSION_CONFLICT');
        }
        return { sessionId: event.sessionId, version: event.expectedVersion + 1, score: { home: 0, away: 0 }, emittedEvents: [] };
      },
      onCommandAccepted: () => undefined,
      onCommandFailed: () => undefined,
    });
    expect(versions).toContain(10);
  });

  it('network failure returns event to pending and stops', async () => {
    vi.useFakeTimers();
    const live = makeLiveQueue([makeEvent()]);
    await drainQueue({
      getQueue: live.getQueue,
      applyQueueUpdate: live.applyQueueUpdate,
      getIsOnline: () => true,
      sendCommand: async () => {
        throw new StatDashApiError('offline', 0);
      },
      onCommandAccepted: () => undefined,
      onCommandFailed: () => undefined,
    });
    expect(live.current[0].status).toBe('pending');
    vi.useRealTimers();
  });

  it('4xx error marks failed and advances', async () => {
    const q1 = makeEvent();
    const q2 = makeEvent({ enqueuedAt: Date.now() + 1 });
    const live = makeLiveQueue([q1, q2]);
    const sent: string[] = [];
    await drainQueue({
      getQueue: live.getQueue,
      applyQueueUpdate: live.applyQueueUpdate,
      getIsOnline: () => true,
      sendCommand: async (event) => {
        if (event.localId === q1.localId) throw new StatDashApiError('bad', 400);
        sent.push(event.localId);
        return { sessionId: event.sessionId, version: event.expectedVersion + 1, score: { home: 0, away: 0 }, emittedEvents: [] };
      },
      onCommandAccepted: () => undefined,
      onCommandFailed: () => undefined,
    });
    expect(live.changes.some((state) => state.some((event) => event.localId === q1.localId && event.status === 'failed'))).toBe(true);
    expect(sent).toContain(q2.localId);
  });

  it('retryFailed resets failed events to pending', async () => {
    saveQueue([makeEvent({ status: 'failed' })]);
    const { result } = renderHook(() => useEventQueue(), { wrapper });
    act(() => result.current.retryFailed());
    expect(result.current.queue[0].status).toBe('pending');
  });

  it('clearSentEvents removes sent entries older than 30 minutes', () => {
    saveQueue([
      makeEvent({ status: 'sent', enqueuedAt: Date.now() - 31 * 60 * 1000 }),
      makeEvent({ status: 'sent', enqueuedAt: Date.now() - 5 * 60 * 1000 }),
      makeEvent({ status: 'pending' }),
    ]);
    clearSentEvents();
    const next = loadQueue();
    expect(next.length).toBe(2);
    expect(next.some((event) => event.status === 'pending')).toBe(true);
  });
});

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commandsApi } from '../../../services/statdash';
import { clearDrainRetryTimer } from './drain';
import { useEventQueue } from './useEventQueue';

vi.mock('../../../services/statdash', async () => {
  const original = await vi.importActual('../../../services/statdash');
  return {
    ...(original as object),
    commandsApi: { sendCommand: vi.fn(), reverseEvent: vi.fn(), correctEvent: vi.fn() },
    sessionsApi: { getSessionState: vi.fn() },
  };
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

const accepted = (version: number, ...eventIds: string[]) => ({
  sessionId: 's1',
  version,
  score: { home: 0, away: 0 },
  emittedEvents: eventIds.map((id, i) => ({ id, sequence: i, eventType: 'x', createdAt: '' })),
});

const base = { sessionId: 's1', payload: {}, expectedVersion: 1 };

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe('undo and edit travel through the ordered queue', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    clearDrainRetryTimer();
    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
  });

  it('an undo issued while its play is still being sent is held behind it, then uses the real event id', async () => {
    const send = deferred<ReturnType<typeof accepted>>();
    vi.mocked(commandsApi.sendCommand).mockReturnValue(send.promise as never);
    vi.mocked(commandsApi.reverseEvent).mockResolvedValue({ sessionId: 's1', version: 3, score: { home: 0, away: 0 } });

    const { result } = renderHook(() => useEventQueue({ getLatestVersion: () => 1 }), { wrapper });
    act(() => {
      result.current.enqueue({ ...base, commandType: 'shot', localId: 'A' });
    });
    await vi.waitFor(() => expect(commandsApi.sendCommand).toHaveBeenCalled());

    // The statistician taps Undo while the shot is mid-flight — no waiting, it's simply queued.
    act(() => {
      result.current.enqueue({ ...base, commandType: 'reverse', kind: 'reverse', targetLocalId: 'A' });
    });
    expect(commandsApi.reverseEvent).not.toHaveBeenCalled(); // must not run before the shot has landed

    await act(async () => {
      send.resolve(accepted(2, 'evt-A'));
    });
    await vi.waitFor(() => expect(commandsApi.reverseEvent).toHaveBeenCalledWith('evt-A', expect.objectContaining({ reason: expect.any(String) })));
  });

  it('an undo for a play restored after a reload uses the event id it was given', async () => {
    vi.mocked(commandsApi.reverseEvent).mockResolvedValue({ sessionId: 's1', version: 9, score: { home: 0, away: 0 } });
    const { result } = renderHook(() => useEventQueue({ getLatestVersion: () => 8 }), { wrapper });
    act(() => {
      result.current.enqueue({ ...base, commandType: 'reverse', kind: 'reverse', targetBackendEventId: 'evt-old' });
    });
    await vi.waitFor(() => expect(commandsApi.reverseEvent).toHaveBeenCalledWith('evt-old', expect.anything()));
    expect(commandsApi.sendCommand).not.toHaveBeenCalled();
  });

  it('an edit of a sent play is sent as a correction to that play\'s real id', async () => {
    vi.mocked(commandsApi.sendCommand).mockResolvedValue(accepted(2, 'evt-B') as never);
    vi.mocked(commandsApi.correctEvent).mockResolvedValue({ sessionId: 's1', version: 3, score: { home: 2, away: 0 } });
    const { result } = renderHook(() => useEventQueue({ getLatestVersion: () => 1 }), { wrapper });
    act(() => {
      result.current.enqueue({ ...base, commandType: 'shot', localId: 'B' });
      result.current.enqueue({
        ...base, commandType: 'correct', kind: 'correct', targetLocalId: 'B', correctedPayload: { shot: { result: 'missed' } },
      });
    });
    await vi.waitFor(() =>
      expect(commandsApi.correctEvent).toHaveBeenCalledWith('evt-B', { reason: expect.any(String), correctedPayload: { shot: { result: 'missed' } } }),
    );
  });

  it('an undo whose play the server never applied finishes quietly instead of reporting a failure', async () => {
    vi.mocked(commandsApi.sendCommand).mockRejectedValue(Object.assign(new Error('bad'), {}));
    const failures: unknown[] = [];
    const { StatDashApiError } = await import('../../../services/statdash');
    vi.mocked(commandsApi.sendCommand).mockRejectedValue(new StatDashApiError('Player X is not on court', 400));
    const { result } = renderHook(
      () => useEventQueue({ getLatestVersion: () => 1, onCommandFailed: (_e, err) => failures.push(err) }),
      { wrapper },
    );
    act(() => {
      result.current.enqueue({ ...base, commandType: 'substitution', localId: 'S' });
    });
    await vi.waitFor(() => expect(result.current.queue.find((q) => q.localId === 'S')?.status).toBe('failed'));
    act(() => {
      result.current.enqueue({ ...base, commandType: 'reverse', kind: 'reverse', targetLocalId: 'S' });
    });
    await vi.waitFor(() => expect(result.current.queue.find((q) => q.kind === 'reverse')?.status).toBe('sent'));
    expect(commandsApi.reverseEvent).not.toHaveBeenCalled();
    expect(failures).toHaveLength(1); // only the original rejection, nothing for the moot undo
  });

  it('a free throw is linked to its foul using the foul\'s real id, even if the foul was still syncing when it was recorded', async () => {
    vi.mocked(commandsApi.sendCommand)
      .mockResolvedValueOnce(accepted(2, 'evt-foul') as never)
      .mockResolvedValueOnce(accepted(3, 'evt-ft') as never);
    const { result } = renderHook(() => useEventQueue({ getLatestVersion: () => 1 }), { wrapper });
    act(() => {
      result.current.enqueue({ ...base, commandType: 'foul', localId: 'F' });
      result.current.enqueue({ ...base, commandType: 'free_throw', localId: 'T', parentLocalId: 'F' });
    });
    await vi.waitFor(() => expect(commandsApi.sendCommand).toHaveBeenCalledTimes(2));
    const second = vi.mocked(commandsApi.sendCommand).mock.calls[1][0];
    expect(second).toMatchObject({ commandType: 'free_throw', parentEventId: 'evt-foul' });
  });

  it('updateEvent amends a queued play in place, before it is sent', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    const { result } = renderHook(() => useEventQueue({ getLatestVersion: () => 1 }), { wrapper });
    act(() => {
      result.current.enqueue({ ...base, commandType: 'shot', localId: 'Z', payload: { a: 1 } });
    });
    act(() => {
      result.current.updateEvent('Z', { payload: { a: 2 } });
    });
    expect(result.current.queue[0].payload).toEqual({ a: 2 });
    expect(result.current.getQueue()[0].payload).toEqual({ a: 2 });
  });
});

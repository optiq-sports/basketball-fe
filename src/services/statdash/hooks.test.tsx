import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import {
  statdashQueryKeys,
  useSendStatDashCommand,
  useSessionStateQuery,
} from './hooks';
import { commandsApi } from './commands.api';
import { sessionsApi } from './sessions.api';

vi.mock('./commands.api', () => ({
  commandsApi: {
    sendCommand: vi.fn(),
  },
}));

vi.mock('./sessions.api', () => ({
  sessionsApi: {
    getSessionState: vi.fn(),
    bootstrapSession: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

describe('statdash hooks', () => {
  it('loads session state query', async () => {
    vi.mocked(sessionsApi.getSessionState).mockResolvedValue({
      sessionId: 'session-1',
      matchId: 'match-1',
      status: 'IN_PROGRESS',
      quarter: 1,
      clockSecondsRemaining: 600,
      version: 2,
      score: { home: 1, away: 0 },
      orientation: { homeOnLeft: true, homeAttacksLeft: true },
      recentEvents: [],
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSessionStateQuery('session-1', true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.version).toBe(2);
  });

  it('updates cache after successful command', async () => {
    vi.mocked(commandsApi.sendCommand).mockResolvedValue({
      sessionId: 'session-1',
      version: 5,
      score: { home: 20, away: 18 },
      emittedEvents: [{ id: 'evt-1', sequence: 1, eventType: 'shot', createdAt: new Date() }],
    });
    const { wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(statdashQueryKeys.sessionState('session-1'), {
      context: { sessionId: 'session-1' },
      state: { version: 1 },
    });
    const { result } = renderHook(() => useSendStatDashCommand(), { wrapper });
    await result.current.mutateAsync({
      sessionId: 'session-1',
      commandType: 'shot',
      payload: {},
      expectedVersion: 1,
      idempotencyKey: 'key-1',
    });

    const cached = queryClient.getQueryData(statdashQueryKeys.sessionState('session-1')) as {
      state?: { version?: number };
    };
    expect(cached.state?.version).toBe(5);
  });
});

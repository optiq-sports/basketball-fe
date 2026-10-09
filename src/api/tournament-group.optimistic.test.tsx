import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  tournaments: { addTeams: vi.fn() },
}));
vi.mock('./ApiClient', () => ({ apiClient: api }));

import { queryKeys, useSetTournamentTeamGroup } from './hooks';

const tournament = {
  id: 't1',
  teams: [
    { teamId: 'a', group: 'A', team: { id: 'a', name: 'Alpha' } },
    { teamId: 'b', group: 'B', team: { id: 'b', name: 'Bravo' } },
  ],
};

const groupOf = (client: QueryClient, teamId: string) =>
  (client.getQueryData(queryKeys.tournament('t1')) as typeof tournament).teams.find((t) => t.teamId === teamId)?.group;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(queryKeys.tournament('t1'), tournament);
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => useSetTournamentTeamGroup(), { wrapper });
  return { client, hook };
}

describe('moving a team to another group (optimistic)', () => {
  it('shows the new group in the cache at once, before the server answers', async () => {
    let finish!: () => void;
    api.tournaments.addTeams.mockReturnValue(new Promise<void>((r) => { finish = r; }));
    const { client, hook } = setup();

    act(() => {
      hook.result.current.mutate({ tournamentId: 't1', teamId: 'b', group: 'A' });
    });

    await waitFor(() => expect(groupOf(client, 'b')).toBe('A'));
    expect(api.tournaments.addTeams).toHaveBeenCalledWith('t1', { teamIds: ['b'], group: 'A' });
    await act(async () => finish());
  });

  it('puts the group back and keeps the server’s reason when the save is refused', async () => {
    api.tournaments.addTeams.mockRejectedValue(new Error('Group is closed'));
    const { client, hook } = setup();

    act(() => {
      hook.result.current.mutate({ tournamentId: 't1', teamId: 'b', group: 'A' });
    });
    await waitFor(() => expect(hook.result.current.isError).toBe(true));

    expect(groupOf(client, 'b')).toBe('B');
    expect(hook.result.current.error?.message).toBe('Group is closed');
  });

  it('leaves the other teams in the tournament alone', async () => {
    api.tournaments.addTeams.mockResolvedValue(undefined);
    const { client, hook } = setup();
    act(() => {
      hook.result.current.mutate({ tournamentId: 't1', teamId: 'b', group: 'A' });
    });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(groupOf(client, 'a')).toBe('A');
  });
});

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  matches: { delete: vi.fn(), update: vi.fn(), create: vi.fn(), getAll: vi.fn(), getById: vi.fn() },
  teams: { delete: vi.fn(), update: vi.fn(), create: vi.fn(), getAll: vi.fn(), getById: vi.fn(), setCaptain: vi.fn() },
  tournaments: { delete: vi.fn(), update: vi.fn(), getAll: vi.fn(), getById: vi.fn(), removeTeam: vi.fn() },
  statistician: { delete: vi.fn(), getAll: vi.fn() },
  players: { removeFromTeam: vi.fn(), getAll: vi.fn() },
}));
vi.mock('./ApiClient', () => ({ apiClient: api }));

import {
  queryKeys,
  useCreateTeam,
  useDeleteMatch,
  useDeleteStatistician,
  useDeleteTeam,
  useDeleteTournament,
  useMatch,
  useMatches,
  useRemovePlayerFromTeam,
  useSetTeamCaptain,
  useTeams,
  useTournamentRemoveTeam,
  useUpdateMatch,
  useUpdateTeam,
  useUpdateTournament,
} from './hooks';

let client: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(QueryClientProvider, { client }, children);

const deferred = <T = unknown,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const ids = (key: readonly unknown[]) => (client.getQueryData(key) as Array<{ id: string }>).map((x) => x.id);

const matches = () => [
  { id: 'm1', tournamentId: 't1', venue: 'Court A', status: 'SCHEDULED' },
  { id: 'm2', tournamentId: 't1', venue: 'Court B', status: 'SCHEDULED' },
  { id: 'm3', tournamentId: 't1', venue: 'Court C', status: 'SCHEDULED' },
];

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  vi.clearAllMocks();
});

describe('deleting', () => {
  it('REGRESSION: a deleted game leaves every fixtures list immediately, not seconds later', async () => {
    client.setQueryData(queryKeys.matches('t1'), matches());
    client.setQueryData(queryKeys.matches(), matches());
    const request = deferred();
    api.matches.delete.mockReturnValue(request.promise);

    const { result } = renderHook(() => useDeleteMatch(), { wrapper });
    act(() => { result.current.mutate('m2'); });

    // The server hasn't answered yet — and the game is already gone from both lists.
    await waitFor(() => expect(ids(queryKeys.matches('t1'))).toEqual(['m1', 'm3']));
    expect(ids(queryKeys.matches())).toEqual(['m1', 'm3']);
    expect(result.current.isPending).toBe(true);

    await act(async () => { request.resolve(undefined); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ids(queryKeys.matches('t1'))).toEqual(['m1', 'm3']);
  });

  it('brings the game back, and reports the error, if the server refuses', async () => {
    client.setQueryData(queryKeys.matches('t1'), matches());
    const request = deferred();
    api.matches.delete.mockReturnValue(request.promise);
    const { result } = renderHook(() => useDeleteMatch(), { wrapper });
    act(() => { result.current.mutate('m2'); });
    await waitFor(() => expect(ids(queryKeys.matches('t1'))).toEqual(['m1', 'm3']));

    await act(async () => { request.reject(new Error('Match has recorded events')); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(ids(queryKeys.matches('t1'))).toEqual(['m1', 'm2', 'm3']); // restored, original order
    expect(result.current.error?.message).toBe('Match has recorded events');
  });

  it.each([
    ['team', () => useDeleteTeam(), api.teams.delete, queryKeys.teams()],
    ['tournament', () => useDeleteTournament(), api.tournaments.delete, queryKeys.tournaments()],
    ['statistician', () => useDeleteStatistician(), api.statistician.delete, queryKeys.statisticians()],
  ] as const)('a deleted %s disappears from its list immediately, and returns if the delete fails', async (_name, useHook, apiFn, key) => {
    client.setQueryData(key, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const request = deferred();
    apiFn.mockReturnValue(request.promise);
    const { result } = renderHook(() => useHook(), { wrapper });
    act(() => { result.current.mutate('b'); });
    await waitFor(() => expect(ids(key)).toEqual(['a', 'c']));
    await act(async () => { request.reject(new Error('nope')); });
    await waitFor(() => expect(ids(key)).toEqual(['a', 'b', 'c']));
  });

  it('does not refetch the deleted item itself (that would 404 and flash an error on its own page)', async () => {
    api.matches.getById.mockResolvedValue({ ok: true, data: { id: 'm2' } });
    api.matches.delete.mockResolvedValue(undefined);
    // The match's detail page is open: an active observer on that record.
    const detail = renderHook(() => useMatch('m2'), { wrapper });
    await waitFor(() => expect(detail.result.current.data).toEqual({ id: 'm2' }));
    expect(api.matches.getById).toHaveBeenCalledTimes(1);

    const { result } = renderHook(() => useDeleteMatch(), { wrapper });
    await act(async () => { await result.current.mutateAsync('m2'); });
    expect(api.matches.getById).toHaveBeenCalledTimes(1); // still just the original load
  });
});

describe('editing', () => {
  it('a status/venue change shows in the list and on the detail page immediately', async () => {
    client.setQueryData(queryKeys.matches('t1'), matches());
    client.setQueryData(queryKeys.match('m1'), matches()[0]);
    const request = deferred();
    api.matches.update.mockReturnValue(request.promise);
    const { result } = renderHook(() => useUpdateMatch(), { wrapper });
    act(() => { result.current.mutate({ id: 'm1', data: { status: 'POSTPONED', venue: 'Court Z' } }); });

    await waitFor(() =>
      expect((client.getQueryData(queryKeys.matches('t1')) as typeof matches extends () => infer R ? R : never)[0]).toMatchObject({ status: 'POSTPONED', venue: 'Court Z' }),
    );
    expect(client.getQueryData(queryKeys.match('m1'))).toMatchObject({ status: 'POSTPONED', venue: 'Court Z' });
    expect((client.getQueryData(queryKeys.matches('t1')) as Array<{ status: string }>)[1].status).toBe('SCHEDULED'); // others untouched
    await act(async () => { request.resolve({ ok: true, data: { id: 'm1', tournamentId: 't1' } }); });
  });

  it('a field left out of the update does not blank the value that is already there', async () => {
    client.setQueryData(queryKeys.matches('t1'), matches());
    api.matches.update.mockReturnValue(deferred().promise);
    const { result } = renderHook(() => useUpdateMatch(), { wrapper });
    act(() => { result.current.mutate({ id: 'm1', data: { status: 'LIVE', venue: undefined } }); });
    await waitFor(() => expect((client.getQueryData(queryKeys.matches('t1')) as Array<{ status: string }>)[0].status).toBe('LIVE'));
    expect((client.getQueryData(queryKeys.matches('t1')) as Array<{ venue: string }>)[0].venue).toBe('Court A');
  });

  it('puts the old values back if the update fails', async () => {
    client.setQueryData(queryKeys.matches('t1'), matches());
    client.setQueryData(queryKeys.match('m1'), matches()[0]);
    const request = deferred();
    api.matches.update.mockReturnValue(request.promise);
    const { result } = renderHook(() => useUpdateMatch(), { wrapper });
    act(() => { result.current.mutate({ id: 'm1', data: { status: 'CANCELLED' } }); });
    await waitFor(() => expect(client.getQueryData(queryKeys.match('m1'))).toMatchObject({ status: 'CANCELLED' }));
    await act(async () => { request.resolve({ ok: false, message: 'Not allowed' }); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(queryKeys.match('m1'))).toMatchObject({ status: 'SCHEDULED' });
    expect((client.getQueryData(queryKeys.matches('t1')) as Array<{ status: string }>)[0].status).toBe('SCHEDULED');
  });

  it('team and tournament edits show immediately too', async () => {
    client.setQueryData(queryKeys.teams(), [{ id: 'a', name: 'Old' }]);
    client.setQueryData(queryKeys.team('a'), { id: 'a', name: 'Old' });
    api.teams.update.mockReturnValue(deferred().promise);
    const team = renderHook(() => useUpdateTeam(), { wrapper });
    act(() => { team.result.current.mutate({ id: 'a', data: { name: 'New' } }); });
    await waitFor(() => expect(client.getQueryData(queryKeys.team('a'))).toMatchObject({ name: 'New' }));
    expect((client.getQueryData(queryKeys.teams()) as Array<{ name: string }>)[0].name).toBe('New');

    client.setQueryData(queryKeys.tournaments(), [{ id: 't', name: 'Old cup' }]);
    api.tournaments.update.mockReturnValue(deferred().promise);
    const tour = renderHook(() => useUpdateTournament(), { wrapper });
    act(() => { tour.result.current.mutate({ id: 't', data: { name: 'New cup' } }); });
    await waitFor(() => expect((client.getQueryData(queryKeys.tournaments()) as Array<{ name: string }>)[0].name).toBe('New cup'));
  });

  it('naming a captain moves the badge at once, and there is only ever one', async () => {
    client.setQueryData(queryKeys.players('team1'), [
      { id: 'p1', isCaptain: true }, { id: 'p2', isCaptain: false }, { id: 'p3' },
    ]);
    api.teams.setCaptain.mockReturnValue(deferred().promise);
    const { result } = renderHook(() => useSetTeamCaptain(), { wrapper });
    act(() => { result.current.mutate({ teamId: 'team1', playerId: 'p3', body: { isCaptain: true } }); });
    await waitFor(() =>
      expect((client.getQueryData(queryKeys.players('team1')) as Array<{ id: string; isCaptain?: boolean }>).map((p) => p.isCaptain)).toEqual([false, false, true]),
    );
  });
});

describe('removing from a roster / tournament', () => {
  it('a player leaves the team roster immediately', async () => {
    client.setQueryData(queryKeys.players('team1'), [{ id: 'p1' }, { id: 'p2' }]);
    client.setQueryData(queryKeys.team('team1'), { id: 'team1', playerTeams: [{ playerId: 'p1' }, { playerId: 'p2' }] });
    const request = deferred();
    api.players.removeFromTeam.mockReturnValue(request.promise);
    const { result } = renderHook(() => useRemovePlayerFromTeam(), { wrapper });
    act(() => { result.current.mutate({ playerId: 'p1', teamId: 'team1' }); });
    await waitFor(() => expect(ids(queryKeys.players('team1'))).toEqual(['p2']));
    expect(client.getQueryData(queryKeys.team('team1'))).toMatchObject({ playerTeams: [{ playerId: 'p2' }] });
    await act(async () => { request.reject(new Error('nope')); });
    await waitFor(() => expect(ids(queryKeys.players('team1'))).toEqual(['p1', 'p2']));
  });

  it('a team leaves a tournament immediately', async () => {
    client.setQueryData(queryKeys.tournament('t1'), { id: 't1', teams: [{ teamId: 'a' }, { teamId: 'b' }] });
    api.tournaments.removeTeam.mockReturnValue(deferred().promise);
    const { result } = renderHook(() => useTournamentRemoveTeam(), { wrapper });
    act(() => { result.current.mutate({ tournamentId: 't1', teamId: 'a' }); });
    await waitFor(() => expect(client.getQueryData(queryKeys.tournament('t1'))).toMatchObject({ teams: [{ teamId: 'b' }] }));
  });
});

describe('creating', () => {
  it('a create stays pending until the new row is really in the list, so Save doesn’t finish before the row appears', async () => {
    api.teams.getAll.mockResolvedValueOnce({ ok: true, data: [{ id: 'a' }] });
    const list = renderHook(() => useTeams(), { wrapper });
    await waitFor(() => expect(list.result.current.data).toEqual([{ id: 'a' }]));

    const refetch = deferred<{ ok: boolean; data: unknown }>();
    api.teams.getAll.mockReturnValueOnce(refetch.promise);
    api.teams.create.mockResolvedValue({ ok: true, data: { id: 'b' } });
    const create = renderHook(() => useCreateTeam(), { wrapper });
    act(() => { create.result.current.mutate({ name: 'B' } as never); });

    // The create itself has succeeded, but the list hasn't caught up — so it is still "saving".
    await waitFor(() => expect(api.teams.create).toHaveBeenCalled());
    await waitFor(() => expect(api.teams.getAll).toHaveBeenCalledTimes(2));
    expect(create.result.current.isPending).toBe(true);
    expect(list.result.current.data).toEqual([{ id: 'a' }]);

    await act(async () => { refetch.resolve({ ok: true, data: [{ id: 'a' }, { id: 'b' }] }); });
    await waitFor(() => expect(create.result.current.isSuccess).toBe(true));
    expect(list.result.current.data).toEqual([{ id: 'a' }, { id: 'b' }]); // the row is there when Save finishes
  });
});

describe('matches list observer', () => {
  it('sanity: useMatches reads the seeded list', async () => {
    api.matches.getAll.mockResolvedValue({ ok: true, data: matches() });
    const { result } = renderHook(() => useMatches('t1'), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(3));
  });
});

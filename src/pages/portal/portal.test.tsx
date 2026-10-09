import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });
const pending = <T,>(): Q<T> => ({ data: undefined, isPending: true, isError: false, isFetching: true, error: null, refetch: vi.fn() });
const failed = <T,>(error: unknown, refetch = vi.fn()): Q<T> => ({ data: undefined, isPending: false, isError: true, isFetching: false, error, refetch });

const h = vi.hoisted(() => ({
  matchesPage: null as unknown,
  match: null as unknown,
  box: null as unknown,
  shots: null as unknown,
  keys: null as unknown,
  createKey: { mutate: vi.fn(), isPending: false },
  revokeKey: { mutate: vi.fn(), isPending: false },
  confirmResult: { value: true },
}));

vi.mock('../../api/hooks', () => ({
  useMatchesPage: () => h.matchesPage,
  useMatch: () => h.match,
  useMyApiKeys: () => h.keys,
  useCreateMyApiKey: () => h.createKey,
  useRevokeMyApiKey: () => h.revokeKey,
  useProfile: () => ({ data: { name: 'Club Admin', email: 'club@example.test' } }),
  queryKeys: { auth: { profile: ['auth', 'profile'] } },
}));
vi.mock('../../services/statdash/hooks', () => ({
  useBoxScoreProjection: () => h.box,
  useShotChartProjection: () => h.shots,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock('../../hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn(async () => h.confirmResult.value),
    dialogProps: { open: false, onClose: () => undefined, onConfirm: () => undefined, description: '' },
  }),
}));

import PortalMatches from './PortalMatches';
import PortalMatchDetail from './PortalMatchDetail';
import PortalKeys from './PortalKeys';

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

function at(path: string, element: React.ReactElement, routePath: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const match = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  tournamentId: 't1',
  homeTeamId: 'home',
  awayTeamId: 'away',
  scheduledDate: '2026-10-10T18:00:00.000Z',
  status: 'COMPLETED',
  homeScore: 81,
  awayScore: 77,
  venue: 'Main Arena',
  homeTeam: {
    id: 'home', name: 'Sparks', code: 'SPK', color: '#fff', country: 'X',
    playerTeams: [{ playerId: 'p1', player: { id: 'p1', firstName: 'Ana', lastName: 'Guard' } }],
  },
  awayTeam: {
    id: 'away', name: 'Fresh Stars', code: 'FS', color: '#000', country: 'X',
    playerTeams: [{ playerId: 'p2', player: { id: 'p2', firstName: 'Ben', lastName: 'Wing' } }],
  },
  tournament: { id: 't1', name: 'Summer Cup' },
  gameSessions: [{ id: 's1', status: 'COMPLETED' }],
  ...over,
});

beforeEach(() => {
  h.matchesPage = ok({
    items: [match(), match({ id: 'm2', status: 'LIVE', homeScore: 40, awayScore: 38 })],
    meta: { page: 1, limit: 10, itemCount: 2, pageCount: 1, hasPreviousPage: false, hasNextPage: false },
  });
  h.match = ok(match());
  h.box = ok({ players: {}, totals: {}, totalEvents: 0 });
  h.shots = ok([]);
  h.keys = ok([]);
  h.createKey = { mutate: vi.fn(), isPending: false };
  h.revokeKey = { mutate: vi.fn(), isPending: false };
  h.confirmResult.value = true;
});

describe('PortalMatches', () => {
  it('lists the client’s matches with team names and status', () => {
    at('/portal/matches', <PortalMatches />, '/portal/matches');
    expect(screen.getAllByText(/Sparks/).length).toBeGreaterThan(0);
    expect(within(screen.getByRole('list', { name: 'Matches' })).getByText('Live')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /sparks.*fresh stars/i })[0].getAttribute('href')).toBe('/portal/matches/m1');
  });

  it('keeps the chosen status in the URL and marks it pressed', () => {
    h.matchesPage = ok({ items: [match({ status: 'LIVE' })], meta: { page: 1, limit: 10, itemCount: 1, pageCount: 1, hasPreviousPage: false, hasNextPage: false } });
    at('/portal/matches?status=LIVE', <PortalMatches />, '/portal/matches');
    expect(screen.getByRole('button', { name: 'Live' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(screen.getByTestId('where').textContent).toBe('/portal/matches?status=COMPLETED');
  });

  it('says there are no matches yet, when nothing exists and no filter is set', () => {
    h.matchesPage = ok({ items: [], meta: { page: 1, limit: 10, itemCount: 0, pageCount: 0, hasPreviousPage: false, hasNextPage: false } });
    at('/portal/matches', <PortalMatches />, '/portal/matches');
    expect(screen.getByText('No matches yet')).toBeTruthy();
    expect(screen.queryByText('No matches')).toBeNull();
  });

  it('says nothing matches a filter, distinct from empty, and clears it', () => {
    h.matchesPage = ok({ items: [], meta: { page: 1, limit: 10, itemCount: 0, pageCount: 0, hasPreviousPage: false, hasNextPage: false } });
    at('/portal/matches?status=LIVE', <PortalMatches />, '/portal/matches');
    expect(screen.getByText('No matches')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('where').textContent).toBe('/portal/matches');
  });

  it('shows the error with a retry', () => {
    const refetch = vi.fn();
    h.matchesPage = failed(new Error('Network down'), refetch);
    at('/portal/matches', <PortalMatches />, '/portal/matches');
    expect(screen.getByRole('alert').textContent).toMatch(/Network down/);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('PortalMatchDetail', () => {
  it('says the game has no data yet when no session exists', () => {
    h.match = ok(match({ gameSessions: [], status: 'SCHEDULED' }));
    at('/portal/matches/m1', <PortalMatchDetail />, '/portal/matches/:matchId');
    expect(screen.getByText('No game data yet')).toBeTruthy();
  });

  it('explains a 403 from the box score in plain words, not a generic failure', () => {
    h.box = failed(Object.assign(new Error('Forbidden'), { status: 403 }));
    at('/portal/matches/m1', <PortalMatchDetail />, '/portal/matches/:matchId');
    expect(screen.getByRole('alert').textContent).toMatch(/can’t open the box score/);
  });

  it('puts each player in their own team’s box score, using the roster names', () => {
    h.box = ok({
      players: {
        p1: { playerId: 'p1', points: 12, rebounds: 3, assists: 2, blocks: 0, steals: 1, fouls: 1, turnovers: 0 },
        p2: { playerId: 'p2', points: 7, rebounds: 5, assists: 0, blocks: 1, steals: 0, fouls: 2, turnovers: 1 },
      },
      totals: {},
      totalEvents: 14,
    });
    at('/portal/matches/m1', <PortalMatchDetail />, '/portal/matches/:matchId');
    const tables = screen.getAllByRole('table');
    expect(within(tables[0]).getByText('Ana Guard')).toBeTruthy();
    expect(within(tables[1]).getByText('Ben Wing')).toBeTruthy();
  });
});

describe('PortalKeys', () => {
  it('invites the first key when there are none', () => {
    at('/portal/keys', <PortalKeys />, '/portal/keys');
    expect(screen.getByText('No keys yet')).toBeTruthy();
  });

  it('won’t create a key without a name', () => {
    at('/portal/keys', <PortalKeys />, '/portal/keys');
    fireEvent.click(screen.getAllByRole('button', { name: 'New key' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    expect(screen.getByText(/Give the key a name/)).toBeTruthy();
    expect(h.createKey.mutate).not.toHaveBeenCalled();
  });

  it('creates a key and shows its secret once', async () => {
    h.createKey.mutate = vi.fn((_name: string, opts: { onSuccess: (d: unknown) => void }) =>
      opts.onSuccess({ id: 'k1', name: 'Club website', clientId: 'c1', createdAt: '2026-10-01T00:00:00Z', apiKey: 'optiq_secret' }),
    );
    at('/portal/keys', <PortalKeys />, '/portal/keys');
    fireEvent.click(screen.getAllByRole('button', { name: 'New key' })[0]);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Club website' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    expect(h.createKey.mutate).toHaveBeenCalledWith('Club website', expect.anything());
    expect(await screen.findByTestId('revealed-key')).toBeTruthy();
    expect(screen.getByTestId('revealed-key').textContent).toBe('optiq_secret');
  });

  it('revokes a key only after confirmation', async () => {
    h.keys = ok([{ id: 'k1', name: 'Club website', clientId: 'c1', createdAt: '2026-10-01T00:00:00Z', lastUsed: null }]);
    h.confirmResult.value = false;
    at('/portal/keys', <PortalKeys />, '/portal/keys');
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Club website' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(h.revokeKey.mutate).not.toHaveBeenCalled();
    h.confirmResult.value = true;
    fireEvent.click(screen.getByRole('button', { name: 'Revoke Club website' }));
    await waitFor(() => expect(h.revokeKey.mutate).toHaveBeenCalledWith('k1', expect.anything()));
  });
});

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configure, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fix 91's regression, carried to the paged fixtures page: a deleted game leaves the list at once, not
 * after the server and a refetch, and comes back with the server's reason if it's refused. Runs on the real
 * query cache and hooks; only the network is mocked.
 */
/**
 * The full Fixtures page is a heavy render, and `findByRole` computes accessible roles across all of it.
 * Alone that takes well under a second; in the full parallel run it overran Testing Library's 1s default
 * and the first lookup timed out ("Unable to find role=button … Delete Charlie vs Delta"). The logic under
 * test was never at fault, so this gives it a realistic wait rather than loosening any assertion.
 */
configure({ asyncUtilTimeout: 10_000 });
const TEST_TIMEOUT = 20_000;

const api = vi.hoisted(() => ({
  matches: { getPage: vi.fn(), delete: vi.fn(), update: vi.fn(), create: vi.fn() },
  tournaments: { getById: vi.fn() },
  statistician: { getAll: vi.fn() },
}));
vi.mock('../../api/ApiClient', () => ({ apiClient: api }));

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../../hooks/useToast', () => ({ useToast: () => toast }));

import Fixtures from './Fixtures';

const teams = [
  { team: { id: 'a', name: 'Alpha' } },
  { team: { id: 'b', name: 'Bravo' } },
  { team: { id: 'c', name: 'Charlie' } },
  { team: { id: 'd', name: 'Delta' } },
];
const fixture = (id: string, home: string, homeName: string, away: string, awayName: string) => ({
  id,
  tournamentId: 't1',
  homeTeamId: home,
  awayTeamId: away,
  homeTeam: { name: homeName },
  awayTeam: { name: awayName },
  status: 'SCHEDULED',
  scheduledDate: '2026-09-25T10:00:00.000Z',
  statistician: null,
  statisticianId: null,
  venue: null,
});
const page = (items: unknown[]) => ({ ok: true, data: { items, meta: { page: 1, limit: 10, itemCount: items.length, pageCount: 1, hasPreviousPage: false, hasNextPage: false } } });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/tournaments/t1/fixtures']}>
        <Routes><Route path="/tournaments/:id/fixtures" element={<Fixtures />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function deferred() {
  let resolve!: (v?: unknown) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function deleteSecondGame() {
  await screen.findByRole('button', { name: 'Delete Charlie vs Delta' });
  fireEvent.click(screen.getByRole('button', { name: 'Delete Charlie vs Delta' }));
  fireEvent.change(screen.getByLabelText(/Type Charlie vs Delta to confirm/), { target: { value: 'Charlie vs Delta' } });
  fireEvent.click(screen.getByRole('button', { name: 'Delete fixture' }));
}

describe('deleting a game on the Fixtures page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.tournaments.getById.mockResolvedValue({ ok: true, data: { id: 't1', name: 'Summer Cup', teams } });
    api.statistician.getAll.mockResolvedValue({ ok: true, data: [] });
    api.matches.getPage.mockResolvedValue(page([fixture('m1', 'a', 'Alpha', 'b', 'Bravo'), fixture('m2', 'c', 'Charlie', 'd', 'Delta')]));
  });

  it('REGRESSION: the game disappears at once — not after the server and a refetch', async () => {
    const request = deferred();
    api.matches.delete.mockReturnValue(request.promise);
    renderPage();
    await deleteSecondGame();

    // The delete request is still in flight, yet Charlie vs Delta is already gone.
    await waitFor(() => expect(screen.queryByRole('link', { name: /Charlie/ })).toBeNull());
    expect(screen.getByRole('link', { name: /Alpha/ })).toBeTruthy(); // the other game is untouched
    expect(api.matches.delete).toHaveBeenCalledWith('m2');

    api.matches.getPage.mockResolvedValue(page([fixture('m1', 'a', 'Alpha', 'b', 'Bravo')]));
    request.resolve();
    await waitFor(() => expect(screen.queryByRole('link', { name: /Charlie/ })).toBeNull());
    expect(toast.error).not.toHaveBeenCalled();
  }, TEST_TIMEOUT);

  it('puts the game back, with the reason, if the server refuses', async () => {
    const request = deferred();
    api.matches.delete.mockReturnValue(request.promise);
    renderPage();
    await deleteSecondGame();
    await waitFor(() => expect(screen.queryByRole('link', { name: /Charlie/ })).toBeNull());

    request.reject(new Error('This match already has recorded events'));
    await waitFor(() => expect(screen.getByRole('link', { name: /Charlie/ })).toBeTruthy());
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('This match already has recorded events'));
  }, TEST_TIMEOUT);
});

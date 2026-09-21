import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  matches: { getAll: vi.fn(), delete: vi.fn(), update: vi.fn(), create: vi.fn() },
  teams: { getAll: vi.fn() },
}));
vi.mock('../../api/ApiClient', () => ({ apiClient: api }));

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../../hooks/useToast', () => ({ useToast: () => toast }));

import Fixtures from './Fixtures';

const teams = [
  { id: 'a', name: 'Alpha' }, { id: 'b', name: 'Bravo' }, { id: 'c', name: 'Charlie' }, { id: 'd', name: 'Delta' },
];
const match = (id: string, home: string, away: string) => ({
  id, tournamentId: 't1', homeTeamId: home, awayTeamId: away, status: 'SCHEDULED', scheduledDate: '2026-09-25T10:00:00.000Z',
});

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
  await screen.findByText('Charlie');
  const deleteButtons = screen.getAllByTitle('Delete match');
  fireEvent.click(deleteButtons[1]);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
}

describe('deleting a game on the Fixtures page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.teams.getAll.mockResolvedValue({ ok: true, data: teams });
    api.matches.getAll.mockResolvedValue({ ok: true, data: [match('m1', 'a', 'b'), match('m2', 'c', 'd')] });
  });

  it('REGRESSION: the game disappears at once — not seconds later, after the server and a refetch', async () => {
    const request = deferred();
    api.matches.delete.mockReturnValue(request.promise);
    renderPage();
    await deleteSecondGame();

    // The delete request is still in flight, yet Charlie vs Delta is already gone.
    await waitFor(() => expect(screen.queryByText('Charlie')).toBeNull());
    expect(screen.getByText('Alpha')).toBeTruthy(); // the other game is untouched
    expect(api.matches.delete).toHaveBeenCalledWith('m2');

    api.matches.getAll.mockResolvedValue({ ok: true, data: [match('m1', 'a', 'b')] });
    request.resolve();
    await waitFor(() => expect(screen.queryByText('Charlie')).toBeNull());
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('puts the game back, with the reason, if the server refuses', async () => {
    const request = deferred();
    api.matches.delete.mockReturnValue(request.promise);
    renderPage();
    await deleteSecondGame();
    await waitFor(() => expect(screen.queryByText('Charlie')).toBeNull());

    request.reject(new Error('This match already has recorded events'));
    await waitFor(() => expect(screen.getByText('Charlie')).toBeTruthy());
    expect(toast.error).toHaveBeenCalledWith('This match already has recorded events');
  });
});

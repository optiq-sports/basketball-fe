import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
vi.mock('../../hooks/useToast', () => ({ useToast: () => toast }));

const team = (id: string, name: string, group: string | null) => ({
  teamId: id,
  group,
  team: { id, name, color: 'blue' },
});

const tournament = {
  id: 't1',
  name: 'Test Cup',
  numberOfGames: 10,
  teams: [team('a', 'Alpha', 'A'), team('b', 'Bravo', 'A'), team('c', 'Charlie', 'B')],
};

const mutateAsync = vi.fn();
const refetch = vi.fn().mockResolvedValue({});

vi.mock('../../api/hooks', () => ({
  useTournament: () => ({ data: tournament, isPending: false, error: null, refetch }),
  useMatches: () => ({ data: [] }),
  useTeams: () => ({ data: [] }),
  useUpdateTournament: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteTournament: () => ({ mutate: vi.fn(), isPending: false }),
  useTournamentAddTeams: () => ({ mutateAsync, mutate: vi.fn(), isPending: false }),
}));

import Tournaments from './Tournaments';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tournaments/t1']}>
      <Routes>
        <Route path="/tournaments/:id" element={<Tournaments />} />
      </Routes>
    </MemoryRouter>,
  );
}

const groupSelectFor = (name: string) => screen.getByLabelText(`Group for ${name}`) as HTMLSelectElement;

function deferred() {
  let resolve!: (v?: unknown) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('moving a team to another group', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refetch.mockResolvedValue({});
  });

  it('shows the picked group and a "Saving…" spinner immediately, and keeps the row in place until saved', async () => {
    const save = deferred();
    mutateAsync.mockReturnValue(save.promise);
    renderPage();

    fireEvent.change(groupSelectFor('Alpha'), { target: { value: 'B' } });

    // Instant feedback while the request is still in flight:
    expect(groupSelectFor('Alpha').value).toBe('B');
    expect(groupSelectFor('Alpha').disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/saving/i);
    expect(screen.getByText('Alpha')).toBeTruthy(); // not yanked out of the list yet
    expect(mutateAsync).toHaveBeenCalledWith({ tournamentId: 't1', body: { teamIds: ['a'], group: 'B' } });
    // Other rows stay usable while one is saving:
    expect(groupSelectFor('Bravo').disabled).toBe(false);

    await act(async () => {
      save.resolve();
    });
  });

  it('moves the team to its new group as soon as the save succeeds, and says so', async () => {
    mutateAsync.mockResolvedValue(undefined);
    renderPage();

    await act(async () => {
      fireEvent.change(groupSelectFor('Alpha'), { target: { value: 'B' } });
    });

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Alpha moved to Group B'));
    expect(screen.queryByRole('status')).toBeNull(); // spinner gone
    // Gone from Group A's standings…
    expect(screen.queryByText('Alpha')).toBeNull();
    // …and present under Group B.
    fireEvent.click(screen.getByRole('button', { name: 'Group B' }));
    const standings = screen.getByText('Group B Standings').closest('div')!.parentElement!;
    expect(within(standings).getByText('Alpha')).toBeTruthy();
    expect(refetch).toHaveBeenCalled();
  });

  it('puts the dropdown back and shows an error when the save fails', async () => {
    mutateAsync.mockRejectedValue(new Error('Server is down'));
    renderPage();

    await act(async () => {
      fireEvent.change(groupSelectFor('Alpha'), { target: { value: 'C' } });
    });

    expect(toast.error).toHaveBeenCalledWith('Server is down');
    expect(groupSelectFor('Alpha').value).toBe('A'); // snapped back
    expect(groupSelectFor('Alpha').disabled).toBe(false);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('tracks several teams saving at once independently', async () => {
    const first = deferred();
    const second = deferred();
    mutateAsync.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    renderPage();

    fireEvent.change(groupSelectFor('Alpha'), { target: { value: 'B' } });
    fireEvent.change(groupSelectFor('Bravo'), { target: { value: 'B' } });
    expect(screen.getAllByRole('status')).toHaveLength(2);

    await act(async () => {
      first.reject(new Error('nope'));
    });
    expect(toast.error).toHaveBeenCalledWith('nope'); // the earlier call's failure is not swallowed
    expect(groupSelectFor('Alpha').value).toBe('A');
    expect(groupSelectFor('Bravo').disabled).toBe(true); // still saving

    await act(async () => {
      second.resolve();
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Bravo moved to Group B'));
  });
});

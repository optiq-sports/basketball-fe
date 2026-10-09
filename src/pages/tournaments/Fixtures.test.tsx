import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const h = vi.hoisted(() => ({
  tournament: null as unknown,
  statisticians: { data: [] as unknown[], isPending: false },
  page: null as unknown,
  lastPageParams: null as unknown,
  create: { mutate: vi.fn(), isPending: false },
  update: { mutate: vi.fn(), isPending: false },
  del: { mutate: vi.fn(), isPending: false },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api/hooks', () => ({
  useTournament: () => h.tournament,
  useStatisticians: () => h.statisticians,
  useMatchesPage: (params: unknown) => {
    h.lastPageParams = params;
    return h.page;
  },
  useCreateMatch: () => h.create,
  useUpdateMatch: () => h.update,
  useDeleteMatch: () => h.del,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => h.toast }));

import Fixtures from './Fixtures';

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.search}</div>;
}

const q = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });
const pageOf = (items: unknown[], pageCount = 1) => q({ items, meta: { page: 1, limit: 10, itemCount: items.length, pageCount, hasPreviousPage: false, hasNextPage: pageCount > 1 } });

const teams = [
  { team: { id: 'a', name: 'Alpha' } },
  { team: { id: 'b', name: 'Bravo' } },
  { team: { id: 'c', name: 'Charlie' } },
];

const fixture = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  homeTeamId: 'a',
  awayTeamId: 'b',
  scheduledDate: '2026-10-10T18:00:00.000Z',
  status: 'SCHEDULED',
  venue: 'Main Arena',
  statisticianId: null,
  statistician: null,
  homeTeam: { name: 'Alpha' },
  awayTeam: { name: 'Bravo' },
  ...over,
});

function renderAt(path = '/tournaments/t1/fixtures') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tournaments/:id/fixtures" element={<Fixtures />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.tournament = q({ id: 't1', name: 'Summer Cup', teams });
  h.statisticians = { data: [{ id: 's1', name: 'Sam Scorer', email: 'sam@x.test' }], isPending: false };
  h.page = pageOf([fixture(), fixture({ id: 'm2', status: 'LIVE', statistician: { name: 'Sam Scorer' }, statisticianId: 's1', homeTeam: { name: 'Charlie' }, awayTeam: { name: 'Alpha' } })]);
  h.create = { mutate: vi.fn(), isPending: false };
  h.update = { mutate: vi.fn(), isPending: false };
  h.del = { mutate: vi.fn(), isPending: false };
  h.toast = { success: vi.fn(), error: vi.fn() };
});

describe('Fixtures: list', () => {
  it('lists fixtures with teams, venue, statistician and status', () => {
    renderAt();
    const table = screen.getByRole('list', { name: 'Fixtures' });
    expect(within(table).getAllByText(/Alpha/).length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Main Arena')).toHaveLength(2);
    expect(within(table).getByText('Unassigned')).toBeTruthy();
    expect(within(table).getByText('Sam Scorer')).toBeTruthy();
    expect(within(table).getByText('Live')).toBeTruthy();
  });

  it('offers a copy-code button on every fixture, for handing the game to a statistician', () => {
    renderAt();
    const cards = screen.getAllByRole('article');
    for (const card of cards) expect(within(card).getByRole('button', { name: /^Copy match code for/ })).toBeInTheDocument();
  });

  it('filters by status through the URL and returns to page one', () => {
    renderAt('/tournaments/t1/fixtures?page=3');
    fireEvent.click(screen.getByRole('button', { name: 'Live' }));
    expect(screen.getByTestId('where').textContent).toBe('?status=LIVE');
    expect(h.lastPageParams).toMatchObject({ tournamentId: 't1', status: 'LIVE' });
  });

  it('says there are no fixtures yet, and offers the first one', () => {
    h.page = pageOf([]);
    renderAt();
    expect(screen.getByText('No fixtures yet')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'New fixture' })[0]);
    expect(screen.getByRole('dialog', { name: 'New fixture' })).toBeTruthy();
  });

  it('says nothing matches the filter, distinct from empty', () => {
    h.page = pageOf([]);
    renderAt('/tournaments/t1/fixtures?status=CANCELLED');
    expect(screen.getByText('No matches')).toBeTruthy();
    expect(screen.queryByText('No fixtures yet')).toBeNull();
  });

  it('won’t offer a new fixture until two teams are in the tournament', () => {
    h.tournament = q({ id: 't1', name: 'Summer Cup', teams: [teams[0]] });
    renderAt();
    expect((screen.getAllByRole('button', { name: 'New fixture' })[0] as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/needs two teams/)).toBeTruthy();
  });
});

describe('Fixtures: create', () => {
  it('blocks a fixture with the same team on both sides', async () => {
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: 'New fixture' })[0]);
    fireEvent.change(screen.getByLabelText(/^Home team/), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText(/^Away team/), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: '2026-10-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create fixture' }));
    expect(await screen.findByText(/must be different from the home team/)).toBeTruthy();
    expect(h.create.mutate).not.toHaveBeenCalled();
  });

  it('creates a fixture with the teams, the time as an instant, and the status scheduled', async () => {
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: 'New fixture' })[0]);
    fireEvent.change(screen.getByLabelText(/^Home team/), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText(/^Away team/), { target: { value: 'c' } });
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: '2026-10-10' } });
    fireEvent.change(screen.getByLabelText(/^Start time/), { target: { value: '18:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create fixture' }));
    await waitFor(() =>
      expect(h.create.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ tournamentId: 't1', homeTeamId: 'a', awayTeamId: 'c', status: 'SCHEDULED', scheduledDate: expect.any(String) }),
        expect.anything(),
      ),
    );
  });

  it('keeps the form open with the server’s reason when it is refused', async () => {
    h.create.mutate = vi.fn((_b: unknown, opts: { onError: (e: Error) => void }) => opts.onError(new Error('Home team is not part of this tournament')));
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: 'New fixture' })[0]);
    fireEvent.change(screen.getByLabelText(/^Home team/), { target: { value: 'a' } });
    fireEvent.change(screen.getByLabelText(/^Away team/), { target: { value: 'c' } });
    fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: '2026-10-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create fixture' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not part of this tournament/));
    expect(screen.getByRole('dialog', { name: 'New fixture' })).toBeTruthy();
  });
});

describe('Fixtures: edit', () => {
  it('a live game keeps its status, and the admin can’t move it to completed by hand', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /Edit Charlie vs Alpha/ }));
    const status = screen.getByLabelText('Status') as HTMLSelectElement;
    expect(status.value).toBe('LIVE');
    expect(status.disabled).toBe(true);
    expect(within(status).queryByRole('option', { name: /Completed/ })).toBeNull();
    expect(screen.getByText('Live and completed games are set by the scorer.')).toBeTruthy();
  });

  it('saves a rescheduled fixture, clearing the statistician when it is set to unassigned', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /Edit Alpha vs Bravo/ }));
    fireEvent.change(screen.getByLabelText(/^Start time/), { target: { value: '20:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(h.update.mutate).toHaveBeenCalledWith(
        { id: 'm1', data: expect.objectContaining({ scheduledDate: expect.any(String), statisticianId: null, status: 'SCHEDULED' }) },
        expect.anything(),
      ),
    );
  });
});

describe('Fixtures: delete', () => {
  it('needs the fixture’s exact label typed first', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha vs Bravo' }));
    const confirm = screen.getByRole('button', { name: 'Delete fixture' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Type Alpha vs Bravo to confirm/), { target: { value: 'Alpha vs Bravo' } });
    expect(confirm.disabled).toBe(false);
  });

  it('warns that a played game’s data goes with it', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Charlie vs Alpha' }));
    expect(screen.getByRole('dialog', { name: 'Delete fixture?' }).textContent).toMatch(/recorded game data/);
  });

  it('deletes once confirmed', () => {
    h.del.mutate = vi.fn((_id: string, opts: { onSuccess: () => void }) => opts.onSuccess());
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha vs Bravo' }));
    fireEvent.change(screen.getByLabelText(/Type Alpha vs Bravo to confirm/), { target: { value: 'Alpha vs Bravo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete fixture' }));
    expect(h.del.mutate).toHaveBeenCalledWith('m1', expect.anything());
    expect(h.toast.success).toHaveBeenCalledWith('Alpha vs Bravo deleted.');
  });
});

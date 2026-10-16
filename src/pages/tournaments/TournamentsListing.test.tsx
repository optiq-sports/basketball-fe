import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q = { data?: unknown; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const h = vi.hoisted(() => ({
  page: null as unknown,
  create: { mutate: vi.fn(), isPending: false },
  update: { mutate: vi.fn(), isPending: false },
  del: { mutate: vi.fn(), isPending: false },
  upload: { mutate: vi.fn(), isPending: false },
  toast: { success: vi.fn(), error: vi.fn() },
  lastQuery: null as unknown,
}));

vi.mock('../../api/hooks', () => ({
  useTournamentsPage: (params: unknown) => {
    h.lastQuery = params;
    return h.page;
  },
  useCreateTournament: () => h.create,
  useUpdateTournament: () => h.update,
  useDeleteTournament: () => h.del,
  useUploadFile: () => h.upload,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => h.toast }));

import TournamentsListing from './TournamentsListing';

const ok = (items: unknown[], itemCount = items.length, pageCount = 1, page = 1): Q => ({
  data: { items, meta: { page, limit: 10, itemCount, pageCount, hasPreviousPage: page > 1, hasNextPage: page < pageCount } },
  isPending: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
});

const cup = {
  id: 't1', name: 'Summer Cup', division: 'DIVISION_1', startDate: '2026-10-01T00:00:00.000Z', endDate: '2026-10-31T00:00:00.000Z',
  venue: 'Main Arena', numberOfGames: 10, numberOfQuarters: 4, quarterDuration: 10, overtimeDuration: 5, crewChief: 'J. Doe', umpire2: 'M. Lee',
  _count: { teams: 6, matches: 12 },
};

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.search}</div>;
}

function renderAt(path = '/tournaments') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tournaments" element={<TournamentsListing />} />
        <Route path="/tournaments/:id" element={<div>DETAIL</div>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.page = ok([cup]);
  h.create = { mutate: vi.fn(), isPending: false };
  h.update = { mutate: vi.fn(), isPending: false };
  h.del = { mutate: vi.fn(), isPending: false };
  h.toast = { success: vi.fn(), error: vi.fn() };
});

describe('TournamentsListing: states', () => {
  it('lists tournaments as flyer tiles, with division, dates, venue and the team and match counts', () => {
    renderAt();
    const link = screen.getByRole('link', { name: 'Open Summer Cup' });
    expect(within(link).getByText('Summer Cup')).toBeTruthy();
    expect(within(link).getByText('Division 1')).toBeTruthy();
    expect(within(link).getByText('6 teams · 12 matches')).toBeTruthy();
  });

  it('says there are no tournaments yet, and Add Tournament opens the form', () => {
    h.page = ok([], 0, 0);
    renderAt();
    expect(screen.getByText('No tournaments found')).toBeTruthy();
    expect(screen.getByText(/Create your first tournament/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Tournament' }));
    expect(screen.getByRole('dialog', { name: 'New tournament' })).toBeTruthy();
  });

  it('says nothing matches a search, distinct from empty', () => {
    h.page = ok([], 0, 0);
    renderAt('/tournaments?q=harbor');
    expect(screen.getByText('No tournaments found')).toBeTruthy();
    expect(screen.getByText('Try a different tournament name.')).toBeTruthy();
  });

  it('shows the failure above the list', () => {
    h.page = { data: undefined, isPending: false, isError: true, isFetching: false, error: new Error('Server unavailable'), refetch: vi.fn() };
    renderAt();
    expect(screen.getByText(/Server unavailable/)).toBeTruthy();
  });

  it('offers no Season filter: the old one had hardcoded options and no column behind them', () => {
    renderAt();
    expect(screen.queryByText('All Seasons')).toBeNull();
    expect(screen.queryByText('2024-2025')).toBeNull();
  });
});

describe('TournamentsListing: URL state', () => {
  it('asks the server for the newest first, and reads the page from the URL', () => {
    renderAt();
    expect(h.lastQuery).toMatchObject({ sortBy: 'createdAt', sortOrder: 'desc', page: 1, limit: 12 });
    renderAt('/tournaments?page=3');
    expect(h.lastQuery).toMatchObject({ page: 3 });
  });

  it('sorts by asking the server, with a name starting A–Z and a press of the active field flipping it', () => {
    renderAt();
    expect(h.lastQuery).toMatchObject({ sortBy: 'createdAt', sortOrder: 'desc' });

    fireEvent.click(screen.getByRole('button', { name: /^Sort by Name/ }));
    expect(h.lastQuery).toMatchObject({ sortBy: 'name', sortOrder: 'asc' });

    fireEvent.click(screen.getByRole('button', { name: /^Sort by Name/ }));
    expect(h.lastQuery).toMatchObject({ sortBy: 'name', sortOrder: 'desc' });
  });

  it('searching waits for a pause in typing, then writes the search to the URL and resets the page', async () => {
    vi.useFakeTimers();
    try {
      renderAt('/tournaments?page=2');
      fireEvent.change(screen.getByLabelText('Search tournaments by name'), { target: { value: 'cup' } });
      expect(screen.getByTestId('where').textContent).toContain('page=2');
      await act(async () => {
        vi.advanceTimersByTime(350);
      });
      await act(async () => undefined);
      const search = screen.getByTestId('where').textContent ?? '';
      expect(search).toContain('q=cup');
      expect(search).not.toContain('page=');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('TournamentsListing: create and edit', () => {
  it('blocks saving an empty form and marks what is missing', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Tournament' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create tournament' }));
    expect(await screen.findByText('Enter the tournament’s name.')).toBeTruthy();
    expect(screen.getByText('Choose a start date.')).toBeTruthy();
    expect(screen.getByText('Enter the venue.')).toBeTruthy();
    expect(h.create.mutate).not.toHaveBeenCalled();
  });

  it('refuses an end date before the start date, even while other fields are also wrong', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Tournament' }));
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: '2026-11-10' } });
    fireEvent.change(screen.getByLabelText(/^End date/), { target: { value: '2026-11-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create tournament' }));
    expect(await screen.findByText('The end date is before the start date.')).toBeTruthy();
    expect(screen.getByText('Enter the venue.')).toBeTruthy();
    expect(h.create.mutate).not.toHaveBeenCalled();
  });

  it('refuses a games count that is not a whole number', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Tournament' }));
    fireEvent.change(screen.getByLabelText(/^Games/), { target: { value: '2.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create tournament' }));
    expect(await screen.findByText(/Number of games must be a whole number/)).toBeTruthy();
  });

  it('creates a tournament from a complete form', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Tournament' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Autumn Cup' } });
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText(/^Venue/), { target: { value: 'Arena' } });
    fireEvent.change(screen.getByLabelText(/^Crew chief/), { target: { value: 'J. Doe' } });
    fireEvent.change(screen.getByLabelText(/^Umpire 2/), { target: { value: 'M. Lee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create tournament' }));
    await waitFor(() => expect(h.create.mutate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Autumn Cup', startDate: '2026-11-01' }), expect.anything()));
  });

  it('keeps the form open and shows the server’s reason when the save is refused', async () => {
    h.create.mutate = vi.fn((_body: unknown, opts: { onError: (e: Error) => void }) => opts.onError(new Error('A tournament with this name already exists.')));
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Tournament' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Summer Cup' } });
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText(/^Venue/), { target: { value: 'Arena' } });
    fireEvent.change(screen.getByLabelText(/^Crew chief/), { target: { value: 'J. Doe' } });
    fireEvent.change(screen.getByLabelText(/^Umpire 2/), { target: { value: 'M. Lee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create tournament' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/already exists/));
    expect(screen.getByRole('dialog', { name: 'New tournament' })).toBeTruthy();
  });
});

describe('TournamentsListing: Start New', () => {
  it('opens the New tournament form when it arrives with ?new=1, and drops the flag', async () => {
    renderAt('/tournaments?new=1');
    expect(await screen.findByRole('dialog', { name: 'New tournament' })).toBeTruthy();
    expect(screen.getByTestId('where')).not.toHaveTextContent('new=1');
  });

  it('does not open the form on an ordinary visit', () => {
    renderAt('/tournaments');
    expect(screen.queryByRole('dialog', { name: 'New tournament' })).toBeNull();
  });

  it('keeps the other filters when it drops the flag', async () => {
    renderAt('/tournaments?new=1&q=cup');
    await screen.findByRole('dialog', { name: 'New tournament' });
    expect(screen.getByTestId('where')).toHaveTextContent('q=cup');
    expect(screen.getByTestId('where')).not.toHaveTextContent('new=1');
  });

  it('goes to the new tournament once it is created, so its teams are the next thing to add', async () => {
    h.create.mutate = vi.fn((_body: unknown, opts: { onSuccess: (t: unknown) => void }) => opts.onSuccess({ id: 'fresh-1', name: 'Autumn Cup' }));
    renderAt('/tournaments');
    fireEvent.click(screen.getByRole('button', { name: 'Add Tournament' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Autumn Cup' } });
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText(/^Venue/), { target: { value: 'Arena' } });
    fireEvent.change(screen.getByLabelText(/^Crew chief/), { target: { value: 'J. Doe' } });
    fireEvent.change(screen.getByLabelText(/^Umpire 2/), { target: { value: 'M. Lee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create tournament' }));
    expect(await screen.findByText('DETAIL')).toBeTruthy();
    // The tournament page has no tabs any more (Fix 134), so its teams are on the page itself.
    expect(screen.getByTestId('where')).not.toHaveTextContent('tab=');
    expect(h.toast.success).toHaveBeenCalledWith(expect.stringContaining('Add its teams next'));
  });
});

describe('TournamentsListing: flyer', () => {
  it('uploads a flyer and includes it in the create payload', async () => {
    h.upload.mutate = vi.fn((_file: File, opts: { onSuccess: (r: { url: string }) => void }) => opts.onSuccess({ url: 'https://cdn.test/flyer.png' }));
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Tournament' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'flyer.png', { type: 'image/png' })] } });
    expect(h.upload.mutate).toHaveBeenCalled();
    expect(document.querySelector('img')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Autumn Cup' } });
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText(/^Venue/), { target: { value: 'Arena' } });
    fireEvent.change(screen.getByLabelText(/^Crew chief/), { target: { value: 'J. Doe' } });
    fireEvent.change(screen.getByLabelText(/^Umpire 2/), { target: { value: 'M. Lee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create tournament' }));
    await waitFor(() => expect(h.create.mutate).toHaveBeenCalledWith(expect.objectContaining({ flyer: 'https://cdn.test/flyer.png' }), expect.anything()));
  });
});

describe('TournamentsListing: delete', () => {
  it('will not delete until the exact name is typed', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Summer Cup' }));
    const confirm = screen.getByRole('button', { name: 'Delete tournament' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Type Summer Cup to confirm/), { target: { value: 'Summer' } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Type Summer Cup to confirm/), { target: { value: 'Summer Cup' } });
    expect(confirm.disabled).toBe(false);
  });

  it('says what will be lost: the matches and scores in it', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Summer Cup' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete tournament?' });
    expect(within(dialog).getByText(/12/)).toBeTruthy();
    expect(within(dialog).getByText(/can’t be undone/)).toBeTruthy();
  });

  it('deletes the tournament once confirmed, and reports success', () => {
    h.del.mutate = vi.fn((_id: string, opts: { onSuccess: () => void }) => opts.onSuccess());
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Summer Cup' }));
    fireEvent.change(screen.getByLabelText(/Type Summer Cup to confirm/), { target: { value: 'Summer Cup' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete tournament' }));
    expect(h.del.mutate).toHaveBeenCalledWith('t1', expect.anything());
    expect(h.toast.success).toHaveBeenCalledWith('Summer Cup deleted.');
  });

  it('reports a refused delete and closes the dialog, so the row can come back', async () => {
    h.del.mutate = vi.fn((_id: string, opts: { onError: (e: Error) => void }) => opts.onError(new Error('Tournament is locked')));
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Summer Cup' }));
    fireEvent.change(screen.getByLabelText(/Type Summer Cup to confirm/), { target: { value: 'Summer Cup' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete tournament' }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith(expect.stringContaining('Tournament is locked')));
    expect(screen.queryByRole('dialog', { name: 'Delete tournament?' })).toBeNull();
  });
});

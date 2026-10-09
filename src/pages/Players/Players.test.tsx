import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });

const h = vi.hoisted(() => ({
  page: null as unknown,
  teams: null as unknown,
  create: { mutate: vi.fn(), isPending: false },
  update: { mutate: vi.fn(), isPending: false },
  release: { mutate: vi.fn(), isPending: false },
  merge: { mutate: vi.fn(), isPending: false },
  upload: { mutate: vi.fn(), isPending: false, reset: vi.fn(), isError: false, error: null },
  uploadFile: { mutate: vi.fn(), isPending: false },
  toast: { success: vi.fn(), error: vi.fn() },
  lastQuery: null as unknown,
}));

vi.mock('../../api/hooks', () => ({
  usePlayersPage: (params: unknown) => { h.lastQuery = params; return h.page; },
  useTeams: () => h.teams,
  useCreatePlayerForTeam: () => h.create,
  useUpdatePlayer: () => h.update,
  useDeletePlayer: () => h.release,
  useMergePlayers: () => h.merge,
  useUploadPlayersExcel: () => h.upload,
  useUploadFile: () => h.uploadFile,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => h.toast }));

import Players from './Players';

const page = (items: unknown[], itemCount = items.length, pageCount = 1, pageNum = 1) =>
  ok({ items, meta: { page: pageNum, limit: 12, itemCount, pageCount, hasPreviousPage: pageNum > 1, hasNextPage: pageNum < pageCount } });

const player = (id: string, firstName: string, lastName: string, over: Record<string, unknown> = {}) => ({
  id,
  firstName,
  lastName,
  position: 'POINT_GUARD',
  jerseyNumber: 5,
  teamId: 'team-1',
  teamName: 'Marktown Flyers',
  playerTeams: [{ id: 'pt1', teamId: 'team-1', isActive: true, joinedAt: '2026-01-01', team: { id: 'team-1', name: 'Marktown Flyers', code: 'MTF' } }],
  ...over,
});

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.search}</div>;
}

function renderAt(path = '/players-management') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/players-management" element={<Players />} /></Routes>
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  h.page = page([player('a', 'Teddy', 'Okereafor'), player('b', 'Fahro', 'Alihodzic', { id: 'b', jerseyNumber: 15, position: 'CENTER' })]);
  h.teams = ok([{ id: 'team-1', name: 'MARKTOWN FLYERS', code: 'MTF' }, { id: 'team-2', name: 'Riverside Kings', code: 'RVK' }]);
  h.create = { mutate: vi.fn(), isPending: false };
  h.update = { mutate: vi.fn(), isPending: false };
  h.release = { mutate: vi.fn(), isPending: false };
  h.merge = { mutate: vi.fn(), isPending: false };
  h.upload = { mutate: vi.fn(), isPending: false, reset: vi.fn(), isError: false, error: null };
  h.uploadFile = { mutate: vi.fn(), isPending: false };
  h.toast = { success: vi.fn(), error: vi.fn() };
});

describe('Players: list', () => {
  it('shows players as cards with their number, position and team', () => {
    renderAt();
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('#5')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Teddy Okereafor')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Point guard')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Marktown Flyers')).toBeInTheDocument();
  });

  it('asks the server for the first page sorted by surname', () => {
    renderAt();
    expect(h.lastQuery).toMatchObject({ sortBy: 'lastName', sortOrder: 'asc', page: 1, limit: 12 });
  });

  it('shows a name stored in caps as normal text', () => {
    h.page = page([player('a', 'TEDDY', 'OKEREAFOR')]);
    renderAt();
    expect(screen.getByText('Teddy Okereafor')).toBeInTheDocument();
  });

  it('says "No team" rather than leaving a blank for an unassigned player', () => {
    h.page = page([player('a', 'Ada', 'Eze', { teamId: null, teamName: null, jerseyNumber: null, playerTeams: [] })]);
    renderAt();
    const card = screen.getByRole('article');
    expect(within(card).getByText('No team')).toBeInTheDocument();
    expect(within(card).queryByText(/^#/)).not.toBeInTheDocument();
  });

  it('says a position is not set instead of showing a blank line', () => {
    h.page = page([player('a', 'Ada', 'Eze', { position: null })]);
    renderAt();
    expect(screen.getByText('Position not set')).toBeInTheDocument();
  });

  it('offers no Release button for a player who is on no team', () => {
    h.page = page([player('a', 'Ada', 'Eze', { teamId: null, teamName: null, playerTeams: [] })]);
    renderAt();
    expect(screen.queryByRole('button', { name: /^Release/ })).not.toBeInTheDocument();
  });
});

describe('Players: search, filter and sort go through the URL', () => {
  it('reads the search term from the URL and sends it to the server', () => {
    renderAt('/players-management?q=teddy');
    expect(h.lastQuery).toMatchObject({ search: 'teddy' });
    expect(screen.getByLabelText('Search players by name')).toHaveValue('teddy');
  });

  it('filters by team', () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('Filter by team'), { target: { value: 'team-2' } });
    expect(screen.getByTestId('where').textContent).toContain('team=team-2');
    expect(h.lastQuery).toMatchObject({ teamId: 'team-2' });
  });

  it('filters to players with no team, and sends unassigned instead of a team id', () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('Filter by team'), { target: { value: '__none' } });
    expect(h.lastQuery).toMatchObject({ unassigned: true });
    expect(h.lastQuery).not.toHaveProperty('teamId');
  });

  it('shows team names in the filter in normal case, not as stored', () => {
    renderAt();
    const select = screen.getByLabelText('Filter by team');
    expect(within(select).getByRole('option', { name: 'Marktown Flyers' })).toBeInTheDocument();
  });

  it('flips direction when the active sort is pressed again', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /Sort by Name/ }));
    expect(screen.getByTestId('where').textContent).toContain('dir=desc');
  });

  it('offers no position sort, because the backend answers 400 for one', () => {
    renderAt();
    expect(screen.queryByRole('button', { name: /Sort by Jersey/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sort by Team/ })).not.toBeInTheDocument();
  });

  it('drops back to page 1 when the filter changes', () => {
    renderAt('/players-management?page=3');
    fireEvent.change(screen.getByLabelText('Filter by team'), { target: { value: 'team-2' } });
    expect(screen.getByTestId('where').textContent).not.toContain('page=3');
  });
});

describe('Players: releasing', () => {
  it('explains that releasing clears their team and keeps the profile', () => {
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: /^Release Teddy Okereafor/ })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Release player?')).toBeInTheDocument();
    expect(within(dialog).getByText(/profile and everything they've recorded stay/i)).toBeInTheDocument();
    expect(within(dialog).getByText('Marktown Flyers')).toBeInTheDocument();
  });

  it('never calls it a delete, because the backend does not delete the player', () => {
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: /^Release Teddy Okereafor/ })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/can’t be undone/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/permanently/i)).not.toBeInTheDocument();
  });

  it('releases the player on confirmation', () => {
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: /^Release Teddy Okereafor/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Release player' }));
    expect(h.release.mutate).toHaveBeenCalledWith('a', expect.anything());
  });
});

describe('Players: cards and table views', () => {
  it('starts on cards and offers both views', () => {
    renderAt();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'cards' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'table' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to a table of the same players, and puts the choice in the URL', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'table' }));
    expect(screen.getByTestId('where')).toHaveTextContent('view=table');
    const table = screen.getByRole('table', { name: 'Players' });
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3); // header + two players
    expect(within(rows[1]).getByText('Teddy Okereafor')).toBeInTheDocument();
    expect(within(rows[1]).getByText('#5')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Point guard')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Marktown Flyers')).toBeInTheDocument();
  });

  it('opens on the table when the URL says so', () => {
    renderAt('/players-management?view=table');
    expect(screen.getByRole('table', { name: 'Players' })).toBeInTheDocument();
  });

  it('remembers the last view on this device when the URL has none', () => {
    const first = renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'table' }));
    first.unmount();
    renderAt();
    expect(screen.getByRole('table', { name: 'Players' })).toBeInTheDocument();
  });

  it('sorts from a column header by asking the server, not by reordering the page', () => {
    renderAt('/players-management?view=table');
    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: /^Position/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('sort=position');
    expect(h.lastQuery).toMatchObject({ sortBy: 'position' });
  });

  it('marks the sorted column, and gives jersey and team no sort control since the backend refuses them', () => {
    renderAt('/players-management?view=table');
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: /Player/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(within(table).queryByRole('button', { name: /^#/ })).not.toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: /^Team/ })).not.toBeInTheDocument();
  });

  it('hides the card sort buttons in the table, where the headers do that job', () => {
    renderAt('/players-management?view=table');
    expect(screen.queryByRole('group', { name: 'Sort by' })).not.toBeInTheDocument();
  });

  it('edits and releases from a table row just as from a card', () => {
    renderAt('/players-management?view=table');
    fireEvent.click(screen.getByRole('button', { name: /^Release Teddy Okereafor/ }));
    expect(screen.getByRole('dialog', { name: 'Release player?' })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: /^Edit Teddy Okereafor/ }));
    expect(screen.getByRole('dialog', { name: 'Edit player' })).toBeInTheDocument();
  });

  it('says No team and shows a dash for a player with no team or number', () => {
    h.page = page([player('a', 'Ada', 'Eze', { teamId: null, teamName: null, jerseyNumber: null, playerTeams: [] })]);
    renderAt('/players-management?view=table');
    const row = within(screen.getByRole('table')).getAllByRole('row')[1];
    expect(within(row).getByText('No team')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /^Release/ })).not.toBeInTheDocument();
  });
});

describe('Players: adding and editing', () => {
  it('creates a player with the team and jersey number the backend needs', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add player' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^First name/), { target: { value: 'Ada' } });
    fireEvent.change(within(dialog).getByLabelText(/^Last name/), { target: { value: 'Eze' } });
    fireEvent.change(within(dialog).getByLabelText(/^Team/), { target: { value: 'team-2' } });
    fireEvent.change(within(dialog).getByLabelText(/^Jersey number/), { target: { value: '7' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add player' }));

    await waitFor(() =>
      expect(h.create.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Ada', lastName: 'Eze', teamId: 'team-2', jerseyNumber: 7 }),
        expect.anything(),
      ),
    );
  });

  it('refuses to create without a team, and says so on the field', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add player' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^First name/), { target: { value: 'Ada' } });
    fireEvent.change(within(dialog).getByLabelText(/^Last name/), { target: { value: 'Eze' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add player' }));

    expect(await within(dialog).findByText('Choose a team.')).toBeInTheDocument();
    expect(h.create.mutate).not.toHaveBeenCalled();
  });

  it('sends only the changed field when editing', async () => {
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit Teddy Okereafor/ })[0]);
    fireEvent.change(screen.getByLabelText(/^Height/), { target: { value: "6'5\"" } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(h.update.mutate).toHaveBeenCalledWith({ id: 'a', data: { height: "6'5\"" } }, expect.anything()));
  });

  it('will not let an edit move a player between teams, since the backend cannot', () => {
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: /^Edit Teddy Okereafor/ })[0]);
    expect(screen.getByLabelText(/^Team/)).toBeDisabled();
  });
});

describe('Players: merging duplicates', () => {
  it('warns that the duplicate is deleted for good and asks for its name', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Merge duplicates' }));
    expect(screen.getByText(/duplicate profile is then deleted for good/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Merge and delete duplicate' })).toBeDisabled();
  });
});

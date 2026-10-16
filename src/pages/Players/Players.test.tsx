import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });
const idle = <T,>(): Q<T> => ({ data: undefined, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });

const h = vi.hoisted(() => ({
  page: null as unknown,
  teams: null as unknown,
  create: { mutate: vi.fn(), isPending: false },
  update: { mutate: vi.fn(), isPending: false },
  release: { mutate: vi.fn(), isPending: false },
  merge: { mutate: vi.fn(), isPending: false },
  upload: { mutate: vi.fn(), isPending: false, reset: vi.fn(), isError: false, error: null },
  uploadFile: { mutate: vi.fn(), isPending: false },
  player: null as unknown,
  team: null as unknown,
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
  usePlayer: () => h.player,
  useTeam: () => h.team,
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
  nationality: 'Nigeria',
  height: "6'2\"",
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

/** The row for a named player, from the restored table. */
const rowFor = (name: string) =>
  within(screen.getByRole('table', { name: 'Players' })).getByText(name).closest('tr') as HTMLElement;

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
  h.player = idle();
  h.team = idle();
  h.toast = { success: vi.fn(), error: vi.fn() };
});

describe('Players: list', () => {
  it('shows each player as a row with their number, position, team, nationality and height', () => {
    renderAt();
    const table = screen.getByRole('table', { name: 'Players' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3); // header + two players
    const row = rowFor('Teddy Okereafor');
    expect(within(row).getByText('5')).toBeInTheDocument();
    expect(within(row).getByText('Point guard')).toBeInTheDocument();
    expect(within(row).getByText('Marktown Flyers')).toBeInTheDocument();
    expect(within(row).getByText('Nigeria')).toBeInTheDocument();
    expect(within(row).getByText("6'2\"")).toBeInTheDocument();
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
    const row = rowFor('Ada Eze');
    expect(within(row).getByText('No team')).toBeInTheDocument();
    expect(within(row).getByText('—')).toBeInTheDocument();
  });

  it('shows a dash rather than a blank cell when a position is not set', () => {
    h.page = page([player('a', 'Ada', 'Eze', { position: null, nationality: null, height: null })]);
    renderAt();
    const row = rowFor('Ada Eze');
    expect(within(row).getAllByText('—')).toHaveLength(3);
  });

  it('offers no Release button for a player who is on no team', () => {
    h.page = page([player('a', 'Ada', 'Eze', { teamId: null, teamName: null, playerTeams: [] })]);
    renderAt();
    expect(screen.queryByRole('button', { name: /^Release/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Edit Ada Eze/ })).toBeInTheDocument();
  });

  it('opens the player profile when their row is clicked', () => {
    renderAt();
    fireEvent.click(rowFor('Teddy Okereafor'));
    expect(screen.getByRole('dialog', { name: 'Player Profile' })).toBeInTheDocument();
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

  it('sorts from a column header by asking the server, not by reordering the page', () => {
    renderAt();
    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: /^Position/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('sort=position');
    expect(h.lastQuery).toMatchObject({ sortBy: 'position' });
  });

  it('flips direction when the active sort is pressed again', () => {
    renderAt();
    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: /^Player/ }));
    expect(screen.getByTestId('where').textContent).toContain('dir=desc');
  });

  it('marks the sorted column, and gives jersey, team and height no sort control since the backend refuses them', () => {
    renderAt();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: /Player/ })).toHaveAttribute('aria-sort', 'ascending');
    expect(within(table).queryByRole('button', { name: /^#/ })).not.toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: /^Team/ })).not.toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: /^Height/ })).not.toBeInTheDocument();
  });

  it('offers no position filter, because the backend answers 400 for one', () => {
    renderAt();
    expect(screen.queryByLabelText(/position/i)).not.toBeInTheDocument();
  });

  it('drops back to page 1 when the filter changes', () => {
    renderAt('/players-management?page=3');
    fireEvent.change(screen.getByLabelText('Filter by team'), { target: { value: 'team-2' } });
    expect(screen.getByTestId('where').textContent).not.toContain('page=3');
  });

  it('pages through the server pages rather than slicing one in the browser', () => {
    h.page = page([player('a', 'Teddy', 'Okereafor')], 30, 3, 1);
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByTestId('where').textContent).toContain('page=2');
  });
});

describe('Players: the cards ⇄ table toggle', () => {
  it('starts on the table, as the page always has', () => {
    renderAt();
    expect(screen.getByRole('table', { name: 'Players' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches to cards, writes the choice to the URL and remembers it', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Cards' }));

    expect(screen.queryByRole('table', { name: 'Players' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Players' })).toBeInTheDocument();
    expect(screen.getByTestId('where').textContent).toContain('view=cards');
    expect(localStorage.getItem('players_view')).toBe('cards');
  });

  it('opens on cards when the URL says so, even with nothing remembered', () => {
    renderAt('/players-management?view=cards');
    expect(screen.getByRole('list', { name: 'Players' })).toBeInTheDocument();
    const cards = within(screen.getByRole('list', { name: 'Players' })).getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Teddy Okereafor')).toBeInTheDocument();
  });

  it('shows the sort buttons only on cards, since the table sorts from its headers', () => {
    renderAt();
    expect(screen.queryByRole('button', { name: /^Sort by Position/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cards' }));
    fireEvent.click(screen.getByRole('button', { name: /^Sort by Position/ }));
    expect(h.lastQuery).toMatchObject({ sortBy: 'position', sortOrder: 'asc' });

    fireEvent.click(screen.getByRole('button', { name: /^Sort by Position/ }));
    expect(h.lastQuery).toMatchObject({ sortBy: 'position', sortOrder: 'desc' });
  });
});

describe('Players: releasing', () => {
  it('explains that releasing clears their team and keeps the profile', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /^Release Teddy Okereafor/ }));
    const dialog = screen.getByRole('dialog', { name: 'Release player?' });
    expect(within(dialog).getByText(/profile and everything they've recorded stay/i)).toBeInTheDocument();
    expect(within(dialog).getByText('Marktown Flyers')).toBeInTheDocument();
  });

  it('never calls it a delete, because the backend does not delete the player', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /^Release Teddy Okereafor/ }));
    const dialog = screen.getByRole('dialog', { name: 'Release player?' });
    expect(within(dialog).queryByText(/can’t be undone/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/permanently/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  });

  it('releases the player on confirmation', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /^Release Teddy Okereafor/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Release player' }));
    expect(h.release.mutate).toHaveBeenCalledWith('a', expect.anything());
  });

  it('does not open the profile when a row action is used', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /^Release Teddy Okereafor/ }));
    expect(screen.queryByRole('dialog', { name: 'Player Profile' })).not.toBeInTheDocument();
  });
});

describe('Players: adding and editing', () => {
  it('creates a player with the team and jersey number the backend needs', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));
    const dialog = screen.getByRole('dialog', { name: 'Add player' });
    fireEvent.change(within(dialog).getByLabelText(/^First Name/), { target: { value: 'Ada' } });
    fireEvent.change(within(dialog).getByLabelText(/^Last Name/), { target: { value: 'Eze' } });
    fireEvent.change(within(dialog).getByLabelText(/^Team/), { target: { value: 'team-2' } });
    fireEvent.change(within(dialog).getByLabelText(/^Jersey Number/), { target: { value: '7' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(h.create.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Ada', lastName: 'Eze', teamId: 'team-2', jerseyNumber: 7 }),
        expect.anything(),
      ),
    );
  });

  it('refuses to create without a team, and says so on the field', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));
    const dialog = screen.getByRole('dialog', { name: 'Add player' });
    fireEvent.change(within(dialog).getByLabelText(/^First Name/), { target: { value: 'Ada' } });
    fireEvent.change(within(dialog).getByLabelText(/^Last Name/), { target: { value: 'Eze' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(await within(dialog).findByText('Choose a team.')).toBeInTheDocument();
    expect(h.create.mutate).not.toHaveBeenCalled();
  });

  it('sends only the changed field when editing', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /^Edit Teddy Okereafor/ }));
    fireEvent.change(screen.getByLabelText(/^Height/), { target: { value: "6'5\"" } });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => expect(h.update.mutate).toHaveBeenCalledWith({ id: 'a', data: { height: "6'5\"" } }, expect.anything()));
  });

  it('will not let an edit move a player between teams, since the backend cannot', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /^Edit Teddy Okereafor/ }));
    expect(screen.getByLabelText(/^Team/)).toBeDisabled();
  });
});

describe('Players: merging duplicates', () => {
  it('warns that the duplicate is deleted for good and asks for its name', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Merge Players' }));
    expect(screen.getByText(/duplicate profile is then deleted for good/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Merge and delete duplicate' })).toBeDisabled();
  });
});

describe('Players: uploading a squad', () => {
  it('cannot be opened before there is a team to upload into', () => {
    h.teams = ok([]);
    renderAt();
    expect(screen.getByRole('button', { name: 'Upload Excel' })).toBeDisabled();
  });

  it('opens the spreadsheet dialog', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Upload Excel' }));
    expect(screen.getByRole('dialog', { name: 'Upload player list (Excel)' })).toBeInTheDocument();
  });
});

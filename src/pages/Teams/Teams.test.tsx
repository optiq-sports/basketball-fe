import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });

const h = vi.hoisted(() => ({
  page: null as unknown,
  team: null as unknown,
  create: { mutate: vi.fn(), isPending: false },
  update: { mutate: vi.fn(), isPending: false },
  del: { mutate: vi.fn(), isPending: false },
  upload: { mutate: vi.fn(), isPending: false },
  toast: { success: vi.fn(), error: vi.fn() },
  lastQuery: null as unknown,
}));

vi.mock('../../api/hooks', () => ({
  useTeamsPage: (params: unknown) => { h.lastQuery = params; return h.page; },
  useCreateTeam: () => h.create,
  useUpdateTeam: () => h.update,
  useDeleteTeam: () => h.del,
  useTeam: () => h.team,
  useUploadFile: () => h.upload,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => h.toast }));

import Teams from './Teams';

const page = (items: unknown[], itemCount = items.length, pageCount = 1, pageNum = 1) => ok({ items, meta: { page: pageNum, limit: 12, itemCount, pageCount, hasPreviousPage: pageNum > 1, hasNextPage: pageNum < pageCount } });
const team = (id: string, name: string, code: string, over: Record<string, unknown> = {}) => ({ id, name, code, _count: { playerTeams: 8 }, ...over });

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.search}</div>;
}

function renderAt(path = '/teams-management') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/teams-management" element={<Teams />} /></Routes>
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.page = page([team('a', 'Alpha', 'ALP'), team('b', 'Bravo', 'BRV')]);
  h.team = ok(undefined);
  h.create = { mutate: vi.fn(), isPending: false };
  h.update = { mutate: vi.fn(), isPending: false };
  h.del = { mutate: vi.fn(), isPending: false };
  h.upload = { mutate: vi.fn(), isPending: false };
  h.toast = { success: vi.fn(), error: vi.fn() };
});

/** The cards are plain divs; each is the container of its own name heading. */
const cards = () => screen.getAllByRole('heading', { level: 3 }).map((h3) => h3.closest('div.group') as HTMLElement);

describe('Teams: list', () => {
  it('shows teams as colour-banner cards with their code, roster size and location', () => {
    h.page = page([team('a', 'Alpha', 'ALP', { country: 'Nigeria', state: 'Lagos', coach: 'Pat Riley' })]);
    renderAt();
    const card = cards()[0];
    expect(within(card).getByText('Alpha')).toBeTruthy();
    // The crest also renders the code as its initials, so target the pill rather than both.
    expect(within(card).getByText('ALP', { selector: 'span:not([aria-hidden])' })).toBeTruthy();
    expect(within(card).getByText('8 players')).toBeTruthy();
    expect(within(card).getByText('Lagos, Nigeria')).toBeTruthy();
    expect(within(card).getByText('Pat Riley')).toBeTruthy();
  });

  it('asks the server for the first page of nine, sorted by name', () => {
    renderAt();
    expect(h.lastQuery).toMatchObject({ sortBy: 'name', sortOrder: 'asc', page: 1, limit: 9 });
  });

  it('shows the team’s own logo where it has one, which the old basketball glyph never did', () => {
    h.page = page([team('a', 'Alpha', 'ALP', { logo: 'https://cdn.test/alpha.png' })]);
    const { container } = renderAt();
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.src).toBe('https://cdn.test/alpha.png');
  });

  it('falls back to the code on the team’s colour when there is no logo', () => {
    h.page = page([team('a', 'Alpha', 'ALP', { color: '#21409A' })]);
    renderAt();
    expect(within(cards()[0]).getByText('ALP', { selector: 'span[aria-hidden]' })).toBeTruthy();
  });

  it('says there are no teams yet, with the action that creates one', () => {
    h.page = page([], 0, 0);
    renderAt();
    expect(screen.getByText('No teams found')).toBeTruthy();
    expect(screen.getByText(/Create your first team/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Team' }));
    expect(screen.getByRole('dialog', { name: 'New team' })).toBeTruthy();
  });

  it('says nothing matches a search, naming what the server can match on', () => {
    h.page = page([], 0, 0);
    renderAt('/teams-management?q=zzz');
    expect(screen.getByText('No teams found')).toBeTruthy();
    expect(screen.getByText('Try a different team name.')).toBeTruthy();
  });

  it('sends a typed search to the server and puts it in the URL', async () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('Search teams by name'), { target: { value: 'alph' } });
    await waitFor(() => expect(h.lastQuery).toMatchObject({ search: 'alph' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toContain('q=alph'));
  });

  it('sorts by asking the server, and flips the direction when the active field is pressed again', () => {
    renderAt();
    expect(h.lastQuery).toMatchObject({ sortBy: 'name', sortOrder: 'asc' });

    fireEvent.click(screen.getByRole('button', { name: /^Sort by Code/ }));
    expect(h.lastQuery).toMatchObject({ sortBy: 'code', sortOrder: 'asc' });

    fireEvent.click(screen.getByRole('button', { name: /^Sort by Code/ }));
    expect(h.lastQuery).toMatchObject({ sortBy: 'code', sortOrder: 'desc' });
  });

  it('starts "Newest" at newest first rather than oldest', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /^Sort by Newest/ }));
    expect(h.lastQuery).toMatchObject({ sortBy: 'createdAt', sortOrder: 'desc' });
  });

  it('pages through the server pages', () => {
    h.page = page([team('a', 'Alpha', 'ALP')], 30, 4, 1);
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByTestId('where').textContent).toContain('page=2');
  });

  it('shows the error above the list', () => {
    h.page = { ...ok(undefined), isError: true, error: new Error('boom') };
    renderAt();
    expect(screen.getByText(/boom/)).toBeTruthy();
  });

  it('opens the team through a real link, so it can go in a new tab', () => {
    renderAt();
    const link = screen.getByRole('link', { name: 'Open Alpha' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/teams-management/a');
  });
});

describe('Teams: shouting names', () => {
  it('shows a name stored in caps as normal text, and asks for that same text to confirm a delete', () => {
    h.page = page([team('a', 'MARKTOWN FLYERS', 'MKF')]);
    h.team = ok({ tournamentTeams: [], homeMatches: [], awayMatches: [] });
    renderAt();
    expect(screen.getByText('Marktown Flyers')).toBeTruthy();
    expect(screen.queryByText('MARKTOWN FLYERS')).toBeNull();

    // The typed confirmation has to match what's on screen, not the raw stored name.
    fireEvent.click(screen.getByRole('button', { name: 'Delete Marktown Flyers' }));
    const confirm = screen.getByRole('button', { name: 'Delete team' }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText(/Type Marktown Flyers to confirm/), { target: { value: 'Marktown Flyers' } });
    expect(confirm.disabled).toBe(false);
  });
});

describe('Teams: create', () => {
  it('blocks a team with no name or code', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Team' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));
    expect(await screen.findByText('Enter the team’s name.')).toBeTruthy();
    expect(screen.getByText('Enter a short code, e.g. LAL.')).toBeTruthy();
    expect(h.create.mutate).not.toHaveBeenCalled();
  });

  it('creates a team, upper-casing the code and leaving out blank fields', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Team' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Charlie' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'cha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));
    await waitFor(() => expect(h.create.mutate).toHaveBeenCalledWith({ name: 'Charlie', code: 'CHA' }, expect.anything()));
  });

  it('keeps the dialog open with the server’s reason when it is refused', async () => {
    h.create.mutate = vi.fn((_b: unknown, opts: { onError: (e: Error) => void }) => opts.onError(new Error('A team with this code already exists.')));
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Team' }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Charlie' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'ALP' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/already exists/));
  });

  it('opens the edit form pre-filled from the card', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Alpha' }));
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Alpha');
  });
});

describe('Teams: delete', () => {
  it('waits for the real cascade counts before allowing the name to be typed', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha' }));
    expect(screen.getByText('Checking what this removes…')).toBeTruthy();
    expect(screen.getByLabelText(/Type Alpha to confirm/)).toBeDisabled();
  });

  it('says exactly what the cascade removes, once the counts arrive — not just "cannot be undone"', () => {
    h.team = ok({ tournamentTeams: [{}, {}], homeMatches: [{}, {}, {}], awayMatches: [{}] });
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete team?' });
    expect(within(dialog).getByText('2', { selector: 'strong' })).toBeTruthy(); // tournaments
    expect(within(dialog).getByText('4', { selector: 'strong' })).toBeTruthy(); // 3 home + 1 away
  });

  it('deletes only once the name is typed and the counts are known', () => {
    h.team = ok({ tournamentTeams: [], homeMatches: [], awayMatches: [] });
    h.del.mutate = vi.fn((_id: string, opts: { onSuccess: () => void }) => opts.onSuccess());
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha' }));
    fireEvent.change(screen.getByLabelText(/Type Alpha to confirm/), { target: { value: 'Alpha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete team' }));
    expect(h.del.mutate).toHaveBeenCalledWith('a', expect.anything());
  });
});

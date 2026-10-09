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

describe('Teams: list', () => {
  it('shows teams as cards with their roster size', () => {
    renderAt();
    const list = screen.getByRole('list', { name: 'Teams' });
    expect(within(list).getByText('Alpha')).toBeTruthy();
    expect(within(list).getAllByText('8').length).toBeGreaterThan(0);
  });

  it('says there are no teams yet, with the action that creates one', () => {
    h.page = page([], 0, 0);
    renderAt();
    expect(screen.getByText('No teams yet')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'New team' })[0]);
    expect(screen.getByRole('dialog', { name: 'New team' })).toBeTruthy();
  });

  it('says nothing matches a search, and clears it', () => {
    h.page = page([], 0, 0);
    renderAt('/teams-management?q=zzz');
    expect(screen.getByText('No matches')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByTestId('where').textContent).toBe('');
  });

  it('sorts by the chosen field through the URL', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Code' }));
    expect(h.lastQuery).toMatchObject({ sortBy: 'code', sortOrder: 'asc' });
    const search = screen.getByTestId('where').textContent ?? '';
    expect(search).toContain('sort=code');
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
    fireEvent.click(screen.getAllByRole('button', { name: 'New team' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));
    expect(await screen.findByText('Enter the team’s name.')).toBeTruthy();
    expect(screen.getByText('Enter a short code, e.g. LAL.')).toBeTruthy();
    expect(h.create.mutate).not.toHaveBeenCalled();
  });

  it('creates a team, upper-casing the code and leaving out blank fields', async () => {
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: 'New team' })[0]);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Charlie' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'cha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));
    await waitFor(() => expect(h.create.mutate).toHaveBeenCalledWith({ name: 'Charlie', code: 'CHA' }, expect.anything()));
  });

  it('keeps the dialog open with the server’s reason when it is refused', async () => {
    h.create.mutate = vi.fn((_b: unknown, opts: { onError: (e: Error) => void }) => opts.onError(new Error('A team with this code already exists.')));
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: 'New team' })[0]);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Charlie' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'ALP' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/already exists/));
  });
});

describe('Teams: delete', () => {
  it('waits for the real cascade counts before allowing the name to be typed', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha' }));
    expect(screen.getByText('Checking what this removes…')).toBeTruthy();
    expect(screen.getByLabelText(/Type Alpha to confirm/)).toBeDisabled();
  });

  it('says exactly what the cascade removes, once the counts arrive', () => {
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

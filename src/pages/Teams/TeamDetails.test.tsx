import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });

const h = vi.hoisted(() => ({
  team: null as unknown,
  players: null as unknown,
  update: { mutate: vi.fn(), isPending: false },
  del: { mutate: vi.fn(), isPending: false },
  setCaptain: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
  removePlayer: { mutate: vi.fn(), isPending: false },
  assign: { mutate: vi.fn(), isPending: false },
  create: { mutate: vi.fn(), isPending: false },
  upload: { mutate: vi.fn(), isPending: false },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api/hooks', () => ({
  useTeam: () => h.team,
  usePlayers: (teamId?: string, opts?: { unassigned?: boolean }) => (opts?.unassigned ? ok([]) : h.players),
  useUpdateTeam: () => h.update,
  useDeleteTeam: () => h.del,
  useSetTeamCaptain: () => h.setCaptain,
  useRemovePlayerFromTeam: () => h.removePlayer,
  useAssignPlayerToTeam: () => h.assign,
  useCreatePlayerForTeam: () => h.create,
  useUploadFile: () => h.upload,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => h.toast }));
vi.mock('../../hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: vi.fn(async () => true), dialogProps: { open: false, onClose: () => undefined, onConfirm: () => undefined, description: '' } }),
}));

import TeamDetails from './TeamDetails';

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}</div>;
}

function renderAt(path = '/teams-management/t1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/teams-management/:id" element={<TeamDetails />} /></Routes>
      <Where />
    </MemoryRouter>,
  );
}

const baseTeam = () => ({
  id: 't1',
  name: 'Sparks',
  code: 'SPK',
  coach: 'Pat Riley',
  tournamentTeams: [{ tournament: { id: 'tourn1', name: 'Summer Cup' } }],
  homeMatches: [{ tournamentId: 'tourn1', status: 'COMPLETED', homeScore: 80, awayScore: 70 }],
  awayMatches: [{ tournamentId: 'tourn1', status: 'COMPLETED', homeScore: 60, awayScore: 75 }],
});

beforeEach(() => {
  h.team = ok(baseTeam());
  h.players = ok([{ id: 'p1', firstName: 'Ana', lastName: 'Guard', position: 'POINT_GUARD', jerseyNumber: 7, isCaptain: true, nationality: 'USA' }]);
  h.update = { mutate: vi.fn(), isPending: false };
  h.del = { mutate: vi.fn(), isPending: false };
  h.setCaptain = { mutate: vi.fn(), isPending: false, variables: undefined };
  h.removePlayer = { mutate: vi.fn(), isPending: false };
  h.assign = { mutate: vi.fn(), isPending: false };
  h.create = { mutate: vi.fn(), isPending: false };
  h.upload = { mutate: vi.fn(), isPending: false };
  h.toast = { success: vi.fn(), error: vi.fn() };
});

describe('TeamDetails: real performance, not invented stats', () => {
  it('computes the record by tournament from the team’s own matches — 2 wins, 0 losses', () => {
    renderAt();
    const table = screen.getByRole('table', { name: 'Record by tournament' });
    const row = within(table).getByText('Summer Cup').closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    // Tournament, GP, W, L, PCT, PF, PA
    expect(cells[1].textContent).toBe('2'); // GP
    expect(cells[2].textContent).toBe('2'); // W
    expect(cells[3].textContent).toBe('0'); // L
    expect(cells[4].textContent).toBe('100.0'); // PCT
  });

  it('says a team with no tournaments has none, rather than showing invented history', () => {
    h.team = ok({ ...baseTeam(), tournamentTeams: [], homeMatches: [], awayMatches: [] });
    renderAt();
    expect(screen.getByText('This team isn’t in any tournament yet.')).toBeTruthy();
    expect(screen.queryByText(/Championship/)).toBeNull();
  });
});

describe('TeamDetails: roster and header', () => {
  it('shows the roster and lets Add player open the dialog', () => {
    renderAt();
    expect(screen.getByText('Ana Guard')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add player' }));
    expect(screen.getByRole('dialog', { name: 'Add a player' })).toBeTruthy();
  });

  it('opens the edit form pre-filled with the saved team', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Sparks');
  });
});

describe('TeamDetails: roster as cards or a table (Fix 126)', () => {
  it('shows the roster as photo cards by default — the pre-redesign experience, restored', () => {
    renderAt();
    expect(screen.getByRole('list', { name: 'Roster' })).toBeTruthy();
    expect(screen.getAllByRole('table')).toHaveLength(1); // only the record table, not a roster table
    expect(screen.getByRole('button', { name: /^Remove Ana Guard as captain$/ })).toBeTruthy();
  });

  it('switches to the table, where height/nationality are compared across columns', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'table' }));
    expect(screen.getAllByRole('table')).toHaveLength(2); // record table + roster table
    expect(screen.queryByRole('list', { name: 'Roster' })).toBeNull();
  });

  it('removing a player from the roster works the same from either view', async () => {
    h.removePlayer.mutate = vi.fn((_vars: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: /^Remove Ana Guard$/ }));
    await waitFor(() => expect(h.removePlayer.mutate).toHaveBeenCalledWith({ playerId: 'p1', teamId: 't1' }, expect.anything()));
  });
});

describe('TeamDetails: coaching staff (Fix 126)', () => {
  it('shows the head coach and assistant coach by name, from the team’s own real data', () => {
    h.team = ok({ ...baseTeam(), assistantCoach: 'Erik Spoelstra', country: 'USA' });
    renderAt();
    const section = screen.getByText('Coaching staff').closest('section, div')!;
    expect(within(section as HTMLElement).getByText('Pat Riley')).toBeTruthy();
    expect(within(section as HTMLElement).getByText('Erik Spoelstra')).toBeTruthy();
    expect(within(section as HTMLElement).getByText(/Assistant coach/)).toBeTruthy();
  });

  it('is left out entirely when the team has no coach on record, rather than showing an empty section', () => {
    h.team = ok({ ...baseTeam(), coach: undefined });
    renderAt();
    expect(screen.queryByText('Coaching staff')).toBeNull();
  });
});

describe('TeamDetails: delete', () => {
  it('shows the real cascade counts without a second request, from the already-loaded team', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete team?' });
    expect(within(dialog).getByText('1', { selector: 'strong' })).toBeTruthy(); // 1 tournament
    expect(within(dialog).getByText('2', { selector: 'strong' })).toBeTruthy(); // 2 matches
  });

  it('returns to the teams list once deleted', () => {
    h.del.mutate = vi.fn((_id: string, opts: { onSuccess: () => void }) => opts.onSuccess());
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.change(screen.getByLabelText(/Type Sparks to confirm/), { target: { value: 'Sparks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete team' }));
    expect(h.del.mutate).toHaveBeenCalledWith('t1', expect.anything());
    expect(screen.getByTestId('where').textContent).toBe('/teams-management');
  });
});

describe('TeamDetails: season at a glance and team information (restored from real data)', () => {
  it('shows games played, win %, home and away record and per-game points from the team’s own matches', () => {
    renderAt();
    const card = screen.getByText('Season at a glance').closest('div')!.parentElement!;
    expect(within(card).getByText('Games played').nextSibling?.textContent).toBe('2');
    expect(within(card).getByText('Win %').nextSibling?.textContent).toBe('100%');
    expect(within(card).getByText('Home record').nextSibling?.textContent).toBe('1–0');
    expect(within(card).getByText('Away record').nextSibling?.textContent).toBe('1–0');
    expect(within(card).getByText('Points per game').nextSibling?.textContent).toBe('77.5');
  });

  it('shows dashes, not zeros, before a team has played', () => {
    h.team = ok({ ...baseTeam(), homeMatches: [], awayMatches: [] });
    renderAt();
    const card = screen.getByText('Season at a glance').closest('div')!.parentElement!;
    expect(within(card).getByText('Win %').nextSibling?.textContent).toBe('—');
  });

  it('lists the team’s details, and the arena, founding year and contact email once the server sends them', () => {
    h.team = ok({ ...baseTeam(), country: 'USA', arena: 'Main Arena', foundedYear: 1999, contactEmail: 'a@b.test' });
    renderAt();
    const card = screen.getByText('Team information').closest('div')!.parentElement!;
    for (const t of ['USA', 'Main Arena', '1999', 'a@b.test']) expect(within(card).getAllByText(t).length).toBeGreaterThan(0);
  });
});

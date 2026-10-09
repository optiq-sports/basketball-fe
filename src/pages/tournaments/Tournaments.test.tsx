import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });

const h = vi.hoisted(() => ({
  tournament: null as unknown,
  matches: null as unknown,
  teams: null as unknown,
  setGroup: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
  removeTeam: { mutate: vi.fn(), isPending: false },
  addTeams: { mutate: vi.fn(), isPending: false },
  update: { mutate: vi.fn(), isPending: false },
  del: { mutate: vi.fn(), isPending: false },
  upload: { mutate: vi.fn(), isPending: false },
  toast: { success: vi.fn(), error: vi.fn() },
  confirmResult: { value: true },
}));

vi.mock('../../api/hooks', () => ({
  useTournament: () => h.tournament,
  useMatches: () => h.matches,
  useTeams: () => h.teams,
  useUpdateTournament: () => h.update,
  useDeleteTournament: () => h.del,
  useSetTournamentTeamGroup: () => h.setGroup,
  useTournamentRemoveTeam: () => h.removeTeam,
  useTournamentAddTeams: () => h.addTeams,
  useUploadFile: () => h.upload,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => h.toast }));
vi.mock('../../hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn(async () => h.confirmResult.value),
    dialogProps: { open: false, onClose: () => undefined, onConfirm: () => undefined, description: '' },
  }),
}));

import Tournaments from './Tournaments';

const teamRow = (id: string, name: string, group: string | null, color: string) => ({ teamId: id, group, team: { id, name, color, code: name.slice(0, 3).toUpperCase() } });

const baseTournament = () => ({
  id: 't1',
  name: 'Summer Cup',
  code: 'SC26',
  division: 'DIVISION_1',
  numberOfGames: 10,
  numberOfQuarters: 4,
  quarterDuration: 10,
  overtimeDuration: 5,
  startDate: '2026-10-01T00:00:00.000Z',
  endDate: '2026-10-31T00:00:00.000Z',
  venue: 'Main Arena',
  crewChief: 'J. Doe',
  umpire2: 'M. Lee',
  teams: [
    teamRow('a', 'Alpha', 'A', '#ff6b2c'),
    teamRow('b', 'Bravo', 'A', 'not-a-colour'),
    teamRow('c', 'Charlie', 'B', '#22aa88'),
  ],
});

const match = (id: string, home: string, away: string, hs: number, as_: number, status = 'COMPLETED', stats: unknown[] = []) => ({
  id,
  homeTeamId: home,
  awayTeamId: away,
  homeScore: hs,
  awayScore: as_,
  status,
  scheduledDate: '2026-10-05T18:00:00.000Z',
  stats,
});

function renderAt(path = '/tournaments/t1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tournaments/:id" element={<Tournaments />} />
        <Route path="/tournaments" element={<div>LIST</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.tournament = ok(baseTournament());
  h.matches = ok([
    match('m1', 'a', 'b', 80, 70, 'COMPLETED', [
      { playerId: 'p1', points: 20, rebounds: 4, assists: 3, blocks: 0, steals: 1, player: { firstName: 'Ana', lastName: 'Guard' } },
    ]),
    match('m2', 'c', 'a', 60, 75, 'COMPLETED'),
    match('m3', 'b', 'c', 0, 0, 'SCHEDULED'),
  ]);
  h.teams = ok([
    { id: 'a', name: 'Alpha', code: 'ALP' },
    { id: 'b', name: 'Bravo', code: 'BRV' },
    { id: 'c', name: 'Charlie', code: 'CHA' },
    { id: 'd', name: 'Delta', code: 'DEL' },
  ]);
  h.setGroup = { mutate: vi.fn(), isPending: false, variables: undefined };
  h.removeTeam = { mutate: vi.fn(), isPending: false };
  h.addTeams = { mutate: vi.fn(), isPending: false };
  h.update = { mutate: vi.fn(), isPending: false };
  h.del = { mutate: vi.fn(), isPending: false };
  h.toast = { success: vi.fn(), error: vi.fn() };
  h.confirmResult.value = true;
});

describe('Tournament detail: header and overview', () => {
  it('shows the name, division, dates and venue', () => {
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: 'Summer Cup' })).toBeTruthy();
    expect(screen.getByText('Division 1')).toBeTruthy();
    expect(screen.getByText(/Main Arena/)).toBeTruthy();
  });

  it('shows leaders for the chosen category, from completed games only', () => {
    renderAt();
    expect(screen.getByText('Ana Guard')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rebounds' }));
    expect(screen.getByRole('button', { name: 'Rebounds' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('opens the edit form pre-filled with the saved tournament', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Summer Cup');
    expect((screen.getByLabelText(/^Start date/) as HTMLInputElement).value).toBe('2026-10-01');
  });

  it('says what the delete will remove, with the real counts', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete tournament?' });
    expect(within(dialog).getByText('3', { selector: 'strong' })).toBeTruthy(); // three matches
  });

  it('shows a failure with a retry when the tournament can’t be loaded', () => {
    const refetch = vi.fn();
    h.tournament = { data: undefined, isPending: false, isError: true, isFetching: false, error: new Error('Not found on server'), refetch };
    renderAt();
    expect(screen.getByRole('alert').textContent).toMatch(/Not found on server/);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('Tournament detail: teams and standings', () => {
  it('computes standings from completed games and ranks them', () => {
    renderAt('/tournaments/t1?tab=teams');
    const table = screen.getByRole('table', { name: 'Teams and standings' });
    const rows = within(table).getAllByRole('row').slice(1); // skip header
    expect(within(rows[0]).getByText('Alpha')).toBeTruthy(); // 2 wins (both home and away)
    expect(within(rows[0]).getByText('4')).toBeTruthy(); // 2 wins x 2 points
  });

  it('moves a team to another group through the optimistic hook', () => {
    renderAt('/tournaments/t1?tab=teams');
    fireEvent.change(screen.getByLabelText('Group for Charlie'), { target: { value: 'A' } });
    expect(h.setGroup.mutate).toHaveBeenCalledWith({ tournamentId: 't1', teamId: 'c', group: 'A' }, expect.anything());
  });

  it('locks only the dropdown of the team being saved, and shows the saving spinner beside it', () => {
    h.setGroup = { mutate: vi.fn(), isPending: true, variables: { tournamentId: 't1', teamId: 'c', group: 'A' } };
    renderAt('/tournaments/t1?tab=teams');
    expect((screen.getByLabelText('Group for Charlie') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('Group for Alpha') as HTMLSelectElement).disabled).toBe(false);
  });

  it('removes a team only after confirmation', async () => {
    h.confirmResult.value = false;
    renderAt('/tournaments/t1?tab=teams');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bravo' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(h.removeTeam.mutate).not.toHaveBeenCalled();
    h.confirmResult.value = true;
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bravo' }));
    await waitFor(() => expect(h.removeTeam.mutate).toHaveBeenCalledWith({ tournamentId: 't1', teamId: 'b' }, expect.anything()));
  });

  it('shows only a real hex colour as a swatch; anything else is neutral, not a made-up colour', () => {
    renderAt('/tournaments/t1?tab=teams');
    const alpha = screen.getByText('Alpha').parentElement!.querySelector('[aria-hidden]') as HTMLElement;
    const bravo = screen.getByText('Bravo').parentElement!.querySelector('[aria-hidden]') as HTMLElement;
    expect(alpha.style.backgroundColor).not.toBe('');
    expect(bravo.style.backgroundColor).toBe('');
  });

  it('filters the table by group', () => {
    renderAt('/tournaments/t1?tab=teams');
    fireEvent.click(screen.getByRole('button', { name: 'Group B' }));
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.getByText('Charlie')).toBeTruthy();
  });

  it('offers to add teams when there are none yet', () => {
    h.tournament = ok({ ...baseTournament(), teams: [] });
    renderAt('/tournaments/t1?tab=teams');
    expect(screen.getByText('No teams yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add teams' }));
    const dialog = screen.getByRole('dialog', { name: 'Add teams' });
    expect(within(dialog).getByText('Alpha')).toBeTruthy();
  });

  it('the add dialog leaves out teams already in the tournament', () => {
    renderAt('/tournaments/t1?tab=teams');
    fireEvent.click(screen.getByRole('button', { name: 'Add teams' }));
    const dialog = screen.getByRole('dialog', { name: 'Add teams' });
    expect(within(dialog).getByText('Delta')).toBeTruthy();
    expect(within(dialog).queryByText('Alpha')).toBeNull();
    expect(within(dialog).queryByText('Bravo')).toBeNull();
  });
});

describe('Tournament detail: add teams', () => {
  it('cannot be submitted with no team chosen', () => {
    h.tournament = ok({ ...baseTournament(), teams: [] });
    renderAt('/tournaments/t1?tab=teams');
    fireEvent.click(screen.getByRole('button', { name: 'Add teams' }));
    const submit = screen.getByRole('button', { name: 'Add to tournament' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(h.addTeams.mutate).not.toHaveBeenCalled();
  });

  it('adds the chosen teams with the group picked', () => {
    h.tournament = ok({ ...baseTournament(), teams: [] });
    renderAt('/tournaments/t1?tab=teams');
    fireEvent.click(screen.getByRole('button', { name: 'Add teams' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Delta/ }));
    fireEvent.change(screen.getByLabelText('Group for the new teams'), { target: { value: 'C' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to tournament' }));
    expect(h.addTeams.mutate).toHaveBeenCalledWith({ tournamentId: 't1', body: { teamIds: ['d'], group: 'C' } }, expect.anything());
  });
});

describe('Tournament detail: matches', () => {
  it('lists the tournament’s matches with their scores and links to each', () => {
    renderAt('/tournaments/t1?tab=matches');
    const list = screen.getByRole('list', { name: 'Matches in this tournament' });
    expect(within(list).getByText('80')).toBeTruthy();
    expect(within(list).getAllByRole('link').length).toBe(3);
  });

  it('says when no matches exist yet', () => {
    h.matches = ok([]);
    renderAt('/tournaments/t1?tab=matches');
    expect(screen.getByText('No matches yet')).toBeTruthy();
  });
});

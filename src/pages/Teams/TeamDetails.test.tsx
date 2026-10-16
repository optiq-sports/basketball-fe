import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });

const h = vi.hoisted(() => ({
  team: null as unknown,
  players: null as unknown,
  teams: null as unknown,
  update: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
  del: { mutate: vi.fn(), isPending: false },
  setCaptain: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
  removePlayer: { mutate: vi.fn(), isPending: false },
  assign: { mutate: vi.fn(), isPending: false },
  create: { mutate: vi.fn(), isPending: false },
  updatePlayer: { mutate: vi.fn(), isPending: false },
  upload: { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api/hooks', () => ({
  useTeam: () => h.team,
  useTeams: () => h.teams,
  usePlayers: (teamId?: string, opts?: { unassigned?: boolean }) => (opts?.unassigned ? ok([]) : h.players),
  useUpdateTeam: () => h.update,
  useDeleteTeam: () => h.del,
  useSetTeamCaptain: () => h.setCaptain,
  useRemovePlayerFromTeam: () => h.removePlayer,
  useAssignPlayerToTeam: () => h.assign,
  useCreatePlayerForTeam: () => h.create,
  useUpdatePlayer: () => h.updatePlayer,
  useUploadFile: () => h.upload,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => h.toast }));
vi.mock('../../hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: vi.fn(async () => true), dialogProps: { open: false, onClose: () => undefined, onConfirm: () => undefined, description: '' } }),
}));

import TeamDetails from './TeamDetails';

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}{loc.search}</div>;
}

function renderAt(path = '/teams-management/t1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/teams-management/:id" element={<TeamDetails />} /></Routes>
      <Where />
    </MemoryRouter>,
  );
}

const match = (over: Record<string, unknown> = {}) => ({
  id: 'm1',
  tournamentId: 'tourn1',
  tournament: { id: 'tourn1', name: 'Summer Cup' },
  status: 'COMPLETED',
  scheduledDate: '2026-03-01T18:00:00.000Z',
  venue: 'Main Arena',
  ...over,
});

const baseTeam = () => ({
  id: 't1',
  name: 'Sparks',
  code: 'SPK',
  color: '#552583',
  coach: 'Pat Riley',
  tournamentTeams: [{ tournament: { id: 'tourn1', name: 'Summer Cup' } }],
  homeMatches: [match({ id: 'm1', homeScore: 80, awayScore: 70, awayTeam: { id: 't2', name: 'Riverside Kings', code: 'RVK', color: '#1D428A' } })],
  awayMatches: [match({ id: 'm2', homeScore: 60, awayScore: 75, scheduledDate: '2026-03-08T18:00:00.000Z', homeTeam: { id: 't3', name: 'Lakeside Owls', code: 'LSO', color: '#CE1141' } })],
});

/** The hero's stat tiles are a `<dl>`: each label's value is the `<dd>` right after it. */
const tile = (label: string) => screen.getByText(label).nextSibling?.textContent;

beforeEach(() => {
  localStorage.clear();
  h.team = ok(baseTeam());
  h.players = ok([{ id: 'p1', firstName: 'Ana', lastName: 'Guard', position: 'POINT_GUARD', jerseyNumber: 7, isCaptain: true, nationality: 'USA', teamId: 't1' }]);
  h.teams = ok([{ id: 't1', name: 'Sparks', code: 'SPK' }]);
  h.update = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
  h.del = { mutate: vi.fn(), isPending: false };
  h.setCaptain = { mutate: vi.fn(), isPending: false, variables: undefined };
  h.removePlayer = { mutate: vi.fn(), isPending: false };
  h.assign = { mutate: vi.fn(), isPending: false };
  h.create = { mutate: vi.fn(), isPending: false };
  h.updatePlayer = { mutate: vi.fn(), isPending: false };
  h.upload = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
  h.toast = { success: vi.fn(), error: vi.fn() };
});

describe('TeamDetails: the hero record is real, not invented', () => {
  it('shows games played, wins, losses, win %, per-game points and the streak from the team’s own matches', () => {
    renderAt();
    expect(tile('Games Played')).toBe('2');
    expect(tile('Wins')).toBe('2');
    expect(tile('Losses')).toBe('0');
    expect(tile('Win %')).toBe('100%');
    expect(tile('PPG')).toBe('77.5');
    expect(tile('PAPG')).toBe('65');
    expect(tile('Streak')).toBe('W2');
  });

  it('counts tournaments entered, in place of the championships the backend cannot know', () => {
    renderAt();
    expect(tile('Tournaments')).toBe('1');
    expect(screen.queryByText(/Championship/i)).toBeNull();
  });

  it('shows dashes, not zeros, before a team has played', () => {
    h.team = ok({ ...baseTeam(), homeMatches: [], awayMatches: [] });
    renderAt();
    expect(tile('Win %')).toBe('—');
    expect(tile('PPG')).toBe('—');
    expect(tile('Streak')).toBe('—');
  });

  it('leaves out a completed game still stored as 0–0, rather than counting an invented tie', () => {
    h.team = ok({ ...baseTeam(), homeMatches: [match({ homeScore: 0, awayScore: 0, awayTeam: { id: 't2', name: 'Riverside Kings' } })], awayMatches: [] });
    renderAt();
    expect(tile('Games Played')).toBe('0');
  });

  it('names the team, its code and where it plays', () => {
    h.team = ok({ ...baseTeam(), country: 'USA', state: 'California', foundedYear: 1947 });
    renderAt();
    expect(screen.getByRole('heading', { name: 'Sparks' })).toBeTruthy();
    expect(screen.getByText('SPK')).toBeTruthy();
    expect(screen.getByText('California, USA')).toBeTruthy();
    expect(screen.getByText('Founded: 1947')).toBeTruthy();
  });
});

describe('TeamDetails: tabs', () => {
  it('opens on Overview and puts a chosen tab in the URL', () => {
    renderAt();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.getByTestId('where').textContent).toContain('tab=history');
  });

  it('opens on the tab the URL asks for', () => {
    renderAt('/teams-management/t1?tab=stats');
    expect(screen.getByRole('tab', { name: 'Statistics' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('TeamDetails: match history is the team’s real games', () => {
  it('lists each finished game with the real opponent, score, tournament, venue and result', () => {
    renderAt('/teams-management/t1?tab=history');
    expect(screen.getByText('Riverside Kings')).toBeTruthy();
    expect(screen.getByText('Lakeside Owls')).toBeTruthy();
    expect(screen.getAllByText('Summer Cup').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Main Arena').length).toBe(2);
    expect(screen.getAllByText('Win')).toHaveLength(2);
    expect(screen.queryByText('Warriors')).toBeNull();
    expect(screen.queryByText('Bulls')).toBeNull();
  });

  it('puts the most recent game first', () => {
    renderAt('/teams-management/t1?tab=history');
    const names = screen.getAllByText(/Riverside Kings|Lakeside Owls/).map((n) => n.textContent);
    expect(names[0]).toBe('Lakeside Owls'); // 8 March, after the 1st
  });

  it('opens the match through a real link, so it can go in a new tab', () => {
    renderAt('/teams-management/t1?tab=history');
    const link = screen.getByText('Lakeside Owls').closest('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/tournaments/tourn1/match/m2');
    fireEvent.click(link);
    expect(screen.getByTestId('where').textContent).toBe('/tournaments/tourn1/match/m2');
  });

  it('says there are no finished games rather than inventing some', () => {
    h.team = ok({ ...baseTeam(), homeMatches: [], awayMatches: [] });
    renderAt('/teams-management/t1?tab=history');
    expect(screen.getByText(/No finished games yet/)).toBeTruthy();
  });
});

describe('TeamDetails: roster', () => {
  it('shows the squad as cards on Overview, with no action buttons there', () => {
    renderAt();
    expect(screen.getByRole('list', { name: 'Roster' })).toBeTruthy();
    expect(screen.getByText('Ana Guard')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Edit Ana Guard/ })).toBeNull();
  });

  it('manages the squad from the Players tab', () => {
    renderAt('/teams-management/t1?tab=players');
    expect(screen.getByRole('button', { name: /^Edit Ana Guard/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Remove Ana Guard from this team/ })).toBeTruthy();
  });

  it('switches the roster between cards and a table, and remembers the choice', () => {
    renderAt('/teams-management/t1?tab=players');
    expect(screen.getByRole('list', { name: 'Roster' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    const table = screen.getByRole('table', { name: 'Roster' });
    const row = within(table).getByText('Ana Guard').closest('tr') as HTMLElement;
    expect(within(row).getByText('7')).toBeTruthy();
    expect(within(row).getByText('Point guard')).toBeTruthy();
    expect(within(row).getByText('USA')).toBeTruthy();
    expect(within(row).getByRole('button', { name: /^Edit Ana Guard/ })).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Roster' })).toBeNull();
    expect(localStorage.getItem('roster_view')).toBe('table');
  });

  it('keeps the table roster read-only on Overview', () => {
    localStorage.setItem('roster_view', 'table');
    renderAt();
    expect(screen.getByRole('table', { name: 'Roster' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Edit Ana Guard/ })).toBeNull();
  });

  it('opens the add-player dialog', () => {
    renderAt('/teams-management/t1?tab=players');
    fireEvent.click(screen.getByRole('button', { name: 'Add Player' }));
    expect(screen.getByRole('dialog', { name: 'Add a player' })).toBeTruthy();
  });

  it('removes a player from this team', async () => {
    h.removePlayer.mutate = vi.fn((_vars: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());
    renderAt('/teams-management/t1?tab=players');
    fireEvent.click(screen.getByRole('button', { name: /^Remove Ana Guard from this team/ }));
    await waitFor(() => expect(h.removePlayer.mutate).toHaveBeenCalledWith({ playerId: 'p1', teamId: 't1' }, expect.anything()));
  });

  it('edits a player through the shared player form', () => {
    renderAt('/teams-management/t1?tab=players');
    fireEvent.click(screen.getByRole('button', { name: /^Edit Ana Guard/ }));
    expect(screen.getByRole('dialog', { name: 'Edit player' })).toBeTruthy();
    expect((screen.getByLabelText(/^First Name/) as HTMLInputElement).value).toBe('Ana');
  });

  it('shows the current captain in the captain picker, and can clear it', () => {
    renderAt('/teams-management/t1?tab=players');
    const select = screen.getByLabelText('Team captain') as HTMLSelectElement;
    expect(select.value).toBe('p1');
    fireEvent.change(select, { target: { value: '' } });
    expect(h.setCaptain.mutate).toHaveBeenCalledWith({ teamId: 't1', playerId: 'p1', body: { isCaptain: false } }, expect.anything());
  });

  it('sets a new captain', () => {
    h.players = ok([
      { id: 'p1', firstName: 'Ana', lastName: 'Guard', jerseyNumber: 7, teamId: 't1' },
      { id: 'p2', firstName: 'Bo', lastName: 'Forward', jerseyNumber: 9, teamId: 't1' },
    ]);
    renderAt('/teams-management/t1?tab=players');
    fireEvent.change(screen.getByLabelText('Team captain'), { target: { value: 'p2' } });
    expect(h.setCaptain.mutate).toHaveBeenCalledWith({ teamId: 't1', playerId: 'p2', body: { isCaptain: true } }, expect.anything());
  });

  it('says the roster is empty rather than showing a bare grid', () => {
    h.players = ok([]);
    renderAt('/teams-management/t1?tab=players');
    expect(screen.getByText(/No players on this team yet/)).toBeTruthy();
  });
});

describe('TeamDetails: statistics', () => {
  it('shows the real record by tournament where the old page showed invented seasons', () => {
    renderAt('/teams-management/t1?tab=stats');
    const table = screen.getByRole('table', { name: 'Record by tournament' });
    const row = within(table).getByText('Summer Cup').closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    // Tournament, Played, Wins, Losses, Win %, Points For, Points Against
    expect(cells[1].textContent).toBe('2');
    expect(cells[2].textContent).toBe('2');
    expect(cells[3].textContent).toBe('0');
    expect(cells[4].textContent).toBe('100.0%');
    expect(cells[5].textContent).toBe('155');
    expect(cells[6].textContent).toBe('130');
  });

  it('says a team with no tournaments has none, rather than showing invented history', () => {
    h.team = ok({ ...baseTeam(), tournamentTeams: [], homeMatches: [], awayMatches: [] });
    renderAt('/teams-management/t1?tab=stats');
    expect(screen.getByText('This team isn’t in any tournament yet.')).toBeTruthy();
  });
});

describe('TeamDetails: team information and coaching staff', () => {
  it('lists the team’s details, and the arena and contact email once the server sends them', () => {
    h.team = ok({ ...baseTeam(), country: 'USA', state: 'California', arena: 'Main Arena', contactEmail: 'a@b.test' });
    renderAt();
    const section = screen.getByText('Team information').closest('section')!;
    for (const t of ['Main Arena', 'a@b.test', 'USA', 'California']) {
      expect(within(section).getAllByText(t).length).toBeGreaterThan(0);
    }
    expect(within(section).getByText('Home record').nextSibling?.textContent).toBe('1–0');
    expect(within(section).getByText('Away record').nextSibling?.textContent).toBe('1–0');
  });

  it('shows the head coach and assistant coach by name, from the team’s own real data', () => {
    h.team = ok({ ...baseTeam(), assistantCoach: 'Erik Spoelstra', country: 'USA' });
    renderAt();
    const section = screen.getByText('Coaching staff').closest('section')!;
    expect(within(section).getByText('Pat Riley')).toBeTruthy();
    expect(within(section).getByText('Erik Spoelstra')).toBeTruthy();
    expect(within(section).getByText('Assistant coach')).toBeTruthy();
  });

  it('is left out entirely when the team has no coach on record, rather than showing an empty section', () => {
    h.team = ok({ ...baseTeam(), coach: undefined });
    renderAt();
    expect(screen.queryByText('Coaching staff')).toBeNull();
  });
});

describe('TeamDetails: edit and delete', () => {
  it('opens the edit form pre-filled with the saved team', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Sparks');
  });

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

  it('uploads a new logo and saves it on the team', async () => {
    h.upload.mutateAsync = vi.fn(async () => ({ url: 'https://cdn.test/logo.png' }));
    h.update.mutateAsync = vi.fn(async () => undefined);
    renderAt();
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Upload team logo'), { target: { files: [file] } });
    await waitFor(() => expect(h.update.mutateAsync).toHaveBeenCalledWith({ id: 't1', data: { logo: 'https://cdn.test/logo.png' } }));
  });
});

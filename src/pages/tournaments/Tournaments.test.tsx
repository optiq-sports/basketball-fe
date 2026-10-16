import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });

const h = vi.hoisted(() => ({
  tournament: null as unknown,
  matches: null as unknown,
  teams: null as unknown,
  statisticians: null as unknown,
  setGroup: { mutate: vi.fn(), isPending: false, variables: undefined as unknown },
  removeTeam: { mutate: vi.fn(), isPending: false },
  addTeams: { mutate: vi.fn(), isPending: false },
  update: { mutate: vi.fn(), isPending: false },
  del: { mutate: vi.fn(), isPending: false },
  upload: { mutate: vi.fn(), isPending: false },
  createMatch: { mutate: vi.fn(), isPending: false },
  toast: { success: vi.fn(), error: vi.fn() },
  confirmResult: { value: true },
}));

vi.mock('../../api/hooks', () => ({
  useTournament: () => h.tournament,
  useMatches: () => h.matches,
  useTeams: () => h.teams,
  useStatisticians: () => h.statisticians,
  useUpdateTournament: () => h.update,
  useDeleteTournament: () => h.del,
  useSetTournamentTeamGroup: () => h.setGroup,
  useTournamentRemoveTeam: () => h.removeTeam,
  useTournamentAddTeams: () => h.addTeams,
  useUploadFile: () => h.upload,
  useCreateMatch: () => h.createMatch,
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

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}{loc.search}</div>;
}

function renderAt(path = '/tournaments/t1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tournaments/:id" element={<Tournaments />} />
        <Route path="/tournaments" element={<div>LIST</div>} />
      </Routes>
      <Where />
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
  h.createMatch = { mutate: vi.fn(), isPending: false };
  h.statisticians = ok([{ id: 's1', name: 'Sam Scorer', email: 'sam@x.test' }]);
  h.toast = { success: vi.fn(), error: vi.fn() };
  h.confirmResult.value = true;
});

describe('Tournament detail: header and quick stats', () => {
  it('shows the name, dates and venue, with the flyer as a banner', () => {
    h.tournament = ok({ ...baseTournament(), flyer: 'https://cdn.test/flyer.png' });
    const { container } = renderAt();
    expect(screen.getByRole('heading', { level: 1, name: 'Summer Cup' })).toBeTruthy();
    expect(screen.getByText(/Main Arena/)).toBeTruthy();
    expect((container.querySelector('img') as HTMLImageElement).src).toBe('https://cdn.test/flyer.png');
  });

  it('counts teams, completed games, total games and the division', () => {
    renderAt();
    expect(screen.getByText('Teams').nextSibling?.textContent).toBe('3');
    expect(screen.getByText('Games played').nextSibling?.textContent).toBe('2');
    expect(screen.getByText('Total games').nextSibling?.textContent).toBe('10');
    expect(screen.getByText('Division').nextSibling?.textContent).toBe('Division 1');
  });

  it('opens the edit form pre-filled with the saved tournament', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Summer Cup');
    expect((screen.getByLabelText(/^Start date/) as HTMLInputElement).value).toBe('2026-10-01');
  });

  it('offers the full format and officials, not the handful of fields the old inline form had', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit tournament' });
    for (const label of [/^Division/, /^Quarter \(min\)/, /^Overtime \(min\)/, /^Crew chief/, /^Commissioner/]) {
      expect(within(dialog).getByLabelText(label)).toBeTruthy();
    }
  });

  it('says what the delete will remove, with the real counts', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete tournament' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete tournament?' });
    expect(within(dialog).getByText('3', { selector: 'strong' })).toBeTruthy(); // three matches
  });

  it('shows a failure with a retry when the tournament can’t be loaded', () => {
    const refetch = vi.fn();
    h.tournament = { data: undefined, isPending: false, isError: true, isFetching: false, error: new Error('Not found on server'), refetch };
    renderAt();
    expect(screen.getByText(/Not found on server/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('has no tournament-level code button: it let anyone who read it open the tournament’s only match without a real match key (Gap 52)', () => {
    renderAt();
    expect(screen.queryByText(/^Code /)).toBeNull();
    expect(screen.queryByRole('button', { name: /copy tournament code/i })).toBeNull();
  });
});

describe('Tournament detail: standings and its group tabs', () => {
  it('computes standings from completed games and ranks them', () => {
    renderAt();
    const table = screen.getByRole('table', { name: 'Standings' });
    const rows = within(table).getAllByRole('row').slice(1); // skip header
    expect(within(rows[0]).getByText('Alpha')).toBeTruthy(); // 2 wins, home and away
    expect(within(rows[0]).getByText('4')).toBeTruthy(); // 2 wins x 2 points
  });

  it('shows how many of the tournament’s games have been played', () => {
    renderAt();
    expect(screen.getByText('2/10 games played')).toBeTruthy();
  });

  it('offers tabs only for the groups the tournament actually uses', () => {
    renderAt();
    expect(screen.getByRole('button', { name: 'Group A' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Group B' })).toBeTruthy();
    // The old page hardcoded A/B/C/D whether or not any team was in them.
    expect(screen.queryByRole('button', { name: 'Group C' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Group D' })).toBeNull();
  });

  it('actually filters the standings by group, which the old tabs never did', () => {
    renderAt();
    const table = () => screen.getByRole('table', { name: /[Ss]tandings/ });
    expect(within(table()).getByText('Alpha')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Group B' }));
    expect(within(table()).queryByText('Alpha')).toBeNull();
    expect(within(table()).getByText('Charlie')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Group B standings' })).toBeTruthy();
  });

  it('keeps the chosen group in the URL', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Group B' }));
    expect(screen.getByTestId('where').textContent).toContain('group=B');
  });

  it('offers no group tabs at all when no team has been put in a group', () => {
    h.tournament = ok({ ...baseTournament(), teams: [teamRow('a', 'Alpha', null, '#ff6b2c')] });
    renderAt();
    expect(screen.queryByRole('group', { name: 'Filter standings by group' })).toBeNull();
  });
});

describe('Tournament detail: the schedule list', () => {
  it('lists every match with its venue and time, and links each to the match page', () => {
    renderAt();
    expect(screen.getByRole('button', { name: /Schedules \(3\)/ })).toBeTruthy();
    expect(screen.getAllByText('Main Arena').length).toBeGreaterThan(0);
  });

  it('opens the match page from a schedule row, through a real link', () => {
    renderAt();
    const link = screen.getByRole('link', { name: 'Open Alpha against Bravo' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/tournaments/t1/match/m1');
    fireEvent.click(link);
    expect(screen.getByTestId('where').textContent).toBe('/tournaments/t1/match/m1');
  });

  it('collapses and expands', () => {
    renderAt();
    const toggle = screen.getByRole('button', { name: /Schedules \(3\)/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('says when no matches exist yet', () => {
    h.matches = ok([]);
    renderAt();
    expect(screen.getByText('No matches scheduled yet.')).toBeTruthy();
  });

  it('gives a scheduled fixture a copy-code button, so it can be handed to a statistician right from here', () => {
    renderAt();
    expect(screen.getByRole('button', { name: /^Copy match code for/ })).toBeTruthy();
  });

  it('creates a fixture right here, not only by sending the admin to /fixtures (Fix 125)', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'New fixture' }));
    const dialog = screen.getByRole('dialog', { name: 'New fixture' });
    fireEvent.change(within(dialog).getByLabelText(/^Home team/), { target: { value: 'a' } });
    fireEvent.change(within(dialog).getByLabelText(/^Away team/), { target: { value: 'b' } });
    fireEvent.change(within(dialog).getByLabelText(/^Date/), { target: { value: '2026-11-01' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create fixture' }));
    await waitFor(() =>
      expect(h.createMatch.mutate).toHaveBeenCalledWith(expect.objectContaining({ tournamentId: 't1', homeTeamId: 'a', awayTeamId: 'b' }), expect.anything()),
    );
  });
});

describe('Tournament detail: the ongoing game panel', () => {
  it('shows a live game with its running score', () => {
    h.matches = ok([match('m9', 'a', 'b', 44, 41, 'LIVE')]);
    renderAt();
    expect(screen.getByText('Ongoing game')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('44')).toBeTruthy();
  });

  it('does not call a finished game ongoing, which the old panel did', () => {
    renderAt(); // fixtures are COMPLETED and SCHEDULED, none LIVE
    expect(screen.queryByText('Ongoing game')).toBeNull();
  });
});

describe('Tournament detail: leaders', () => {
  it('shows leaders for the chosen category, from completed games only', () => {
    renderAt();
    expect(screen.getByText('Ana Guard')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rebounds' }));
    expect(screen.getByRole('button', { name: 'Rebounds' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('opens the player’s own profile, not their stats in one arbitrary game', () => {
    renderAt();
    const link = screen.getByRole('link', { name: 'Open Ana Guard' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/players-management/p1');
    fireEvent.click(link);
    expect(screen.getByTestId('where').textContent).toBe('/players-management/p1');
  });

  it('says so when nothing has been recorded yet', () => {
    h.matches = ok([match('m3', 'b', 'c', 0, 0, 'SCHEDULED')]);
    renderAt();
    expect(screen.getByText('No stats recorded yet for this tournament.')).toBeTruthy();
  });
});

describe('Tournament detail: teams and groups', () => {
  it('moves a team to another group through the optimistic hook', () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('Group for Charlie'), { target: { value: 'A' } });
    expect(h.setGroup.mutate).toHaveBeenCalledWith({ tournamentId: 't1', teamId: 'c', group: 'A' }, expect.anything());
  });

  it('locks only the dropdown of the team being saved', () => {
    h.setGroup = { mutate: vi.fn(), isPending: true, variables: { tournamentId: 't1', teamId: 'c', group: 'A' } };
    renderAt();
    expect((screen.getByLabelText('Group for Charlie') as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText('Group for Alpha') as HTMLSelectElement).disabled).toBe(false);
  });

  it('removes a team only after confirmation', async () => {
    h.confirmResult.value = false;
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bravo' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(h.removeTeam.mutate).not.toHaveBeenCalled();
    h.confirmResult.value = true;
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bravo' }));
    await waitFor(() => expect(h.removeTeam.mutate).toHaveBeenCalledWith({ tournamentId: 't1', teamId: 'b' }, expect.anything()));
  });

  it('offers to add teams when there are none yet', () => {
    h.tournament = ok({ ...baseTournament(), teams: [] });
    renderAt();
    expect(screen.getByText('No teams yet')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Teams' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Add teams to tournament' });
    expect(within(dialog).getByText('Alpha')).toBeTruthy();
  });

  it('the add dialog leaves out teams already in the tournament', () => {
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Teams' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Add teams to tournament' });
    expect(within(dialog).getByText('Delta')).toBeTruthy();
    expect(within(dialog).queryByText('Alpha')).toBeNull();
    expect(within(dialog).queryByText('Bravo')).toBeNull();
  });
});

describe('Tournament detail: add teams', () => {
  it('cannot be submitted with no team chosen', () => {
    h.tournament = ok({ ...baseTournament(), teams: [] });
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Teams' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Add teams to tournament' });
    expect((within(dialog).getByRole('button', { name: 'Add Teams' }) as HTMLButtonElement).disabled).toBe(true);
    expect(h.addTeams.mutate).not.toHaveBeenCalled();
  });

  it('adds the chosen teams with the group picked', () => {
    h.tournament = ok({ ...baseTournament(), teams: [] });
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add Teams' })[0]);
    const dialog = screen.getByRole('dialog', { name: 'Add teams to tournament' });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Delta/ }));
    fireEvent.change(within(dialog).getByLabelText('Group for the new teams'), { target: { value: 'C' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Teams' }));
    expect(h.addTeams.mutate).toHaveBeenCalledWith({ tournamentId: 't1', body: { teamIds: ['d'], group: 'C' } }, expect.anything());
  });
});

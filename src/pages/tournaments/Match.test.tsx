import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });
const failed = (error: unknown): Q<never> => ({ data: undefined, isPending: false, isError: true, isFetching: false, error, refetch: vi.fn() });

const h = vi.hoisted(() => ({
  match: null as unknown,
  statisticians: null as unknown,
  box: null as unknown,
  shots: null as unknown,
  update: { mutate: vi.fn(), isPending: false },
  del: { mutate: vi.fn(), isPending: false },
  rebuild: { mutate: vi.fn(), isPending: false },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../api/hooks', () => ({
  useMatch: () => h.match,
  useStatisticians: () => h.statisticians,
  useUpdateMatch: () => h.update,
  useDeleteMatch: () => h.del,
}));
vi.mock('../../services/statdash/hooks', () => ({
  useBoxScoreProjection: () => h.box,
  useShotChartProjection: () => h.shots,
  useRebuildProjection: () => h.rebuild,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => h.toast }));

import GameScorePage from './Match';

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

const player = (id: string, first: string, last: string) => ({ playerId: id, player: { id, firstName: first, lastName: last } });
const matchBase = () => ({
  id: 'm1',
  tournamentId: 't1',
  homeTeamId: 'home',
  awayTeamId: 'away',
  homeScore: 81,
  awayScore: 77,
  quarter1Home: 20,
  quarter1Away: 18,
  quarter2Home: 25,
  quarter2Away: 23,
  status: 'COMPLETED',
  scheduledDate: '2026-10-10T18:00:00.000Z',
  venue: 'Main Arena',
  statisticianId: 's1',
  statistician: { name: 'Sam Scorer', email: 'sam@x.test' },
  tournament: { name: 'Summer Cup' },
  homeTeam: { id: 'home', name: 'Sparks', playerTeams: [player('p1', 'Ana', 'Guard')] },
  awayTeam: { id: 'away', name: 'Fresh Stars', playerTeams: [player('p2', 'Ben', 'Wing')] },
  gameSessions: [{ id: 'sess1', status: 'COMPLETED' }],
});

function renderAt(path = '/tournaments/t1/match/m1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tournaments/:id/match/:matchId" element={<GameScorePage />} />
        <Route path="/tournaments/:id/fixtures" element={<div>FIXTURES</div>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.match = ok(matchBase());
  h.statisticians = ok([{ id: 's1', name: 'Sam Scorer', email: 'sam@x.test' }, { id: 's2', name: 'Pat Count', email: 'pat@x.test' }]);
  h.box = ok({ players: { p1: { playerId: 'p1', points: 12, rebounds: 3, assists: 2, blocks: 0, steals: 1, fouls: 1, turnovers: 0 }, p2: { playerId: 'p2', points: 7, rebounds: 5, assists: 0, blocks: 1, steals: 0, fouls: 2, turnovers: 1 } }, totals: {}, totalEvents: 14 });
  h.shots = ok([{ eventId: 'e1', teamId: 'home', result: 'made', x: 0.5, y: 0.5 }]);
  h.update = { mutate: vi.fn(), isPending: false };
  h.del = { mutate: vi.fn(), isPending: false };
  h.rebuild = { mutate: vi.fn(), isPending: false };
  h.toast = { success: vi.fn(), error: vi.fn() };
});

describe('Match: scoreboard and assignment', () => {
  it('shows the score and the quarter scores', () => {
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: 'Sparks vs Fresh Stars' })).toBeTruthy();
    expect(screen.getByLabelText('Sparks 81, Fresh Stars 77')).toBeTruthy();
    const quarters = screen.getByRole('table', { name: 'Scores by quarter' });
    expect(within(quarters).getByText('20')).toBeTruthy();
  });

  it('shows who is scoring the game', () => {
    renderAt();
    expect(screen.getByText('Currently scoring: Sam Scorer')).toBeTruthy();
  });

  it('keeps Save off until the statistician is changed', () => {
    renderAt();
    expect((screen.getByRole('button', { name: 'Save statistician' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('assigns a different statistician', () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: 's2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save statistician' }));
    expect(h.update.mutate).toHaveBeenCalledWith({ id: 'm1', data: { statisticianId: 's2' } }, expect.anything());
  });

  it('unassigns by sending null, not an empty string', () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('Assign to'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save statistician' }));
    expect(h.update.mutate).toHaveBeenCalledWith({ id: 'm1', data: { statisticianId: null } }, expect.anything());
  });

  it('shows the code the statistician types to open this game, with a copy button', () => {
    renderAt();
    const code = screen.getByTestId('match-code').textContent ?? '';
    expect(code.length).toBeGreaterThan(0);
    expect(screen.getByText(/types this on the match key screen/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Copy match code for/ })).toBeInTheDocument();
  });

  it('uses the match key as the code when the match has one', () => {
    h.match = ok({ ...matchBase(), matchKey: 'KEY-42' });
    renderAt();
    expect(screen.getByTestId('match-code')).toHaveTextContent('KEY-42');
  });

  it('says a game has no statistician when none is assigned', () => {
    h.match = ok({ ...matchBase(), statisticianId: null, statistician: null });
    renderAt();
    expect(screen.getByText('No statistician is assigned to this game yet.')).toBeTruthy();
  });
});

describe('Match: game data', () => {
  it('splits the box score into the two teams by roster', () => {
    renderAt();
    const tables = screen.getAllByRole('table');
    const box = tables.filter((t) => within(t).queryByText('Ana Guard'));
    expect(box).toHaveLength(1);
    expect(within(box[0]).queryByText('Ben Wing')).toBeNull();
  });

  it('says there is no game data when the game has no session', () => {
    h.match = ok({ ...matchBase(), gameSessions: [] });
    renderAt();
    expect(screen.getByText('No game data yet')).toBeTruthy();
  });

  it('explains a 403 on the box score in plain words', () => {
    h.box = failed(Object.assign(new Error('Forbidden'), { status: 403 }));
    renderAt();
    expect(screen.getByRole('alert').textContent).toMatch(/can’t open the box score/);
  });

  it('opens the shot chart from the tab in the URL', () => {
    renderAt('/tournaments/t1/match/m1?tab=shots');
    expect(screen.getByRole('img', { name: /Shot chart: 1 shots shown/ })).toBeTruthy();
  });

  it('rebuilds the box score from the session’s recorded plays', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Rebuild box score' }));
    expect(h.rebuild.mutate).toHaveBeenCalledWith('sess1', expect.anything());
  });
});

describe('Match: delete', () => {
  it('needs the exact match label typed, and warns about a played game’s data', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete match' }));
    expect(screen.getByRole('dialog', { name: 'Delete fixture?' }).textContent).toMatch(/recorded game data/);
    const confirm = screen.getByRole('button', { name: 'Delete fixture' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Type Sparks vs Fresh Stars to confirm/), { target: { value: 'Sparks vs Fresh Stars' } });
    expect(confirm.disabled).toBe(false);
  });

  it('returns to the fixtures once deleted', () => {
    h.del.mutate = vi.fn((_id: string, opts: { onSuccess: () => void }) => opts.onSuccess());
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Delete match' }));
    fireEvent.change(screen.getByLabelText(/Type Sparks vs Fresh Stars to confirm/), { target: { value: 'Sparks vs Fresh Stars' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete fixture' }));
    expect(h.del.mutate).toHaveBeenCalledWith('m1', expect.anything());
    expect(screen.getByText('FIXTURES')).toBeTruthy();
  });
});

import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });
const failed = (error: unknown): Q<never> => ({ data: undefined, isPending: false, isError: true, isFetching: false, error, refetch: vi.fn() });

const h = vi.hoisted(() => ({
  match: null as unknown,
  statisticians: null as unknown,
  box: null as unknown,
  shots: null as unknown,
  timeline: { data: undefined, isPending: false, isError: true, error: Object.assign(new Error('Not Found'), { status: 404 }), refetch: () => undefined } as unknown,
  summary: { data: undefined, isPending: false, isError: false, refetch: () => undefined } as unknown,
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
  useSummaryProjection: () => h.summary,
  useTimelineProjection: () => h.timeline,
  timelineUnavailable: (e: unknown) => (e as { status?: number })?.status === 404,
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
  h.timeline = { data: undefined, isPending: false, isError: true, error: Object.assign(new Error('Not Found'), { status: 404 }), isFetching: false, refetch: vi.fn() };
  h.summary = ok(undefined);
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
    renderAt('/tournaments/t1/match/m1?tab=box');
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
    renderAt('/tournaments/t1/match/m1?tab=box');
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

describe('Match: overview and game stats (FIBA-style views)', () => {
  it('opens on the overview, with leaders, key stats and game information', () => {
    renderAt();
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Game leaders')).toBeTruthy();
    expect(screen.getByText('Key stats')).toBeTruthy();
    expect(screen.getByText('Game information')).toBeTruthy();
    expect(screen.getByText('Main Arena', { selector: 'dd' })).toBeTruthy();
  });

  it('names each team’s leading scorer, from its own roster', () => {
    renderAt();
    const leaders = screen.getByText('Game leaders').closest('div')!.parentElement!;
    expect(within(leaders).getByText('Ana Guard')).toBeTruthy();
    expect(within(leaders).getByText('Ben Wing')).toBeTruthy();
  });

  it('reads each stat out in words, not just bar lengths', () => {
    renderAt();
    expect(screen.getByText(/Points: Sparks 12, Fresh Stars 7/)).toBeTruthy();
    expect(screen.getByText(/Turnovers: Sparks 0, Fresh Stars 1/)).toBeTruthy();
  });

  it('shows field-goal shooting from the shot feed on the game stats tab, with a dash where nothing was attempted', () => {
    renderAt('/tournaments/t1/match/m1?tab=stats');
    expect(screen.getByText(/Field goal percentage: Sparks 100%, Fresh Stars none/)).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Shots made and attempted' });
    expect(within(table.querySelector('tbody')!.querySelectorAll('tr')[0] as HTMLElement).getByText('1/1')).toBeTruthy();
  });

  it('says plainly what the feed can’t show yet instead of leaving gaps unexplained', () => {
    renderAt('/tournaments/t1/match/m1?tab=stats');
    expect(screen.getByText(/lead tracker is built from every play/)).toBeTruthy();
  });

  it('can filter the shot chart down to one team', () => {
    renderAt('/tournaments/t1/match/m1?tab=shots');
    fireEvent.click(screen.getByRole('button', { name: 'Fresh Stars' }));
    expect(screen.getByRole('img', { name: /Shot chart: 0 shots shown/ })).toBeTruthy();
  });
});

describe('Match: the score on a finished game', () => {
  it('shows the game session’s score when the match record still reads 0 – 0 (Gap 55)', () => {
    h.match = ok({ ...matchBase(), homeScore: 0, awayScore: 0 });
    h.summary = ok({ score: { home: 20, away: 14 } });
    renderAt();
    expect(screen.getByLabelText('Sparks 20, Fresh Stars 14')).toBeTruthy();
  });

  it('falls back to the match record when the session score isn’t available', () => {
    renderAt();
    expect(screen.getByLabelText('Sparks 81, Fresh Stars 77')).toBeTruthy();
  });
});

describe('Match: quarter scores (restored, Fix 128)', () => {
  it('saves a quarter once both teams’ scores are entered', async () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('Sparks quarter 3'), { target: { value: '22' } });
    fireEvent.change(screen.getByLabelText('Fresh Stars quarter 3'), { target: { value: '19' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save quarter scores' }));
    await waitFor(() => expect(h.update.mutate).toHaveBeenCalledWith(
      { id: 'm1', data: expect.objectContaining({ quarter3Home: 22, quarter3Away: 19, quarter1Home: 20, quarter1Away: 18 }) },
      expect.anything(),
    ));
  });

  it('says so when a quarter has only one team’s score, and leaves it out', async () => {
    renderAt();
    fireEvent.change(screen.getByLabelText('Sparks quarter 4'), { target: { value: '5' } });
    expect(await screen.findByText(/Quarter 4 has only one team’s score/)).toBeTruthy();
  });

  it('won’t save before anything is changed', () => {
    renderAt();
    expect((screen.getByRole('button', { name: 'Save quarter scores' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Match: plays, lead tracker and advanced stats (Gap 53 / 54 contract)', () => {
  const plays = [
    { sequence: 1, eventType: 'shot', teamId: 'home', playerId: 'p1', period: 1, clockSecondsRemaining: 540, homeScore: 2, awayScore: 0, description: '2PtsFG jump shot made' },
    { sequence: 2, eventType: 'rebound', teamId: 'away', playerId: 'p2', period: 1, clockSecondsRemaining: 500, homeScore: 2, awayScore: 0, description: 'defensive rebound' },
    { sequence: 3, eventType: 'shot', teamId: 'away', playerId: 'p2', period: 1, clockSecondsRemaining: 400, homeScore: 2, awayScore: 3, description: '3PtsFG made' },
    { sequence: 4, eventType: 'period_end', teamId: null, playerId: null, period: 1, clockSecondsRemaining: 0, homeScore: 2, awayScore: 3, description: '' },
  ];
  const withPlays = () => { h.timeline = ok(plays); };

  it('says the feed isn’t available yet while the server can’t send plays', () => {
    renderAt('/tournaments/t1/match/m1?tab=plays');
    expect(screen.getByText('Play by play isn’t available yet')).toBeTruthy();
  });

  it('lists the plays newest first, with scoring plays lifted out and the period end as a banner', () => {
    withPlays();
    renderAt('/tournaments/t1/match/m1?tab=plays');
    const items = screen.getAllByRole('listitem');
    expect(items[0].textContent).toMatch(/End of period/);
    expect(items[1].textContent).toMatch(/Ben Wing/);
    expect(items[1].textContent).toMatch(/\+3/);
    expect(items[2].textContent).toMatch(/defensive rebound/);
    expect(items[3].textContent).toMatch(/Ana Guard/);
    expect(items[3].textContent).toMatch(/\+2/);
  });

  it('works out the quarter scores from the plays when the match record has none', () => {
    withPlays();
    h.match = ok({ ...matchBase(), quarter1Home: undefined, quarter1Away: undefined, quarter2Home: undefined, quarter2Away: undefined });
    renderAt();
    const table = screen.getByRole('table', { name: 'Scores by quarter' });
    expect(within(table).getByText('Q1')).toBeTruthy();
    expect(within(table).getAllByText('2').length).toBeGreaterThan(0);
  });

  it('shows the lead tracker’s story from the plays', () => {
    withPlays();
    renderAt('/tournaments/t1/match/m1?tab=stats');
    expect(screen.getByRole('img', { name: /Lead tracker: biggest lead Sparks 2, Fresh Stars 1; the lead changed hands 1 times/ })).toBeTruthy();
    expect(screen.getByText('lead changes')).toBeTruthy();
  });

  it('shows the advanced team stats the server sends, and only those', () => {
    h.summary = ok({ score: { home: 81, away: 77 }, advanced: { home: { pointsInPaint: 40, benchPoints: 12 }, away: { pointsInPaint: 30 } } });
    renderAt('/tournaments/t1/match/m1?tab=stats');
    expect(screen.getByText(/Points in the paint: Sparks 40, Fresh Stars 30/)).toBeTruthy();
    expect(screen.getByText(/Points from the bench: Sparks 12, Fresh Stars none/)).toBeTruthy();
    expect(screen.queryByText(/Fast break points:/)).toBeNull();
  });

  it('explains plainly when the server sends no advanced stats', () => {
    renderAt('/tournaments/t1/match/m1?tab=stats');
    expect(screen.getByText(/aren’t sent by the server yet/)).toBeTruthy();
  });
});

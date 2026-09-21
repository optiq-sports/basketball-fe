import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ProjectionState = { data?: Record<string, unknown>; isError?: boolean; dataUpdatedAt?: number };

const matchState: { current: Record<string, unknown> } = { current: {} };
const projectionState: { current: ProjectionState } = { current: {} };
const projectionArgs: { current: unknown[] } = { current: [] };

vi.mock('../../api/hooks', () => ({
  useMatch: () => ({ data: matchState.current, isPending: false, isError: false }),
}));
vi.mock('../../services/statdash', () => ({
  usePlayerGameProjection: (...args: unknown[]) => {
    projectionArgs.current = args;
    return { dataUpdatedAt: 0, ...projectionState.current };
  },
}));

import PlayerDetails from './PlayerDetails';

const baseMatch = {
  id: 'm1',
  status: 'LIVE',
  homeTeam: {
    name: 'Home FC',
    playerTeams: [{ playerId: 'p1', jerseyNumber: 7, player: { id: 'p1', firstName: 'Ada', lastName: 'Obi' } }],
  },
  awayTeam: { name: 'Away FC', playerTeams: [] },
  tournament: { name: 'Test Cup' },
  gameSessions: [{ id: 's1', status: 'IN_PROGRESS' }],
  stats: [{ playerId: 'p1', points: 2, rebounds: 1, assists: 0, blocks: 0, steals: 0, fouls: 0, turnovers: 0 }],
};

const line = { playerId: 'p1', points: 11, rebounds: 4, assists: 3, blocks: 1, steals: 2, fouls: 2, turnovers: 0 };

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tournaments/t1/match/m1/player/p1']}>
      <Routes>
        <Route path="/tournaments/:id/match/:matchId/player/:playerId" element={<PlayerDetails />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The value shown in a summary tile, found via its label. */
const tile = (label: string) => screen.getByText(label, { selector: 'div.text-sm' }).previousElementSibling?.textContent;

describe('PlayerDetails live stats', () => {
  beforeEach(() => {
    matchState.current = baseMatch;
    projectionState.current = { data: line, dataUpdatedAt: Date.now() };
  });

  it('shows the live projection (not the older saved record) with a LIVE indicator while the match is live', () => {
    renderPage();
    expect(tile('PTS')).toBe('11');
    expect(tile('REB')).toBe('4');
    expect(tile('AST')).toBe('3');
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText(/updating every 5 seconds/i)).toBeTruthy();
    expect(screen.queryByText(/live updates unavailable/i)).toBeNull();
  });

  it('asks for the projection of the session being played, polling only while live', () => {
    renderPage();
    expect(projectionArgs.current).toEqual(['s1', 'p1', { live: true }]);
  });

  it('warns that the numbers may be behind when the live projection cannot be loaded', () => {
    projectionState.current = { data: undefined, isError: true };
    renderPage();
    expect(tile('PTS')).toBe('2'); // falls back to the saved record
    expect(screen.getByText(/live updates unavailable/i)).toBeTruthy();
  });

  it('uses the saved record and shows no live indicator once the match is over', () => {
    matchState.current = { ...baseMatch, status: 'COMPLETED' };
    renderPage();
    expect(tile('PTS')).toBe('2');
    expect(screen.queryByText('Live')).toBeNull();
    expect(projectionArgs.current).toEqual(['s1', 'p1', { live: false }]);
  });

  it('shows a live game with no events yet as zeros rather than "no stats"', () => {
    projectionState.current = {
      data: { playerId: 'p1', points: 0, rebounds: 0, assists: 0, blocks: 0, steals: 0, fouls: 0, turnovers: 0 },
    };
    matchState.current = { ...baseMatch, stats: [] };
    renderPage();
    expect(tile('PTS')).toBe('0');
    expect(screen.queryByText(/no recorded stats/i)).toBeNull();
  });
});

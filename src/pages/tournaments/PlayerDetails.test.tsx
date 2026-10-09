import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ match: null as unknown }));
vi.mock('../../api/hooks', () => ({ useMatch: () => h.match }));
vi.mock('../../services/statdash', () => ({ usePlayerGameProjection: () => ({ data: undefined, dataUpdatedAt: 0, isError: false }) }));

import PlayerDetails from './PlayerDetails';

const q = (data: unknown, over: Record<string, unknown> = {}) => ({ data, isPending: false, isError: false, refetch: vi.fn(), ...over });

const match = {
  id: 'm1',
  status: 'COMPLETED',
  homeTeam: { name: 'MARKTOWN FLYERS', playerTeams: [{ playerId: 'p1', jerseyNumber: 7, player: { id: 'p1', firstName: 'ADA', lastName: 'OBI', position: 'POINT_GUARD', height: '6\'1"', dateOfBirth: '1998-04-02T00:00:00Z' } }] },
  awayTeam: { name: 'Riverside Kings', playerTeams: [] },
  tournament: { name: 'Summer Cup' },
  gameSessions: [{ id: 's1', status: 'COMPLETED' }],
  stats: [{ playerId: 'p1', points: 21, rebounds: 7, assists: 5, blocks: 1, steals: 2, fouls: 3, turnovers: 4 }],
};

const renderAt = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/tournaments/t1/match/m1/player/p1', state }]}>
      <Routes><Route path="/tournaments/:id/match/:matchId/player/:playerId" element={<PlayerDetails />} /></Routes>
    </MemoryRouter>,
  );

const tile = (label: string) => screen.getByText(label, { selector: 'div.text-sm' }).previousElementSibling?.textContent;

beforeEach(() => {
  h.match = q(match);
});

describe('Player in a game', () => {
  it('shows who they are, in normal case, and the game they played', () => {
    renderAt();
    expect(screen.getByRole('heading', { name: 'Ada Obi' })).toBeInTheDocument();
    expect(screen.getByText('#7')).toBeInTheDocument();
    expect(screen.getByText('Point guard')).toBeInTheDocument();
    expect(screen.getByText(/Marktown Flyers vs Riverside Kings/)).toBeInTheDocument();
  });

  it('shows the recorded line as tiles, including turnovers', () => {
    renderAt();
    expect(tile('PTS')).toBe('21');
    expect(tile('REB')).toBe('7');
    expect(tile('AST')).toBe('5');
    expect(tile('STL')).toBe('2');
    expect(tile('BLK')).toBe('1');
    expect(tile('PF')).toBe('3');
    expect(tile('TO')).toBe('4');
  });

  it('no longer repeats the one game as a Cumulative and an Average row', () => {
    renderAt();
    expect(screen.queryByText('Cumulative')).not.toBeInTheDocument();
    expect(screen.queryByText('Average')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('goes back to the match by default', () => {
    renderAt();
    expect(screen.getByRole('link', { name: /Match/ })).toHaveAttribute('href', '/tournaments/t1/match/m1');
  });

  it('goes back to where the visitor came from', () => {
    renderAt({ from: 'players-page' });
    expect(screen.getByRole('link', { name: /Players/ })).toHaveAttribute('href', '/players-management');
  });

  it('goes back to the tournament when it came from the leaders', () => {
    renderAt({ from: 'tournament-leaders', tournamentId: 't9' });
    expect(screen.getByRole('link', { name: /Tournament/ })).toHaveAttribute('href', '/tournaments/t9');
  });

  it('says so when this player has no stats in the game', () => {
    h.match = q({ ...match, stats: [] });
    renderAt();
    expect(screen.getByText(/No recorded stats for this player/)).toBeInTheDocument();
  });

  it('shows the error with a retry and a way back when the match will not load', () => {
    h.match = q(undefined, { isError: true });
    renderAt();
    expect(screen.getByText('Failed to load match data.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Match/ })).toBeInTheDocument();
  });
});

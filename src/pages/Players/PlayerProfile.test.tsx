import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ player: null as unknown, team: null as unknown }));
vi.mock('../../api/hooks', () => ({ usePlayer: () => h.player, useTeam: () => h.team }));

import PlayerProfile from './PlayerProfile';

const q = (data: unknown, over: Record<string, unknown> = {}) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn(), ...over });

const player = {
  id: 'p1',
  firstName: 'TEDDY',
  lastName: 'OKEREAFOR',
  position: 'POINT_GUARD',
  height: '6\'4"',
  nationality: 'Nigeria',
  dateOfBirth: '1996-03-05T00:00:00.000Z',
  jerseyNumber: 5,
  teamId: 't1',
  teamName: 'MARKTOWN FLYERS',
  isCaptain: true,
  recentMatches: [
    { matchId: 'm1', opponent: 'RIVERSIDE KINGS', scheduledDate: '2026-03-01T18:00:00Z', points: 20, rebounds: 6, assists: 4, blocks: 1, steals: 2, fouls: 3, turnovers: 1 },
    { matchId: 'm2', opponent: null, scheduledDate: null, points: 10, rebounds: 2, assists: 2, blocks: 0, steals: 0, fouls: 1, turnovers: 3 },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/players-management/p1']}>
      <Routes><Route path="/players-management/:playerId" element={<PlayerProfile />} /></Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  h.player = q(player);
  h.team = q({ id: 't1', name: 'Marktown Flyers' });
});

describe('Player profile', () => {
  it('shows who they are, with names in normal case', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Teddy Okereafor' })).toBeInTheDocument();
    expect(screen.getByText('#5')).toBeInTheDocument();
    expect(screen.getByText('Captain')).toBeInTheDocument();
    expect(screen.getByText('Point guard')).toBeInTheDocument();
    expect(screen.getByText('Nigeria')).toBeInTheDocument();
    expect(screen.getByText('Marktown Flyers')).toBeInTheDocument();
  });

  it('averages the recent games into the summary tiles', () => {
    renderPage();
    const ppg = screen.getByText('PPG').previousSibling as HTMLElement;
    expect(ppg).toHaveTextContent('15.0'); // (20 + 10) / 2
    expect(screen.getByText('RPG').previousSibling).toHaveTextContent('4.0');
  });

  it('lists each game with its opponent, and totals and averages beneath', () => {
    renderPage();
    expect(screen.getByText('vs Riverside Kings')).toBeInTheDocument();
    expect(screen.getByText('Game')).toBeInTheDocument(); // the one with no opponent
    const table = screen.getByRole('table');
    expect(within(table).getByText('Cumulative')).toBeInTheDocument();
    expect(within(table).getByText('Average')).toBeInTheDocument();
  });

  it('says so when they have no recorded games, with dashes in the tiles', () => {
    h.player = q({ ...player, recentMatches: [] });
    renderPage();
    expect(screen.getByText('No recorded games yet.')).toBeInTheDocument();
    expect(screen.getByText('PPG').previousSibling).toHaveTextContent('—');
  });

  it('shows No team for a player with none', () => {
    h.player = q({ ...player, teamId: null, teamName: null });
    h.team = q(undefined);
    renderPage();
    expect(screen.getByText('No team')).toBeInTheDocument();
  });

  it('links back to the players list', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /Players/ })).toHaveAttribute('href', '/players-management');
  });

  it('shows the error with a retry when the player will not load', () => {
    h.player = q(undefined, { isError: true, error: new Error('Player not found') });
    renderPage();
    expect(screen.getByText(/Player not found/)).toBeInTheDocument();
  });
});

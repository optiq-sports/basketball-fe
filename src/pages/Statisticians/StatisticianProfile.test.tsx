import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ stat: null as unknown, match: null as unknown }));

vi.mock('../../api/hooks', () => ({
  useStatistician: () => h.stat,
  useMatch: () => h.match,
}));

import ViewStat from './viewStat';
import MatchLookup from '../tournaments/MatchLookup';

const ok = <T,>(data: T) => ({ data, isPending: false, isError: false, error: null, refetch: vi.fn() });

const stat = {
  id: 's1',
  email: 'ada@example.com',
  name: 'Ada Eze',
  status: 'ACTIVE',
  profile: { fullName: 'Ada Eze', phone: '0801', country: 'Ghana', state: 'Accra', dobDay: 3, dobMonth: 2, dobYear: 1990, photos: [] },
  gamesOfficiated: [
    { matchId: 'm1', homeTeam: { name: 'MARKTOWN FLYERS' }, awayTeam: { name: 'Riverside Kings' }, scheduledDate: '2026-03-01T18:00:00Z', venue: 'Main Court' },
    { matchId: 'm2', homeTeam: null, awayTeam: null, scheduledDate: null, venue: null },
  ],
};

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/statisticians/s1']}>
      <Routes><Route path="/statisticians/:id" element={<ViewStat />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.stat = ok(stat);
});

describe('Statistician profile', () => {
  it('shows who they are', () => {
    renderProfile();
    expect(screen.getByRole('heading', { name: 'Ada Eze' })).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Accra, Ghana')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('lists the games they scored as links that look the tournament up', () => {
    renderProfile();
    const games = within(screen.getByRole('list'));
    const first = games.getAllByRole('link')[0];
    expect(first).toHaveAttribute('href', '/matches/m1');
    expect(within(first).getByText(/Marktown Flyers/)).toBeInTheDocument();
    expect(within(first).getByText(/Main Court/)).toBeInTheDocument();
    // a game with no teams, date or venue still renders something sensible
    expect(games.getAllByRole('link')[1]).toHaveTextContent('Home vs Away');
    expect(screen.getByText('Games scored', { selector: 'dt' }).nextSibling).toHaveTextContent('2');
  });

  it('never links to a hardcoded tournament', () => {
    renderProfile();
    for (const a of screen.getAllByRole('link')) expect(a.getAttribute('href')).not.toMatch(/tournaments\/1\//);
  });

  it('says when they have not scored anything', () => {
    h.stat = ok({ ...stat, gamesOfficiated: [] });
    renderProfile();
    expect(screen.getByText(/No games scored yet/)).toBeInTheDocument();
  });

  it('marks an inactive statistician', () => {
    h.stat = ok({ ...stat, status: 'INACTIVE' });
    renderProfile();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows the error with a retry', () => {
    h.stat = { data: undefined, isPending: false, isError: true, error: new Error('nope'), refetch: vi.fn() };
    renderProfile();
    expect(screen.getByText(/nope/)).toBeInTheDocument();
  });
});

describe('MatchLookup', () => {
  const renderLookup = () =>
    render(
      <MemoryRouter initialEntries={['/matches/m1']}>
        <Routes>
          <Route path="/matches/:matchId" element={<MatchLookup />} />
          <Route path="/tournaments/:id/match/:matchId" element={<div>match page</div>} />
        </Routes>
      </MemoryRouter>,
    );

  it("sends the visitor to the match's real tournament", () => {
    h.match = ok({ id: 'm1', tournamentId: 'tour-9' });
    renderLookup();
    expect(screen.getByText('match page')).toBeInTheDocument();
  });

  it('shows an error instead of guessing a tournament when the match is not found', () => {
    h.match = { data: undefined, isPending: false, isError: true, error: new Error('Match not found'), refetch: vi.fn() };
    renderLookup();
    expect(screen.getByText(/Match not found/)).toBeInTheDocument();
    expect(screen.queryByText('match page')).not.toBeInTheDocument();
  });
});

describe('Statistician with no name stored', () => {
  it('shows an initial from their email instead of a question mark', () => {
    h.stat = ok({ id: 's2', email: 'stat1@gmail.com', name: null, status: 'ACTIVE', profile: null, gamesOfficiated: [] });
    renderProfile();
    expect(screen.getByRole('heading', { name: 'stat1@gmail.com' })).toBeInTheDocument();
    expect(screen.queryByText('?')).not.toBeInTheDocument();
    expect(screen.getByText('S')).toBeInTheDocument();
  });
});

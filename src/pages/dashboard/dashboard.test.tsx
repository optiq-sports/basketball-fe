import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q = { data?: unknown; isPending: boolean; error: Error | null };
const done = (data: unknown): Q => ({ data, isPending: false, error: null });
const pending: Q = { data: undefined, isPending: true, error: null };

const h = vi.hoisted(() => ({
  profile: null as unknown,
  teams: null as unknown,
  live: null as unknown,
  scheduled: null as unknown,
  completed: null as unknown,
  tournaments: null as unknown,
}));

vi.mock('../../api/hooks', () => ({
  useProfile: () => h.profile,
  useTeams: () => h.teams,
  useTournaments: () => h.tournaments,
  useMatches: (_t: unknown, status: string) => (status === 'LIVE' ? h.live : status === 'SCHEDULED' ? h.scheduled : h.completed),
}));

import Dashboard from './dashboard';

const renderPage = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);

/** The big number in the tile with this label. */
const tileValue = (label: string) => within(screen.getByText(label).parentElement as HTMLElement).getAllByText(/./)[0];

beforeEach(() => {
  h.profile = done({ id: 'u1', email: 'a@x.com', role: 'ADMIN', name: 'Ada' });
  h.teams = done([{ id: 't1', name: 'A' }, { id: 't2', name: 'B' }]);
  h.live = done([]);
  h.scheduled = done([]);
  h.completed = done([]);
  h.tournaments = done([{ id: 'x', name: 'Cup' }]);
});

describe('Dashboard counters', () => {
  it('shows each count once it has loaded', () => {
    renderPage();
    expect(tileValue('Teams')).toHaveTextContent('2');
    expect(tileValue('Tournaments')).toHaveTextContent('1');
    expect(tileValue('Live now')).toHaveTextContent('0');
  });

  it('shows a dash, not a zero, while a count is still loading', () => {
    h.teams = pending;
    h.tournaments = pending;
    h.live = pending;
    h.scheduled = pending;
    renderPage();
    for (const label of ['Teams', 'Tournaments', 'Live now', 'Upcoming matches']) {
      expect(tileValue(label)).toHaveTextContent('—');
    }
  });

  it('a real zero shows as 0 once the answer is in', () => {
    h.scheduled = done([]);
    renderPage();
    expect(tileValue('Upcoming matches')).toHaveTextContent('0');
  });

  it('only the counts still loading show a dash', () => {
    h.teams = pending;
    renderPage();
    expect(tileValue('Teams')).toHaveTextContent('—');
    expect(tileValue('Tournaments')).toHaveTextContent('1');
  });
});

describe('Dashboard Start New', () => {
  const renderWithRoutes = () => {
    function Where() {
      const loc = useLocation();
      return <div data-testid="where">{loc.pathname + loc.search}</div>;
    }
    return render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('the header button opens the New tournament form', () => {
    renderWithRoutes();
    fireEvent.click(screen.getByRole('button', { name: /^Start New$/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/tournaments?new=1');
  });

  it('the Game Setup button does the same', () => {
    renderWithRoutes();
    fireEvent.click(screen.getByRole('button', { name: 'Game Setup' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/tournaments?new=1');
  });
});

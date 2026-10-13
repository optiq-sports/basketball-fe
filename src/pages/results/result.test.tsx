import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q = { data?: unknown; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = (data: unknown): Q => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });

type MatchesQ = { data?: Array<{ tournamentId: string }>; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const h = vi.hoisted(() => ({ matches: null as unknown, tournaments: null as unknown, lastArgs: null as unknown }));
vi.mock('../../api/hooks', () => ({
  // A real `useMatches(tournamentId, ...)` re-queries the server scoped to that tournament; this mock
  // does the same against the fixed list, so a tournament filter can realistically narrow it to nothing.
  useMatches: (tournamentId: string | undefined, status: unknown) => {
    h.lastArgs = { tournamentId, status };
    const q = h.matches as MatchesQ;
    if (!tournamentId || !q?.data) return q;
    return { ...q, data: q.data.filter((m) => m.tournamentId === tournamentId) };
  },
  useTournaments: () => h.tournaments,
}));

import Results from './result';

const match = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  tournamentId: 'tour-7',
  status: 'COMPLETED',
  homeScore: 88,
  awayScore: 79,
  scheduledDate: new Date(2026, 8, 21, 18, 0).toISOString(),
  venue: 'Main Court',
  tournament: { name: 'SUMMER CUP' },
  homeTeam: { name: 'MARKTOWN FLYERS' },
  awayTeam: { name: 'Riverside Kings' },
  ...over,
});

function Where() { return <div data-testid="where">{useLocation().search}</div>; }
const renderAt = (path = '/results') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/results" element={<Results />} /></Routes>
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => {
  h.matches = ok([
    match('m1'),
    match('m2', {
      scheduledDate: new Date(2026, 8, 17, 10, 0).toISOString(),
      homeScore: 60,
      awayScore: 70,
      homeTeam: { name: 'Charlie' },
      awayTeam: { name: 'Delta' },
    }),
  ]);
  h.tournaments = ok([{ id: 'tour-7', name: 'SUMMER CUP' }, { id: 'tour-8', name: 'Autumn Cup' }]);
});

describe('Results', () => {
  it('asks for every finished game, status COMPLETED, with no tournament filter by default', () => {
    renderAt();
    expect(h.lastArgs).toEqual({ tournamentId: undefined, status: 'COMPLETED' });
  });

  it('shows the real scores from homeScore and awayScore', () => {
    renderAt();
    const card = screen.getAllByRole('article')[0];
    expect(within(card).getByText('88')).toBeInTheDocument();
    expect(within(card).getByText('79')).toBeInTheDocument();
    expect(within(card).getByText('Marktown Flyers')).toBeInTheDocument();
  });

  it('puts each day under its own heading, newest day first', () => {
    renderAt();
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings).toHaveLength(2);
    expect(headings[0]).toHaveTextContent('21');
  });

  it('links each game to its own tournament, never a hardcoded one', () => {
    renderAt();
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/^\/tournaments\/tour-7\/match\/m[12]$/);
    }
  });

  it('filters by tournament, from the URL, and goes back to page 1', () => {
    renderAt('/results?page=3');
    fireEvent.change(screen.getByLabelText('Filter by tournament'), { target: { value: 'tour-8' } });
    expect(screen.getByTestId('where')).toHaveTextContent('tournament=tour-8');
    expect(screen.getByTestId('where')).not.toHaveTextContent('page=');
    expect(h.lastArgs).toEqual({ tournamentId: 'tour-8', status: 'COMPLETED' });
  });

  it('searches by team, venue or tournament over the full list — the backend ignores `search`, so this runs in the browser (Gap 33)', async () => {
    renderAt();
    fireEvent.change(screen.getByLabelText(/Search by team, venue or tournament/), { target: { value: 'riverside' } });
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('q=riverside'));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Riverside Kings')).toBeInTheDocument();
  });

  it('finds a game by its venue too', async () => {
    renderAt();
    fireEvent.change(screen.getByLabelText(/Search by team, venue or tournament/), { target: { value: 'main court' } });
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  });

  it('filters to one day, from the date picker, and goes back to page 1', async () => {
    renderAt('/results?page=2');
    fireEvent.change(screen.getByLabelText('Filter by date'), { target: { value: '2026-09-17' } });
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('date=2026-09-17'));
    expect(screen.getByTestId('where')).not.toHaveTextContent('page=');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('says so, with a way back, when no game was played on the chosen day', () => {
    renderAt('/results?date=2026-01-01');
    expect(screen.getByText('Nothing matches the current filters.')).toBeInTheDocument();
  });

  it('says there are no finished games yet', () => {
    h.matches = ok([]);
    renderAt();
    expect(screen.getByText('No finished games yet')).toBeInTheDocument();
  });

  it('says so, distinctly, when a tournament filter matches nothing — not the plain empty state', () => {
    renderAt('/results?tournament=tour-8');
    expect(screen.getByText('Nothing matches the current filters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(screen.getByTestId('where')).not.toHaveTextContent('tournament=');
  });

  it('shows the error with a retry', () => {
    h.matches = { ...ok(undefined), isError: true, error: new Error('boom') };
    renderAt();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it('shows the first page of 12 when there are more finished games than that', () => {
    h.matches = ok(Array.from({ length: 14 }, (_, i) => match(`m${i}`, { scheduledDate: new Date(2026, 8, 1 + i, 18, 0).toISOString() })));
    renderAt();
    expect(screen.getAllByRole('article')).toHaveLength(12);
  });

  it('paginates the filtered list in the browser, not from the server', () => {
    h.matches = ok(Array.from({ length: 14 }, (_, i) => match(`m${i}`, { scheduledDate: new Date(2026, 8, 1 + i, 18, 0).toISOString() })));
    renderAt('/results?page=2');
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });
});

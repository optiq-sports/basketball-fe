import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q = { data?: unknown; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = (data: unknown): Q => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });

const h = vi.hoisted(() => ({ page: null as unknown, tournaments: null as unknown, lastParams: null as unknown }));
vi.mock('../../api/hooks', () => ({
  useMatchesPage: (params: unknown) => { h.lastParams = params; return h.page; },
  useTournaments: () => h.tournaments,
}));

import Results from './result';

const meta = (itemCount: number, pageCount = 1, page = 1) => ({ page, limit: 12, itemCount, pageCount, hasPreviousPage: page > 1, hasNextPage: page < pageCount });
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
  h.page = ok({ items: [match('m1'), match('m2', { scheduledDate: new Date(2026, 8, 17, 10, 0).toISOString(), homeScore: 60, awayScore: 70 })], meta: meta(2) });
  h.tournaments = ok([{ id: 'tour-7', name: 'SUMMER CUP' }, { id: 'tour-8', name: 'Autumn Cup' }]);
});

describe('Results', () => {
  it('asks the server for finished games, newest first, one page at a time', () => {
    renderAt();
    expect(h.lastParams).toMatchObject({ status: 'COMPLETED', sortBy: 'scheduledDate', sortOrder: 'desc', page: 1, limit: 12 });
  });

  it('shows the real scores from homeScore and awayScore', () => {
    renderAt();
    const card = screen.getAllByRole('article')[0];
    expect(within(card).getByText('88')).toBeInTheDocument();
    expect(within(card).getByText('79')).toBeInTheDocument();
    expect(within(card).getByText('Marktown Flyers')).toBeInTheDocument();
  });

  it('puts each day under its own heading', () => {
    renderAt();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
  });

  it('links each game to its own tournament, never a hardcoded one', () => {
    renderAt();
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/^\/tournaments\/tour-7\/match\/m[12]$/);
    }
  });

  it('filters by tournament on the server, from the URL, and goes back to page 1', () => {
    renderAt('/results?page=3');
    fireEvent.change(screen.getByLabelText('Filter by tournament'), { target: { value: 'tour-8' } });
    expect(screen.getByTestId('where')).toHaveTextContent('tournament=tour-8');
    expect(screen.getByTestId('where')).not.toHaveTextContent('page=');
    expect(h.lastParams).toMatchObject({ tournamentId: 'tour-8', page: 1 });
  });

  it('reads the page from the URL', () => {
    renderAt('/results?page=2');
    expect(h.lastParams).toMatchObject({ page: 2 });
  });

  it('says there are no finished games yet', () => {
    h.page = ok({ items: [], meta: meta(0, 0) });
    renderAt();
    expect(screen.getByText('No finished games yet')).toBeInTheDocument();
  });

  it('says so when a tournament has none, with a way to clear the filter', () => {
    h.page = ok({ items: [], meta: meta(0, 0) });
    renderAt('/results?tournament=tour-8');
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.getByTestId('where')).not.toHaveTextContent('tournament=');
  });

  it('shows the error with a retry', () => {
    h.page = { ...ok(undefined), isError: true, error: new Error('boom') };
    renderAt();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it('has no search box, since the backend ignores search on matches', () => {
    renderAt();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });
});

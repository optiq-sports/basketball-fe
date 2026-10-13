import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ok = (data: unknown) => ({ data, isPending: false });
const h = vi.hoisted(() => ({ calls: 0 }));
vi.mock('../../api/hooks', () => ({
  useTournaments: () => { h.calls += 1; return ok([{ id: 't1', name: 'Summer Cup', venue: 'Main Arena' }]); },
  useTeams: () => ok([{ id: 'k1', name: 'Marktown Flyers', code: 'MTF', country: 'Nigeria' }]),
  usePlayers: () => ok([{ id: 'p1', firstName: 'Ana', lastName: 'Guard', teamName: 'Marktown Flyers', jerseyNumber: 7 }]),
}));

import GlobalSearch from './GlobalSearch';

function Where() { return <div data-testid="where">{useLocation().pathname}</div>; }
const renderIt = () => render(
  <MemoryRouter initialEntries={['/dashboard']}>
    <Routes><Route path="*" element={<GlobalSearch />} /></Routes>
    <Where />
  </MemoryRouter>,
);
const box = () => screen.getByRole('combobox', { name: /Search tournaments, teams and players/ });

beforeEach(() => { h.calls = 0; });

describe('GlobalSearch', () => {
  it('loads nothing until someone types, so it costs the other pages nothing', () => {
    renderIt();
    expect(h.calls).toBe(0);
    fireEvent.change(box(), { target: { value: 'mark' } });
    expect(h.calls).toBeGreaterThan(0);
  });

  it('groups what it finds under Tournaments, Teams and Players', () => {
    renderIt();
    fireEvent.change(box(), { target: { value: 'mark' } });
    expect(screen.getByRole('group', { name: 'Teams' })).toBeTruthy();
    expect(screen.getByRole('option', { name: /^Marktown Flyers/ })).toBeTruthy();
    expect(screen.getByRole('option', { name: /Ana Guard/ })).toBeTruthy();
  });

  it('opens the highlighted result with the keyboard', () => {
    renderIt();
    fireEvent.change(box(), { target: { value: 'ana' } });
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(screen.getByTestId('where').textContent).toBe('/players-management/p1');
  });

  it('moves down the results with the arrow keys', () => {
    renderIt();
    fireEvent.change(box(), { target: { value: 'mark' } });
    fireEvent.keyDown(box(), { key: 'ArrowDown' });
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(screen.getByTestId('where').textContent).toMatch(/^\/players-management\//);
  });

  it('opens a result when it is clicked', () => {
    renderIt();
    fireEvent.change(box(), { target: { value: 'summer' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Summer Cup/ }));
    expect(screen.getByTestId('where').textContent).toBe('/tournaments/t1');
  });

  it('says plainly when nothing matches', () => {
    renderIt();
    fireEvent.change(box(), { target: { value: 'zzzz' } });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it('closes on Escape, and ⌘K jumps back into the box', () => {
    renderIt();
    fireEvent.change(box(), { target: { value: 'mark' } });
    fireEvent.keyDown(box(), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    expect(document.activeElement).toBe(box());
  });
});

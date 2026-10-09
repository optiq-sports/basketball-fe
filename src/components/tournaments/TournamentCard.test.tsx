import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TournamentCard } from './TournamentCard';
import type { Tournament } from '../../types/api';

const base: Tournament = {
  id: 't1',
  name: 'SUMMER CUP',
  division: 'DIVISION_1',
  numberOfGames: 10,
  numberOfQuarters: 4,
  quarterDuration: 10,
  overtimeDuration: 5,
  startDate: '2026-10-01T00:00:00.000Z',
  endDate: '2026-10-31T00:00:00.000Z',
  venue: 'Main Arena',
  _count: { teams: 6, matches: 12 },
};

const renderCard = (tournament: Partial<Tournament> = {}) =>
  render(
    <MemoryRouter>
      <TournamentCard tournament={{ ...base, ...tournament }} onEdit={vi.fn()} onDelete={vi.fn()} />
    </MemoryRouter>,
  );

describe('TournamentCard', () => {
  it('normalizes a shouting name, and opens the tournament through one link', () => {
    renderCard();
    expect(screen.getByText('Summer Cup')).toBeTruthy();
    expect(screen.queryByText('SUMMER CUP')).toBeNull();
    expect(screen.getByRole('link', { name: 'Open Summer Cup' }).getAttribute('href')).toBe('/tournaments/t1');
  });

  it('shows the flyer as the banner when the tournament has one', () => {
    const { container } = renderCard({ flyer: 'https://example.test/flyer.png' });
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.src).toBe('https://example.test/flyer.png');
  });

  it('shows a plain banner, not a blank one, when there is no flyer', () => {
    const { container } = renderCard({ flyer: undefined });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy(); // the trophy mark
  });

  it('shows the division, dates, venue and counts', () => {
    renderCard();
    const card = screen.getByRole('link', { name: 'Open Summer Cup' }).closest('article')!;
    expect(within(card).getByText('Division 1')).toBeTruthy();
    expect(within(card).getByText('Main Arena')).toBeTruthy();
    expect(within(card).getByText('6')).toBeTruthy();
    expect(within(card).getByText('12')).toBeTruthy();
  });

  it('puts its actions outside the link, so a click on them doesn’t open the tournament', () => {
    renderCard();
    const link = screen.getByRole('link', { name: 'Open Summer Cup' });
    expect(within(link).queryByRole('button', { name: /Edit/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Summer Cup' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete Summer Cup' })).toBeTruthy();
  });
});

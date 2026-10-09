import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MatchCard, type MatchCardData } from './MatchCard';

const base: MatchCardData = {
  id: 'm1',
  home: { name: 'SPARKS', code: 'SPK' },
  away: { name: 'fresh stars', code: 'FS' },
  homeScore: 81,
  awayScore: 77,
  status: 'COMPLETED',
  scheduledDate: '2026-10-10T18:00:00.000Z',
  venue: 'Main Arena',
  eyebrow: 'SUMMER CUP',
};

const renderCard = (match: Partial<MatchCardData> = {}, actions?: React.ReactNode) =>
  render(
    <MemoryRouter>
      <MatchCard match={{ ...base, ...match }} href="/portal/matches/m1" actions={actions} />
    </MemoryRouter>,
  );

describe('MatchCard', () => {
  it('opens the match through one link named after both teams and the state', () => {
    renderCard();
    const link = screen.getByRole('link', { name: /Sparks versus Fresh Stars, Final/ });
    expect(link.getAttribute('href')).toBe('/portal/matches/m1');
  });

  it('normalizes a shouting or whispering team name for display, in the header and the team rows', () => {
    renderCard();
    expect(screen.getByText('Sparks')).toBeTruthy();
    expect(screen.getByText('Fresh Stars')).toBeTruthy();
    expect(screen.queryByText('SPARKS')).toBeNull();
    expect(screen.getByText('Summer Cup')).toBeTruthy(); // the eyebrow too
  });

  it('shows the scores once the game has started, and marks the winner', () => {
    renderCard();
    expect(screen.getByText('81')).toBeTruthy();
    expect(screen.getByText('77')).toBeTruthy();
    expect(screen.getByText('Sparks').className).toMatch(/font-bold/);
    expect(screen.getByText('Fresh Stars').className).not.toMatch(/font-bold/);
  });

  it('shows no scores before the game starts', () => {
    renderCard({ status: 'SCHEDULED', homeScore: 0, awayScore: 0 });
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.getAllByText('–')).toHaveLength(2);
  });

  it('marks a live game and labels it as live', () => {
    renderCard({ status: 'LIVE', homeScore: 40, awayScore: 38 });
    expect(screen.getByRole('link', { name: /Sparks versus Fresh Stars, Live/ })).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('puts its actions outside the link, so a click on them doesn’t open the match', () => {
    renderCard({}, <button type="button">Edit</button>);
    const link = screen.getByRole('link', { name: /Sparks versus/ });
    expect(within(link).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('says so when the venue hasn’t been set', () => {
    renderCard({ venue: null });
    expect(screen.getByText('Venue to be confirmed')).toBeTruthy();
  });

  it('shows a logo crest when the team has one, and initials when it does not', () => {
    const { container } = renderCard({ home: { name: 'Sparks', code: 'SPK', logo: 'https://example.test/sparks.png' } });
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.src).toBe('https://example.test/sparks.png');
    expect(screen.getByText('FS')).toBeTruthy(); // away team's initials, no logo
  });
});

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShotChartCourt, type ShotPoint } from './ShotChartCourt';

const shots: ShotPoint[] = [
  { eventId: 'a', teamId: 'home', result: 'made', x: 0.5, y: 0.5 },
  { eventId: 'b', teamId: 'away', result: 'missed', x: 0.2, y: 0.3 },
  { eventId: 'c', teamId: 'home', result: 'made', x: 1.4, y: 0.5 }, // outside the court: not drawn
  { eventId: 'd', teamId: 'home', result: 'made', x: null, y: null }, // no location: not drawn
];

describe('ShotChartCourt', () => {
  it('reports only the shots that have a valid court location', () => {
    render(<ShotChartCourt shots={shots} homeTeamId="home" />);
    expect(screen.getByRole('img', { name: 'Shot chart: 2 shots shown' })).toBeTruthy();
  });

  it('hides the quarter filter when the data carries no quarters', () => {
    render(<ShotChartCourt shots={shots} homeTeamId="home" />);
    expect(screen.queryByRole('group', { name: 'Quarter' })).toBeNull();
  });

  it('shows quarter filters when shots carry a period, and filters by it', () => {
    const withPeriods: ShotPoint[] = [
      { eventId: 'q1', teamId: 'home', result: 'made', x: 0.5, y: 0.5, period: 1 },
      { eventId: 'q2', teamId: 'home', result: 'made', x: 0.5, y: 0.5, period: 2 },
    ];
    render(<ShotChartCourt shots={withPeriods} homeTeamId="home" />);
    fireEvent.click(screen.getByRole('button', { name: 'Q2' }));
    expect(screen.getByRole('img', { name: 'Shot chart: 1 shots shown' })).toBeTruthy();
  });

  it('toggles made and missed shots independently', () => {
    render(<ShotChartCourt shots={shots} homeTeamId="home" />);
    fireEvent.click(screen.getByRole('button', { name: 'Missed' }));
    expect(screen.getByRole('img', { name: 'Shot chart: 1 shots shown' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Missed' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('says so when there are no locations at all', () => {
    render(<ShotChartCourt shots={[]} homeTeamId="home" />);
    expect(screen.getByText('No shot locations recorded yet.')).toBeTruthy();
  });
});

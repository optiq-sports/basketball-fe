import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoxScoreTable, percent, shotLine, type BoxScoreRow } from './BoxScoreTable';

const base: BoxScoreRow[] = [
  { playerId: 'p1', name: 'A. Guard', points: 16, rebounds: 4, assists: 3, steals: 2, blocks: 0, fouls: 2, turnovers: 1 },
  { playerId: 'p2', name: 'B. Wing', points: 9, rebounds: 7, assists: 1, steals: 0, blocks: 2, fouls: 4, turnovers: 3 },
];

describe('BoxScoreTable', () => {
  it('shows the core columns and sums the team totals from the rows', () => {
    render(<BoxScoreTable teamName="Sparks" rows={base} caption="Box score" />);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'PTS' })).toBeTruthy();
    const foot = table.querySelector('tfoot') as HTMLElement;
    expect(within(foot).getByText('25')).toBeTruthy(); // 16 + 9 points
    expect(within(foot).getByText('11')).toBeTruthy(); // 4 + 7 rebounds
  });

  it('leaves out advanced columns the backend has not sent yet, rather than showing empty ones', () => {
    render(<BoxScoreTable teamName="Sparks" rows={base} caption="Box score" />);
    expect(screen.queryByRole('columnheader', { name: 'MIN' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: '+/-' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'FG' })).toBeNull();
  });

  it('shows advanced columns once the data carries them, and does not sum minutes or plus/minus', () => {
    const rows: BoxScoreRow[] = [
      { ...base[0], secondsPlayed: 1440, fga: 10, fgm: 6, plusMinus: 5, eff: 14 },
      { ...base[1], secondsPlayed: 900, fga: 8, fgm: 3, plusMinus: -2, eff: 6 },
    ];
    render(<BoxScoreTable teamName="Sparks" rows={rows} caption="Box score" />);
    expect(screen.getByRole('columnheader', { name: 'MIN' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: '+/-' })).toBeTruthy();
    const foot = screen.getByRole('table').querySelector('tfoot') as HTMLElement;
    expect(within(foot).getByText('9/18 (50%)')).toBeTruthy(); // 6+3 made / 10+8 attempted
    expect(within(foot).getByText('20')).toBeTruthy(); // EFF is summed: 14 + 6
    // minutes and plus/minus totals are blank, as the stats reference specifies
    expect(within(foot).getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('says so when a team has no players recorded', () => {
    render(<BoxScoreTable teamName="Sparks" rows={[]} caption="Box score" />);
    expect(screen.getByText('No players recorded for this team.')).toBeTruthy();
  });
});

describe('BoxScoreTable player links', () => {
  const rows = [{ playerId: 'p1', name: 'Ada Obi', points: 10, rebounds: 2, assists: 1, steals: 0, blocks: 0, fouls: 1, turnovers: 0 }];

  it('links each player to the page you give it', async () => {
    const { MemoryRouter } = await import('react-router-dom');
    render(
      <MemoryRouter>
        <BoxScoreTable teamName="Home" rows={rows} caption="Box score" playerHref={(id) => `/player/${id}`} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Ada Obi' })).toHaveAttribute('href', '/player/p1');
  });

  it('shows plain names, and needs no router, when there is nowhere to link to', () => {
    render(<BoxScoreTable teamName="Home" rows={rows} caption="Box score" />);
    expect(screen.getByText('Ada Obi')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('shooting lines and percentages', () => {
  it('formats as the reference does: whole numbers plain, otherwise one decimal', () => {
    expect(percent(5, 10)).toBe('50');
    expect(percent(2, 7)).toBe('28.6');
    expect(percent(4, 5)).toBe('80');
    expect(percent(1, 3)).toBe('33.3');
    expect(percent(0, 4)).toBe('0');
    expect(percent(4, 4)).toBe('100');
  });

  it('shows made/attempted with the percentage, and just 0/0 when nothing was attempted', () => {
    expect(shotLine(5, 10)).toBe('5/10 (50%)');
    expect(shotLine(2, 7)).toBe('2/7 (28.6%)');
    expect(shotLine(0, 0)).toBe('0/0');
  });

  it('puts the line in each row and a combined team percentage in the totals', () => {
    const rows: BoxScoreRow[] = [
      { playerId: 'a', name: 'A', points: 12, rebounds: 1, assists: 0, steals: 0, blocks: 0, fouls: 0, turnovers: 0, fga: 10, fgm: 5, fta: 5, ftm: 4 },
      { playerId: 'b', name: 'B', points: 6, rebounds: 1, assists: 0, steals: 0, blocks: 0, fouls: 0, turnovers: 0, fga: 7, fgm: 2, fta: 0, ftm: 0 },
    ];
    render(<BoxScoreTable teamName="Sparks" rows={rows} caption="Box score" />);
    const table = screen.getByRole('table');
    const body = table.querySelector('tbody') as HTMLElement;
    const foot = table.querySelector('tfoot') as HTMLElement;
    expect(within(body).getByText('5/10 (50%)')).toBeTruthy();
    expect(within(body).getByText('2/7 (28.6%)')).toBeTruthy();
    expect(within(body).getByText('4/5 (80%)')).toBeTruthy();
    expect(within(body).getByText('0/0')).toBeTruthy(); // B took no free throws: no percentage to show
    expect(within(foot).getByText('7/17 (41.2%)')).toBeTruthy(); // team FG: 5+2 made of 10+7
    expect(within(foot).getByText('4/5 (80%)')).toBeTruthy(); // team FT: only A shot any
  });
});

describe('column order follows the stats reference', () => {
  const full: BoxScoreRow[] = [
    { playerId: 'a', name: 'A', points: 16, rebounds: 7, assists: 4, steals: 2, blocks: 1, fouls: 2, turnovers: 3,
      secondsPlayed: 1470, fga: 12, fgm: 7, twoPa: 6, twoPm: 4, threePa: 6, threePm: 3, fta: 6, ftm: 4, oreb: 2, dreb: 5, plusMinus: 5, eff: 22 },
  ];

  it('is MIN, PTS, FG, 2PT, 3PT, FT, REB, OREB, DREB, AST, STL, BLK, PF, TO, +/-, EFF after the player', () => {
    render(<BoxScoreTable teamName="Sparks" rows={full} caption="Box score" />);
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toEqual(['Player', 'MIN', 'PTS', 'FG', '2PT', '3PT', 'FT', 'REB', 'OREB', 'DREB', 'AST', 'STL', 'BLK', 'PF', 'TO', '+/-', 'EFF']);
  });

  it('shows whole minutes: 1,470 seconds is 24, not 24.5', () => {
    render(<BoxScoreTable teamName="Sparks" rows={full} caption="Box score" />);
    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('24')).toBeTruthy();
  });

  it('keeps the core columns in order when that is all the backend sends', () => {
    render(<BoxScoreTable teamName="Sparks" rows={base} caption="Box score" />);
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Player', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'PF', 'TO']);
  });
});

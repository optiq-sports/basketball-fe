import { describe, expect, it } from 'vitest';
import { sideColors } from './GameView';
import type { Match } from '../../types/api';

const m = (home?: string, away?: string) => ({ homeTeam: { color: home }, awayTeam: { color: away } }) as unknown as Match;

describe('sideColors', () => {
  it('uses each team’s own colour', () => {
    expect(sideColors(m('#aa0000', '#0000aa'))).toEqual({ home: '#aa0000', away: '#0000aa' });
  });

  it('replaces a white or missing colour, which would vanish on a bar, with a fallback', () => {
    const c = sideColors(m('#ffffff', undefined));
    expect(c.home).not.toBe('#ffffff');
    expect(c.away).toBeTruthy();
    expect(c.home).not.toBe(c.away);
  });

  it('never gives both teams the same colour', () => {
    const c = sideColors(m('#aa0000', '#AA0000'));
    expect(c.home.toLowerCase()).not.toBe(c.away.toLowerCase());
  });
});

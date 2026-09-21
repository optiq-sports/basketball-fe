import { describe, expect, it } from 'vitest';
import { swapPlayers, type TeamLineup } from './substitutionLineupUtils';

describe('swapPlayers', () => {
  const lineup: TeamLineup = { onCourt: [4, 5, 7, 9, 15], bench: [10, 23, 3] };

  it('puts the bench player in the same slot and sends the other to the bench', () => {
    expect(swapPlayers(lineup, 7, 10)).toEqual({ onCourt: [4, 5, 10, 9, 15], bench: [23, 3, 7] });
  });

  it('swapping back restores the original court and bench membership', () => {
    const there = swapPlayers(lineup, 7, 10);
    const back = swapPlayers(there, 10, 7);
    expect(back.onCourt).toEqual(lineup.onCourt);
    expect([...back.bench].sort((a, b) => a - b)).toEqual([...lineup.bench].sort((a, b) => a - b));
  });

  it('does not change the original', () => {
    swapPlayers(lineup, 7, 10);
    expect(lineup.onCourt).toEqual([4, 5, 7, 9, 15]);
  });
});

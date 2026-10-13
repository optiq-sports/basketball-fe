import { describe, expect, it } from 'vitest';
import { halfFilledQuarters, quarterScoresOf, quarterScoresSchema, toQuarterUpdate } from './quarter-scores-form';
import type { Match } from '../../types/api';

const blank = { q1Home: '', q1Away: '', q2Home: '', q2Away: '', q3Home: '', q3Away: '', q4Home: '', q4Away: '' };

describe('quarter scores form', () => {
  it('reads saved scores as text, with a blank for a quarter that has none', () => {
    const v = quarterScoresOf({ quarter1Home: 20, quarter1Away: 18, quarter2Home: null } as unknown as Match);
    expect(v.q1Home).toBe('20');
    expect(v.q2Home).toBe('');
    expect(v.q4Away).toBe('');
  });

  it('keeps a real 0 as 0, not blank', () => {
    expect(quarterScoresOf({ quarter1Home: 0, quarter1Away: 0 } as unknown as Match).q1Home).toBe('0');
  });

  it('sends only quarters with both sides filled in', () => {
    expect(toQuarterUpdate({ ...blank, q1Home: '20', q1Away: '18', q2Home: '9' })).toEqual({ quarter1Home: 20, quarter1Away: 18 });
  });

  it('sends a 0 – 0 quarter', () => {
    expect(toQuarterUpdate({ ...blank, q3Home: '0', q3Away: '0' })).toEqual({ quarter3Home: 0, quarter3Away: 0 });
  });

  it('names the quarters that have only one side', () => {
    expect(halfFilledQuarters({ ...blank, q2Home: '9', q4Away: '3', q1Home: '1', q1Away: '1' })).toEqual([2, 4]);
  });

  it('accepts blanks and whole numbers, rejects the rest', () => {
    expect(quarterScoresSchema.safeParse(blank).success).toBe(true);
    expect(quarterScoresSchema.safeParse({ ...blank, q1Home: '25' }).success).toBe(true);
    expect(quarterScoresSchema.safeParse({ ...blank, q1Home: '-3' }).success).toBe(false);
    expect(quarterScoresSchema.safeParse({ ...blank, q1Home: '2.5' }).success).toBe(false);
    expect(quarterScoresSchema.safeParse({ ...blank, q1Home: 'abc' }).success).toBe(false);
  });
});

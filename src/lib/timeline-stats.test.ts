import { describe, expect, it } from 'vitest';
import { clockText, leadSummary, periodLabel, periodScores } from './timeline-stats';
import type { TimelineEvent } from '../services/statdash/types';

let seq = 0;
const ev = (period: number, clock: number, homeScore: number, awayScore: number): TimelineEvent => ({
  sequence: ++seq, eventType: 'shot', teamId: null, playerId: null, period, clockSecondsRemaining: clock, homeScore, awayScore, description: '',
});

describe('periodScores', () => {
  it('splits the running score into what each team scored in each period', () => {
    const e = [ev(1, 300, 2, 0), ev(1, 10, 10, 8), ev(2, 400, 14, 8), ev(2, 0, 22, 15)];
    expect(periodScores(e)).toEqual([{ period: 1, home: 10, away: 8 }, { period: 2, home: 12, away: 7 }]);
  });
  it('is empty with no plays', () => expect(periodScores([])).toEqual([]));
});

describe('leadSummary', () => {
  // 10-minute quarters: a lead of 3 for home, a tie, then away ahead, then home again.
  const events = [ev(1, 540, 3, 0), ev(1, 480, 3, 3), ev(1, 420, 3, 5), ev(1, 360, 6, 5)];

  it('finds the biggest lead for each side', () => {
    const s = leadSummary(events);
    expect(s.biggestLead).toEqual({ home: 3, away: 2 });
  });

  it('counts a lead that passes through a tie as a change, and the tie separately', () => {
    const s = leadSummary(events);
    expect(s.leadChanges).toBe(2);
    expect(s.timesTied).toBe(1);
  });

  it('finds the longest unanswered run', () => {
    // away scored 3 then 2 with no reply
    expect(leadSummary(events).biggestRun).toEqual({ home: 3, away: 5 });
  });

  it('adds up the time each team was in front, and none while tied', () => {
    const s = leadSummary(events);
    // home led 60s (0:60 to 120s), tied 60s, away led 60s (180s to 240s)
    expect(s.timeLeading.home).toBe(60);
    expect(s.timeLeading.away).toBe(60);
  });

  it('puts overtime after regulation when working out elapsed time', () => {
    const s = leadSummary([ev(5, 290, 80, 78)], 600, 300);
    expect(s.series[0].elapsed).toBe(2400 + 10);
  });

  it('ignores plays that did not change the score', () => {
    expect(leadSummary([ev(1, 500, 0, 0), ev(1, 400, 0, 0)]).series).toEqual([]);
  });
});

describe('labels', () => {
  it('names periods', () => {
    expect(periodLabel(2)).toBe('Q2');
    expect(periodLabel(5)).toBe('OT');
    expect(periodLabel(6)).toBe('OT2');
  });
  it('formats a clock', () => expect(clockText(65)).toBe('1:05'));
});

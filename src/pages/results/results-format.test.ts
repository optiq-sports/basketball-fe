import { describe, expect, it } from 'vitest';
import { groupByDay } from './results-format';
import type { Match } from '../../types/api';

const m = (id: string, scheduledDate: string) => ({ id, scheduledDate }) as unknown as Match;
const local = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString();

describe('groupByDay', () => {
  it('puts games from the same day under one heading, newest day first', () => {
    const groups = groupByDay([m('a', local(2026, 9, 21, 20)), m('b', local(2026, 9, 21, 9)), m('c', local(2026, 9, 17, 10))]);
    expect(groups.map((g) => g.day)).toEqual(['2026-09-21', '2026-09-17']);
    expect(groups[0].matches.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('keeps a late-night game on the day it was played in the viewer’s time zone', () => {
    const groups = groupByDay([m('late', local(2026, 9, 21, 23, 30)), m('early', local(2026, 9, 22, 0, 15))]);
    expect(groups.map((g) => g.day)).toEqual(['2026-09-22', '2026-09-21']);
  });

  it('orders days even when the page arrives out of order', () => {
    const groups = groupByDay([m('old', local(2026, 1, 5, 12)), m('new', local(2026, 3, 5, 12))]);
    expect(groups.map((g) => g.day)).toEqual(['2026-03-05', '2026-01-05']);
  });

  it('puts a game with no usable date in its own group at the end, instead of dropping it', () => {
    const groups = groupByDay([m('bad', 'not a date'), m('ok', local(2026, 9, 21, 12))]);
    expect(groups.map((g) => g.day)).toEqual(['2026-09-21', 'unknown']);
    expect(groups[1].label).toBe('Date not set');
    expect(groups[1].matches[0].id).toBe('bad');
  });

  it('is empty for no games', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

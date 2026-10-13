import { z } from 'zod';
import type { Match, MatchUpdate } from '../../types/api';

export const QUARTERS = [1, 2, 3, 4] as const;
type Key = `q${1 | 2 | 3 | 4}${'Home' | 'Away'}`;
export type QuarterScoresValues = Record<Key, string>;

const score = z.string().trim().refine((v) => v === '' || (/^\d{1,3}$/.test(v)), 'Use a whole number from 0 to 999, or leave blank.');

export const quarterScoresSchema: z.ZodType<QuarterScoresValues, QuarterScoresValues> = z.object({
  q1Home: score, q1Away: score, q2Home: score, q2Away: score,
  q3Home: score, q3Away: score, q4Home: score, q4Away: score,
});

/** The match's saved quarter scores as form text; a quarter with no score is blank, not 0. */
export function quarterScoresOf(match: Match): QuarterScoresValues {
  const out = {} as QuarterScoresValues;
  for (const q of QUARTERS) {
    for (const side of ['Home', 'Away'] as const) {
      const v = match[`quarter${q}${side}`];
      out[`q${q}${side}`] = typeof v === 'number' ? String(v) : '';
    }
  }
  return out;
}

/**
 * Only quarters with both sides filled in are sent; the backend adds them up for the final score. A
 * half-filled quarter is left alone so a typo can't write a one-sided score.
 */
export function toQuarterUpdate(v: QuarterScoresValues): MatchUpdate {
  const out: MatchUpdate = {};
  for (const q of QUARTERS) {
    const h = v[`q${q}Home`];
    const a = v[`q${q}Away`];
    if (h === '' || a === '') continue;
    out[`quarter${q}Home`] = Number(h);
    out[`quarter${q}Away`] = Number(a);
  }
  return out;
}

/** Quarters where one side has a number and the other doesn't. */
export function halfFilledQuarters(v: QuarterScoresValues): number[] {
  return QUARTERS.filter((q) => (v[`q${q}Home`] === '') !== (v[`q${q}Away`] === ''));
}

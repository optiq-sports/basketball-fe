import { describe, expect, it } from 'vitest';
import { normalizeName } from './text';

describe('normalizeName', () => {
  it('title-cases a name stored in all caps', () => {
    expect(normalizeName('MARKTOWN FLYERS')).toBe('Marktown Flyers');
  });

  it('title-cases a name stored in all lowercase', () => {
    expect(normalizeName('fresh stars')).toBe('Fresh Stars');
  });

  it('leaves an already mixed-case name alone', () => {
    expect(normalizeName('Sparks')).toBe('Sparks');
    expect(normalizeName('McLaren Raptors')).toBe('McLaren Raptors');
  });

  it('capitalizes after an apostrophe or hyphen, not just whitespace', () => {
    expect(normalizeName("O'NEILL ALL-STARS")).toBe("O'Neill All-Stars");
  });

  it('handles blank input without throwing', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName(undefined)).toBe('');
    expect(normalizeName(null)).toBe('');
  });

  it('leaves a single-letter or symbol-only string alone', () => {
    expect(normalizeName('A')).toBe('A');
    expect(normalizeName('7')).toBe('7');
  });
});

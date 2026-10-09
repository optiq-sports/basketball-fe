import { describe, expect, it } from 'vitest';
import { clampLimit, formatMs, lagTone } from './queue-format';

describe('formatMs', () => {
  it('reads as a duration', () => {
    expect(formatMs(0)).toBe('—');
    expect(formatMs(450)).toBe('450ms');
    expect(formatMs(2500)).toBe('2.5s');
    expect(formatMs(125_000)).toBe('2m 5s');
    expect(formatMs(7_200_000)).toBe('2.0h');
  });
});

describe('lagTone', () => {
  it('flags slow and stuck queues', () => {
    expect(lagTone(0)).toBe('ok');
    expect(lagTone(10_000)).toBe('ok');
    expect(lagTone(10_001)).toBe('slow');
    expect(lagTone(60_001)).toBe('stuck');
  });
});

describe('clampLimit', () => {
  it('keeps the requeue limit inside what the page allows', () => {
    expect(clampLimit('50')).toBe(50);
    expect(clampLimit('0')).toBe(1);
    expect(clampLimit('-5')).toBe(1);
    expect(clampLimit('9999')).toBe(200);
    expect(clampLimit('7.9')).toBe(7);
  });
  it('falls back to the default for blank or junk', () => {
    expect(clampLimit('')).toBe(25);
    expect(clampLimit('abc')).toBe(25);
  });
});

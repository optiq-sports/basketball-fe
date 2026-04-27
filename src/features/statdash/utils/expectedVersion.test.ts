import {
  assertExpectedVersion,
  shouldApplyIncomingVersion,
} from './expectedVersion';

describe('expectedVersion helpers', () => {
  it('accepts non-negative integers', () => {
    expect(assertExpectedVersion(0)).toBe(0);
    expect(assertExpectedVersion(9)).toBe(9);
  });

  it('rejects invalid expected versions', () => {
    expect(() => assertExpectedVersion(-1)).toThrow();
    expect(() => assertExpectedVersion(1.5)).toThrow();
    expect(() => assertExpectedVersion('2')).toThrow();
  });

  it('applies only newer versions', () => {
    expect(shouldApplyIncomingVersion(5, 6)).toBe(true);
    expect(shouldApplyIncomingVersion(5, 5)).toBe(false);
    expect(shouldApplyIncomingVersion(5, 4)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { getRimPosition, isCourtClickThreePointer } from './courtThreePoint';
import { courtFeetToShot } from '../../lib/shot-coordinates';

/** A shot taken at a real spot on the court, in the form the app stores. */
const at = (xFt: number, yFt: number) => courtFeetToShot(xFt, yFt);
/** Home attacks the left basket by default, so these are measured from the left end. */
const isThree = (xFt: number, yFt: number, side: 'home' | 'away' = 'home', homeAttacksLeft = true) => {
  const { x, y } = at(xFt, yFt);
  return isCourtClickThreePointer(x, y, side, homeAttacksLeft);
};

describe('isCourtClickThreePointer, in real court feet (Bug 207)', () => {
  it('counts shots inside the arc as twos', () => {
    expect(isThree(5.25, 25)).toBe(false);  // at the rim
    expect(isThree(19, 25)).toBe(false);    // free-throw line
    expect(isThree(28, 25)).toBe(false);    // a foot inside the arc
    expect(isThree(10, 10)).toBe(false);    // in the paint area, off-centre
  });

  it('counts shots beyond the arc as threes', () => {
    expect(isThree(30, 25)).toBe(true);     // a foot beyond the top of the arc
    expect(isThree(40, 25)).toBe(true);     // well beyond
    expect(isThree(47, 25)).toBe(true);     // from half way
  });

  it('gets the corners right, where the line runs straight rather than curved', () => {
    expect(isThree(7, 1)).toBe(true);       // in the corner, outside the line
    expect(isThree(7, 49)).toBe(true);      // the other corner
    expect(isThree(7, 5)).toBe(false);      // same depth but inside the line
    expect(isThree(2, 2)).toBe(true);       // tight in the corner by the baseline
  });

  it('measures from the basket the shooting team is attacking', () => {
    // The same real position is a three at one end and deep in the other team's half at the other.
    expect(isThree(30, 25, 'home', true)).toBe(true);
    expect(isThree(94 - 30, 25, 'away', true)).toBe(true);
    // Flip the orientation and the ends swap.
    expect(isThree(30, 25, 'away', false)).toBe(true);
    expect(isThree(94 - 30, 25, 'home', false)).toBe(true);
  });

  it('does not call a shot near the arc for the far basket a three for this one', () => {
    // 64ft from the left baseline is just outside the right basket's arc, and nowhere near the left's.
    expect(isThree(64, 25, 'away', true)).toBe(true);
    expect(isThree(64, 25, 'home', true)).toBe(true); // it is 59ft from the left rim, so still a three
  });
});

describe('getRimPosition', () => {
  it('returns the rim in the stored form, matching the constant used before the redraw', () => {
    expect(getRimPosition('home', true).nx).toBeCloseTo(0.05593277881514174, 6);
    expect(getRimPosition('home', true).ny).toBeCloseTo(0.5, 6);
  });

  it('gives the other basket when the team attacks the other way', () => {
    const left = getRimPosition('home', true);
    const right = getRimPosition('home', false);
    expect(right.nx).toBeCloseTo(1 - left.nx, 9);
  });

  it('puts a putback at the rim, which is never a three', () => {
    const rim = getRimPosition('away', true);
    expect(isCourtClickThreePointer(rim.nx, rim.ny, 'away', true)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { shotToCourtFeet, courtFeetToShot, COURT_LENGTH_FT, COURT_WIDTH_FT } from './shot-coordinates';

/** A tap at a given point of StatDash's 620x380 court, as the fraction the app actually records. */
const tap = (viewBoxX: number, viewBoxY: number) => shotToCourtFeet(viewBoxX / 620, viewBoxY / 380);
const near = (got: number, want: number, tolerance = 0.05) => Math.abs(got - want) <= tolerance;

describe('shotToCourtFeet (Bug 207)', () => {
  it('puts a tap on each StatDash court feature onto the same feature of the real court', () => {
    // Left baseline, centre.
    expect(near(tap(16, 190).xFt, 0)).toBe(true);
    // The rim.
    expect(near(tap(0.05593277881514174 * 620, 190).xFt, 5.25)).toBe(true);
    // Front of the paint, which is the free-throw line.
    expect(near(tap(148, 190).xFt, 19)).toBe(true);
    // Top of the three-point arc: 5.25 to the rim plus a 23.75 radius.
    expect(near(tap(233, 190).xFt, 29)).toBe(true);
    // Half-way.
    expect(near(tap(310, 190).xFt, 47)).toBe(true);
  });

  it('maps the far half as the near half mirrored', () => {
    expect(near(tap(620 - 16, 190).xFt, COURT_LENGTH_FT)).toBe(true);
    expect(near(tap(620 - 148, 190).xFt, COURT_LENGTH_FT - 19)).toBe(true);
    expect(near(tap(620 - 233, 190).xFt, COURT_LENGTH_FT - 29)).toBe(true);
  });

  it('maps the sidelines, the corner three and the paint across the width', () => {
    expect(near(tap(100, 16).yFt, 0)).toBe(true);
    expect(near(tap(100, 58).yFt, 3)).toBe(true);
    expect(near(tap(100, 118).yFt, 17)).toBe(true);
    expect(near(tap(100, 190).yFt, 25)).toBe(true);
    expect(near(tap(100, 262).yFt, COURT_WIDTH_FT - 17)).toBe(true);
    expect(near(tap(100, 364).yFt, COURT_WIDTH_FT)).toBe(true);
  });

  it('puts a corner three outside the arc, where it used to land inside it', () => {
    // A tap in StatDash's corner-three strip: beyond the corner line, short of where the arc begins.
    const { xFt, yFt } = tap(100, 40);
    expect(xFt).toBeLessThan(14.2); // inside the straight part of the corner line
    expect(yFt).toBeLessThan(3); // and outside it, which makes it a three
    // The raw mapping this replaces put the same tap at 15.2ft, 5.3ft, inside the arc.
    expect(near((100 / 620) * 94, 15.16, 0.1)).toBe(true);
  });

  it('clamps a tap on the margin to the court rather than outside it', () => {
    expect(tap(0, 0).xFt).toBe(0);
    expect(tap(0, 0).yFt).toBe(0);
    expect(tap(620, 380).xFt).toBe(COURT_LENGTH_FT);
    expect(tap(620, 380).yFt).toBe(COURT_WIDTH_FT);
  });

  it('keeps the centre of the court at the centre', () => {
    const { xFt, yFt } = shotToCourtFeet(0.5, 0.5);
    expect(xFt).toBe(47);
    expect(yFt).toBe(25);
  });
});

describe('courtFeetToShot', () => {
  it('round-trips exactly, so a redrawn recording court can keep the stored format', () => {
    for (const [xFt, yFt] of [[0, 0], [5.25, 25], [19, 25], [29, 3], [47, 25], [70, 40], [94, 50]]) {
      const encoded = courtFeetToShot(xFt, yFt);
      const decoded = shotToCourtFeet(encoded.x, encoded.y);
      expect(decoded.xFt).toBeCloseTo(xFt, 6);
      expect(decoded.yFt).toBeCloseTo(yFt, 6);
    }
  });

  it('encodes the rim to the constant StatDash has always used for it', () => {
    expect(courtFeetToShot(5.25, 25).x).toBeCloseTo(0.05593277881514174, 6);
  });

  it('mirrors the far half', () => {
    const near = courtFeetToShot(19, 25);
    const far = courtFeetToShot(94 - 19, 25);
    expect(far.x).toBeCloseTo(1 - near.x, 9);
  });
});

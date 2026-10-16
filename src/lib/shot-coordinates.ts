/**
 * Maps a shot recorded in StatDash onto a real basketball court.
 *
 * StatDash records a court tap as a fraction of its own SVG element (`BasketballCourt.tsx`,
 * `viewBox 620x380`, playing area inset by 16 units). `ShotChartCourt` draws a true-scale court,
 * 94ft by 50ft, with the paint, the arc and the rim where they really are. Those two courts are not
 * the same shape, so plotting the raw fraction put shots in the wrong place (Bug 207): 3.4ft out at
 * the free-throw line, 6.3ft at the top of the arc, and 6.9ft at a corner three, which landed inside
 * the arc and read as a two. The rim and the half-way line were right, the first because the rim
 * constant was calibrated from a real tap and the second by symmetry, which is why only some shots
 * looked wrong.
 *
 * Two things are wrong with the raw fraction and both are corrected here. The 16-unit margin is not
 * part of the court, and the StatDash court is not drawn to scale: its playing area is 1.69 wide for
 * every 1 tall against a real 1.88, its paint is 22.4% of the court's length against a real 20.2%,
 * and its arc reaches 36.9% against a real 30.9%.
 *
 * The correction is an anchored piecewise-linear map. Each anchor pairs a feature's position in
 * StatDash with the same feature's position on a real court, so a tap on StatDash's free-throw line
 * lands on the chart's free-throw line, and a tap between two features is interpolated. Both courts
 * are symmetrical, so the anchors cover one half and the other is mirrored.
 *
 * This runs at render rather than at capture on purpose. Shots already recorded carry no marker
 * saying which space they are in, so correcting at capture would fix new games and leave every
 * existing one wrong, with no way to tell them apart afterwards. Correcting here fixes both.
 *
 * If StatDash's court is ever redrawn to true proportions, this map has to go in the same change, or
 * the new coordinates will be corrected twice.
 */

/** StatDash normalised x, paired with the real court position in feet. Left half; right is mirrored. */
const X_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [16 / 620, 0],      // baseline
  [0.05593277881514174, 5.25], // rim, the calibrated constant from courtThreePoint.ts
  [148 / 620, 19],    // free-throw line, front of the paint
  [233 / 620, 29],    // top of the three-point arc (5.25 + 23.75)
  [0.5, 47],          // half-way line
];

/** The same for y. Top half; the bottom is mirrored. */
const Y_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [16 / 380, 0],      // sideline
  [58 / 380, 3],      // where the corner three meets the baseline
  [118 / 380, 17],    // edge of the paint
  [0.5, 25],          // centre
];

/** The inverse of `interpolate`: feet back to the StatDash fraction that would have produced them. */
function interpolateInverse(feet: number, anchors: ReadonlyArray<readonly [number, number]>): number {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];

  if (feet <= first[1]) {
    const next = anchors[1];
    const slope = (next[0] - first[0]) / (next[1] - first[1]);
    return first[0] + (feet - first[1]) * slope;
  }

  for (let i = 1; i < anchors.length; i += 1) {
    const prev = anchors[i - 1];
    const curr = anchors[i];
    if (feet <= curr[1]) {
      const t = (feet - prev[1]) / (curr[1] - prev[1]);
      return prev[0] + t * (curr[0] - prev[0]);
    }
  }
  return last[0];
}

/** Interpolates through the anchors, extending the end segments for taps outside the court lines. */
function interpolate(value: number, anchors: ReadonlyArray<readonly [number, number]>): number {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];

  if (value <= first[0]) {
    const next = anchors[1];
    const slope = (next[1] - first[1]) / (next[0] - first[0]);
    return first[1] + (value - first[0]) * slope;
  }

  for (let i = 1; i < anchors.length; i += 1) {
    const prev = anchors[i - 1];
    const curr = anchors[i];
    if (value <= curr[0]) {
      const t = (value - prev[0]) / (curr[0] - prev[0]);
      return prev[1] + t * (curr[1] - prev[1]);
    }
  }
  return last[1];
}

/** Mirrors a half-court map onto the far half, which is the near half turned around the centre. */
function mapAxis(value: number, anchors: ReadonlyArray<readonly [number, number]>, length: number): number {
  const feet = value <= 0.5 ? interpolate(value, anchors) : length - interpolate(1 - value, anchors);
  return Math.min(length, Math.max(0, feet));
}

export const COURT_LENGTH_FT = 94;
export const COURT_WIDTH_FT = 50;

/**
 * A shot's position in feet on a 94 by 50 court, from the 0-to-1 pair StatDash recorded.
 * The result is clamped to the court, so a tap on the margin sits on the line rather than outside it.
 */
export function shotToCourtFeet(x: number, y: number): { xFt: number; yFt: number } {
  return {
    xFt: mapAxis(x, X_ANCHORS, COURT_LENGTH_FT),
    yFt: mapAxis(y, Y_ANCHORS, COURT_WIDTH_FT),
  };
}

/** Mirrors the inverse onto the far half, matching `mapAxis`. */
function mapAxisInverse(feet: number, anchors: ReadonlyArray<readonly [number, number]>, length: number): number {
  const half = length / 2;
  return feet <= half ? interpolateInverse(feet, anchors) : 1 - interpolateInverse(length - feet, anchors);
}

/**
 * The inverse of `shotToCourtFeet`: a real court position, back into the fraction StatDash has always
 * stored.
 *
 * This is what lets the recording court be redrawn to true proportions without a backend change. The
 * statistician taps a court that is finally the right shape, the tap is read in feet, and this encodes
 * it into the same space every shot has been written in since the beginning. Old and new shots then
 * mean the same thing, so nothing has to distinguish them and nothing has to be migrated.
 *
 * The map is piecewise linear and strictly increasing through its anchors, so this inverse is exact.
 */
export function courtFeetToShot(xFt: number, yFt: number): { x: number; y: number } {
  return {
    x: mapAxisInverse(xFt, X_ANCHORS, COURT_LENGTH_FT),
    y: mapAxisInverse(yFt, Y_ANCHORS, COURT_WIDTH_FT),
  };
}

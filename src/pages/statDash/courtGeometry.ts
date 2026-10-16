/**
 * The recording court, drawn to the proportions of a real basketball court.
 *
 * The drawing used to be a schematic: a 620 by 380 box with the court filling it, which made the
 * playing area 1.69 wide for every 1 tall where a real court is 1.88, and put the paint and the arc at
 * the wrong distances. A statistician aiming at the arc was aiming at a line that was not where the
 * real one is (Bug 207).
 *
 * The viewBox stays 620 by 380 so the surrounding layout does not move. The court is drawn true to
 * scale inside it and centred, which leaves a little room above and below.
 */

export const VIEWBOX_W = 620;
export const VIEWBOX_H = 380;

export const COURT_LENGTH_FT = 94;
export const COURT_WIDTH_FT = 50;

/** The court spans the same horizontal extent the old drawing did, so the court still fills the width. */
const COURT_X0 = 16;
const COURT_W = 588;
/** One foot, in viewBox units. Both axes share it, which is what makes the drawing true to scale. */
export const FT = COURT_W / COURT_LENGTH_FT;
const COURT_H = COURT_WIDTH_FT * FT;
const COURT_Y0 = (VIEWBOX_H - COURT_H) / 2;

export const COURT_RECT = { x: COURT_X0, y: COURT_Y0, width: COURT_W, height: COURT_H };

/** A point on the court, in feet, as viewBox coordinates. */
export const vx = (ft: number): number => COURT_X0 + ft * FT;
export const vy = (ft: number): number => COURT_Y0 + ft * FT;

/** A tap on the court element, as a 0-to-1 fraction of it, in feet. Clamped to the court. */
export function elementFractionToFeet(nx: number, ny: number): { xFt: number; yFt: number } {
  const xFt = (nx * VIEWBOX_W - COURT_X0) / FT;
  const yFt = (ny * VIEWBOX_H - COURT_Y0) / FT;
  return {
    xFt: Math.min(COURT_LENGTH_FT, Math.max(0, xFt)),
    yFt: Math.min(COURT_WIDTH_FT, Math.max(0, yFt)),
  };
}

/** The reverse, for placing a marker whose position is known in feet. */
export function feetToElementFraction(xFt: number, yFt: number): { nx: number; ny: number } {
  return { nx: vx(xFt) / VIEWBOX_W, ny: vy(yFt) / VIEWBOX_H };
}

/** Real court dimensions, in feet, used by both the drawing and the three-point test. */
export const COURT = {
  rimX: 5.25,
  rimY: COURT_WIDTH_FT / 2,
  rimRadius: 0.75,
  backboardX: 4,
  restrictedRadius: 4,
  paintDepth: 19,
  paintHalfWidth: 8,
  ftCircleRadius: 6,
  centreCircleRadius: 6,
  threeRadius: 23.75,
  /** The corner three runs parallel to the sideline, 3ft in, until the arc begins. */
  cornerInset: 3,
  cornerBreakX: 14.2,
} as const;

import type { TeamSide } from './types';
import { courtFeetToShot, shotToCourtFeet } from '../../lib/shot-coordinates';
import { COURT, COURT_LENGTH_FT, COURT_WIDTH_FT } from './courtGeometry';

/**
 * Whether a recorded shot was taken from behind the three-point line, and where the rim is.
 *
 * Both work in real feet now. They used to work in the units of the old schematic court, whose arc was
 * a different shape and distance from the basket than a real one, so a shot could be scored by a line
 * that is not where the real line is (Bug 207). The arguments and return values are unchanged: they are
 * still the 0-to-1 pair that is stored for every shot, which is decoded here.
 */

/** A shot within this many feet of a line is given to the shooter, as the old code did in its own units. */
const EPS_FT = 0.12;

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** True when this side attacks the left basket, which decides which end to measure from. */
function attacksLeft(shootingSide: TeamSide, homeAttacksLeft: boolean): boolean {
  return (shootingSide === 'home' && homeAttacksLeft) || (shootingSide === 'away' && !homeAttacksLeft);
}

/**
 * Normalized court position of the rim a team shoots at, used for shots that always happen at the
 * basket, such as a putback, where there is no real tap to take a spot from.
 */
export function getRimPosition(
  shootingSide: TeamSide,
  homeAttacksLeft = true
): { nx: number; ny: number } {
  const xFt = attacksLeft(shootingSide, homeAttacksLeft) ? COURT.rimX : COURT_LENGTH_FT - COURT.rimX;
  const { x, y } = courtFeetToShot(xFt, COURT.rimY);
  return { nx: x, ny: y };
}

/**
 * Home attacks the left basket and away the right, unless `homeAttacksLeft` says otherwise.
 * True when the shot is from outside the three-point line.
 */
export function isCourtClickThreePointer(
  nx: number,
  ny: number,
  shootingSide: TeamSide,
  homeAttacksLeft = true
): boolean {
  const { xFt, yFt } = shotToCourtFeet(nx, ny);

  // Measure every shot against the left basket, mirroring the far half onto the near one.
  const x = attacksLeft(shootingSide, homeAttacksLeft) ? xFt : COURT_LENGTH_FT - xFt;
  const y = yFt;

  // The corners: the line runs parallel to the sideline until the arc begins.
  const inCorner = y < COURT.cornerInset - EPS_FT || y > COURT_WIDTH_FT - COURT.cornerInset + EPS_FT;
  if (x <= COURT.cornerBreakX + EPS_FT && inCorner) return true;

  // Everywhere else: beyond the radius struck from the rim.
  return dist(x, y, COURT.rimX, COURT.rimY) > COURT.threeRadius + EPS_FT;
}

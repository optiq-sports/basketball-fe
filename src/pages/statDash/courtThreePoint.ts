import type { TeamSide } from './types';

/** Matches BasketballCourt viewBox 620×380. */
const W = 620;
const H = 380;

const LEFT_ARC_CX = 85;
const LEFT_ARC_CY = 190;
const ARC_R = 148;
const LEFT_X_SPLIT = 152;
const ARC_TOP_Y = 58;
const ARC_BOTTOM_Y = 322;

const RIGHT_ARC_CX = W - LEFT_ARC_CX;
const RIGHT_ARC_CY = LEFT_ARC_CY;
const RIGHT_X_SPLIT = W - LEFT_X_SPLIT;

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * Home attacks the left basket, away the right (same orientation as the schematic).
 * Returns true if the click is outside the 2pt arc region (counts as a three).
 */
export function isCourtClickThreePointer(
  nx: number,
  ny: number,
  shootingSide: TeamSide,
  homeAttacksLeft = true
): boolean {
  const x = nx * W;
  const y = ny * H;
  const eps = 0.75;
  const shootsLeft =
    (shootingSide === 'home' && homeAttacksLeft) ||
    (shootingSide === 'away' && !homeAttacksLeft);
  if (shootsLeft) {
    if (x <= LEFT_X_SPLIT + eps && (y < ARC_TOP_Y - eps || y > ARC_BOTTOM_Y + eps)) {
      return true;
    }
    const d = dist(x, y, LEFT_ARC_CX, LEFT_ARC_CY);
    if (d > ARC_R + eps) return true;
    return false;
  }
  if (x >= RIGHT_X_SPLIT - eps && (y < ARC_TOP_Y - eps || y > ARC_BOTTOM_Y + eps)) {
    return true;
  }
  const d = dist(x, y, RIGHT_ARC_CX, RIGHT_ARC_CY);
  if (d > ARC_R + eps) return true;
  return false;
}

import type { TeamSide } from './types';

export type ShotTypeId = 'jump' | 'layup' | 'dunk' | 'post';
export type ShotResult = 'made' | 'missed';

export type ShotFlowEntry = 'player' | 'court';

export type ShotFlowStep =
  | 'pickShooter'
  | 'shotType'
  | 'assist'
  | 'pickRebounder'
  | 'pickBlocker';

/** Modal choice on "Select Rebounder" (not including simple rebound — jersey alone). */
export type ReboundOutcomeId =
  | 'tipin_layup_miss'
  | 'tipin_dunk_miss'
  | 'tipin_layup_made'
  | 'tipin_dunk_made'
  | 'block_involved'
  | 'dead_out_of_bounds'
  | 'dead_shot_clock_violation';

export type DeadBallReasonId = 'out_of_bounds' | 'shot_clock_violation';

export type ShotFlowDraft = {
  side: TeamSide | null;
  shooterJersey: number | null;
  shotType: ShotTypeId | null;
  result: ShotResult;
  fastBreak: boolean;

  // Live ball rebound loop (triggered after committing a missed shot).
  rebounderSide: TeamSide | null;
  rebounderJersey: number | null;
  blockerSide: TeamSide | null;
  blockerJersey: number | null;
  /** Set when user taps a non-simple action first; jersey click completes the branch. */
  reboundBranch: ReboundOutcomeId | null;
  deadBallReason: DeadBallReasonId | null;

  // Tip-in attempts skip shotType/assist UI and commit immediately after pickShooter.
  tipInCommit: boolean;
};

export type ActiveShotFlow = {
  entry: ShotFlowEntry;
  step: ShotFlowStep;
  draft: ShotFlowDraft;
};

/** MVP: all made shots count 2; extend per `ShotTypeId` when adding 3PT etc. */
export function getShotPoints(_shotType: ShotTypeId): number {
  return 2;
}

export const SHOT_TYPE_OPTIONS: { id: ShotTypeId; label: string }[] = [
  { id: 'jump', label: 'Jump Shot' },
  { id: 'layup', label: 'Layup' },
  { id: 'dunk', label: 'Dunk' },
  { id: 'post', label: 'Post shot' },
];

export function shotTypeResultPhrase(id: ShotTypeId, result: ShotResult): string {
  const m: Record<ShotTypeId, { made: string; missed: string }> = {
    jump: { made: 'Jump shot made', missed: 'Jump shot missed' },
    layup: { made: 'Layup made', missed: 'Layup missed' },
    dunk: { made: 'Dunk made', missed: 'Dunk missed' },
    post: { made: 'Post shot made', missed: 'Post shot missed' },
  };
  return m[id][result];
}

export function emptyShotDraft(): ShotFlowDraft {
  return {
    side: null,
    shooterJersey: null,
    shotType: null,
    result: 'made',
    fastBreak: false,

    rebounderSide: null,
    rebounderJersey: null,
    blockerSide: null,
    blockerJersey: null,
    reboundBranch: null,
    deadBallReason: null,

    tipInCommit: false,
  };
}

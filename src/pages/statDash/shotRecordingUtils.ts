import type { TeamSide } from './types';

export type ShotTypeId = 'jump' | 'layup' | 'dunk' | 'post';

export type ShotFlowEntry = 'player' | 'court';

export type ShotFlowStep = 'pickShooter' | 'shotType' | 'assist';

export type ShotFlowDraft = {
  side: TeamSide | null;
  shooterJersey: number | null;
  shotType: ShotTypeId | null;
  fastBreak: boolean;
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

export function shotTypeResultPhrase(id: ShotTypeId): string {
  const m: Record<ShotTypeId, string> = {
    jump: 'Jump shot made',
    layup: 'Layup made',
    dunk: 'Dunk made',
    post: 'Post shot made',
  };
  return m[id];
}

export function emptyShotDraft(): ShotFlowDraft {
  return {
    side: null,
    shooterJersey: null,
    shotType: null,
    fastBreak: false,
  };
}

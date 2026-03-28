import type { TeamSide } from './types';

export type FoulTypeId =
  | 'personal'
  | 'technical'
  | 'intentional'
  | 'flagrant1'
  | 'flagrant2'
  | 'charging';

export const FOUL_TYPE_OPTIONS: { id: FoulTypeId; label: string }[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'technical', label: 'Technical' },
  { id: 'intentional', label: 'Intentional' },
  { id: 'flagrant1', label: 'Flagrant 1' },
  { id: 'flagrant2', label: 'Flagrant 2' },
  { id: 'charging', label: 'Charging' },
];

export function foulTypeLabel(id: FoulTypeId): string {
  return FOUL_TYPE_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export type FoulFlowEntry = 'court' | 'player';

export type FoulFlowStep =
  | 'pickFouler'
  | 'foulType'
  | 'pickFouled'
  | 'ftCount'
  | 'ftShooter'
  | 'ftResults'
  | 'rebounder';

export type FoulFlowDraft = {
  foulerSide: TeamSide | null;
  foulerJersey: number | null;
  foulType: FoulTypeId | null;
  fouledJersey: number | null;
  /** 0 = no free throws */
  ftCount: 0 | 1 | 2 | 3 | null;
  shooterSameAsFouled: boolean | null;
  ftResults: ('made' | 'miss')[];
  reboundSide: TeamSide | null;
  reboundJersey: number | null;
};

export type ActiveFoulFlow = {
  entry: FoulFlowEntry;
  step: FoulFlowStep;
  draft: FoulFlowDraft;
};

export function emptyFoulDraft(): FoulFlowDraft {
  return {
    foulerSide: null,
    foulerJersey: null,
    foulType: null,
    fouledJersey: null,
    ftCount: null,
    shooterSameAsFouled: null,
    ftResults: [],
    reboundSide: null,
    reboundJersey: null,
  };
}

export function opponentOf(side: TeamSide): TeamSide {
  return side === 'home' ? 'away' : 'home';
}

/** Back navigation (linear undo). */
export function foulFlowBack(cur: ActiveFoulFlow): ActiveFoulFlow | 'idle' {
  const { entry, step, draft } = cur;
  switch (step) {
    case 'rebounder':
      return {
        ...cur,
        step: 'ftResults',
        draft: { ...draft, reboundSide: null, reboundJersey: null },
      };
    case 'ftResults':
      return {
        ...cur,
        step: 'ftShooter',
        draft: { ...draft, ftResults: [], shooterSameAsFouled: null },
      };
    case 'ftShooter':
      return {
        ...cur,
        step: 'ftCount',
        draft: { ...draft },
      };
    case 'ftCount':
      return {
        ...cur,
        step: 'pickFouled',
        draft: { ...draft, ftCount: null },
      };
    case 'pickFouled':
      return {
        ...cur,
        step: 'foulType',
        draft: { ...draft, fouledJersey: null },
      };
    case 'foulType':
      if (entry === 'court') {
        return {
          ...cur,
          step: 'pickFouler',
          draft: {
            ...draft,
            foulType: null,
            foulerSide: null,
            foulerJersey: null,
          },
        };
      }
      return 'idle';
    case 'pickFouler':
      return 'idle';
    default:
      return cur;
  }
}

export function initialFoulFlowFromCourt(): ActiveFoulFlow {
  return {
    entry: 'court',
    step: 'pickFouler',
    draft: emptyFoulDraft(),
  };
}

export function initialFoulFlowFromPlayer(side: TeamSide, jersey: number): ActiveFoulFlow {
  return {
    entry: 'player',
    step: 'foulType',
    draft: {
      ...emptyFoulDraft(),
      foulerSide: side,
      foulerJersey: jersey,
    },
  };
}

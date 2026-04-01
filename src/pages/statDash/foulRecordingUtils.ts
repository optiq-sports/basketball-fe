import type { TeamSide } from './types';

export type FoulTypeId =
  | 'personal'
  | 'shooting'
  | 'technical'
  | 'unsportmanlike'
  | 'double_foul'
  | 'offensive';

export const FOUL_TYPE_OPTIONS: { id: FoulTypeId; label: string }[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'shooting', label: 'Shooting' },
  { id: 'technical', label: 'Technical' },
  { id: 'unsportmanlike', label: 'Unsportmanlike' },
  { id: 'double_foul', label: 'Double Foul' },
  { id: 'offensive', label: 'Offensive' },
];

export function foulTypeLabel(id: FoulTypeId): string {
  return FOUL_TYPE_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export type FoulFlowEntry = 'court' | 'player' | 'panel';

export type FoulerRole = 'player' | 'bench' | 'coach';

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
  foulerRole: FoulerRole | null;
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
    foulerRole: null,
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

/** Game log `player` column for the fouler. */
export function foulerLogPlayerField(draft: FoulFlowDraft): string {
  if (draft.foulerRole === 'bench') {
    return draft.foulerJersey !== null ? `#${draft.foulerJersey} (bench)` : 'Bench';
  }
  if (draft.foulerRole === 'coach') return 'Coach';
  if (draft.foulerJersey !== null) return `#${draft.foulerJersey}`;
  return '—';
}

export function isFoulerDraftComplete(draft: FoulFlowDraft): boolean {
  if (draft.foulerSide === null || draft.foulerRole === null) return false;
  if (draft.foulerRole === 'player') return draft.foulerJersey !== null;
  if (draft.foulerRole === 'bench') return true;
  if (draft.foulerRole === 'coach') return draft.foulerJersey === null;
  return false;
}

export type PanelFoulPick =
  | { kind: 'player'; jersey: number }
  | { kind: 'bench_player'; jersey: number }
  | { kind: 'bench' }
  | { kind: 'coach' };

export function initialFoulFlowFromPanelSelection(
  side: TeamSide,
  pick: PanelFoulPick
): ActiveFoulFlow {
  const base = emptyFoulDraft();
  if (pick.kind === 'player') {
    return {
      entry: 'panel',
      step: 'foulType',
      draft: {
        ...base,
        foulerSide: side,
        foulerJersey: pick.jersey,
        foulerRole: 'player',
      },
    };
  }
  if (pick.kind === 'bench_player') {
    return {
      entry: 'panel',
      step: 'foulType',
      draft: {
        ...base,
        foulerSide: side,
        foulerJersey: pick.jersey,
        foulerRole: 'bench',
      },
    };
  }
  return {
    entry: 'panel',
    step: 'foulType',
    draft: {
      ...base,
      foulerSide: side,
      foulerJersey: null,
      foulerRole: pick.kind === 'bench' ? 'bench' : 'coach',
    },
  };
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
            foulerRole: null,
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
      foulerRole: 'player',
    },
  };
}

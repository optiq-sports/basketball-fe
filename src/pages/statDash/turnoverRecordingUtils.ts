import type { TeamSide } from './types';

export type TurnoverTypeId =
  | 'ball_handling'
  | 'bad_pass'
  | 'double_dribble'
  | 'travel'
  | 'out_of_bounds'
  | 'back_court'
  | 'three_seconds'
  | 'eight_seconds'
  | 'twenty_four_seconds';

export const TURNOVER_TYPE_OPTIONS: { id: TurnoverTypeId; label: string }[] = [
  { id: 'ball_handling', label: 'Ball Handling' },
  { id: 'bad_pass', label: 'Bad Pass' },
  { id: 'double_dribble', label: 'Double Dribble' },
  { id: 'travel', label: 'Travel' },
  { id: 'out_of_bounds', label: 'Out of Bounds' },
  { id: 'back_court', label: 'Back Court' },
  { id: 'three_seconds', label: '3 Seconds' },
  { id: 'eight_seconds', label: '8 Seconds' },
  { id: 'twenty_four_seconds', label: '24 Seconds' },
];

export function turnoverTypeLabel(id: TurnoverTypeId): string {
  return TURNOVER_TYPE_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export type TurnoverFlowEntry = 'panel';

export type TurnoverFlowStep = 'pickPlayer' | 'turnoverType' | 'steal';

export type TurnoverFlowDraft = {
  committingSide: TeamSide;
  committingJersey: number | null;
  turnoverType: TurnoverTypeId | null;
};

export type ActiveTurnoverFlow = {
  entry: TurnoverFlowEntry;
  step: TurnoverFlowStep;
  draft: TurnoverFlowDraft;
};

export function initialTurnoverFlowFromPanel(side: TeamSide): ActiveTurnoverFlow {
  return {
    entry: 'panel',
    step: 'pickPlayer',
    draft: {
      committingSide: side,
      committingJersey: null,
      turnoverType: null,
    },
  };
}

export function turnoverFlowBack(cur: ActiveTurnoverFlow): ActiveTurnoverFlow | 'idle' {
  const { step, draft } = cur;
  switch (step) {
    case 'steal':
      return {
        ...cur,
        step: 'turnoverType',
        draft: { ...draft, turnoverType: null },
      };
    case 'turnoverType':
      return {
        ...cur,
        step: 'pickPlayer',
        draft: { ...draft, committingJersey: null },
      };
    case 'pickPlayer':
      return 'idle';
    default:
      return cur;
  }
}

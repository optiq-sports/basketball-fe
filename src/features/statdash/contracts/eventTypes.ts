export const STATDASH_EVENT_TYPES = [
  'shot',
  'assist',
  'rebound',
  'block',
  'foul',
  'free_throw',
  'turnover',
  'steal',
  'dead_ball',
  'substitution',
  'jump_ball',
  'timeout',
  'clock',
] as const;

export const STATDASH_SHOT_RESULTS = ['made', 'missed'] as const;
export const STATDASH_REBOUND_TYPES = ['offensive', 'defensive'] as const;
export const STATDASH_DEAD_BALL_REASONS = [
  'out_of_bounds',
  'shot_clock_violation',
  'held_ball',
  'lane_violation',
] as const;

export type StatDashEventType = (typeof STATDASH_EVENT_TYPES)[number];

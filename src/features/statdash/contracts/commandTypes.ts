export const STATDASH_COMMAND_TYPES = [
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

export type StatDashCommandType = (typeof STATDASH_COMMAND_TYPES)[number];

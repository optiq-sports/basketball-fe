export type TeamSide = 'home' | 'away';

export interface GameLogEntry {
  id: string;
  period: string;
  clock: string;
  team: string;
  player: string;
  action: string;
  result: string;
}

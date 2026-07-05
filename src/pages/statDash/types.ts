export type TeamSide = 'home' | 'away';

export interface GameLogEntry {
  id: string;
  /** Idempotency key from the queued command — links this entry to a backend event */
  localId?: string;
  /** Real backend event ID, set once the queue's onCommandAccepted fires */
  backendEventId?: string;
  /** Structured display data used to populate the edit modal */
  meta?: Record<string, unknown>;
  period: string;
  clock: string;
  team: string;
  player: string;
  action: string;
  result: string;
}

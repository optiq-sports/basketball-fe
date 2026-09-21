/**
 * Remembers whether the game clock was running or stopped, and where it was, so a reload, reconnect
 * or realtime resync brings back the clock the statistician left — instead of guessing from the
 * session status.
 *
 * The server can't answer this: its session status `IN_PROGRESS` means "the game has started", not
 * "the clock is running" (stopping the clock at a dead ball doesn't change it), and a stop/start is
 * only recorded inside a `clock` event's payload. So the clock is remembered here, on this device,
 * at every change, and restored from that when the page comes back.
 */

export interface ClockAnchor {
  sessionId: string;
  isRunning: boolean;
  /** Seconds left on the clock at `at`. */
  seconds: number;
  period: number;
  /** The session status when this was saved (PAUSED / IN_PROGRESS …). */
  status?: string;
  /** When this was saved (ms since epoch). */
  at: number;
}

/** Longest gap over which a clock that was running is assumed to have kept running. Beyond it the
 * page was almost certainly abandoned, so it comes back stopped rather than silently burning time. */
export const MAX_RESUME_GAP_SEC = 15 * 60;

/** The server's status snapshot can lag a write by up to this long (its /state cache is 30 s). */
export const STATUS_OVERRIDE_WINDOW_MS = 35_000;

const keyFor = (sessionId: string) => `statdash_clock_${sessionId}`;

export function writeClockAnchor(anchor: ClockAnchor): void {
  try {
    localStorage.setItem(keyFor(anchor.sessionId), JSON.stringify(anchor));
  } catch {
    // Storage full or unavailable — the clock just won't be remembered across a reload.
  }
}

export function readClockAnchor(sessionId: string): ClockAnchor | null {
  try {
    const raw = localStorage.getItem(keyFor(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ClockAnchor>;
    if (
      typeof parsed.isRunning !== 'boolean' ||
      typeof parsed.seconds !== 'number' ||
      typeof parsed.at !== 'number' ||
      parsed.sessionId !== sessionId
    ) {
      return null;
    }
    return {
      sessionId,
      isRunning: parsed.isRunning,
      seconds: parsed.seconds,
      period: typeof parsed.period === 'number' ? parsed.period : 1,
      status: typeof parsed.status === 'string' ? parsed.status : undefined,
      at: parsed.at,
    };
  } catch {
    return null;
  }
}

export interface ClockReading {
  isRunning: boolean;
  seconds: number;
}

/** Where the clock is now, given a reading taken at `at`: a running clock keeps counting down. */
export function clockAt(reading: ClockReading & { at: number }, now: number): ClockReading {
  if (!reading.isRunning) return { isRunning: false, seconds: reading.seconds };
  const elapsed = Math.max(0, Math.round((now - reading.at) / 1000));
  if (elapsed > MAX_RESUME_GAP_SEC) return { isRunning: false, seconds: reading.seconds };
  return { isRunning: true, seconds: Math.max(0, reading.seconds - elapsed) };
}

export interface LastClockEvent {
  isRunning: boolean;
  seconds: number;
  /** When the server recorded it (ms since epoch). */
  at: number;
}

/** The most recent `clock` event among a session snapshot's recent events, if there is one. */
export function lastClockEvent(
  events: Array<{ eventType: string; payload: unknown; createdAt: string | Date }> | undefined,
): LastClockEvent | null {
  if (!events) return null;
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (e.eventType !== 'clock') continue;
    const p = (e.payload ?? {}) as { isRunning?: unknown; clockSecondsRemaining?: unknown };
    if (typeof p.isRunning !== 'boolean' || typeof p.clockSecondsRemaining !== 'number') continue;
    const at = new Date(e.createdAt).getTime();
    if (Number.isNaN(at)) continue;
    return { isRunning: p.isRunning, seconds: p.clockSecondsRemaining, at };
  }
  return null;
}

export interface RestoreInput {
  serverStatus: string;
  serverSeconds: number;
  anchor: ClockAnchor | null;
  serverClockEvent: LastClockEvent | null;
  now?: number;
}

export interface RestoredClock extends ClockReading {
  status: string;
  source: 'local' | 'server-event' | 'server';
}

/**
 * Decides the clock and session status to show after a reload.
 *
 * Whichever memory is newer wins: this device's own (exact, saved at every change) or the last
 * `clock` event the server recorded (for a device that has never seen this game). A clock the
 * session isn't actually playing (paused, finished, not started) is never running. With nothing to
 * go on the clock comes back stopped — a stopped clock is obvious and one tap from running, while a
 * clock that starts by itself quietly gives wrong times.
 */
export function restoreClock(input: RestoreInput): RestoredClock {
  const now = input.now ?? Date.now();
  const { anchor, serverClockEvent, serverStatus, serverSeconds } = input;

  // The server's status can lag a pause/resume by up to its cache lifetime; a very recent local
  // write of the status is more accurate than that.
  let status = serverStatus;
  if (
    anchor?.status &&
    anchor.status !== serverStatus &&
    (anchor.status === 'PAUSED' || anchor.status === 'IN_PROGRESS') &&
    (serverStatus === 'PAUSED' || serverStatus === 'IN_PROGRESS') &&
    now - anchor.at < STATUS_OVERRIDE_WINDOW_MS
  ) {
    status = anchor.status;
  }

  const candidates: Array<{ source: 'local' | 'server-event'; reading: ClockReading & { at: number } }> = [];
  if (anchor) candidates.push({ source: 'local', reading: { isRunning: anchor.isRunning, seconds: anchor.seconds, at: anchor.at } });
  if (serverClockEvent) candidates.push({ source: 'server-event', reading: serverClockEvent });
  candidates.sort((a, b) => b.reading.at - a.reading.at);
  const best = candidates[0];

  if (!best) return { isRunning: false, seconds: serverSeconds, status, source: 'server' };

  const now_ = clockAt(best.reading, now);
  return {
    isRunning: status === 'IN_PROGRESS' ? now_.isRunning : false,
    seconds: now_.seconds,
    status,
    source: best.source,
  };
}

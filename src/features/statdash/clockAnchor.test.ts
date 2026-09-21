import { beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_RESUME_GAP_SEC,
  STATUS_OVERRIDE_WINDOW_MS,
  clockAt,
  lastClockEvent,
  readClockAnchor,
  restoreClock,
  writeClockAnchor,
  type ClockAnchor,
} from './clockAnchor';

const T0 = 1_700_000_000_000;
const anchor = (over: Partial<ClockAnchor> = {}): ClockAnchor => ({
  sessionId: 's1', isRunning: false, seconds: 420, period: 1, status: 'IN_PROGRESS', at: T0, ...over,
});

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('remembers the clock per session', () => {
    writeClockAnchor(anchor({ seconds: 300 }));
    expect(readClockAnchor('s1')).toMatchObject({ isRunning: false, seconds: 300, status: 'IN_PROGRESS' });
    expect(readClockAnchor('other-game')).toBeNull();
  });

  it('ignores damaged or foreign data', () => {
    localStorage.setItem('statdash_clock_s1', 'not json');
    expect(readClockAnchor('s1')).toBeNull();
    localStorage.setItem('statdash_clock_s1', JSON.stringify({ sessionId: 'someone-else', isRunning: true, seconds: 1, at: 1 }));
    expect(readClockAnchor('s1')).toBeNull();
  });
});

describe('clockAt', () => {
  it('a stopped clock does not move, however long the page was gone', () => {
    expect(clockAt({ isRunning: false, seconds: 420, at: T0 }, T0 + 5 * 60_000)).toEqual({ isRunning: false, seconds: 420 });
  });
  it('a running clock keeps counting down while the page reloads', () => {
    expect(clockAt({ isRunning: true, seconds: 420, at: T0 }, T0 + 12_000)).toEqual({ isRunning: true, seconds: 408 });
  });
  it('never goes below zero', () => {
    expect(clockAt({ isRunning: true, seconds: 5, at: T0 }, T0 + 60_000)).toEqual({ isRunning: true, seconds: 0 });
  });
  it('a page abandoned for a long time comes back stopped, not silently burning game time', () => {
    const gap = (MAX_RESUME_GAP_SEC + 60) * 1000;
    expect(clockAt({ isRunning: true, seconds: 420, at: T0 }, T0 + gap)).toEqual({ isRunning: false, seconds: 420 });
  });
});

describe('lastClockEvent', () => {
  const ev = (eventType: string, payload: unknown, createdAt: string) => ({ eventType, payload, createdAt });
  it('finds the newest clock event and reads whether it was running', () => {
    const events = [
      ev('clock', { isRunning: true, clockSecondsRemaining: 500 }, '2026-09-21T10:00:00Z'),
      ev('shot', {}, '2026-09-21T10:00:10Z'),
      ev('clock', { isRunning: false, clockSecondsRemaining: 470 }, '2026-09-21T10:00:30Z'),
      ev('shot', {}, '2026-09-21T10:00:40Z'),
    ];
    expect(lastClockEvent(events)).toEqual({ isRunning: false, seconds: 470, at: new Date('2026-09-21T10:00:30Z').getTime() });
  });
  it('returns null when there is none, or it is unreadable', () => {
    expect(lastClockEvent([])).toBeNull();
    expect(lastClockEvent(undefined)).toBeNull();
    expect(lastClockEvent([ev('clock', { clockSecondsRemaining: 5 }, '2026-09-21T10:00:00Z')])).toBeNull();
  });
});

describe('restoreClock', () => {
  it('REGRESSION: a clock the statistician stopped stays stopped after a reload', () => {
    // The session is IN_PROGRESS (the game has started) — that alone must not start the clock.
    const r = restoreClock({
      serverStatus: 'IN_PROGRESS', serverSeconds: 430,
      anchor: anchor({ isRunning: false, seconds: 420, at: T0 }),
      serverClockEvent: null, now: T0 + 60_000,
    });
    expect(r).toMatchObject({ isRunning: false, seconds: 420, status: 'IN_PROGRESS', source: 'local' });
  });

  it('a clock that was running is still running, and has kept counting', () => {
    const r = restoreClock({
      serverStatus: 'IN_PROGRESS', serverSeconds: 430,
      anchor: anchor({ isRunning: true, seconds: 420, at: T0 }),
      serverClockEvent: null, now: T0 + 20_000,
    });
    expect(r).toMatchObject({ isRunning: true, seconds: 400 });
  });

  it('a paused, unstarted or finished game is never running', () => {
    for (const serverStatus of ['PAUSED', 'PENDING', 'COMPLETED']) {
      const r = restoreClock({ serverStatus, serverSeconds: 300, anchor: anchor({ isRunning: true, status: serverStatus }), serverClockEvent: null, now: T0 + 1000 });
      expect(r.isRunning).toBe(false);
    }
  });

  it('a device that has never seen the game uses the last clock event the server recorded', () => {
    const r = restoreClock({
      serverStatus: 'IN_PROGRESS', serverSeconds: 400, anchor: null,
      serverClockEvent: { isRunning: false, seconds: 415, at: T0 }, now: T0 + 90_000,
    });
    expect(r).toMatchObject({ isRunning: false, seconds: 415, source: 'server-event' });
  });

  it('whichever memory is newer wins', () => {
    const newerLocal = restoreClock({
      serverStatus: 'IN_PROGRESS', serverSeconds: 400,
      anchor: anchor({ isRunning: false, seconds: 300, at: T0 + 10_000 }),
      serverClockEvent: { isRunning: true, seconds: 500, at: T0 }, now: T0 + 20_000,
    });
    expect(newerLocal.source).toBe('local');
    const newerServer = restoreClock({
      serverStatus: 'IN_PROGRESS', serverSeconds: 400,
      anchor: anchor({ isRunning: true, seconds: 500, at: T0 }),
      serverClockEvent: { isRunning: false, seconds: 300, at: T0 + 10_000 }, now: T0 + 20_000,
    });
    expect(newerServer).toMatchObject({ source: 'server-event', isRunning: false, seconds: 300 });
  });

  it('with nothing to go on, comes back stopped at the server\'s time', () => {
    expect(restoreClock({ serverStatus: 'IN_PROGRESS', serverSeconds: 555, anchor: null, serverClockEvent: null, now: T0 })).toEqual({
      isRunning: false, seconds: 555, status: 'IN_PROGRESS', source: 'server',
    });
  });

  describe('a just-paused game the server still reports as in progress (its status snapshot lags)', () => {
    it('trusts a very recent local pause over the lagging server status', () => {
      const r = restoreClock({
        serverStatus: 'IN_PROGRESS', serverSeconds: 400,
        anchor: anchor({ isRunning: false, status: 'PAUSED', seconds: 400, at: T0 }),
        serverClockEvent: null, now: T0 + 5_000,
      });
      expect(r).toMatchObject({ status: 'PAUSED', isRunning: false });
    });
    it('and just as recent a resume over a lagging PAUSED', () => {
      const r = restoreClock({
        serverStatus: 'PAUSED', serverSeconds: 400,
        anchor: anchor({ isRunning: true, status: 'IN_PROGRESS', seconds: 400, at: T0 }),
        serverClockEvent: null, now: T0 + 5_000,
      });
      expect(r).toMatchObject({ status: 'IN_PROGRESS', isRunning: true });
    });
    it('but once the server has had time to catch up, the server\'s status wins again', () => {
      const r = restoreClock({
        serverStatus: 'IN_PROGRESS', serverSeconds: 400,
        anchor: anchor({ isRunning: false, status: 'PAUSED', at: T0 }),
        serverClockEvent: null, now: T0 + STATUS_OVERRIDE_WINDOW_MS + 1000,
      });
      expect(r.status).toBe('IN_PROGRESS');
    });
  });
});

import { describe, expect, it } from 'vitest';
import { StatDashApiError } from './client';
import { parseVersionConflict } from './versionConflict';

describe('parseVersionConflict', () => {
  it('recognizes the exact response the backend sends (409, message only, no code) and reads the real version', () => {
    // Captured from the deployed API: {"statusCode":409,...,"message":"Stale version. Expected 1, latest is 2"}
    const error = new StatDashApiError('Stale version. Expected 1, latest is 2', 409);
    expect(parseVersionConflict(error)).toEqual({ latestVersion: 2 });
  });

  it('prefers a latestVersion field when the server includes one', () => {
    const error = new StatDashApiError('Stale version. Expected 1, latest is 2', 409, 'SD_VERSION_CONFLICT', {
      latestVersion: 9,
    });
    expect(parseVersionConflict(error)).toEqual({ latestVersion: 9 });
  });

  it('still recognizes a coded conflict whose message has no number', () => {
    expect(parseVersionConflict(new StatDashApiError('conflict', 409, 'VERSION_CONFLICT'))).toEqual({
      latestVersion: null,
    });
  });

  it('does not mistake a different 409 for a version problem', () => {
    const reused = new StatDashApiError(
      'idempotencyKey already exists for a different request payload',
      409,
      'SD_IDEMPOTENCY_KEY_REUSED_DIFFERENT_REQUEST',
    );
    expect(parseVersionConflict(reused)).toBeNull();
  });

  it('ignores anything that is not a 409 StatDash error', () => {
    expect(parseVersionConflict(new StatDashApiError('Stale version. Expected 1, latest is 2', 400))).toBeNull();
    expect(parseVersionConflict(new Error('Stale version. Expected 1, latest is 2'))).toBeNull();
    expect(parseVersionConflict(null)).toBeNull();
  });
});

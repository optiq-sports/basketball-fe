import { describe, expect, it } from 'vitest';
import { EMPTY_FIXTURE_FORM, fromIsoToLocal, toFixtureCreate, toFixtureUpdate, toIsoFromLocal, validateFixtureForm, type FixtureFormValues } from './fixture-form';

const teams = new Set(['a', 'b', 'c']);
const filled: FixtureFormValues = { ...EMPTY_FIXTURE_FORM, homeTeamId: 'a', awayTeamId: 'b', date: '2026-10-10', time: '18:30', venue: ' Main ' };

describe('validateFixtureForm (create)', () => {
  it('accepts two different tournament teams and a date', () => {
    expect(validateFixtureForm(filled, teams, { editing: false })).toEqual({});
  });

  it('requires both teams', () => {
    const e = validateFixtureForm({ ...filled, homeTeamId: '', awayTeamId: '' }, teams, { editing: false });
    expect(e.homeTeamId).toMatch(/home team/);
    expect(e.awayTeamId).toMatch(/away team/);
  });

  it('rejects a team that isn’t in the tournament', () => {
    expect(validateFixtureForm({ ...filled, awayTeamId: 'zzz' }, teams, { editing: false }).awayTeamId).toMatch(/isn’t in this tournament/);
  });

  it('rejects the same team on both sides', () => {
    expect(validateFixtureForm({ ...filled, awayTeamId: 'a' }, teams, { editing: false }).awayTeamId).toMatch(/different/);
  });

  it('requires a date and a valid time', () => {
    expect(validateFixtureForm({ ...filled, date: '' }, teams, { editing: false }).date).toMatch(/date/);
    expect(validateFixtureForm({ ...filled, time: '6pm' }, teams, { editing: false }).time).toMatch(/HH:MM/);
  });
});

describe('validateFixtureForm (edit)', () => {
  it('does not re-check teams, which can’t change after a fixture is made', () => {
    expect(validateFixtureForm({ ...filled, homeTeamId: '', awayTeamId: '' }, new Set(), { editing: true })).toEqual({});
  });

  it('won’t let an admin set LIVE or COMPLETED by hand, but keeps the current status', () => {
    expect(validateFixtureForm({ ...filled, status: 'COMPLETED' }, teams, { editing: true, currentStatus: 'LIVE' }).status).toMatch(/scorer/);
    expect(validateFixtureForm({ ...filled, status: 'LIVE' }, teams, { editing: true, currentStatus: 'LIVE' })).toEqual({});
    expect(validateFixtureForm({ ...filled, status: 'CANCELLED' }, teams, { editing: true, currentStatus: 'SCHEDULED' })).toEqual({});
  });
});

describe('payloads', () => {
  it('create: trims the venue, leaves out blanks, and sends the local time as an instant', () => {
    const body = toFixtureCreate({ ...filled, statisticianId: '' }, 't1');
    expect(body).toEqual({
      tournamentId: 't1',
      homeTeamId: 'a',
      awayTeamId: 'b',
      scheduledDate: toIsoFromLocal('2026-10-10', '18:30'),
      status: 'SCHEDULED',
      venue: 'Main',
    });
    expect(body).not.toHaveProperty('statisticianId');
  });

  it('edit: an empty statistician or venue is sent as null, so it is cleared', () => {
    const body = toFixtureUpdate({ ...filled, venue: '', statisticianId: '', status: 'POSTPONED' });
    expect(body).toMatchObject({ venue: null, statisticianId: null, status: 'POSTPONED' });
  });

  it('round-trips a stored instant back to the same local date and time', () => {
    const iso = toIsoFromLocal('2026-03-08', '07:05');
    expect(fromIsoToLocal(iso)).toEqual({ date: '2026-03-08', time: '07:05' });
  });
});

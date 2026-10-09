import { describe, expect, it } from 'vitest';
import { EMPTY_TEAM_FORM, fromTeam, toTeamPayload, validateTeamForm, type TeamFormValues } from './team-form';

const filled: TeamFormValues = { ...EMPTY_TEAM_FORM, name: ' Lakers ', code: ' lal ' };

describe('validateTeamForm', () => {
  it('requires only name and code', () => {
    expect(Object.keys(validateTeamForm(EMPTY_TEAM_FORM)).sort()).toEqual(['code', 'name']);
    expect(validateTeamForm(filled)).toEqual({});
  });

  it('rejects an invalid hex colour, but accepts a blank one', () => {
    expect(validateTeamForm({ ...filled, color: 'blue' }).color).toMatch(/hex colour/);
    expect(validateTeamForm({ ...filled, color: '#FF6B2C' })).toEqual({});
    expect(validateTeamForm({ ...filled, color: '' })).toEqual({});
  });

  it('rejects an overly long code', () => {
    expect(validateTeamForm({ ...filled, code: 'ABCDEFGHIJK' }).code).toMatch(/10 characters/);
  });
});

describe('toTeamPayload', () => {
  it('trims the name, upper-cases the code, and leaves out blank optional fields', () => {
    expect(toTeamPayload(filled)).toEqual({ name: 'Lakers', code: 'LAL' });
  });

  it('includes optional fields that were filled in', () => {
    const body = toTeamPayload({ ...filled, color: '#FF6B2C', coach: 'Pat Riley' });
    expect(body).toMatchObject({ color: '#FF6B2C', coach: 'Pat Riley' });
  });
});

describe('fromTeam', () => {
  it('pre-fills from a saved team, with blanks for anything unset', () => {
    expect(fromTeam({ name: 'Lakers', code: 'LAL' })).toEqual({ ...EMPTY_TEAM_FORM, name: 'Lakers', code: 'LAL' });
  });
});

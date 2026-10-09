import { describe, expect, it } from 'vitest';
import { EMPTY_NEW_PLAYER_FORM, isPotentialDuplicateMessage, toNewPlayerPayload, validateNewPlayerForm, type NewPlayerFormValues } from './add-player-form';

const filled: NewPlayerFormValues = { ...EMPTY_NEW_PLAYER_FORM, firstName: ' Michael ', lastName: ' Jordan ', jerseyNumber: '23' };

describe('validateNewPlayerForm', () => {
  it('requires first name, last name and a jersey number 0-99', () => {
    expect(Object.keys(validateNewPlayerForm(EMPTY_NEW_PLAYER_FORM)).sort()).toEqual(['firstName', 'jerseyNumber', 'lastName']);
    expect(validateNewPlayerForm(filled)).toEqual({});
  });

  it('rejects a jersey number out of range or not a whole number', () => {
    expect(validateNewPlayerForm({ ...filled, jerseyNumber: '100' }).jerseyNumber).toMatch(/0 to 99/);
    expect(validateNewPlayerForm({ ...filled, jerseyNumber: '-1' }).jerseyNumber).toMatch(/0 to 99/);
    expect(validateNewPlayerForm({ ...filled, jerseyNumber: '7.5' }).jerseyNumber).toMatch(/0 to 99/);
  });

  it('accepts jersey number 0', () => {
    expect(validateNewPlayerForm({ ...filled, jerseyNumber: '0' })).toEqual({});
  });

  it('rejects a malformed email but allows a blank one', () => {
    expect(validateNewPlayerForm({ ...filled, email: 'nope' }).email).toMatch(/valid email/);
    expect(validateNewPlayerForm({ ...filled, email: '' })).toEqual({});
  });
});

describe('toNewPlayerPayload', () => {
  it('trims names, converts the jersey number, and leaves out blank optional fields', () => {
    expect(toNewPlayerPayload(filled, 't1')).toEqual({ teamId: 't1', firstName: 'Michael', lastName: 'Jordan', jerseyNumber: 23 });
  });

  it('adds confirmDuplicate only when asked', () => {
    expect(toNewPlayerPayload(filled, 't1', true)).toMatchObject({ confirmDuplicate: true });
    expect(toNewPlayerPayload(filled, 't1')).not.toHaveProperty('confirmDuplicate');
  });
});

describe('isPotentialDuplicateMessage', () => {
  it('recognises the duplicate-conflict message and nothing else', () => {
    expect(isPotentialDuplicateMessage('Potential duplicate found (82.00% similarity). Verify and confirm to proceed.')).toBe(true);
    expect(isPotentialDuplicateMessage('Jersey number 23 is already taken in this team')).toBe(false);
  });
});

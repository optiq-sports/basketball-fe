import { describe, it, expect } from 'vitest';
import {
  EMPTY_PLAYER_FORM,
  fromPlayer,
  positionLabel,
  toCreatePayload,
  toUpdatePayload,
  validatePlayerForm,
  type PlayerFormValues,
} from './player-form';
import type { Player } from '../../types/api';

const filled: PlayerFormValues = {
  ...EMPTY_PLAYER_FORM,
  firstName: 'Teddy',
  lastName: 'Okereafor',
  jerseyNumber: '5',
  teamId: 'team-1',
  position: 'POINT_GUARD',
  nationality: 'UK',
  height: "6'4\"",
};

describe('validatePlayerForm', () => {
  it('requires a team and a jersey number when creating, but not when editing', () => {
    const values = { ...EMPTY_PLAYER_FORM, firstName: 'Teddy', lastName: 'Okereafor' };
    expect(validatePlayerForm(values, false)).toEqual({
      jerseyNumber: 'Enter a jersey number.',
      teamId: 'Choose a team.',
    });
    expect(validatePlayerForm(values, true)).toEqual({});
  });

  it('always requires both names', () => {
    const errors = validatePlayerForm({ ...filled, firstName: '  ', lastName: '' }, true);
    expect(errors.firstName).toBe('Enter a first name.');
    expect(errors.lastName).toBe('Enter a last name.');
  });

  it('rejects a jersey number that is not a whole number from 0 to 99', () => {
    expect(validatePlayerForm({ ...filled, jerseyNumber: '7.5' }, false).jerseyNumber).toBeDefined();
    expect(validatePlayerForm({ ...filled, jerseyNumber: '100' }, false).jerseyNumber).toBeDefined();
    expect(validatePlayerForm({ ...filled, jerseyNumber: '0' }, false).jerseyNumber).toBeUndefined();
    expect(validatePlayerForm({ ...filled, jerseyNumber: '99' }, false).jerseyNumber).toBeUndefined();
  });

  it('accepts a blank email but rejects a malformed one', () => {
    expect(validatePlayerForm({ ...filled, email: '' }, false).email).toBeUndefined();
    expect(validatePlayerForm({ ...filled, email: 'teddy@' }, false).email).toBeDefined();
  });
});

describe('toCreatePayload', () => {
  it('sends the required fields and leaves blank optional ones out entirely', () => {
    expect(toCreatePayload(filled)).toEqual({
      teamId: 'team-1',
      firstName: 'Teddy',
      lastName: 'Okereafor',
      jerseyNumber: 5,
      position: 'POINT_GUARD',
      nationality: 'UK',
      height: "6'4\"",
    });
  });

  it('omits the position when it was left unset, rather than sending an empty string', () => {
    const body = toCreatePayload({ ...filled, position: '' });
    expect('position' in body).toBe(false);
  });
});

describe('toUpdatePayload', () => {
  it('sends only what changed', () => {
    expect(toUpdatePayload({ ...filled, height: "6'5\"" }, filled)).toEqual({ height: "6'5\"" });
  });

  it('sends nothing at all when nothing changed', () => {
    expect(toUpdatePayload(filled, filled)).toEqual({});
  });

  it('sends the jersey number with its team, because the backend ignores it on its own', () => {
    expect(toUpdatePayload({ ...filled, jerseyNumber: '12' }, filled)).toEqual({
      teamId: 'team-1',
      jerseyNumber: 12,
    });
  });

  it('leaves the jersey number alone when the player has no team to be numbered in', () => {
    const noTeam = { ...filled, teamId: '', jerseyNumber: '' };
    expect(toUpdatePayload({ ...noTeam, jerseyNumber: '12' }, noTeam)).toEqual({});
  });

  it('uses nationality, never country — the backend rejects country with a 400', () => {
    const body = toUpdatePayload({ ...filled, nationality: 'Spain' }, filled);
    expect(body).toEqual({ nationality: 'Spain' });
    expect('country' in body).toBe(false);
  });
});

describe('fromPlayer', () => {
  it('fills the form from a saved player, trimming the date to a day', () => {
    const player: Player = {
      id: 'p1',
      firstName: 'Fahro',
      lastName: 'Alihodzic',
      position: 'CENTER',
      height: "6'10\"",
      nationality: 'Bosnia',
      dateOfBirth: '1992-04-03T00:00:00.000Z',
      jerseyNumber: 15,
      teamId: 'team-1',
      teamName: 'MARKTOWN FLYERS',
    };
    expect(fromPlayer(player)).toMatchObject({
      firstName: 'Fahro',
      lastName: 'Alihodzic',
      jerseyNumber: '15',
      teamId: 'team-1',
      position: 'CENTER',
      nationality: 'Bosnia',
      dateOfBirth: '1992-04-03',
    });
  });

  it('copes with the nulls the backend sends for a player with no team', () => {
    const player: Player = {
      id: 'p2',
      firstName: 'Ada',
      lastName: 'Eze',
      position: null,
      jerseyNumber: null,
      teamId: null,
      teamName: null,
    };
    expect(fromPlayer(player)).toMatchObject({ jerseyNumber: '', teamId: '', position: '' });
  });
});

describe('positionLabel', () => {
  it('turns the backend enum into words', () => {
    expect(positionLabel('SHOOTING_GUARD')).toBe('Shooting guard');
  });

  it('is empty for a player with no position, rather than showing a raw value', () => {
    expect(positionLabel(null)).toBe('');
    expect(positionLabel(undefined)).toBe('');
    expect(positionLabel('SOMETHING_ELSE')).toBe('');
  });
});

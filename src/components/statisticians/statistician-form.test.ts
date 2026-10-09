import { describe, expect, it } from 'vitest';
import {
  EMPTY_STATISTICIAN_FORM,
  displayName,
  fromStatistician,
  generatePassword,
  locationOf,
  splitFullName,
  toCreatePayload,
  toUpdatePayload,
  validateStatisticianForm,
  type StatisticianFormValues,
} from './statistician-form';
import type { Statistician } from '../../types/api';

const saved: Statistician = {
  id: 's1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  status: 'ACTIVE',
  profile: { fullName: 'Ada King Lovelace', phone: '0801', country: 'Nigeria', state: 'Lagos', homeAddress: '1 Main St', photos: ['https://img/a.png'] },
};

describe('splitFullName', () => {
  it('uses the first word as first name and the rest as last name', () => {
    expect(splitFullName('Ada King Lovelace')).toEqual({ firstName: 'Ada', lastName: 'King Lovelace' });
    expect(splitFullName('Ada')).toEqual({ firstName: 'Ada', lastName: '' });
    expect(splitFullName(null)).toEqual({ firstName: '', lastName: '' });
  });
});

describe('displayName / locationOf', () => {
  it('prefers the profile name, then the user name, then the email', () => {
    expect(displayName(saved)).toBe('Ada King Lovelace');
    expect(displayName({ name: 'Ada', email: 'a@x.com' })).toBe('Ada');
    expect(displayName({ email: 'a@x.com' })).toBe('a@x.com');
  });
  it('joins state and country, skipping what is missing', () => {
    expect(locationOf(saved)).toBe('Lagos, Nigeria');
    expect(locationOf({ profile: { country: 'Ghana' } })).toBe('Ghana');
    expect(locationOf({})).toBe('');
  });
});

describe('generatePassword', () => {
  it('is 12 characters with upper, lower and a digit, and no look-alikes', () => {
    for (let i = 0; i < 50; i += 1) {
      const p = generatePassword();
      expect(p).toHaveLength(12);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[2-9]/);
      expect(p).not.toMatch(/[01OIl]/);
    }
  });
});

describe('validateStatisticianForm', () => {
  const create: StatisticianFormValues = { ...EMPTY_STATISTICIAN_FORM, firstName: 'Ada', lastName: 'L', email: 'ada@example.com', password: 'Abcdefg2hij' };

  it('accepts a complete create', () => {
    expect(validateStatisticianForm(create, EMPTY_STATISTICIAN_FORM, false)).toEqual({});
  });
  it('needs both names, an email and a password on a create', () => {
    const errors = validateStatisticianForm(EMPTY_STATISTICIAN_FORM, EMPTY_STATISTICIAN_FORM, false);
    expect(Object.keys(errors)).toEqual(['firstName', 'lastName', 'email', 'password']);
  });
  it('rejects a malformed email and a short password', () => {
    const errors = validateStatisticianForm({ ...create, email: 'nope', password: 'short' }, EMPTY_STATISTICIAN_FORM, false);
    expect(errors.email).toMatch(/valid email/);
    expect(errors.password).toMatch(/at least 8/);
  });
  it('does not need an email or password on an edit', () => {
    const base = fromStatistician(saved);
    expect(validateStatisticianForm(base, base, true)).toEqual({});
  });
  it('refuses to clear a stored field, because the backend would silently ignore it', () => {
    const base = fromStatistician(saved);
    const errors = validateStatisticianForm({ ...base, phone: '' }, base, true);
    expect(errors.phone).toMatch(/can’t be cleared/);
  });
  it('lets an empty field stay empty', () => {
    const base = fromStatistician({ ...saved, profile: { ...saved.profile, phone: null } });
    expect(validateStatisticianForm(base, base, true)).toEqual({});
  });
});

describe('payloads', () => {
  it('create sends the joined name and leaves blank optionals out', () => {
    const body = toCreatePayload({ ...EMPTY_STATISTICIAN_FORM, firstName: ' Ada ', lastName: 'Lovelace', email: ' ada@example.com ', password: 'Abcdefg2hij', phone: '  ' });
    expect(body).toEqual({
      email: 'ada@example.com',
      password: 'Abcdefg2hij',
      firstName: 'Ada',
      lastName: 'Lovelace',
      name: 'Ada Lovelace',
      status: 'ACTIVE',
    });
  });

  it('edit sends nothing when nothing changed', () => {
    const base = fromStatistician(saved);
    expect(toUpdatePayload(base, base)).toEqual({});
  });

  it('edit sends only the changed fields', () => {
    const base = fromStatistician(saved);
    expect(toUpdatePayload({ ...base, phone: '0802' }, base)).toEqual({ phone: '0802' });
  });

  it('a rename also sends `name`, which is what the list reads', () => {
    const base = fromStatistician(saved);
    expect(toUpdatePayload({ ...base, lastName: 'Byron' }, base)).toEqual({ firstName: 'Ada', lastName: 'Byron', name: 'Ada Byron' });
  });

  it('sends status and a new password when they are set', () => {
    const base = fromStatistician(saved);
    expect(toUpdatePayload({ ...base, status: 'INACTIVE', password: 'NewPass123' }, base)).toEqual({ status: 'INACTIVE', password: 'NewPass123' });
  });
});

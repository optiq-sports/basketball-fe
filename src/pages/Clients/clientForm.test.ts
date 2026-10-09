import { describe, expect, it } from 'vitest';
import { EMPTY_CLIENT_FORM, toClientCreate, validateClientForm } from './clientForm';

const filled = {
  ...EMPTY_CLIENT_FORM,
  name: '  Optiq Academy ',
  userEmail: 'coach@academy.test ',
  userFirstName: 'Jo',
  userLastName: 'Lee',
};

describe('validateClientForm', () => {
  it('requires a name, a valid primary-user email, and both names of that user', () => {
    const errors = validateClientForm(EMPTY_CLIENT_FORM);
    expect(Object.keys(errors).sort()).toEqual(['name', 'userEmail', 'userFirstName', 'userLastName']);
  });

  it('accepts a complete form with no optional fields', () => {
    expect(validateClientForm(filled)).toEqual({});
  });

  it('rejects a malformed email', () => {
    expect(validateClientForm({ ...filled, userEmail: 'not-an-email' }).userEmail).toMatch(/valid email/);
  });

  it('only checks website and logo if they were entered, and they must be http(s) URLs', () => {
    expect(validateClientForm({ ...filled, websiteUrl: '', logo: '' })).toEqual({});
    expect(validateClientForm({ ...filled, websiteUrl: 'academy.test' }).websiteUrl).toMatch(/http/);
    expect(validateClientForm({ ...filled, logo: 'ftp://x' }).logo).toMatch(/http/);
    expect(validateClientForm({ ...filled, websiteUrl: 'https://academy.test' })).toEqual({});
  });
});

describe('toClientCreate', () => {
  it('trims values and leaves out optional fields that were left blank', () => {
    expect(toClientCreate(filled)).toEqual({
      name: 'Optiq Academy',
      userEmail: 'coach@academy.test',
      userFirstName: 'Jo',
      userLastName: 'Lee',
    });
  });

  it('includes website and logo when they were entered', () => {
    const body = toClientCreate({ ...filled, websiteUrl: ' https://academy.test ', logo: 'https://academy.test/l.png' });
    expect(body.websiteUrl).toBe('https://academy.test');
    expect(body.logo).toBe('https://academy.test/l.png');
  });
});

import { describe, expect, it } from 'vitest';
import { isSelf, lockReason } from './admin-rules';
import {
  EMPTY_ADMIN_FORM,
  fromAdmin,
  toCreatePayload,
  toUpdatePayload,
  validateAdminForm,
} from './admin-form';
import type { Admin } from '../../types/api';

const sa1: Admin = { id: 'sa1', email: 'root@x.com', name: 'Root', role: 'SUPER_ADMIN', status: 'ACTIVE' };
const sa2: Admin = { id: 'sa2', email: 'two@x.com', role: 'SUPER_ADMIN', status: 'ACTIVE' };
const ad: Admin = { id: 'ad1', email: 'a@x.com', role: 'ADMIN', status: 'ACTIVE' };

describe('lockReason', () => {
  it('locks the signed-in account, matching by id', () => {
    expect(lockReason(sa1, [sa1, sa2, ad], { id: 'sa1', email: 'other@x.com' })).toMatch(/your own account/);
  });
  it('falls back to email (case-insensitive) when the profile has no id', () => {
    expect(isSelf(sa1, { email: 'ROOT@x.com' })).toBe(true);
    expect(isSelf(sa1, { email: 'two@x.com' })).toBe(false);
  });
  it('locks the only active super admin', () => {
    expect(lockReason(sa1, [sa1, ad], { id: 'ad1' })).toMatch(/only active super admin/);
  });
  it('does not count an inactive super admin as a spare', () => {
    expect(lockReason(sa1, [sa1, { ...sa2, status: 'INACTIVE' }], { id: 'ad1' })).toMatch(/only active super admin/);
  });
  it('lets one of two super admins be changed by the other', () => {
    expect(lockReason(sa2, [sa1, sa2], { id: 'sa1' })).toBeNull();
  });
  it('never locks a plain admin', () => {
    expect(lockReason(ad, [sa1, ad], { id: 'sa1' })).toBeNull();
  });
});

describe('admin form', () => {
  it('needs a valid email on a create but not a password', () => {
    expect(validateAdminForm(EMPTY_ADMIN_FORM, false).email).toMatch(/Enter an email/);
    expect(validateAdminForm({ ...EMPTY_ADMIN_FORM, email: 'nope' }, false).email).toMatch(/valid email/);
    expect(validateAdminForm({ ...EMPTY_ADMIN_FORM, email: 'a@x.com' }, false)).toEqual({});
  });
  it('rejects a short password but allows a blank one', () => {
    expect(validateAdminForm({ ...EMPTY_ADMIN_FORM, email: 'a@x.com', password: 'abc' }, false).password).toMatch(/at least 8/);
  });
  it('leaves the password out of a create when blank, so the backend emails one', () => {
    expect(toCreatePayload({ ...EMPTY_ADMIN_FORM, email: ' a@x.com ' })).toEqual({ email: 'a@x.com', role: 'ADMIN', status: 'ACTIVE' });
    expect(toCreatePayload({ ...EMPTY_ADMIN_FORM, email: 'a@x.com', name: ' Ann ', password: 'Abcdefg2hij' })).toMatchObject({ name: 'Ann', password: 'Abcdefg2hij' });
  });
  it('sends only what changed on an edit', () => {
    const base = fromAdmin(ad);
    expect(toUpdatePayload(base, base, false)).toEqual({});
    expect(toUpdatePayload({ ...base, role: 'SUPER_ADMIN', status: 'INACTIVE', name: 'Ann' }, base, false)).toEqual({ role: 'SUPER_ADMIN', status: 'INACTIVE', name: 'Ann' });
  });
  it('never sends role or status for a locked account', () => {
    const base = fromAdmin(sa1);
    expect(toUpdatePayload({ ...base, role: 'ADMIN', status: 'INACTIVE', name: 'R' }, base, true)).toEqual({ name: 'R' });
  });
});

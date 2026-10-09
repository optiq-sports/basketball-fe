import type { Admin } from '../../types/api';

/**
 * Guards the backend doesn't have. `AdminService` will happily deactivate or demote any account,
 * including the signed-in one and the last active super admin — which locks everyone out of this
 * screen, since only a SUPER_ADMIN can reach it. These rules keep that from happening from the UI;
 * they don't replace a server-side check (Gap 41).
 */
export interface Me {
  id?: string;
  email?: string;
}

const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export const isSelf = (admin: Pick<Admin, 'id' | 'email'>, me?: Me): boolean =>
  !!me && (me.id ? me.id === admin.id : same(me.email, admin.email));

export const isActiveSuperAdmin = (a: Pick<Admin, 'role' | 'status'>): boolean =>
  a.role === 'SUPER_ADMIN' && a.status !== 'INACTIVE';

/** Why this account's role and status can't be changed, or null when they can. */
export function lockReason(admin: Admin, all: Admin[], me?: Me): string | null {
  if (isSelf(admin, me)) return 'This is your own account. Ask another super admin to change its role or status.';
  if (isActiveSuperAdmin(admin) && all.filter(isActiveSuperAdmin).length <= 1) {
    return 'This is the only active super admin. Make another one first, or no one could manage admins.';
  }
  return null;
}

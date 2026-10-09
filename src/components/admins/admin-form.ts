import { z } from 'zod';
import type { Admin, AdminCreateBody, AdminRole, AdminUpdateBody } from '../../types/api';
import { EMAIL_RE, zodErrors } from '../../lib/form';

export interface AdminFormValues {
  email: string;
  name: string;
  role: AdminRole;
  status: 'ACTIVE' | 'INACTIVE';
  password: string;
}

export const EMPTY_ADMIN_FORM: AdminFormValues = { email: '', name: '', role: 'ADMIN', status: 'ACTIVE', password: '' };

export const ROLES: Array<{ value: AdminRole; label: string }> = [
  { value: 'SUPER_ADMIN', label: 'Super administrator' },
  { value: 'ADMIN', label: 'Administrator' },
];

export const roleLabel = (role?: string): string => ROLES.find((r) => r.value === role)?.label ?? role ?? '—';

export const MIN_PASSWORD_LENGTH = 8;

export type AdminFormErrors = Partial<Record<keyof AdminFormValues, string>>;

/** A create needs an email; a password is optional (blank means the backend emails a temporary one). */
export const adminFormSchema = (editing: boolean): z.ZodType<AdminFormValues, AdminFormValues> =>
  z
    .object({
      email: z.string(),
      name: z.string(),
      role: z.enum(['SUPER_ADMIN', 'ADMIN']),
      status: z.enum(['ACTIVE', 'INACTIVE']),
      password: z.string(),
    })
    .superRefine((v, ctx) => {
      const add = (path: keyof AdminFormValues, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
      if (!editing) {
        if (!v.email.trim()) add('email', 'Enter an email address.');
        else if (!EMAIL_RE.test(v.email.trim())) add('email', 'Enter a valid email address.');
      }
      if (v.password && v.password.length < MIN_PASSWORD_LENGTH) {
        add('password', `Use at least ${MIN_PASSWORD_LENGTH} characters, or leave it blank.`);
      }
    });

export const validateAdminForm = (v: AdminFormValues, editing: boolean): AdminFormErrors => zodErrors(adminFormSchema(editing), v);

export function toCreatePayload(v: AdminFormValues): AdminCreateBody {
  return {
    email: v.email.trim(),
    role: v.role,
    status: v.status,
    ...(v.name.trim() ? { name: v.name.trim() } : {}),
    ...(v.password ? { password: v.password } : {}),
  };
}

/** Only what changed. A locked account (yourself, the last super admin) never sends role or status. */
export function toUpdatePayload(v: AdminFormValues, baseline: AdminFormValues, locked: boolean): AdminUpdateBody {
  const body: AdminUpdateBody = {};
  if (v.name.trim() !== baseline.name.trim()) body.name = v.name.trim();
  if (!locked && v.role !== baseline.role) body.role = v.role;
  if (!locked && v.status !== baseline.status) body.status = v.status;
  if (v.password) body.password = v.password;
  return body;
}

export function fromAdmin(a: Admin): AdminFormValues {
  return {
    email: a.email,
    name: a.name ?? '',
    role: a.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
    status: a.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    password: '',
  };
}

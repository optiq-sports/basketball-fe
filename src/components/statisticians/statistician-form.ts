import { z } from 'zod';
import type { Statistician, StatisticianCreateBody, StatisticianUpdateBody } from '../../types/api';
import { EMAIL_RE, requiredText, zodErrors } from '../../lib/form';

/** Values as typed. `password` is only used on a create, or when an edit sets a new one. */
export interface StatisticianFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  country: string;
  state: string;
  homeAddress: string;
  photo: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export const EMPTY_STATISTICIAN_FORM: StatisticianFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  country: '',
  state: '',
  homeAddress: '',
  photo: '',
  status: 'ACTIVE',
};

export type StatisticianFormErrors = Partial<Record<keyof StatisticianFormValues, string>>;

/** The backend's `CreateAdminDto` has `@MinLength(6)`; statisticians have no minimum, but 8 is sane. */
export const MIN_PASSWORD_LENGTH = 8;

/** Readable 12-character password with no look-alike characters (no 0/O, 1/l/I). */
export function generatePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  const pick = (set: string, i: number) => set[bytes[i] % set.length];
  const chars = [pick(upper, 0), pick(lower, 1), pick(digits, 2)];
  for (let i = 3; i < length; i += 1) chars.push(pick(all, i));
  // Fisher–Yates with fresh randomness, so the guaranteed characters don't always lead.
  const swap = new Uint32Array(length);
  crypto.getRandomValues(swap);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = swap[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Splits the profile's `fullName` back into first and last. The backend stores only the joined string
 * ("first last"), so the first word is the first name and the rest is the last name.
 */
export function splitFullName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

/** What to call a statistician: their full name, else the user name, else the email. */
export function displayName(s: Pick<Statistician, 'name' | 'email' | 'profile'>): string {
  return s.profile?.fullName?.trim() || s.name?.trim() || s.email || 'Unnamed statistician';
}

/**
 * The statistician form's rules, mirroring `CreateStatisticianDto`: an email is the only required field
 * there. We also require both names, because the backend builds the display name only when it gets
 * *both*; with one, the account is created with no name at all.
 *
 * On an edit, the backend ignores any empty value (`if (phone) ...`), so a field that had a value can't
 * be cleared yet. Saying so beats a save that appears to work and then reverts on reload. That is why
 * the schema needs the stored values.
 */
export const statisticianFormSchema = (baseline: StatisticianFormValues, editing: boolean): z.ZodType<StatisticianFormValues, StatisticianFormValues> =>
  z
    .object({
      firstName: requiredText('Enter a first name.'),
      lastName: requiredText('Enter a last name.'),
      email: z.string(),
      password: z.string(),
      phone: z.string(),
      country: z.string(),
      state: z.string(),
      homeAddress: z.string(),
      photo: z.string(),
      status: z.enum(['ACTIVE', 'INACTIVE']),
    })
    .superRefine((v, ctx) => {
      const add = (path: keyof StatisticianFormValues, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
      if (!editing) {
        if (!v.email.trim()) add('email', 'Enter an email address.');
        else if (!EMAIL_RE.test(v.email.trim())) add('email', 'Enter a valid email address.');
      }
      if (!editing && !v.password) add('password', 'Set a password. Generate one if you like.');
      else if (v.password && v.password.length < MIN_PASSWORD_LENGTH) {
        add('password', `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      }
      if (editing) {
        for (const k of ['phone', 'country', 'state', 'homeAddress'] as const) {
          if (baseline[k].trim() && !v[k].trim()) {
            add(k, 'This can’t be cleared yet. Enter a new value, or leave it as it was.');
          }
        }
      }
    });

export const validateStatisticianForm = (
  v: StatisticianFormValues,
  baseline: StatisticianFormValues,
  editing: boolean,
): StatisticianFormErrors => zodErrors(statisticianFormSchema(baseline, editing), v);

const trimmed = (s: string) => (s.trim() ? s.trim() : undefined);

/** Body for `POST /statistician`. Blank optional fields are left out, not sent as empty strings. */
export function toCreatePayload(v: StatisticianFormValues): StatisticianCreateBody {
  const firstName = v.firstName.trim();
  const lastName = v.lastName.trim();
  return {
    email: v.email.trim(),
    password: v.password,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    status: v.status,
    ...(trimmed(v.phone) ? { phone: trimmed(v.phone) } : {}),
    ...(trimmed(v.country) ? { country: trimmed(v.country) } : {}),
    ...(trimmed(v.state) ? { state: trimmed(v.state) } : {}),
    ...(trimmed(v.homeAddress) ? { homeAddress: trimmed(v.homeAddress) } : {}),
    ...(trimmed(v.photo) ? { photo: trimmed(v.photo) } : {}),
  };
}

/**
 * Body for `PATCH /statistician/:id`, only what changed. A name change sends `name` as well as
 * `firstName`/`lastName`: the backend writes the first two to the profile's `fullName` only and the
 * list reads the user's `name`, so without it a rename would not show up anywhere.
 */
export function toUpdatePayload(v: StatisticianFormValues, baseline: StatisticianFormValues): StatisticianUpdateBody {
  const body: StatisticianUpdateBody = {};
  const changed = (k: keyof StatisticianFormValues) => v[k].trim() !== baseline[k].trim();

  if (changed('firstName') || changed('lastName')) {
    const firstName = v.firstName.trim();
    const lastName = v.lastName.trim();
    body.firstName = firstName;
    body.lastName = lastName;
    body.name = `${firstName} ${lastName}`;
  }
  if (changed('phone')) body.phone = v.phone.trim();
  if (changed('country')) body.country = v.country.trim();
  if (changed('state')) body.state = v.state.trim();
  if (changed('homeAddress')) body.homeAddress = v.homeAddress.trim();
  if (changed('photo')) body.photo = v.photo.trim();
  if (v.status !== baseline.status) body.status = v.status;
  if (v.password) body.password = v.password;
  return body;
}

/** Pre-fills the form from a saved statistician, so editing starts from what's stored. */
export function fromStatistician(s: Statistician): StatisticianFormValues {
  const { firstName, lastName } = splitFullName(s.profile?.fullName ?? s.name);
  return {
    firstName,
    lastName,
    email: s.email ?? '',
    password: '',
    phone: s.profile?.phone ?? '',
    country: s.profile?.country ?? '',
    state: s.profile?.state ?? '',
    homeAddress: s.profile?.homeAddress ?? '',
    photo: s.profile?.photos?.[0] ?? '',
    status: s.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
  };
}

/** "Lagos, Nigeria" from whichever of state and country are set; empty when neither is. */
export function locationOf(s: Pick<Statistician, 'profile'>): string {
  return [s.profile?.state, s.profile?.country].filter(Boolean).join(', ');
}

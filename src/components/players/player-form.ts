import { z } from 'zod';
import type { Player, PlayerCreateForTeam, PlayerPosition, PlayerUpdateBody } from '../../types/api';
import { EMAIL_RE, optionalMatching, requiredText, zodErrors } from '../../lib/form';

/** Values as typed. The jersey number stays a string until it's checked and sent. */
export interface PlayerFormValues {
  firstName: string;
  lastName: string;
  jerseyNumber: string;
  teamId: string;
  position: string;
  nationality: string;
  height: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  photo: string;
}

/** The five values of the backend's `PlayerPosition` enum. "" means none, which it accepts. */
export const POSITIONS: Array<{ value: PlayerPosition; label: string }> = [
  { value: 'POINT_GUARD', label: 'Point guard' },
  { value: 'SHOOTING_GUARD', label: 'Shooting guard' },
  { value: 'SMALL_FORWARD', label: 'Small forward' },
  { value: 'POWER_FORWARD', label: 'Power forward' },
  { value: 'CENTER', label: 'Center' },
];

export const positionLabel = (value?: string | null): string =>
  (value && POSITIONS.find((p) => p.value === value)?.label) || '';

export const EMPTY_PLAYER_FORM: PlayerFormValues = {
  firstName: '',
  lastName: '',
  jerseyNumber: '',
  teamId: '',
  position: '',
  nationality: '',
  height: '',
  dateOfBirth: '',
  email: '',
  phone: '',
  photo: '',
};

export type PlayerFormErrors = Partial<Record<keyof PlayerFormValues, string>>;

/**
 * The player form's rules, mirroring the backend's DTOs: a create needs a first name, a last name, a
 * team and a jersey number (`CreatePlayerForTeamDto`), while an edit needs only the names
 * (`UpdatePlayerDto` makes everything optional). The server checks again, including that the jersey is
 * free in that team.
 *
 * On an edit the team and jersey are only sent together, so a blank jersey just means "leave it".
 */
export const playerFormSchema = (editing: boolean): z.ZodType<PlayerFormValues, PlayerFormValues> =>
  z
    .object({
      firstName: requiredText('Enter a first name.'),
      lastName: requiredText('Enter a last name.'),
      jerseyNumber: z.string(),
      teamId: z.string(),
      position: z.string(),
      nationality: z.string(),
      height: z.string(),
      dateOfBirth: z.string(),
      email: optionalMatching(EMAIL_RE, 'Enter a valid email address, or leave it blank.'),
      phone: z.string(),
      photo: z.string(),
    })
    .superRefine((v, ctx) => {
      const jersey = v.jerseyNumber.trim();
      if (!editing && !jersey) {
        ctx.addIssue({ code: 'custom', path: ['jerseyNumber'], message: 'Enter a jersey number.' });
      } else if (jersey && (!/^\d+$/.test(jersey) || Number(jersey) > 99)) {
        ctx.addIssue({ code: 'custom', path: ['jerseyNumber'], message: 'Use a whole number from 0 to 99.' });
      }
      if (!editing && !v.teamId) ctx.addIssue({ code: 'custom', path: ['teamId'], message: 'Choose a team.' });
    });

export const validatePlayerForm = (v: PlayerFormValues, editing: boolean): PlayerFormErrors =>
  zodErrors(playerFormSchema(editing), v);

const trimmed = (s: string) => (s.trim() ? s.trim() : undefined);

/** Body for `POST /players/team`. Blank optional fields are left out, not sent as empty strings. */
export function toCreatePayload(v: PlayerFormValues): PlayerCreateForTeam {
  return {
    teamId: v.teamId,
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    jerseyNumber: Number(v.jerseyNumber),
    ...(v.position ? { position: v.position } : {}),
    ...(trimmed(v.nationality) ? { nationality: trimmed(v.nationality) } : {}),
    ...(trimmed(v.height) ? { height: trimmed(v.height) } : {}),
    ...(v.dateOfBirth ? { dateOfBirth: v.dateOfBirth } : {}),
    ...(trimmed(v.email) ? { email: trimmed(v.email) } : {}),
    ...(trimmed(v.phone) ? { phone: trimmed(v.phone) } : {}),
    ...(trimmed(v.photo) ? { photo: trimmed(v.photo) } : {}),
  };
}

/**
 * Body for `PATCH /players/:id`. Only what actually changed is sent, so an edit can't quietly
 * overwrite a field someone else just set. `teamId` and `jerseyNumber` go together or not at all —
 * the backend ignores a jersey number without the team it belongs to.
 */
export function toUpdatePayload(v: PlayerFormValues, baseline: PlayerFormValues): PlayerUpdateBody {
  const body: PlayerUpdateBody = {};
  const changed = (k: keyof PlayerFormValues) => v[k].trim() !== baseline[k].trim();

  if (changed('firstName')) body.firstName = v.firstName.trim();
  if (changed('lastName')) body.lastName = v.lastName.trim();
  if (changed('position')) body.position = v.position || undefined;
  if (changed('nationality')) body.nationality = v.nationality.trim();
  if (changed('height')) body.height = v.height.trim();
  if (changed('dateOfBirth')) body.dateOfBirth = v.dateOfBirth || undefined;
  if (changed('email')) body.email = v.email.trim();
  if (changed('phone')) body.phone = v.phone.trim();
  if (changed('photo')) body.photo = v.photo.trim();

  const jersey = v.jerseyNumber.trim();
  if (jersey && changed('jerseyNumber') && v.teamId) {
    body.teamId = v.teamId;
    body.jerseyNumber = Number(jersey);
  }
  return body;
}

/** Pre-fills the form from a saved player, so editing starts from what's stored. */
export function fromPlayer(p: Player): PlayerFormValues {
  return {
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    jerseyNumber: p.jerseyNumber != null ? String(p.jerseyNumber) : '',
    teamId: p.teamId ?? '',
    position: typeof p.position === 'string' ? p.position : '',
    nationality: p.nationality ?? '',
    height: p.height ?? '',
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.slice(0, 10) : '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    photo: p.photo ?? '',
  };
}

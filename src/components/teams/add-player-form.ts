import { z } from 'zod';
import type { PlayerCreateForTeam, PlayerPosition } from '../../types/api';
import { EMAIL_RE, optionalMatching, requiredText, zodErrors } from '../../lib/form';

export interface NewPlayerFormValues {
  firstName: string;
  lastName: string;
  jerseyNumber: string;
  position: '' | PlayerPosition;
  height: string;
  dateOfBirth: string;
  nationality: string;
  phone: string;
  email: string;
  photo: string;
}

export const EMPTY_NEW_PLAYER_FORM: NewPlayerFormValues = {
  firstName: '',
  lastName: '',
  jerseyNumber: '',
  position: '',
  height: '',
  dateOfBirth: '',
  nationality: '',
  phone: '',
  email: '',
  photo: '',
};

export type NewPlayerFormErrors = Partial<Record<keyof NewPlayerFormValues, string>>;

const jerseyRule = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 99;
};

const POSITION_VALUES = ['POINT_GUARD', 'SHOOTING_GUARD', 'SMALL_FORWARD', 'POWER_FORWARD', 'CENTER'] as const;

/** Mirrors `CreatePlayerForTeamDto`: name and a jersey number (0 to 99) are required; the rest is optional. */
export const newPlayerFormSchema: z.ZodType<NewPlayerFormValues, NewPlayerFormValues> = z.object({
  firstName: requiredText('Enter a first name.'),
  lastName: requiredText('Enter a last name.'),
  jerseyNumber: z.string().refine(jerseyRule, 'Enter a jersey number from 0 to 99.'),
  position: z.union([z.literal(''), z.enum(POSITION_VALUES)]),
  height: z.string(),
  dateOfBirth: z.string(),
  nationality: z.string(),
  phone: z.string(),
  email: optionalMatching(EMAIL_RE, 'Enter a valid email address.'),
  photo: z.string(),
});

/** Assigning someone who already exists: a player to pick and a jersey number for this team. */
export interface AssignPlayerFormValues {
  playerId: string;
  jerseyNumber: string;
}

export const assignPlayerFormSchema: z.ZodType<AssignPlayerFormValues, AssignPlayerFormValues> = z.object({
  playerId: z.string().min(1, 'Choose a player.'),
  jerseyNumber: z.string().refine(jerseyRule, 'Enter a jersey number from 0 to 99.'),
});

export const validateNewPlayerForm = (v: NewPlayerFormValues): NewPlayerFormErrors => zodErrors(newPlayerFormSchema, v);

const optional = (s: string) => (s.trim() ? s.trim() : undefined);

export function toNewPlayerPayload(v: NewPlayerFormValues, teamId: string, confirmDuplicate = false): PlayerCreateForTeam {
  return {
    teamId,
    firstName: v.firstName.trim(),
    lastName: v.lastName.trim(),
    jerseyNumber: Number(v.jerseyNumber),
    ...(v.position ? { position: v.position } : {}),
    ...(optional(v.height) ? { height: optional(v.height) } : {}),
    ...(optional(v.dateOfBirth) ? { dateOfBirth: optional(v.dateOfBirth) } : {}),
    ...(optional(v.nationality) ? { nationality: optional(v.nationality) } : {}),
    ...(optional(v.phone) ? { phone: optional(v.phone) } : {}),
    ...(optional(v.email) ? { email: optional(v.email) } : {}),
    ...(optional(v.photo) ? { photo: optional(v.photo) } : {}),
    ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
  };
}

/** The backend's potential-duplicate conflict offers a "create anyway" retry; other 409s (e.g. jersey taken) don't. */
export function isPotentialDuplicateMessage(message: string): boolean {
  return /potential duplicate/i.test(message);
}

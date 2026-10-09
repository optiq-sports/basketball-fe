import { z } from 'zod';
import type { TeamCreate } from '../../types/api';
import { optionalMatching, requiredText, zodErrors } from '../../lib/form';

export interface TeamFormValues {
  name: string;
  code: string;
  color: string;
  logo: string;
  country: string;
  state: string;
  coach: string;
  assistantCoach: string;
}

export const EMPTY_TEAM_FORM: TeamFormValues = {
  name: '',
  code: '',
  color: '',
  logo: '',
  country: '',
  state: '',
  coach: '',
  assistantCoach: '',
};

export type TeamFormErrors = Partial<Record<keyof TeamFormValues, string>>;

const HEX = /^#[0-9a-f]{3,8}$/i;

/** The team form's rules. Only name and code are required, matching the backend's DTO. */
export const teamFormSchema: z.ZodType<TeamFormValues, TeamFormValues> = z.object({
  name: requiredText('Enter the team’s name.'),
  code: z.string().trim().min(1, 'Enter a short code, e.g. LAL.').max(10, 'Keep the code to 10 characters or fewer.'),
  color: optionalMatching(HEX, 'Use a hex colour, e.g. #FF6B2C.'),
  logo: z.string(),
  country: z.string(),
  state: z.string(),
  coach: z.string(),
  assistantCoach: z.string(),
});

/** Field errors for the team form, without a form around it. */
export const validateTeamForm = (v: TeamFormValues): TeamFormErrors => zodErrors(teamFormSchema, v);

const optional = (s: string) => (s.trim() ? s.trim() : undefined);

/** Builds the request body. Blank optional fields are left out, not sent as empty strings. */
export function toTeamPayload(v: TeamFormValues): TeamCreate {
  return {
    name: v.name.trim(),
    code: v.code.trim().toUpperCase(),
    ...(optional(v.color) ? { color: optional(v.color) } : {}),
    ...(optional(v.logo) ? { logo: optional(v.logo) } : {}),
    ...(optional(v.country) ? { country: optional(v.country) } : {}),
    ...(optional(v.state) ? { state: optional(v.state) } : {}),
    ...(optional(v.coach) ? { coach: optional(v.coach) } : {}),
    ...(optional(v.assistantCoach) ? { assistantCoach: optional(v.assistantCoach) } : {}),
  };
}

export function fromTeam(t: { name: string; code: string; color?: string | null; logo?: string | null; country?: string | null; state?: string | null; coach?: string | null; assistantCoach?: string | null }): TeamFormValues {
  return {
    name: t.name,
    code: t.code,
    color: t.color ?? '',
    logo: t.logo ?? '',
    country: t.country ?? '',
    state: t.state ?? '',
    coach: t.coach ?? '',
    assistantCoach: t.assistantCoach ?? '',
  };
}

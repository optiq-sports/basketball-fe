import { z } from 'zod';
import type { TeamCreate } from '../../types/api';
import { EMAIL_RE, optionalMatching, requiredText, zodErrors } from '../../lib/form';

export interface TeamFormValues {
  name: string;
  code: string;
  color: string;
  logo: string;
  country: string;
  state: string;
  coach: string;
  assistantCoach: string;
  arena: string;
  /** Kept as typed, so a half-entered year doesn't become a number mid-edit. */
  foundedYear: string;
  contactEmail: string;
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
  arena: '',
  foundedYear: '',
  contactEmail: '',
};

export type TeamFormErrors = Partial<Record<keyof TeamFormValues, string>>;

const HEX = /^#[0-9a-f]{3,8}$/i;
const YEAR = /^\d{4}$/;

/**
 * The team form's rules. Only name and code are required, matching the backend's DTO.
 *
 * `arena`, `foundedYear` and `contactEmail` are editable here as of the 14 Oct 2026 backend push: the
 * DTO had accepted all three for a while, but the columns didn't exist until that migration (Gap 54),
 * so there was nowhere to put them.
 */
export const teamFormSchema: z.ZodType<TeamFormValues, TeamFormValues> = z.object({
  name: requiredText('Enter the team’s name.'),
  code: z.string().trim().min(1, 'Enter a short code, e.g. LAL.').max(10, 'Keep the code to 10 characters or fewer.'),
  color: optionalMatching(HEX, 'Use a hex colour, e.g. #FF6B2C.'),
  logo: z.string(),
  country: z.string(),
  state: z.string(),
  coach: z.string(),
  assistantCoach: z.string(),
  arena: z.string(),
  foundedYear: optionalMatching(YEAR, 'Use a four-digit year, e.g. 1998.'),
  contactEmail: optionalMatching(EMAIL_RE, 'Enter a valid email address, or leave it blank.'),
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
    ...(optional(v.arena) ? { arena: optional(v.arena) } : {}),
    ...(optional(v.foundedYear) ? { foundedYear: Number(v.foundedYear.trim()) } : {}),
    ...(optional(v.contactEmail) ? { contactEmail: optional(v.contactEmail) } : {}),
  };
}

export function fromTeam(t: {
  name: string;
  code: string;
  color?: string | null;
  logo?: string | null;
  country?: string | null;
  state?: string | null;
  coach?: string | null;
  assistantCoach?: string | null;
  arena?: string | null;
  foundedYear?: number | null;
  contactEmail?: string | null;
}): TeamFormValues {
  return {
    name: t.name,
    code: t.code,
    color: t.color ?? '',
    logo: t.logo ?? '',
    country: t.country ?? '',
    state: t.state ?? '',
    coach: t.coach ?? '',
    assistantCoach: t.assistantCoach ?? '',
    arena: t.arena ?? '',
    foundedYear: t.foundedYear != null ? String(t.foundedYear) : '',
    contactEmail: t.contactEmail ?? '',
  };
}

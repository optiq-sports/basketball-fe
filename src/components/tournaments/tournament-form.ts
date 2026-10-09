import { z } from 'zod';
import type { TournamentCreate, TournamentDivision } from '../../types/api';
import { zodErrors } from '../../lib/form';

/** Values as typed. Numbers stay strings until they're checked and sent. */
export interface TournamentFormValues {
  name: string;
  division: TournamentDivision;
  numberOfGames: string;
  numberOfQuarters: string;
  quarterDuration: string;
  overtimeDuration: string;
  startDate: string;
  endDate: string;
  venue: string;
  crewChief: string;
  umpire1: string;
  umpire2: string;
  commissioner: string;
  flyer: string;
}

export const DIVISIONS: Array<{ value: TournamentDivision; label: string }> = [
  { value: 'PREMIER', label: 'Premier' },
  { value: 'DIVISION_1', label: 'Division 1' },
  { value: 'DIVISION_2', label: 'Division 2' },
  { value: 'DIVISION_3', label: 'Division 3' },
  { value: 'JUNIOR', label: 'Junior' },
];

export const divisionLabel = (value: string): string => DIVISIONS.find((d) => d.value === value)?.label ?? value;

export const EMPTY_TOURNAMENT_FORM: TournamentFormValues = {
  name: '',
  division: 'PREMIER',
  numberOfGames: '10',
  numberOfQuarters: '4',
  quarterDuration: '10',
  overtimeDuration: '5',
  startDate: '',
  endDate: '',
  venue: '',
  crewChief: '',
  umpire1: '',
  umpire2: '',
  commissioner: '',
  flyer: '',
};

export type TournamentFormErrors = Partial<Record<keyof TournamentFormValues, string>>;

const WHOLE_NUMBER = /^\d+$/;

/** A whole number of 1 or more, typed as text. Blank is fine only when `optional`. */
const wholeNumber = (label: string, optional = false) =>
  z.string().superRefine((raw, ctx) => {
    const v = raw.trim();
    if (!v) {
      if (!optional) ctx.addIssue({ code: 'custom', message: `Enter ${label}.` });
      return;
    }
    if (!WHOLE_NUMBER.test(v) || Number(v) < 1) {
      ctx.addIssue({ code: 'custom', message: `${label[0].toUpperCase()}${label.slice(1)} must be a whole number, 1 or more.` });
    }
  });

/**
 * The tournament form's rules. They mirror the backend's DTO: name, division, games, quarter length,
 * start date, venue, crew chief and umpire 2 are required. The server checks again.
 */
export const tournamentFormSchema: z.ZodType<TournamentFormValues, TournamentFormValues> = z
  .object({
    name: z.string().trim().min(1, 'Enter the tournament’s name.').max(120, 'Keep the name under 120 characters.'),
    division: z.enum(['PREMIER', 'DIVISION_1', 'DIVISION_2', 'DIVISION_3', 'JUNIOR'], { error: 'Choose a division.' }),
    numberOfGames: wholeNumber('number of games'),
    numberOfQuarters: wholeNumber('number of quarters', true),
    quarterDuration: wholeNumber('quarter length (minutes)'),
    overtimeDuration: wholeNumber('overtime length (minutes)', true),
    startDate: z.string().min(1, 'Choose a start date.'),
    endDate: z.string(),
    venue: z.string().trim().min(1, 'Enter the venue.'),
    crewChief: z.string().trim().min(1, 'Enter the crew chief.'),
    umpire1: z.string(),
    umpire2: z.string().trim().min(1, 'Enter the second umpire.'),
    commissioner: z.string(),
    flyer: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.startDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'The end date is before the start date.' });
    }
  });

export const validateTournamentForm = (v: TournamentFormValues): TournamentFormErrors => zodErrors(tournamentFormSchema, v);

const optionalText = (s: string) => (s.trim() ? s.trim() : undefined);

/** Builds the request body. Blank optional fields are left out, not sent as empty strings. */
export function toTournamentPayload(v: TournamentFormValues): TournamentCreate {
  return {
    name: v.name.trim(),
    division: v.division,
    numberOfGames: Number(v.numberOfGames),
    ...(v.numberOfQuarters.trim() ? { numberOfQuarters: Number(v.numberOfQuarters) } : {}),
    quarterDuration: Number(v.quarterDuration),
    ...(v.overtimeDuration.trim() ? { overtimeDuration: Number(v.overtimeDuration) } : {}),
    startDate: v.startDate,
    ...(v.endDate ? { endDate: v.endDate } : {}),
    venue: v.venue.trim(),
    crewChief: v.crewChief.trim(),
    ...(optionalText(v.umpire1) ? { umpire1: optionalText(v.umpire1) } : {}),
    umpire2: v.umpire2.trim(),
    ...(optionalText(v.commissioner) ? { commissioner: optionalText(v.commissioner) } : {}),
    ...(optionalText(v.flyer) ? { flyer: optionalText(v.flyer) } : {}),
  };
}

/** Pre-fills the form from a saved tournament, so editing starts from what's stored. */
export function fromTournament(t: {
  name: string;
  division: TournamentDivision;
  numberOfGames: number;
  numberOfQuarters?: number;
  quarterDuration: number;
  overtimeDuration?: number;
  startDate: string;
  endDate?: string;
  venue?: string;
  crewChief?: string;
  umpire1?: string;
  umpire2?: string;
  commissioner?: string;
  flyer?: string;
}): TournamentFormValues {
  const day = (iso?: string) => (iso ? iso.slice(0, 10) : '');
  return {
    name: t.name,
    division: t.division,
    numberOfGames: String(t.numberOfGames),
    numberOfQuarters: t.numberOfQuarters != null ? String(t.numberOfQuarters) : '',
    quarterDuration: String(t.quarterDuration),
    overtimeDuration: t.overtimeDuration != null ? String(t.overtimeDuration) : '',
    startDate: day(t.startDate),
    endDate: day(t.endDate),
    venue: t.venue ?? '',
    crewChief: t.crewChief ?? '',
    umpire1: t.umpire1 ?? '',
    umpire2: t.umpire2 ?? '',
    commissioner: t.commissioner ?? '',
    flyer: t.flyer ?? '',
  };
}

import { z } from 'zod';
import type { MatchCreate, MatchStatus } from '../../types/api';
import { zodErrors } from '../../lib/form';

export interface FixtureFormValues {
  homeTeamId: string;
  awayTeamId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  venue: string;
  statisticianId: string; // '' = unassigned
  status: MatchStatus;
}

export const EMPTY_FIXTURE_FORM: FixtureFormValues = {
  homeTeamId: '',
  awayTeamId: '',
  date: '',
  time: '18:00',
  venue: '',
  statisticianId: '',
  status: 'SCHEDULED',
};

/** Statuses an admin may set by hand. LIVE and COMPLETED come from the scorer, from the game itself. */
export const ADMIN_SETTABLE_STATUSES: MatchStatus[] = ['SCHEDULED', 'CANCELLED', 'POSTPONED'];

export const STATUS_LABELS: Record<MatchStatus, string> = {
  SCHEDULED: 'Scheduled',
  LIVE: 'Live',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  POSTPONED: 'Postponed',
};

export type FixtureFormErrors = Partial<Record<keyof FixtureFormValues, string>>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

export interface FixtureRules {
  editing: boolean;
  currentStatus?: MatchStatus;
}

/**
 * The fixture form's rules, for one tournament. They mirror the backend: both teams must be in the
 * tournament and differ, and a date is required. The server checks again, and its messages are shown
 * as they come. The teams only matter on a create; an edit can't change them.
 */
export const fixtureFormSchema = (tournamentTeamIds: Set<string>, opts: FixtureRules): z.ZodType<FixtureFormValues, FixtureFormValues> =>
  z
    .object({
      homeTeamId: z.string(),
      awayTeamId: z.string(),
      date: z.string().refine((v) => DATE.test(v) && !Number.isNaN(new Date(v).getTime()), 'Choose a date.'),
      time: z.string().refine((v) => TIME.test(v), 'Enter the start time as HH:MM.'),
      venue: z.string().refine((v) => v.trim().length <= 120, 'Keep the venue under 120 characters.'),
      statisticianId: z.string(),
      status: z.enum(['SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED', 'POSTPONED']),
    })
    .superRefine((v, ctx) => {
      const add = (path: keyof FixtureFormValues, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
      if (!opts.editing) {
        if (!v.homeTeamId) add('homeTeamId', 'Choose the home team.');
        else if (!tournamentTeamIds.has(v.homeTeamId)) add('homeTeamId', 'That team isn’t in this tournament.');
        if (!v.awayTeamId) add('awayTeamId', 'Choose the away team.');
        else if (!tournamentTeamIds.has(v.awayTeamId)) add('awayTeamId', 'That team isn’t in this tournament.');
        if (v.homeTeamId && v.homeTeamId === v.awayTeamId) add('awayTeamId', 'The away team must be different from the home team.');
      }
      if (opts.currentStatus && !ADMIN_SETTABLE_STATUSES.includes(opts.currentStatus) && v.status !== opts.currentStatus) {
        add('status', 'A live or finished game’s status is set by the scorer.');
      }
    });

/** Field errors for a fixture, without a form around it. */
export const validateFixtureForm = (v: FixtureFormValues, tournamentTeamIds: Set<string>, opts: FixtureRules): FixtureFormErrors =>
  zodErrors(fixtureFormSchema(tournamentTeamIds, opts), v);

/** Local date and time to an ISO instant, as the existing fixtures did: the admin's wall clock. */
export function toIsoFromLocal(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

/** Splits a stored instant back into the local date and time the form shows. */
export function fromIsoToLocal(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function toFixtureCreate(v: FixtureFormValues, tournamentId: string): MatchCreate {
  return {
    tournamentId,
    homeTeamId: v.homeTeamId,
    awayTeamId: v.awayTeamId,
    scheduledDate: toIsoFromLocal(v.date, v.time),
    status: 'SCHEDULED',
    ...(v.venue.trim() ? { venue: v.venue.trim() } : {}),
    ...(v.statisticianId ? { statisticianId: v.statisticianId } : {}),
  };
}

/** Edit body. An empty statistician sends `null` so the backend clears the assignment. */
export function toFixtureUpdate(v: FixtureFormValues): Record<string, unknown> {
  return {
    scheduledDate: toIsoFromLocal(v.date, v.time),
    venue: v.venue.trim() || null,
    statisticianId: v.statisticianId || null,
    status: v.status,
  };
}

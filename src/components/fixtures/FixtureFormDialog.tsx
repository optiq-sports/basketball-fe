import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';
import {
  ADMIN_SETTABLE_STATUSES,
  EMPTY_FIXTURE_FORM,
  STATUS_LABELS,
  fromIsoToLocal,
  fixtureFormSchema,
  toFixtureCreate,
  toFixtureUpdate,
  type FixtureFormValues,
} from './fixture-form';
import type { Match, MatchCreate, MatchStatus } from '../../types/api';
import { normalizeName } from '../../lib/text';

const inputClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 aria-[invalid=true]:border-rose-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

function Field({ id, label, error, required, children }: { id: string; label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span aria-hidden className="text-rose-600"> *</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export interface FixtureTeam { id: string; name: string }
export interface FixtureStatistician { id: string; name?: string | null; email: string }

/**
 * Create or edit a fixture. Teams are fixed once a fixture exists, so an edit changes the time, venue,
 * statistician and status. Statuses set by the scorer (live, completed) are shown but can't be picked.
 */
const FixtureFormDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  match: Match | null;
  teams: FixtureTeam[];
  statisticians: FixtureStatistician[];
  isSaving: boolean;
  serverError?: string | null;
  onSubmit: (body: { create?: MatchCreate; update?: Record<string, unknown> }) => void;
  tournamentId: string;
}> = ({ open, onClose, match, teams, statisticians, isSaving, serverError, onSubmit, tournamentId }) => {
  const editing = !!match;
  const baseline = useMemo<FixtureFormValues>(() => {
    if (!match) return EMPTY_FIXTURE_FORM;
    const local = fromIsoToLocal(match.scheduledDate);
    return {
      ...EMPTY_FIXTURE_FORM,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      date: local.date,
      time: local.time,
      venue: match.venue ?? '',
      statisticianId: (match as { statisticianId?: string | null }).statisticianId ?? '',
      status: match.status,
    };
  }, [match]);

  const teamIds = useMemo(() => new Set(teams.map((t) => t.id)), [teams]);
  const schema = useMemo(() => fixtureFormSchema(teamIds, { editing, currentStatus: match?.status }), [teamIds, editing, match?.status]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FixtureFormValues>({ defaultValues: baseline, resolver: zodResolver(schema) });
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Start fresh whenever the dialog opens, for a different fixture or a new one.
  useEffect(() => {
    if (!open) return;
    reset(baseline);
    setConfirmingDiscard(false);
    // reset only when the dialog opens or switches fixture; baseline follows `match`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, match?.id]);

  const teamName = (id: string) => normalizeName(teams.find((t) => t.id === id)?.name) || 'Team';

  const requestClose = () => {
    if (isSaving) return;
    if (isDirty) setConfirmingDiscard(true);
    else onClose();
  };

  const submit = handleSubmit((values) => {
    if (editing) onSubmit({ update: toFixtureUpdate(values) });
    else onSubmit({ create: toFixtureCreate(values, tournamentId) });
  });

  // A game the scorer has set live or finished keeps its status: the select is locked, and says why.
  const statusLocked = !!match && !ADMIN_SETTABLE_STATUSES.includes(match.status);
  const statusOptions: MatchStatus[] = [...new Set<MatchStatus>([...ADMIN_SETTABLE_STATUSES, ...(match ? [match.status] : [])])];
  const invalid = (k: keyof FixtureFormValues) => (errors[k] ? true : undefined);
  const describedBy = (k: keyof FixtureFormValues) => (errors[k] ? `${k}-error` : undefined);
  const msg = (k: keyof FixtureFormValues) => errors[k]?.message;

  return (
    <Modal open={open} onClose={requestClose} title={editing ? 'Edit fixture' : 'New fixture'} size="md" closeOnBackdropClick={!isSaving} closeOnEscape={!isSaving}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate aria-busy={isSaving}>
        {serverError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{serverError}</p>}

        <fieldset className="grid gap-4 sm:grid-cols-2" disabled={isSaving}>
          <legend className="sr-only">Teams and time</legend>
          {editing ? (
            <div className="sm:col-span-2 rounded-md bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-900 dark:bg-gray-800 dark:text-white">
              {teamName(baseline.homeTeamId)} <span className="font-normal text-gray-400">vs</span> {teamName(baseline.awayTeamId)}
            </div>
          ) : (
            <>
              <Field id="homeTeamId" label="Home team" required error={msg('homeTeamId')}>
                <select id="homeTeamId" className={inputClass} {...register('homeTeamId')} aria-invalid={invalid('homeTeamId')} aria-describedby={describedBy('homeTeamId')}>
                  <option value="">Choose…</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{normalizeName(t.name)}</option>)}
                </select>
              </Field>
              <Field id="awayTeamId" label="Away team" required error={msg('awayTeamId')}>
                <select id="awayTeamId" className={inputClass} {...register('awayTeamId')} aria-invalid={invalid('awayTeamId')} aria-describedby={describedBy('awayTeamId')}>
                  <option value="">Choose…</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{normalizeName(t.name)}</option>)}
                </select>
              </Field>
            </>
          )}
          <Field id="date" label="Date" required error={msg('date')}>
            <input id="date" type="date" className={inputClass} {...register('date')} aria-invalid={invalid('date')} aria-describedby={describedBy('date')} />
          </Field>
          <Field id="time" label="Start time" required error={msg('time')}>
            <input id="time" type="time" className={inputClass} {...register('time')} aria-invalid={invalid('time')} aria-describedby={describedBy('time')} />
          </Field>
          <Field id="venue" label="Venue" error={msg('venue')}>
            <input id="venue" className={inputClass} {...register('venue')} aria-invalid={invalid('venue')} aria-describedby={describedBy('venue')} />
          </Field>
          <Field id="statisticianId" label="Statistician">
            <select id="statisticianId" className={inputClass} {...register('statisticianId')}>
              <option value="">Unassigned</option>
              {statisticians.map((s) => <option key={s.id} value={s.id}>{s.name || s.email}</option>)}
            </select>
          </Field>
          {editing && (
            <div className="sm:col-span-2">
              <Field id="status" label="Status" error={msg('status')}>
                <select id="status" className={inputClass} {...(statusLocked ? { value: baseline.status, disabled: true, onChange: () => undefined } : register('status'))} aria-invalid={invalid('status')} aria-describedby={describedBy('status')}>
                  {statusOptions.map((s) => (
                    <option key={s} value={s} disabled={!ADMIN_SETTABLE_STATUSES.includes(s) && s !== match?.status}>{STATUS_LABELS[s]}{!ADMIN_SETTABLE_STATUSES.includes(s) ? ' (set by the scorer)' : ''}</option>
                  ))}
                </select>
              </Field>
              {statusLocked && <p className="mt-1 text-xs text-gray-500">Live and completed games are set by the scorer.</p>}
            </div>
          )}
        </fieldset>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          {confirmingDiscard ? (
            <div role="alertdialog" aria-label="Discard unsaved changes" className="mr-auto flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-700 dark:text-gray-300">Discard your unsaved changes?</span>
              <Button variant="secondary" type="button" onClick={() => setConfirmingDiscard(false)}>Keep editing</Button>
              <Button variant="destructive" type="button" onClick={onClose}>Discard</Button>
            </div>
          ) : (
            <Button variant="secondary" type="button" onClick={requestClose} disabled={isSaving}>Cancel</Button>
          )}
          <Button type="submit" disabled={isSaving || confirmingDiscard} className="min-w-28">
            {isSaving && <Spinner />}
            {isSaving ? 'Saving…' : editing ? 'Save changes' : 'Create fixture'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default FixtureFormDialog;

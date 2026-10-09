import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';
import { useUploadFile } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { DIVISIONS, EMPTY_TOURNAMENT_FORM, fromTournament, toTournamentPayload, tournamentFormSchema, type TournamentFormValues } from './tournament-form';
import type { Tournament, TournamentCreate } from '../../types/api';

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

/**
 * Create or edit a tournament. Save stays busy until the server accepts it, and only then closes.
 * Closing with unsaved changes asks first, inline, rather than throwing the edits away silently.
 */
const TournamentFormDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  initial?: Tournament | null;
  isSaving: boolean;
  serverError?: string | null;
  onSubmit: (body: TournamentCreate) => void;
}> = ({ open, onClose, initial, isSaving, serverError, onSubmit }) => {
  const editing = !!initial;
  const baseline = useMemo(() => (initial ? fromTournament(initial) : EMPTY_TOURNAMENT_FORM), [initial]);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<TournamentFormValues>({ defaultValues: baseline, resolver: zodResolver(tournamentFormSchema) });
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const uploadFile = useUploadFile();
  const toast = useToast();

  // Start fresh whenever the dialog opens, for a different tournament or a new one.
  useEffect(() => {
    if (!open) return;
    reset(baseline);
    setConfirmingDiscard(false);
    // reset only when the dialog opens or switches tournament; baseline follows `initial`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const flyer = watch('flyer');
  const busy = isSaving || uploadFile.isPending;
  const requestClose = () => {
    if (busy) return;
    if (isDirty) setConfirmingDiscard(true);
    else onClose();
  };

  const pickFlyer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadFile.mutate(file, {
      onSuccess: (res) => setValue('flyer', res.url, { shouldDirty: true }),
      onError: (err) => toast.error(`Couldn’t upload the flyer: ${err.message}`),
    });
  };

  const submit = handleSubmit((values) => onSubmit(toTournamentPayload(values)));

  const invalid = (k: keyof TournamentFormValues) => (errors[k] ? true : undefined);
  const describedBy = (k: keyof TournamentFormValues) => (errors[k] ? `${k}-error` : undefined);
  const msg = (k: keyof TournamentFormValues) => errors[k]?.message;

  return (
    <Modal open={open} onClose={requestClose} title={editing ? 'Edit tournament' : 'New tournament'} size="lg" closeOnBackdropClick={!busy} closeOnEscape={!busy}>
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate aria-busy={busy}>
        {serverError && (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {serverError}
          </p>
        )}

        <div className="flex items-center gap-4">
          {flyer ? (
            <img src={flyer} alt="" className={`h-16 w-28 rounded-md object-cover ${uploadFile.isPending ? 'opacity-50' : ''}`} />
          ) : (
            <span className="flex h-16 w-28 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400 dark:bg-gray-800">No flyer</span>
          )}
          <div className="flex flex-col gap-1">
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              {uploadFile.isPending && <Spinner className="size-3.5" />}
              {uploadFile.isPending ? 'Uploading…' : 'Upload flyer'}
              <input type="file" accept="image/*" className="sr-only" onChange={pickFlyer} disabled={busy} />
            </label>
            <span className="text-xs text-gray-500">Shown on the tournament's card.</span>
          </div>
        </div>

        <fieldset className="grid gap-4 md:grid-cols-2" disabled={busy}>
          <legend className="sr-only">Tournament details</legend>
          <div className="md:col-span-2">
            <Field id="name" label="Name" required error={msg('name')}>
              <input id="name" className={inputClass} {...register('name')} aria-invalid={invalid('name')} aria-describedby={describedBy('name')} autoFocus />
            </Field>
          </div>
          <Field id="division" label="Division" required error={msg('division')}>
            <select id="division" className={inputClass} {...register('division')} aria-invalid={invalid('division')}>
              {DIVISIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Field>
          <Field id="venue" label="Venue" required error={msg('venue')}>
            <input id="venue" className={inputClass} {...register('venue')} aria-invalid={invalid('venue')} aria-describedby={describedBy('venue')} />
          </Field>
          <Field id="startDate" label="Start date" required error={msg('startDate')}>
            <input id="startDate" type="date" className={inputClass} {...register('startDate')} aria-invalid={invalid('startDate')} aria-describedby={describedBy('startDate')} />
          </Field>
          <Field id="endDate" label="End date" error={msg('endDate')}>
            <input id="endDate" type="date" className={inputClass} {...register('endDate')} aria-invalid={invalid('endDate')} aria-describedby={describedBy('endDate')} />
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 md:grid-cols-4" disabled={busy}>
          <legend className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Format</legend>
          <Field id="numberOfGames" label="Games" required error={msg('numberOfGames')}>
            <input id="numberOfGames" inputMode="numeric" className={inputClass} {...register('numberOfGames')} aria-invalid={invalid('numberOfGames')} aria-describedby={describedBy('numberOfGames')} />
          </Field>
          <Field id="numberOfQuarters" label="Quarters" error={msg('numberOfQuarters')}>
            <input id="numberOfQuarters" inputMode="numeric" className={inputClass} {...register('numberOfQuarters')} aria-invalid={invalid('numberOfQuarters')} aria-describedby={describedBy('numberOfQuarters')} />
          </Field>
          <Field id="quarterDuration" label="Quarter (min)" required error={msg('quarterDuration')}>
            <input id="quarterDuration" inputMode="numeric" className={inputClass} {...register('quarterDuration')} aria-invalid={invalid('quarterDuration')} aria-describedby={describedBy('quarterDuration')} />
          </Field>
          <Field id="overtimeDuration" label="Overtime (min)" error={msg('overtimeDuration')}>
            <input id="overtimeDuration" inputMode="numeric" className={inputClass} {...register('overtimeDuration')} aria-invalid={invalid('overtimeDuration')} aria-describedby={describedBy('overtimeDuration')} />
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 md:grid-cols-2" disabled={busy}>
          <legend className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Officials</legend>
          <Field id="crewChief" label="Crew chief" required error={msg('crewChief')}>
            <input id="crewChief" className={inputClass} {...register('crewChief')} aria-invalid={invalid('crewChief')} aria-describedby={describedBy('crewChief')} />
          </Field>
          <Field id="umpire1" label="Umpire 1" error={msg('umpire1')}>
            <input id="umpire1" className={inputClass} {...register('umpire1')} />
          </Field>
          <Field id="umpire2" label="Umpire 2" required error={msg('umpire2')}>
            <input id="umpire2" className={inputClass} {...register('umpire2')} aria-invalid={invalid('umpire2')} aria-describedby={describedBy('umpire2')} />
          </Field>
          <Field id="commissioner" label="Commissioner" error={msg('commissioner')}>
            <input id="commissioner" className={inputClass} {...register('commissioner')} />
          </Field>
        </fieldset>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
          {confirmingDiscard ? (
            <div role="alertdialog" aria-label="Discard unsaved changes" className="mr-auto flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-700 dark:text-gray-300">Discard your unsaved changes?</span>
              <Button variant="secondary" type="button" onClick={() => setConfirmingDiscard(false)}>Keep editing</Button>
              <Button variant="destructive" type="button" onClick={onClose}>Discard</Button>
            </div>
          ) : (
            <Button variant="secondary" type="button" onClick={requestClose} disabled={busy}>Cancel</Button>
          )}
          <Button type="submit" disabled={busy || confirmingDiscard} className="min-w-28">
            {isSaving && <Spinner />}
            {isSaving ? 'Saving…' : editing ? 'Save changes' : 'Create tournament'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default TournamentFormDialog;

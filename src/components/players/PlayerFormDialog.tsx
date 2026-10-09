import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Country } from 'country-state-city';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';
import { PlayerAvatar } from './PlayerAvatar';
import { useTeams, useUploadFile } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { normalizeName } from '../../lib/text';
import {
  EMPTY_PLAYER_FORM,
  POSITIONS,
  fromPlayer,
  toCreatePayload,
  toUpdatePayload,
  playerFormSchema,
  type PlayerFormValues,
} from './player-form';
import type { Player, PlayerCreateForTeam, PlayerUpdateBody } from '../../types/api';

const inputClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 aria-[invalid=true]:border-rose-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

function Field({ id, label, error, required, hint, children }: { id: string; label: string; error?: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span aria-hidden className="text-rose-600"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

/**
 * Create or edit a player. A create goes to `POST /players/team`, which needs a team and a jersey
 * number; an edit goes to `PATCH /players/:id` and sends only what changed.
 *
 * The photo is uploaded as soon as it's picked, so a failed upload is reported before the player is
 * saved rather than after. Save stays busy until the server accepts it, and only then closes.
 */
const PlayerFormDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  initial?: Player | null;
  isSaving: boolean;
  serverError?: string | null;
  onCreate: (body: PlayerCreateForTeam) => void;
  onUpdate: (body: PlayerUpdateBody) => void;
}> = ({ open, onClose, initial, isSaving, serverError, onCreate, onUpdate }) => {
  const editing = !!initial;
  const teamsQuery = useTeams();
  const uploadFile = useUploadFile();
  const toast = useToast();

  const teams = useMemo(
    () =>
      (teamsQuery.data ?? [])
        .map((t) => ({ id: t.id, name: normalizeName(t.name) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [teamsQuery.data],
  );
  const countries = useMemo(() => Country.getAllCountries().map((c) => c.name).sort((a, b) => a.localeCompare(b)), []);

  const baseline = useMemo(() => (initial ? fromPlayer(initial) : EMPTY_PLAYER_FORM), [initial]);
  const schema = useMemo(() => playerFormSchema(editing), [editing]);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<PlayerFormValues>({ defaultValues: baseline, resolver: zodResolver(schema) });
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Start fresh whenever the dialog opens, for a different player or a new one.
  useEffect(() => {
    if (!open) return;
    reset(baseline);
    setConfirmingDiscard(false);
    // reset only when the dialog opens or switches player; baseline follows `initial`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const [firstName, lastName, photo] = watch(['firstName', 'lastName', 'photo']);
  const busy = isSaving || uploadFile.isPending;

  const requestClose = () => {
    if (busy) return;
    if (isDirty) setConfirmingDiscard(true);
    else onClose();
  };

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadFile.mutate(file, {
      onSuccess: (res) => setValue('photo', res.url, { shouldDirty: true }),
      onError: (err) => toast.error(`Couldn’t upload the photo: ${err.message}`),
    });
  };

  const submit = handleSubmit((values) => {
    if (editing) onUpdate(toUpdatePayload(values, baseline));
    else onCreate(toCreatePayload(values));
  });

  const invalid = (k: keyof PlayerFormValues) => (errors[k] ? true : undefined);
  const describedBy = (k: keyof PlayerFormValues) => (errors[k] ? `${k}-error` : undefined);
  const msg = (k: keyof PlayerFormValues) => errors[k]?.message;
  // On an edit the player's team can't change here, and without one there is no jersey to edit.
  // Those fields are shown but not registered, because React Hook Form reads a disabled input as undefined.
  const noJersey = editing && !baseline.teamId;

  return (
    <Modal open={open} onClose={requestClose} title={editing ? 'Edit player' : 'Add player'} size="lg" closeOnBackdropClick={!busy} closeOnEscape={!busy}>
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate aria-busy={busy}>
        {serverError && (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {serverError}
          </p>
        )}

        <div className="flex items-center gap-4">
          <PlayerAvatar
            firstName={firstName}
            lastName={lastName}
            photo={photo}
            size="lg"
            className={uploadFile.isPending ? 'opacity-50' : undefined}
          />
          <div className="flex flex-col gap-1">
            <label className="inline-flex w-fit items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              {uploadFile.isPending && <Spinner className="size-3.5" />}
              {uploadFile.isPending ? 'Uploading…' : photo ? 'Replace photo' : 'Upload photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} disabled={busy} />
            </label>
            <span className="text-xs text-gray-500">Without one, their initials are shown.</span>
          </div>
        </div>

        <fieldset className="grid gap-4 md:grid-cols-2" disabled={busy}>
          <legend className="sr-only">Player details</legend>
          <Field id="firstName" label="First name" required error={msg('firstName')}>
            <input id="firstName" className={inputClass} {...register('firstName')} aria-invalid={invalid('firstName')} aria-describedby={describedBy('firstName')} autoFocus />
          </Field>
          <Field id="lastName" label="Last name" required error={msg('lastName')}>
            <input id="lastName" className={inputClass} {...register('lastName')} aria-invalid={invalid('lastName')} aria-describedby={describedBy('lastName')} />
          </Field>
          <Field id="position" label="Position" error={msg('position')}>
            <select id="position" className={inputClass} {...register('position')}>
              <option value="">Not set</option>
              {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field id="height" label="Height" hint="However you record it — 6'4&quot; or 193cm.">
            <input id="height" className={inputClass} {...register('height')} />
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 md:grid-cols-2" disabled={busy}>
          <legend className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Team</legend>
          <Field
            id="teamId"
            label="Team"
            required={!editing}
            error={msg('teamId')}
            hint={editing ? 'Where they play now. Transfers are done from the team’s roster, not here.' : undefined}
          >
            <select id="teamId" className={inputClass} {...(editing ? { value: baseline.teamId, disabled: true, onChange: () => undefined } : register('teamId'))} aria-invalid={invalid('teamId')} aria-describedby={describedBy('teamId')}>
              <option value="">{teamsQuery.isPending ? 'Loading teams…' : 'Select a team'}</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field id="jerseyNumber" label="Jersey number" required={!editing} error={msg('jerseyNumber')} hint={noJersey ? 'They need a team before they can have a number.' : undefined}>
            <input id="jerseyNumber" inputMode="numeric" className={inputClass} {...(noJersey ? { value: '', disabled: true, onChange: () => undefined } : register('jerseyNumber'))} aria-invalid={invalid('jerseyNumber')} aria-describedby={describedBy('jerseyNumber')} />
          </Field>
        </fieldset>

        <fieldset className="grid gap-4 md:grid-cols-2" disabled={busy}>
          <legend className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Personal</legend>
          <Field id="nationality" label="Nationality">
            <input id="nationality" className={inputClass} {...register('nationality')} list="player-nationalities" autoComplete="off" />
            <datalist id="player-nationalities">
              {countries.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field id="dateOfBirth" label="Date of birth">
            <input id="dateOfBirth" type="date" className={inputClass} {...register('dateOfBirth')} />
          </Field>
          <Field id="email" label="Email" error={msg('email')}>
            <input id="email" type="email" className={inputClass} {...register('email')} aria-invalid={invalid('email')} aria-describedby={describedBy('email')} />
          </Field>
          <Field id="phone" label="Phone">
            <input id="phone" className={inputClass} {...register('phone')} />
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
            {isSaving ? 'Saving…' : editing ? 'Save changes' : 'Add player'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default PlayerFormDialog;

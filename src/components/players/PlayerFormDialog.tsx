import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Country } from 'country-state-city';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
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
  'w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent aria-[invalid=true]:border-error-500 disabled:bg-gray-100 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-white/5';
const labelClass = 'block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300';

function Field({
  id,
  label,
  error,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span aria-hidden className="text-error-600"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-error-600 dark:text-error-500">{error}</p>}
    </div>
  );
}

/**
 * Create or edit a player, back in its pre-redesign shape: one column of `brand`-toned fields, the
 * portrait picker at the top, and plain Cancel / Create buttons on a divided footer.
 *
 * What the redesign added stays: Zod rules shared with the page (`player-form`), a create that goes
 * to `POST /players/team` with the team and jersey number it requires, an edit that goes to
 * `PATCH /players/:id` carrying only what changed, and a prompt before unsaved changes are thrown
 * away.
 *
 * The photo is uploaded as soon as it's picked, so a failed upload is reported before the player is
 * saved rather than after — the old page uploaded on save and could leave a player created without
 * their portrait and no clear way to tell.
 */
const PlayerFormDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  initial?: Player | null;
  isSaving: boolean;
  serverError?: string | null;
  /** Omitted where the dialog only ever edits, as on a team's roster. */
  onCreate?: (body: PlayerCreateForTeam) => void;
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
    else onCreate?.(toCreatePayload(values));
  });

  const invalid = (k: keyof PlayerFormValues) => (errors[k] ? true : undefined);
  const describedBy = (k: keyof PlayerFormValues) => (errors[k] ? `${k}-error` : undefined);
  const msg = (k: keyof PlayerFormValues) => errors[k]?.message;
  // On an edit the player's team can't change here, and without one there is no jersey to edit.
  // Those fields are shown but not registered, because React Hook Form reads a disabled input as undefined.
  const noJersey = editing && !baseline.teamId;

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title={editing ? 'Edit player' : 'Add player'}
      size="lg"
      closeOnBackdropClick={!busy}
      closeOnEscape={!busy}
    >
      <form onSubmit={submit} className="space-y-6" noValidate aria-busy={busy}>
        {serverError && (
          <p role="alert" className="rounded-lg border border-error-100 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-500">
            {serverError}
          </p>
        )}

        <div>
          <span className={labelClass}>Player portrait (optional)</span>
          <div className="flex items-center gap-4">
            <PlayerAvatar
              firstName={firstName}
              lastName={lastName}
              photo={photo}
              size="lg"
              className={uploadFile.isPending ? 'opacity-50' : undefined}
            />
            <div className="flex-1">
              <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5">
                {uploadFile.isPending && <Spinner className="size-3.5" />}
                {uploadFile.isPending ? 'Uploading…' : photo ? 'Replace photo' : 'Upload photo'}
                <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} disabled={busy} />
              </label>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                PNG or JPEG recommended. Without one, their initials are shown.
              </p>
            </div>
          </div>
        </div>

        <fieldset className="space-y-6" disabled={busy}>
          <legend className="sr-only">Player details</legend>

          <Field id="firstName" label="First Name" required error={msg('firstName')}>
            <input
              id="firstName"
              className={inputClass}
              placeholder="Enter first name"
              {...register('firstName')}
              aria-invalid={invalid('firstName')}
              aria-describedby={describedBy('firstName')}
              autoFocus
            />
          </Field>

          <Field id="lastName" label="Last Name" required error={msg('lastName')}>
            <input
              id="lastName"
              className={inputClass}
              placeholder="Enter last name"
              {...register('lastName')}
              aria-invalid={invalid('lastName')}
              aria-describedby={describedBy('lastName')}
            />
          </Field>

          <Field
            id="jerseyNumber"
            label="Jersey Number"
            required={!editing}
            error={msg('jerseyNumber')}
            hint={noJersey ? 'They need a team before they can have a number.' : undefined}
          >
            <input
              id="jerseyNumber"
              inputMode="numeric"
              placeholder="Enter jersey number"
              className={inputClass}
              {...(noJersey ? { value: '', disabled: true, onChange: () => undefined } : register('jerseyNumber'))}
              aria-invalid={invalid('jerseyNumber')}
              aria-describedby={describedBy('jerseyNumber')}
            />
          </Field>

          <Field id="position" label="Position" error={msg('position')}>
            <select id="position" className={`cursor-pointer ${inputClass}`} {...register('position')}>
              <option value="">Not set</option>
              {POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>

          <Field
            id="teamId"
            label="Team"
            required={!editing}
            error={msg('teamId')}
            hint={editing ? 'Where they play now. Transfers are done from the team’s roster, not here.' : undefined}
          >
            <select
              id="teamId"
              className={`cursor-pointer ${inputClass}`}
              {...(editing ? { value: baseline.teamId, disabled: true, onChange: () => undefined } : register('teamId'))}
              aria-invalid={invalid('teamId')}
              aria-describedby={describedBy('teamId')}
            >
              <option value="">{teamsQuery.isPending ? 'Loading teams…' : 'Select team'}</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>

          <Field id="nationality" label="Nationality">
            <input id="nationality" className={inputClass} {...register('nationality')} list="player-nationalities" autoComplete="off" />
            <datalist id="player-nationalities">
              {countries.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>

          <Field id="height" label="Height" hint="However you record it — 6'4&quot; or 193cm.">
            <input id="height" className={inputClass} placeholder="e.g., 6'3&quot;" {...register('height')} />
          </Field>

          <Field id="dateOfBirth" label="Date of Birth">
            <input id="dateOfBirth" type="date" className={`${inputClass} dark:[color-scheme:dark]`} {...register('dateOfBirth')} />
          </Field>

          <Field id="email" label="Email" error={msg('email')}>
            <input
              id="email"
              type="email"
              className={inputClass}
              {...register('email')}
              aria-invalid={invalid('email')}
              aria-describedby={describedBy('email')}
            />
          </Field>

          <Field id="phone" label="Phone">
            <input id="phone" className={inputClass} {...register('phone')} />
          </Field>
        </fieldset>

        <div className="flex flex-wrap items-center justify-end gap-4 border-t border-gray-200 pt-6 dark:border-gray-800">
          {confirmingDiscard ? (
            <div role="alertdialog" aria-label="Discard unsaved changes" className="mr-auto flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-700 dark:text-gray-300">Discard your unsaved changes?</span>
              <button
                type="button"
                onClick={() => setConfirmingDiscard(false)}
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-lg bg-error-500 px-4 py-2 font-medium text-white transition-colors hover:bg-error-600"
              >
                Discard
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              className="cursor-pointer rounded-lg border border-gray-300 bg-white px-6 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={busy || confirmingDiscard}
            className="inline-flex min-w-28 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-500 px-6 py-2.5 font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSaving && <Spinner />}
            {isSaving ? 'Saving...' : editing ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PlayerFormDialog;

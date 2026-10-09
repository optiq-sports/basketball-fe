import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';
import { useUploadFile } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { EMPTY_TEAM_FORM, fromTeam, teamFormSchema, toTeamPayload, type TeamFormValues } from './team-form';
import type { Team, TeamCreate } from '../../types/api';

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

/** Create or edit a team. The logo can be typed as a URL or uploaded; an upload replaces whatever URL was there. */
const TeamFormDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  initial?: Team | null;
  isSaving: boolean;
  serverError?: string | null;
  onSubmit: (body: TeamCreate) => void;
}> = ({ open, onClose, initial, isSaving, serverError, onSubmit }) => {
  const editing = !!initial;
  const baseline = useMemo(() => (initial ? fromTeam(initial) : EMPTY_TEAM_FORM), [initial]);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<TeamFormValues>({ defaultValues: baseline, resolver: zodResolver(teamFormSchema) });
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const uploadFile = useUploadFile();
  const toast = useToast();

  // Start fresh whenever the dialog opens, for a different team or a new one.
  useEffect(() => {
    if (!open) return;
    reset(baseline);
    setConfirmingDiscard(false);
    // reset only when the dialog opens or switches team; baseline follows `initial`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const logo = watch('logo');

  const pickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadFile.mutate(file, {
      onSuccess: (res) => setValue('logo', res.url, { shouldDirty: true }),
      onError: (err) => toast.error(`Couldn’t upload the logo: ${err.message}`),
    });
  };

  const requestClose = () => {
    if (isSaving) return;
    if (isDirty) setConfirmingDiscard(true);
    else onClose();
  };

  const submit = handleSubmit((values) => onSubmit(toTeamPayload(values)));

  const invalid = (k: keyof TeamFormValues) => (errors[k] ? true : undefined);
  const describedBy = (k: keyof TeamFormValues) => (errors[k] ? `${k}-error` : undefined);
  const msg = (k: keyof TeamFormValues) => errors[k]?.message;
  const busy = isSaving || uploadFile.isPending;

  return (
    <Modal open={open} onClose={requestClose} title={editing ? 'Edit team' : 'New team'} size="md" closeOnBackdropClick={!busy} closeOnEscape={!busy}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate aria-busy={busy}>
        {serverError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{serverError}</p>}

        <div className="flex items-center gap-4">
          {logo ? (
            <img src={logo} alt="" className={`size-14 rounded-lg object-cover ${uploadFile.isPending ? 'opacity-50' : ''}`} />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400 dark:bg-gray-800">No logo</span>
          )}
          <div className="flex flex-col gap-1">
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              {uploadFile.isPending && <Spinner className="size-3.5" />}
              {uploadFile.isPending ? 'Uploading…' : 'Upload logo'}
              <input type="file" accept="image/*" className="sr-only" onChange={pickLogo} disabled={busy} />
            </label>
            <span className="text-xs text-gray-500">Or paste a URL below.</span>
          </div>
        </div>

        <fieldset className="grid gap-4 sm:grid-cols-2" disabled={busy}>
          <legend className="sr-only">Team details</legend>
          <Field id="name" label="Name" required error={msg('name')}>
            <input id="name" className={inputClass} {...register('name')} aria-invalid={invalid('name')} aria-describedby={describedBy('name')} autoFocus />
          </Field>
          <Field id="code" label="Code" required error={msg('code')}>
            <input id="code" className={inputClass} {...register('code')} aria-invalid={invalid('code')} aria-describedby={describedBy('code')} placeholder="e.g. LAL" />
          </Field>
          <Field id="color" label="Colour" error={msg('color')}>
            <input id="color" className={inputClass} {...register('color')} aria-invalid={invalid('color')} aria-describedby={describedBy('color')} placeholder="#FF6B2C" />
          </Field>
          <Field id="logo" label="Logo URL">
            <input id="logo" className={inputClass} {...register('logo')} placeholder="https://" />
          </Field>
          <Field id="country" label="Country">
            <input id="country" className={inputClass} {...register('country')} />
          </Field>
          <Field id="state" label="State / region">
            <input id="state" className={inputClass} {...register('state')} />
          </Field>
          <Field id="coach" label="Coach">
            <input id="coach" className={inputClass} {...register('coach')} />
          </Field>
          <Field id="assistantCoach" label="Assistant coach">
            <input id="assistantCoach" className={inputClass} {...register('assistantCoach')} />
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
            {isSaving ? 'Saving…' : editing ? 'Save changes' : 'Create team'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default TeamFormDialog;

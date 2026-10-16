import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { btnDanger, btnPrimary, btnSecondary, dialogFooter, errorBanner, fieldErrorClass, inputClass, labelClass } from '../ui/formStyles';
import { useUploadFile } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import { EMPTY_TEAM_FORM, fromTeam, teamFormSchema, toTeamPayload, type TeamFormValues } from './team-form';
import type { Team, TeamCreate } from '../../types/api';

function Field({ id, label, error, required, children }: { id: string; label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span aria-hidden className="text-error-600"> *</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} className={fieldErrorClass}>{error}</p>}
    </div>
  );
}

/**
 * Create or edit a team. The logo can be typed as a URL or uploaded; an upload replaces whatever URL
 * was there.
 *
 * Home arena, founded year and contact email are editable as of the 14 Oct 2026 backend push. The DTO
 * had accepted all three for some time, but the columns only arrived with that migration (Gap 54), so
 * until now the team page could show them and nothing could set them.
 */
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
        {serverError && <p role="alert" className={errorBanner}>{serverError}</p>}

        <div className="flex items-center gap-4">
          {logo ? (
            <img src={logo} alt="" className={`size-20 rounded-lg object-cover ${uploadFile.isPending ? 'opacity-50' : ''}`} />
          ) : (
            <span className="flex size-20 items-center justify-center rounded-lg border border-gray-300 bg-gray-100 text-xs text-gray-400 dark:border-gray-700 dark:bg-white/5">No logo</span>
          )}
          <div className="flex flex-col gap-1">
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5">
              {uploadFile.isPending && <Spinner className="size-3.5" />}
              {uploadFile.isPending ? 'Uploading…' : 'Upload logo'}
              <input type="file" accept="image/*" className="sr-only" onChange={pickLogo} disabled={busy} />
            </label>
            <span className="text-xs text-gray-500 dark:text-gray-400">Or paste a URL below.</span>
          </div>
        </div>

        <fieldset className="grid gap-5 sm:grid-cols-2" disabled={busy}>
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
          <Field id="arena" label="Home arena">
            <input id="arena" className={inputClass} {...register('arena')} />
          </Field>
          <Field id="foundedYear" label="Founded" error={msg('foundedYear')}>
            <input id="foundedYear" inputMode="numeric" placeholder="e.g. 1998" className={inputClass} {...register('foundedYear')} aria-invalid={invalid('foundedYear')} aria-describedby={describedBy('foundedYear')} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="contactEmail" label="Contact email" error={msg('contactEmail')}>
              <input id="contactEmail" type="email" className={inputClass} {...register('contactEmail')} aria-invalid={invalid('contactEmail')} aria-describedby={describedBy('contactEmail')} />
            </Field>
          </div>
        </fieldset>

        <div className={dialogFooter}>
          {confirmingDiscard ? (
            <div role="alertdialog" aria-label="Discard unsaved changes" className="mr-auto flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-700 dark:text-gray-300">Discard your unsaved changes?</span>
              <button type="button" className={btnSecondary} onClick={() => setConfirmingDiscard(false)}>Keep editing</button>
              <button type="button" className={btnDanger} onClick={onClose}>Discard</button>
            </div>
          ) : (
            <button type="button" className={btnSecondary} onClick={requestClose} disabled={busy}>Cancel</button>
          )}
          <button type="submit" className={`${btnPrimary} min-w-28`} disabled={busy || confirmingDiscard}>
            {isSaving && <Spinner />}
            {isSaving ? 'Saving...' : editing ? 'Save changes' : 'Create team'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default TeamFormDialog;

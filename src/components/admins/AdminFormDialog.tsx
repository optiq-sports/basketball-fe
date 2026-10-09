import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';
import { useToast } from '../../hooks/useToast';
import { generatePassword } from '../statisticians/statistician-form';
import {
  EMPTY_ADMIN_FORM,
  ROLES,
  fromAdmin,
  toCreatePayload,
  toUpdatePayload,
  adminFormSchema,
  type AdminFormValues,
} from './admin-form';
import type { Admin, AdminCreateBody, AdminUpdateBody } from '../../types/api';

const inputClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 aria-[invalid=true]:border-rose-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

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
 * Create or edit an admin. On a create, leaving the password blank is the good path: the backend
 * generates one, emails it and forces a change on first sign-in. Typing or generating one here sets it
 * directly, and the admin has to hand it over themselves.
 *
 * When `lockedReason` is set (the signed-in account, or the last active super admin) role and status are
 * disabled and the reason is shown, so the form can't lock everyone out.
 */
const AdminFormDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  initial?: Admin | null;
  lockedReason?: string | null;
  isSaving: boolean;
  serverError?: string | null;
  onCreate: (body: AdminCreateBody) => void;
  onUpdate: (body: AdminUpdateBody) => void;
}> = ({ open, onClose, initial, lockedReason, isSaving, serverError, onCreate, onUpdate }) => {
  const editing = !!initial;
  const locked = editing && !!lockedReason;
  const toast = useToast();

  const baseline = useMemo(() => (initial ? fromAdmin(initial) : EMPTY_ADMIN_FORM), [initial]);
  const schema = useMemo(() => adminFormSchema(editing), [editing]);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { errors, isDirty },
  } = useForm<AdminFormValues>({ defaultValues: baseline, resolver: zodResolver(schema) });
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    reset(baseline);
    setConfirmingDiscard(false);
    setShowPassword(false);
    setCopied(false);
    // reset only when the dialog opens or switches person; baseline follows `initial`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  const password = watch('password');

  const requestClose = () => {
    if (isSaving) return;
    if (isDirty) setConfirmingDiscard(true);
    else onClose();
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(getValues('password'));
      setCopied(true);
    } catch {
      setCopied(false);
      toast.error('Couldn’t copy. Select the password and copy it by hand.');
    }
  };

  const submit = handleSubmit((values) => {
    if (editing) onUpdate(toUpdatePayload(values, baseline, locked));
    else onCreate(toCreatePayload(values));
  });

  const msg = (k: keyof AdminFormValues) => errors[k]?.message;

  return (
    <Modal open={open} onClose={requestClose} title={editing ? 'Edit admin' : 'Add admin'} size="md" closeOnBackdropClick={!isSaving} closeOnEscape={!isSaving}>
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate aria-busy={isSaving}>
        {serverError && (
          <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {serverError}
          </p>
        )}
        {locked && (
          <p role="note" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            {lockedReason}
          </p>
        )}

        <fieldset className="flex flex-col gap-4" disabled={isSaving}>
          <legend className="sr-only">Admin details</legend>
          <Field id="email" label="Email" required={!editing} error={msg('email')} hint={editing ? 'The email is their sign-in, so it can’t be changed here.' : undefined}>
            <input id="email" type="email" {...register('email')} className={`${inputClass} ${editing ? 'bg-gray-50 text-gray-500 dark:bg-gray-800' : ''}`} aria-invalid={errors.email ? true : undefined} aria-describedby={errors.email ? 'email-error' : undefined} readOnly={editing} autoFocus={!editing} />
          </Field>
          <Field id="name" label="Name">
            <input id="name" className={inputClass} {...register('name')} autoFocus={editing} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="role" label="Role">
              {/* A locked field is shown, not registered: React Hook Form reads a disabled input as undefined. */}
              <select id="role" className={inputClass} {...(locked ? { value: baseline.role, disabled: true, onChange: () => undefined } : register('role'))}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
            <Field id="status" label="Status">
              <select id="status" className={inputClass} {...(locked ? { value: baseline.status, disabled: true, onChange: () => undefined } : register('status'))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2" disabled={isSaving}>
          <legend className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
            {editing ? 'Reset password (optional)' : 'Password (optional)'}
          </legend>
          <Field
            id="password"
            label={editing ? 'New password' : 'Password'}
            error={msg('password')}
            hint={
              editing
                ? 'Leave blank to keep their current password. They aren’t asked to change one you set here.'
                : 'Leave blank and the server emails them a temporary password to change on first sign-in. Email delivery from the server isn’t confirmed (Gap 49), so unless you have seen one arrive, set a password here and hand it over yourself.'
            }
          >
            <div className="flex flex-wrap gap-2">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className={`${inputClass} min-w-0 flex-1 font-mono`}
                {...register('password', { onChange: () => setCopied(false) })}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'password-error' : undefined}
                autoComplete="new-password"
              />
              <Button type="button" variant="secondary" onClick={() => setShowPassword((s) => !s)}>{showPassword ? 'Hide' : 'Show'}</Button>
              <Button type="button" variant="secondary" onClick={() => { setValue('password', generatePassword(), { shouldDirty: true }); setShowPassword(true); setCopied(false); }}>Generate</Button>
              <Button type="button" variant="secondary" onClick={() => void copyPassword()} disabled={!password}>{copied ? 'Copied' : 'Copy'}</Button>
            </div>
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
            <Button variant="secondary" type="button" onClick={requestClose} disabled={isSaving}>Cancel</Button>
          )}
          <Button type="submit" disabled={isSaving || confirmingDiscard} className="min-w-28">
            {isSaving && <Spinner />}
            {isSaving ? 'Saving…' : editing ? 'Save changes' : 'Add admin'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AdminFormDialog;

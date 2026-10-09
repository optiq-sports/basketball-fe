import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';
import { useAssignPlayerToTeam, useCreatePlayerForTeam, usePlayers, useUploadFile } from '../../api/hooks';
import { useToast } from '../../hooks/useToast';
import {
  EMPTY_NEW_PLAYER_FORM,
  assignPlayerFormSchema,
  isPotentialDuplicateMessage,
  newPlayerFormSchema,
  toNewPlayerPayload,
  type AssignPlayerFormValues,
  type NewPlayerFormValues,
} from './add-player-form';

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

type Mode = 'existing' | 'new';

/**
 * Add a player to the roster: pick an existing unassigned player, or create a new one. A new player
 * that closely matches someone already in the system is refused with a similarity note; "Create
 * anyway" resubmits with the backend's own override flag rather than silently retrying.
 */
const AddPlayerDialog: React.FC<{ open: boolean; onClose: () => void; teamId: string }> = ({ open, onClose, teamId }) => {
  const [mode, setMode] = useState<Mode>('existing');
  const [search, setSearch] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState(false);

  // Two forms share the dialog: pick someone who exists, or create someone new.
  const existing = useForm<AssignPlayerFormValues>({
    defaultValues: { playerId: '', jerseyNumber: '' },
    resolver: zodResolver(assignPlayerFormSchema),
  });
  const fresh = useForm<NewPlayerFormValues>({
    defaultValues: EMPTY_NEW_PLAYER_FORM,
    resolver: zodResolver(newPlayerFormSchema),
  });

  const unassignedQuery = usePlayers(undefined, { unassigned: true });
  const assignPlayer = useAssignPlayerToTeam();
  const createPlayer = useCreatePlayerForTeam();
  const uploadFile = useUploadFile();
  const toast = useToast();

  const reset = () => {
    setMode('existing');
    setSearch('');
    existing.reset({ playerId: '', jerseyNumber: '' });
    fresh.reset(EMPTY_NEW_PLAYER_FORM);
    setServerError(null);
    setDuplicateNotice(false);
  };

  const busy = assignPlayer.isPending || createPlayer.isPending || uploadFile.isPending;
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const candidates = (unassignedQuery.data ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    return !q || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q);
  });

  const submitExisting = existing.handleSubmit((values) => {
    setServerError(null);
    assignPlayer.mutate(
      { playerId: values.playerId, teamId, body: { jerseyNumber: Number(values.jerseyNumber) } },
      { onSuccess: () => { toast.success('Player added to the roster.'); close(); }, onError: (err) => setServerError(err.message) },
    );
  });

  const createNew = (values: NewPlayerFormValues, confirmDuplicate = false) => {
    setServerError(null);
    setDuplicateNotice(false);
    createPlayer.mutate(toNewPlayerPayload(values, teamId, confirmDuplicate), {
      onSuccess: (created) => { toast.success(`${created.firstName} ${created.lastName} added to the roster.`); close(); },
      onError: (err) => {
        if (isPotentialDuplicateMessage(err.message)) setDuplicateNotice(true);
        setServerError(err.message);
      },
    });
  };
  const submitNew = fresh.handleSubmit((values) => createNew(values));
  // "Create anyway" goes through the same checks, then resubmits with the backend's own override flag.
  const submitNewAnyway = fresh.handleSubmit((values) => createNew(values, true));

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    uploadFile.mutate(file, { onSuccess: (res) => fresh.setValue('photo', res.url, { shouldDirty: true }), onError: (err) => toast.error(`Couldn’t upload the photo: ${err.message}`) });
  };

  const photo = fresh.watch('photo');
  const newMsg = (k: keyof NewPlayerFormValues) => fresh.formState.errors[k]?.message;

  return (
    <Modal open={open} onClose={close} title="Add a player" size="md" closeOnBackdropClick={!busy} closeOnEscape={!busy}>
      <div role="tablist" aria-label="How to add this player" className="mb-4 flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {([{ id: 'existing', label: 'Existing player' }, { id: 'new', label: 'New player' }] as const).map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={mode === t.id}
            onClick={() => { setMode(t.id); setServerError(null); setDuplicateNotice(false); }}
            className={`h-10 px-3 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-court-400/50 ${mode === t.id ? 'border-b-2 border-signal-500 text-court-900 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {serverError && (
        <div role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          <p>{serverError}</p>
          {duplicateNotice && (
            <Button variant="destructive" size="sm" type="button" className="mt-2" onClick={() => void submitNewAnyway()} disabled={createPlayer.isPending}>
              {createPlayer.isPending ? 'Creating…' : 'Create anyway'}
            </Button>
          )}
        </div>
      )}

      {mode === 'existing' ? (
        <form onSubmit={submitExisting} className="flex flex-col gap-4" aria-busy={assignPlayer.isPending} noValidate>
          <div>
            <label htmlFor="player-search" className="sr-only">Search unassigned players</label>
            <input id="player-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className={inputClass} />
          </div>
          {unassignedQuery.isPending && <p className="text-sm text-gray-500">Loading players…</p>}
          {unassignedQuery.isError && <p className="text-sm text-rose-600">{(unassignedQuery.error as Error).message}</p>}
          {!unassignedQuery.isPending && !unassignedQuery.isError && candidates.length === 0 && <p className="text-sm text-gray-500">{search ? 'No players match that search.' : 'No unassigned players right now.'}</p>}
          <ul className="max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {candidates.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                  <input type="radio" value={p.id} {...existing.register('playerId')} className="size-4 border-gray-300 text-court-600 focus:ring-court-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{p.firstName} {p.lastName}</span>
                </label>
              </li>
            ))}
          </ul>
          {existing.formState.errors.playerId && (
            <p id="playerId-error" role="alert" className="-mt-2 text-xs text-rose-600">{existing.formState.errors.playerId.message}</p>
          )}
          <Field id="jersey" label="Jersey number" required error={existing.formState.errors.jerseyNumber?.message}>
            <input id="jersey" inputMode="numeric" {...existing.register('jerseyNumber')} aria-invalid={existing.formState.errors.jerseyNumber ? true : undefined} className={inputClass} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
            <Button variant="secondary" type="button" onClick={close} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {assignPlayer.isPending && <Spinner />}
              {assignPlayer.isPending ? 'Adding…' : 'Add to roster'}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitNew} className="flex flex-col gap-4" aria-busy={busy} noValidate>
          <div className="flex items-center gap-4">
            {photo ? (
              <img src={photo} alt="" className={`size-14 rounded-full object-cover ${uploadFile.isPending ? 'opacity-50' : ''}`} />
            ) : (
              <span className="flex size-14 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400 dark:bg-gray-800">No photo</span>
            )}
            <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              {uploadFile.isPending ? 'Uploading…' : 'Upload photo'}
              <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} disabled={busy} />
            </label>
          </div>

          <fieldset className="grid gap-4 sm:grid-cols-2" disabled={busy}>
            <legend className="sr-only">New player details</legend>
            <Field id="firstName" label="First name" required error={newMsg('firstName')}>
              <input id="firstName" className={inputClass} {...fresh.register('firstName')} autoFocus />
            </Field>
            <Field id="lastName" label="Last name" required error={newMsg('lastName')}>
              <input id="lastName" className={inputClass} {...fresh.register('lastName')} />
            </Field>
            <Field id="jerseyNumber" label="Jersey number" required error={newMsg('jerseyNumber')}>
              <input id="jerseyNumber" inputMode="numeric" className={inputClass} {...fresh.register('jerseyNumber')} />
            </Field>
            <Field id="position" label="Position">
              <select id="position" className={inputClass} {...fresh.register('position')}>
                <option value="">Not set</option>
                <option value="POINT_GUARD">Point Guard</option>
                <option value="SHOOTING_GUARD">Shooting Guard</option>
                <option value="SMALL_FORWARD">Small Forward</option>
                <option value="POWER_FORWARD">Power Forward</option>
                <option value="CENTER">Center</option>
              </select>
            </Field>
            <Field id="height" label="Height">
              <input id="height" className={inputClass} {...fresh.register('height')} placeholder="e.g. 6'3&quot;" />
            </Field>
            <Field id="dateOfBirth" label="Date of birth">
              <input id="dateOfBirth" type="date" className={inputClass} {...fresh.register('dateOfBirth')} />
            </Field>
            <Field id="nationality" label="Nationality">
              <input id="nationality" className={inputClass} {...fresh.register('nationality')} />
            </Field>
            <Field id="phone" label="Phone">
              <input id="phone" className={inputClass} {...fresh.register('phone')} />
            </Field>
            <div className="sm:col-span-2">
              <Field id="email" label="Email" error={newMsg('email')}>
                <input id="email" type="email" className={inputClass} {...fresh.register('email')} />
              </Field>
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
            <Button variant="secondary" type="button" onClick={close} disabled={busy}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {createPlayer.isPending && <Spinner />}
              {createPlayer.isPending ? 'Creating…' : 'Create & add'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default AddPlayerDialog;

import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { Button } from '../ui/primitives/button';
import { Badge } from '../ui/primitives/badge';
import { useTeams, useUploadPlayersExcel } from '../../api/hooks';
import { normalizeName } from '../../lib/text';
import type { PlayerUploadResult } from '../../types/api';

/** What the backend reads off each row, lowercased and trimmed — alternatives separated by "/". */
const COLUMNS = [
  'First name', 'Last name', 'Jersey number', 'Position', 'Height',
  'Date of birth', 'Country', 'Email', 'Phone', 'Gender',
];

/** How the backend labels what it did with a row, in words an admin can act on. */
const ACTIONS: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  LINKED: { label: 'Signed to this team', variant: 'success' },
  ALREADY_IN_TEAM: { label: 'Already on this team', variant: 'neutral' },
  SKIPPED: { label: 'Skipped', variant: 'warning' },
};

const inputClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

/**
 * Bulk-adds a team's players from a spreadsheet. The backend checks every row against the players it
 * already has: an exact match is signed to the team instead of being duplicated, and a close-but-not-
 * exact match is skipped and reported here for review rather than guessed at.
 *
 * Rows the backend couldn't use at all come back under `errors`, and are shown — an earlier version
 * of this screen had that block commented out, so failed rows vanished silently.
 */
const UploadPlayersDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  /** Pre-selects a team, for when this is opened from that team's page. */
  teamId?: string;
}> = ({ open, onClose, teamId }) => {
  const teamsQuery = useTeams();
  const upload = useUploadPlayersExcel();

  const [selectedTeam, setSelectedTeam] = useState(teamId ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<PlayerUploadResult | null>(null);

  const teams = useMemo(
    () =>
      (teamsQuery.data ?? [])
        .map((t) => ({ id: t.id, name: normalizeName(t.name) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [teamsQuery.data],
  );

  // Reset each time the dialog opens, so a previous run's summary isn't still on screen.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelectedTeam(teamId ?? '');
      setFile(null);
      setFileError(null);
      setResult(null);
      upload.reset();
    }
  }

  const close = () => {
    if (upload.isPending) return;
    onClose();
  };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setFileError(picked && !picked.name.toLowerCase().endsWith('.xlsx') ? 'Only .xlsx files can be read. Save the sheet as .xlsx and try again.' : null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !file || fileError) return;
    upload.mutate({ teamId: selectedTeam, file }, { onSuccess: (data) => setResult(data ?? null) });
  };

  const details = result?.details ?? [];
  const errors = result?.errors ?? [];
  const created = result?.created ?? result?.createdCount ?? 0;
  const duplicates = result?.duplicatesFound ?? result?.duplicatesCount ?? 0;
  const processed = result?.totalProcessed ?? 0;

  return (
    <Modal open={open} onClose={close} title="Add players from a spreadsheet" size="lg" closeOnBackdropClick={!upload.isPending} closeOnEscape={!upload.isPending}>
      {result ? (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-3 gap-3 rounded-md border border-gray-200 p-4 dark:border-gray-800">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Rows read</dt>
              <dd className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{processed}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Added</dt>
              <dd className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{created}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Already known</dt>
              <dd className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{duplicates}</dd>
            </div>
          </dl>

          {processed === 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              There were no rows to read. Check the sheet has a header row and at least one player under it.
            </p>
          )}

          {errors.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                {errors.length} {errors.length === 1 ? 'row' : 'rows'} couldn’t be used
              </h3>
              <ul className="max-h-40 overflow-y-auto rounded-md border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-500/30 dark:bg-rose-500/10">
                {errors.map((e, i) => (
                  <li key={i} className="flex gap-2 text-rose-800 dark:text-rose-200">
                    <span className="font-medium">Row {e.row}:</span>
                    <span>{e.error}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {details.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Players already on record</h3>
              <p className="text-xs text-gray-500">
                An exact match is signed to the team rather than duplicated. A close match is skipped — open the
                player and merge them yourself if it really is the same person.
              </p>
              <ul className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-3 dark:border-gray-800">
                {details.map((d, i) => {
                  const action = d.action ? ACTIONS[d.action] : undefined;
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-gray-500">Row {d.row}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{d.player}</span>
                      {d.matchScore != null && (
                        <span className="text-gray-500">{Math.round(Number(d.matchScore))}% match</span>
                      )}
                      {action ? (
                        <Badge variant={action.variant} className="ml-auto">{action.label}</Badge>
                      ) : d.action ? (
                        <Badge className="ml-auto">{d.action}</Badge>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-800">
            <Button type="button" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5" aria-busy={upload.isPending}>
          {upload.isError && (
            <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {(upload.error as Error).message}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="upload-team" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Team<span aria-hidden className="text-rose-600"> *</span>
            </label>
            <select id="upload-team" className={inputClass} value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} disabled={upload.isPending}>
              <option value="">{teamsQuery.isPending ? 'Loading teams…' : 'Select a team'}</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="text-xs text-gray-500">Everyone in the sheet is signed to this team.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="upload-file" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Spreadsheet (.xlsx)<span aria-hidden className="text-rose-600"> *</span>
            </label>
            <input id="upload-file" type="file" accept=".xlsx" onChange={pickFile} disabled={upload.isPending} className={inputClass} aria-invalid={fileError ? true : undefined} aria-describedby={fileError ? 'upload-file-error' : undefined} />
            {fileError && <p id="upload-file-error" className="text-xs text-rose-600">{fileError}</p>}
          </div>

          <div className="rounded-md bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Columns it reads</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {COLUMNS.join(' · ')} — only the names are required, capitalisation doesn’t matter, and
              anything else in the sheet is ignored.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
            <Button variant="secondary" type="button" onClick={close} disabled={upload.isPending}>Cancel</Button>
            <Button type="submit" disabled={upload.isPending || !selectedTeam || !file || !!fileError} className="min-w-28">
              {upload.isPending && <Spinner />}
              {upload.isPending ? 'Reading…' : 'Upload'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default UploadPlayersDialog;

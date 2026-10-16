import React, { useMemo, useState } from 'react';
import { FiCheck, FiCopy } from 'react-icons/fi';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import { useTeams, useUploadPlayersExcel } from '../../api/hooks';
import { normalizeName } from '../../lib/text';
import type { PlayerUploadResult } from '../../types/api';

/** What the backend reads off each row, lowercased and trimmed — alternatives separated by "/". */
const COLUMNS = [
  'First name', 'Last name', 'Jersey number', 'Position', 'Height',
  'Date of birth', 'Country', 'Email', 'Phone', 'Gender',
];

/** How the backend labels what it did with a row, in words an admin can act on. */
const ACTIONS: Record<string, { label: string; className: string }> = {
  LINKED: { label: 'Signed to this team', className: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500' },
  ALREADY_IN_TEAM: { label: 'Already on this team', className: 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300' },
  SKIPPED: { label: 'Skipped', className: 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-500' },
};

const badgeClass = 'ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium';

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-white/5';
const labelClass = 'block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300';

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
  const [copied, setCopied] = useState(false);

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
      setCopied(false);
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

  /** Copies the skipped rows out, so they can be chased up away from this screen. */
  const copyDetails = () => {
    const rows = result?.details ?? [];
    if (rows.length === 0) return;
    const lines = ['Players already on record (skipped):', ...rows.map((d) => `  Row ${d.row}: ${d.player}${d.action ? ` — ${d.action}` : ''}`)];
    navigator.clipboard
      .writeText(lines.join('\n'))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        /* a browser with no clipboard permission just leaves the icon alone */
      });
  };

  const details = result?.details ?? [];
  const errors = result?.errors ?? [];
  const created = result?.created ?? result?.createdCount ?? 0;
  const duplicates = result?.duplicatesFound ?? result?.duplicatesCount ?? 0;
  const processed = result?.totalProcessed ?? 0;

  return (
    <Modal open={open} onClose={close} title="Upload player list (Excel)" size="lg" closeOnBackdropClick={!upload.isPending} closeOnEscape={!upload.isPending}>
      {result ? (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-3 gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Rows read</dt>
              <dd className="text-xl font-bold tabular-nums text-gray-900 dark:text-white">{processed}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Added</dt>
              <dd className="text-xl font-bold tabular-nums text-success-700 dark:text-success-500">{created}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Already known</dt>
              <dd className="text-xl font-bold tabular-nums text-warning-700 dark:text-warning-500">{duplicates}</dd>
            </div>
          </dl>

          {processed === 0 && (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              There were no rows to read. Check the sheet has a header row and at least one player under it.
            </p>
          )}

          {errors.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-error-700 dark:text-error-500">
                {errors.length} {errors.length === 1 ? 'row' : 'rows'} couldn’t be used
              </h3>
              <ul className="max-h-40 overflow-y-auto rounded-lg border border-error-100 bg-error-50 p-3 text-sm dark:border-error-500/30 dark:bg-error-500/10">
                {errors.map((e, i) => (
                  <li key={i} className="flex gap-2 text-error-700 dark:text-error-500">
                    <span className="font-medium">Row {e.row}:</span>
                    <span>{e.error}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {details.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Players already on record</h3>
                <button
                  type="button"
                  onClick={copyDetails}
                  title={copied ? 'Copied!' : 'Copy to clipboard'}
                  aria-label={copied ? 'Copied to clipboard' : 'Copy these rows to the clipboard'}
                  className={`cursor-pointer rounded p-1.5 transition-colors ${copied ? 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300'}`}
                >
                  {copied ? <FiCheck size={16} /> : <FiCopy size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                An exact match is signed to the team rather than duplicated. A close match is skipped — use Merge
                Players if it really is the same person.
              </p>
              <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                {details.map((d, i) => {
                  const action = d.action ? ACTIONS[d.action] : undefined;
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium text-gray-500 dark:text-gray-400">Row {d.row}</span>
                      <span className="font-medium text-gray-900 dark:text-white">{d.player}</span>
                      {d.matchScore != null && (
                        <span className="text-gray-500 dark:text-gray-400">{Math.round(Number(d.matchScore))}% match</span>
                      )}
                      {action ? (
                        <span className={`${badgeClass} ${action.className}`}>{action.label}</span>
                      ) : d.action ? (
                        <span className={`${badgeClass} bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300`}>{d.action}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg bg-brand-500 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-600"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-5" aria-busy={upload.isPending}>
          {upload.isError && (
            <p role="alert" className="rounded-lg border border-error-100 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-500">
              {(upload.error as Error).message}
            </p>
          )}

          <div>
            <label htmlFor="upload-team" className={labelClass}>
              Team<span aria-hidden className="text-error-600"> *</span>
            </label>
            <select id="upload-team" className={`cursor-pointer ${inputClass}`} value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} disabled={upload.isPending}>
              <option value="">{teamsQuery.isPending ? 'Loading teams…' : 'Select team'}</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Everyone in the sheet is signed to this team.</p>
          </div>

          <div>
            <label htmlFor="upload-file" className={labelClass}>
              Excel file (.xlsx)<span aria-hidden className="text-error-600"> *</span>
            </label>
            <input
              id="upload-file"
              type="file"
              accept=".xlsx"
              onChange={pickFile}
              disabled={upload.isPending}
              className={`${inputClass} file:mr-4 file:cursor-pointer file:rounded file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-brand-700 dark:file:bg-brand-500/10 dark:file:text-brand-400`}
              aria-invalid={fileError ? true : undefined}
              aria-describedby={fileError ? 'upload-file-error' : undefined}
            />
            {fileError && <p id="upload-file-error" className="mt-1 text-xs text-error-600 dark:text-error-500">{fileError}</p>}
          </div>

          <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.02]">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Columns it reads</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {COLUMNS.join(' · ')} — only the names are required, capitalisation doesn’t matter, and
              anything else in the sheet is ignored.
            </p>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-800">
            <button
              type="button"
              onClick={close}
              disabled={upload.isPending}
              className="cursor-pointer rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={upload.isPending || !selectedTeam || !file || !!fileError}
              className="inline-flex min-w-28 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {upload.isPending && <Spinner />}
              {upload.isPending ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default UploadPlayersDialog;

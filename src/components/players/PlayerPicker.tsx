import React, { useState } from 'react';
import { usePlayersPage } from '../../api/hooks';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PlayerAvatar } from './PlayerAvatar';
import { Button } from '../ui/primitives/button';
import { normalizeName } from '../../lib/text';
import type { Player } from '../../types/api';

export const playerLabel = (p: Player): string => {
  const name = `${normalizeName(p.firstName)} ${normalizeName(p.lastName)}`;
  const jersey = p.jerseyNumber != null ? ` #${p.jerseyNumber}` : '';
  const team = p.teamName ? ` — ${normalizeName(p.teamName)}` : '';
  return `${name}${jersey}${team}`;
};

/**
 * Picks one player by name. The search runs on the server, so this works across every player rather
 * than only the page the list happens to be showing. The backend matches first and last name only —
 * a jersey number or team name won't find anyone.
 */
export function PlayerPicker({
  id,
  label,
  selected,
  onSelect,
  excludeId,
  disabled,
}: {
  id: string;
  label: string;
  selected: Player | null;
  onSelect: (player: Player | null) => void;
  excludeId?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const search = useDebouncedValue(draft.trim(), 300);
  const query = usePlayersPage({ search: search || undefined, limit: 6, page: 1 });

  const results = (query.data?.items ?? []).filter((p) => p.id !== excludeId);
  const searching = search.length > 0;

  if (selected) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <div className="flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
          <PlayerAvatar firstName={selected.firstName} lastName={selected.lastName} photo={selected.photo} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">{playerLabel(selected)}</span>
          <Button variant="ghost" size="sm" type="button" onClick={() => { onSelect(null); setDraft(''); }} disabled={disabled}>
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <input
        id={id}
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Search by name"
        autoComplete="off"
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
      />
      {searching && (
        <div aria-live="polite" className="rounded-md border border-gray-200 dark:border-gray-700">
          {query.isPending && <p className="px-3 py-2 text-sm text-gray-500">Searching…</p>}
          {query.isError && <p className="px-3 py-2 text-sm text-rose-600">{(query.error as Error).message}</p>}
          {!query.isPending && !query.isError && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">No player matches “{search}”.</p>
          )}
          <ul className="max-h-56 overflow-y-auto">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none dark:hover:bg-gray-800 dark:focus-visible:bg-gray-800"
                >
                  <PlayerAvatar firstName={p.firstName} lastName={p.lastName} photo={p.photo} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-gray-900 dark:text-white">{playerLabel(p)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

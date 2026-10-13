import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayers, useTeams, useTournaments } from '../../api/hooks';
import { SEARCH_LIMIT, searchEverything, type SearchHit, type SearchKind } from '../../lib/global-search';
import { SearchIcon } from './icons';
import { cn } from '../../lib/utils';

const GROUPS: Array<{ kind: SearchKind; label: string }> = [
  { kind: 'tournament', label: 'Tournaments' },
  { kind: 'team', label: 'Teams' },
  { kind: 'player', label: 'Players' },
];

/** Only mounted once someone types, so the three lists aren't fetched on every page of the admin. */
function Results({ query, activeIndex, onHits, onPick, listId }: {
  query: string;
  activeIndex: number;
  onHits: (hits: SearchHit[]) => void;
  onPick: (hit: SearchHit) => void;
  listId: string;
}) {
  const tournaments = useTournaments();
  const teams = useTeams();
  const players = usePlayers();
  const loading = tournaments.isPending || teams.isPending || players.isPending;

  const grouped = useMemo(
    () => searchEverything(query, { tournaments: tournaments.data ?? [], teams: teams.data ?? [], players: players.data ?? [] }),
    [query, tournaments.data, teams.data, players.data],
  );
  const flat = useMemo(() => GROUPS.flatMap((g) => grouped[g.kind]), [grouped]);
  useEffect(() => onHits(flat), [flat, onHits]);

  let index = -1;
  return (
    <div id={listId} role="listbox" aria-label="Search results" className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[28rem] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      {loading && flat.length === 0 && <p role="status" className="px-3 py-3 text-sm text-gray-500">Searching…</p>}
      {!loading && flat.length === 0 && <p role="status" className="px-3 py-3 text-sm text-gray-500">Nothing matches “{query.trim()}”.</p>}
      {GROUPS.map((g) =>
        grouped[g.kind].length === 0 ? null : (
          <div key={g.kind} role="group" aria-label={g.label}>
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.label}</p>
            {grouped[g.kind].map((hit) => {
              index += 1;
              const active = index === activeIndex;
              return (
                <div
                  key={`${hit.kind}-${hit.id}`}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => { e.preventDefault(); onPick(hit); }}
                  className={cn('flex cursor-pointer flex-col rounded-md px-3 py-2', active ? 'bg-court-50 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60')}
                >
                  <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{hit.title}</span>
                  <span className="truncate text-xs text-gray-500">{hit.subtitle}</span>
                </div>
              );
            })}
          </div>
        ),
      )}
      {flat.length >= SEARCH_LIMIT * GROUPS.length && <p className="px-3 py-2 text-xs text-gray-500">Showing the top {SEARCH_LIMIT} in each group. Type more to narrow it down.</p>}
    </div>
  );
}

const sameHits = (a: SearchHit[], b: SearchHit[]) => a.length === b.length && a.every((h, i) => h.kind === b[i].kind && h.id === b[i].id);

/** Find a tournament, team or player from anywhere in the admin. ⌘K (or Ctrl+K) jumps to the box. */
export default function GlobalSearch() {
  const navigate = useNavigate();
  const listId = useId().replace(/:/g, '');
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  // Keep the old list when the results are the same ones, so a re-render of the results can't loop back here.
  const updateHits = useCallback((next: SearchHit[]) => setHits((prev) => (sameHits(prev, next) ? prev : next)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  const pick = (hit: SearchHit) => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    navigate(hit.href);
  };

  const showing = open && query.trim().length > 0;

  return (
    <div ref={wrapRef} className="relative hidden lg:block">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"><SearchIcon className="size-4 fill-current" /></span>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Search tournaments, teams and players"
        aria-expanded={showing}
        aria-controls={showing ? listId : undefined}
        aria-activedescendant={showing && hits.length > 0 ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Search tournaments, teams, players…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
          else if (e.key === 'ArrowDown' && hits.length) { e.preventDefault(); setActive((a) => (a + 1) % hits.length); }
          else if (e.key === 'ArrowUp' && hits.length) { e.preventDefault(); setActive((a) => (a - 1 + hits.length) % hits.length); }
          else if (e.key === 'Enter' && showing && hits[active]) { e.preventDefault(); pick(hits[active]); }
        }}
        className="h-10 w-full rounded-lg border border-gray-200 bg-transparent py-2 pl-11 pr-16 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus-visible:ring-[3px] focus-visible:ring-court-400/50 dark:border-gray-700 dark:text-white xl:w-[400px]"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">⌘K</kbd>
      {showing && <Results query={query} activeIndex={active} onHits={updateHits} onPick={pick} listId={listId} />}
    </div>
  );
}

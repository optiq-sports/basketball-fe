import React, { useEffect, useId, useRef, useState } from 'react';
import type { GameLogEntry, TeamSide } from '../types';
import { actionTitle, isEditableAction, type SubstitutionEditOptions, type SyncState } from '../logEdit/logEditModel';

type Draft = Record<string, unknown>;

export interface LogEditorModalProps {
  entry: GameLogEntry;
  draft: Draft;
  onDraftChange: (updater: (draft: Draft) => Draft) => void;
  /** Whether the draft differs from what was recorded. Save stays off until it does. */
  dirty: boolean;
  /** Informational only. Nothing in this modal ever waits on it. */
  sync: SyncState;
  teamNames: { home: string; away: string };
  getPlayerLabel: (side: TeamSide | null, jersey: number) => string;
  /** Players who could have made this play: who was on the court for that side at the time. */
  playersFor: (side: TeamSide | undefined, current: unknown) => number[];
  /** Everyone on that side's roster — the ones not in `playersFor` are offered under "Bench". */
  rosterFor?: (side: TeamSide | undefined) => number[];
  /** Points a shot is worth, from where it was taken. */
  shotValue: number;
  hasShotPosition: boolean;
  foulTypeLabel: (id: string) => string;
  turnoverTypeLabel: (id: string) => string;
  /** What saving would do to the scoreboard (zeros if nothing). */
  scoreChange: { home: number; away: number };
  /** For a substitution: who it can be changed to, or why it can't be changed right now. */
  substitution?: SubstitutionEditOptions;
  /** One sentence describing what Undo will do. */
  undoDescription: string;
  /** Set when Undo can't be done right now, with the reason. */
  undoBlockedReason?: string;
  onSave: () => void;
  onUndo: () => void;
  onClose: () => void;
}

const opposite = (side: TeamSide): TeamSide => (side === 'home' ? 'away' : 'home');

// ---------------------------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------------------------

/** One line of the form: a short label on the left, the taps on the right. */
const Row: React.FC<{ label: string; children: React.ReactNode; muted?: boolean }> = ({ label, children, muted }) => (
  <div className={`flex flex-col gap-1 sm:flex-row sm:gap-3 ${muted ? 'opacity-45' : ''}`}>
    <span className="shrink-0 pt-1 text-xs font-bold uppercase tracking-wide text-gray-500 sm:w-[4.5rem] sm:pt-2.5">
      {label}
    </span>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
);

const chipBase =
  'flex min-h-[46px] min-w-0 flex-col items-center justify-center border-2 px-1 py-1 leading-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed';
const chipOn = 'border-sky-600 bg-sky-600 text-white';
const chipOff = 'border-gray-300 bg-white text-gray-800 hover:border-gray-500';

/** "#30 S. Curry" -> { num: "#30", name: "Curry" } for a compact two-line chip. */
function splitLabel(label: string): { num: string; name: string } {
  const m = /^(#\d+)\s*(.*)$/.exec(label);
  if (!m) return { num: label, name: '' };
  const words = m[2].trim().split(/\s+/).filter(Boolean);
  return { num: m[1], name: words.length ? words[words.length - 1] : '' };
}

/**
 * Players as a tight grid of jersey chips — number big, surname small — five to a row, so the five
 * on the court fit on one line. Anyone else on the roster sits behind "Bench".
 */
function PlayerPicker(props: {
  name: string;
  players: number[];
  bench?: number[];
  label: (jersey: number) => string;
  value: number | string | undefined;
  onChange: (value: number | string) => void;
  /** Adds a first "No assist"-style chip that sets the value to 'none'. */
  noneLabel?: string;
  disabled?: boolean;
}): React.ReactElement {
  const bench = props.bench ?? [];
  const selectedOnBench = typeof props.value === 'number' && bench.includes(props.value);
  const [benchOpen, setBenchOpen] = useState(false);
  const showBench = benchOpen || selectedOnBench;
  const shown = showBench ? [...props.players, ...bench] : props.players;
  const cols = props.noneLabel ? 'grid-cols-6' : 'grid-cols-5';

  const chip = (key: string, selected: boolean, onClick: () => void, aria: string, top: string, bottom: string) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={aria}
      disabled={props.disabled}
      onClick={onClick}
      className={`${chipBase} ${selected ? chipOn : chipOff}`}
    >
      <span className="text-base font-bold">{top}</span>
      <span className={`max-w-full truncate text-[11px] font-medium ${selected ? 'text-sky-100' : 'text-gray-500'}`}>{bottom}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div role="radiogroup" aria-label={props.name} className={`grid ${cols} gap-1.5`}>
        {props.noneLabel &&
          chip('none', props.value === 'none' || props.value === undefined, () => props.onChange('none'), props.noneLabel, '—', props.noneLabel)}
        {shown.map((j) => {
          const { num, name } = splitLabel(props.label(j));
          return chip(String(j), j === props.value, () => props.onChange(j), props.label(j), num, name);
        })}
      </div>
      {bench.length > 0 && !selectedOnBench && (
        <button
          type="button"
          aria-expanded={showBench}
          onClick={() => setBenchOpen((o) => !o)}
          className="self-start text-xs font-semibold text-sky-700 hover:underline"
        >
          {showBench ? 'Hide bench' : `Bench (${bench.length})`}
        </button>
      )}
    </div>
  );
}

/** A few labelled options side by side — Made / Missed, the two teams, … — sharing the row equally. */
function Segmented<T extends string>(props: {
  name: string;
  options: Array<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <div role="radiogroup" aria-label={props.name} className="flex gap-1.5">
      {props.options.map((opt) => {
        const selected = opt.value === props.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={props.disabled}
            onClick={() => props.onChange(opt.value)}
            className={`${chipBase} flex-1 text-sm font-bold ${selected ? chipOn : chipOff}`}
          >
            <span className="max-w-full truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const Static: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Row label={label}>
    <p className="pt-1 text-sm font-semibold text-gray-900 sm:pt-2.5">{children}</p>
  </Row>
);

const SyncChip: React.FC<{ sync: SyncState }> = ({ sync }) => {
  if (sync === 'synced') return null;
  const sending = sync === 'sending';
  return (
    <span
      role="status"
      className={`inline-flex shrink-0 items-center gap-1.5 px-2 py-1 text-xs font-semibold ${
        sending ? 'bg-sky-50 text-sky-700' : 'bg-amber-100 text-amber-800'
      }`}
      title={
        sending
          ? 'This play is on its way to the server. You can still edit or undo it.'
          : "The server hasn't accepted this yet. It will keep retrying; you can still edit or undo it."
      }
    >
      {sending && <span className="size-2 animate-pulse rounded-full bg-sky-500" aria-hidden />}
      {sending ? 'Sending…' : 'Not sent yet'}
    </span>
  );
};

// ---------------------------------------------------------------------------------------------
// The modal
// ---------------------------------------------------------------------------------------------

const LogEditorModal: React.FC<LogEditorModalProps> = (props) => {
  const {
    entry, draft, onDraftChange, dirty, sync, teamNames, getPlayerLabel, playersFor, rosterFor, shotValue,
    hasShotPosition, foulTypeLabel, turnoverTypeLabel, scoreChange, undoDescription, undoBlockedReason,
    substitution, onSave, onUndo, onClose,
  } = props;

  const titleId = useId();
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const action = entry.action;
  const editable = isEditableAction(action);

  useEffect(() => {
    firstFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (patch: Draft) => onDraftChange((d) => ({ ...d, ...patch }));

  const labelOf = (side: TeamSide | undefined) => (j: number) => getPlayerLabel(side ?? null, j);

  /** Who was on the court, and (separately) everyone else on the roster. */
  const picks = (side: TeamSide | undefined, current: unknown, exclude?: unknown) => {
    const court = playersFor(side, current).filter((j) => j !== exclude);
    const all = rosterFor ? rosterFor(side) : [];
    const bench = all.filter((j) => !court.includes(j) && j !== exclude);
    return { court, bench };
  };

  const subBlocked = action === 'substitution' && !!substitution && !substitution.ok;

  // -- the fields for each kind of play. Every row is always drawn, so nothing moves under a tap. --
  const renderFields = (): React.ReactNode => {
    switch (action) {
      case 'shot': {
        const shotSide = draft.side as TeamSide | undefined;
        if (!shotSide) return null;
        const made = draft.result !== 'missed';
        const shooter = picks(shotSide, draft.shooterJersey);
        const assisters = picks(shotSide, draft.assistJersey, draft.shooterJersey);
        return (
          <>
            <Row label="Shooter">
              <PlayerPicker
                name="Shooter"
                players={shooter.court}
                bench={shooter.bench}
                label={labelOf(shotSide)}
                value={draft.shooterJersey as number | undefined}
                onChange={(j) =>
                  // A player can't assist their own shot.
                  set(draft.assistJersey === j ? { shooterJersey: j, assistJersey: 'none' } : { shooterJersey: j })
                }
              />
            </Row>
            <Row label="Result">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Segmented
                    name="Result"
                    options={[{ value: 'made', label: 'Made' }, { value: 'missed', label: 'Missed' }]}
                    value={made ? 'made' : 'missed'}
                    onChange={(v) => set({ result: v })}
                  />
                </div>
                <span
                  className="w-14 shrink-0 text-right text-sm font-bold text-gray-700"
                  title={
                    hasShotPosition
                      ? 'Set by where the shot was taken, so changing the player or result won’t change it.'
                      : 'No court position was recorded for this shot, so the original value is kept.'
                  }
                >
                  {shotValue} pt{shotValue === 1 ? '' : 's'}
                </span>
              </div>
            </Row>
            <Row label="Assist" muted={!made}>
              <PlayerPicker
                name="Assist"
                players={assisters.court}
                bench={assisters.bench}
                label={labelOf(shotSide)}
                noneLabel="No assist"
                disabled={!made}
                value={made ? ((draft.assistJersey as string | number | undefined) ?? 'none') : 'none'}
                onChange={(v) => set({ assistJersey: v })}
              />
              {!made && <p className="mt-1 text-xs text-gray-500">A missed shot can’t have an assist.</p>}
            </Row>
          </>
        );
      }
      case 'foul': {
        const fouler = draft.foulerSide as TeamSide | undefined;
        if (!fouler) return null;
        const fouled = opposite(fouler);
        const committing = picks(fouler, draft.foulerJersey);
        const receiving = picks(fouled, draft.fouledJersey);
        return (
          <>
            <Static label="Type">{foulTypeLabel(String(draft.foulType ?? ''))}</Static>
            <Row label="Fouler">
              <PlayerPicker
                name="Fouler"
                players={committing.court}
                bench={committing.bench}
                label={labelOf(fouler)}
                value={draft.foulerJersey as number | undefined}
                onChange={(j) => set({ foulerJersey: j })}
              />
            </Row>
            {draft.foulType !== 'technical' && (
              <Row label="Fouled">
                <PlayerPicker
                  name="Fouled player"
                  players={receiving.court}
                  bench={receiving.bench}
                  label={labelOf(fouled)}
                  value={draft.fouledJersey as number | undefined}
                  onChange={(j) => set({ fouledJersey: j })}
                />
              </Row>
            )}
          </>
        );
      }
      case 'free throw': {
        const ftSide = draft.shooterSide as TeamSide | undefined;
        if (!ftSide) return null;
        const shooter = picks(ftSide, draft.shooterJersey);
        return (
          <>
            <Static label="Attempt">
              {String(draft.attempt)} of {String(draft.totalAttempts)}
            </Static>
            <Row label="Shooter">
              <PlayerPicker
                name="Shooter"
                players={shooter.court}
                bench={shooter.bench}
                label={labelOf(ftSide)}
                value={draft.shooterJersey as number | undefined}
                onChange={(j) => set({ shooterJersey: j })}
              />
            </Row>
            <Row label="Result">
              <Segmented
                name="Result"
                options={[{ value: 'made', label: 'Made' }, { value: 'missed', label: 'Missed' }]}
                value={draft.result === 'missed' ? 'missed' : 'made'}
                onChange={(v) => set({ result: v })}
              />
            </Row>
          </>
        );
      }
      case 'turnover': {
        const s = draft.side as TeamSide | undefined;
        if (!s) return null;
        const who = picks(s, draft.jersey);
        return (
          <>
            <Static label="Type">{turnoverTypeLabel(String(draft.turnoverType ?? ''))}</Static>
            <Row label="Player">
              <PlayerPicker
                name="Player"
                players={who.court}
                bench={who.bench}
                label={labelOf(s)}
                value={draft.jersey as number | undefined}
                onChange={(j) => set({ jersey: j })}
              />
            </Row>
          </>
        );
      }
      case 'rebound': {
        const s = draft.side as TeamSide | undefined;
        if (!s) return null;
        const who = picks(s, draft.jersey);
        return (
          <>
            <Row label="Player">
              <PlayerPicker
                name="Player"
                players={who.court}
                bench={who.bench}
                label={labelOf(s)}
                value={draft.jersey as number | undefined}
                onChange={(j) => set({ jersey: j })}
              />
            </Row>
            <Row label="Type">
              <Segmented
                name="Rebound type"
                options={[{ value: 'offensive', label: 'Offensive' }, { value: 'defensive', label: 'Defensive' }]}
                value={draft.reboundType === 'offensive' ? 'offensive' : 'defensive'}
                onChange={(v) => set({ reboundType: v })}
              />
            </Row>
          </>
        );
      }
      case 'substitution': {
        if (!substitution) return null;
        if (!substitution.ok) {
          return (
            <p className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
              {substitution.reason}
            </p>
          );
        }
        const subSide = draft.side as TeamSide | undefined;
        return (
          <>
            <Row label="Came off">
              <PlayerPicker
                name="Player who came off"
                players={substitution.outOptions}
                label={labelOf(subSide)}
                value={draft.outJersey as number | undefined}
                onChange={(j) => set({ outJersey: j })}
              />
            </Row>
            <Row label="Came on">
              <PlayerPicker
                name="Player who came on"
                players={substitution.inOptions}
                label={labelOf(subSide)}
                value={draft.inJersey as number | undefined}
                onChange={(j) => set({ inJersey: j })}
              />
            </Row>
          </>
        );
      }
      case 'timeout':
        return (
          <Row label="Called by">
            <Segmented
              name="Timeout called by"
              options={[
                { value: 'home', label: teamNames.home },
                { value: 'away', label: teamNames.away },
                { value: 'officials', label: 'Officials' },
              ]}
              value={draft.choice as 'home' | 'away' | 'officials' | undefined}
              onChange={(v) => set({ choice: v })}
            />
          </Row>
        );
      case 'jump ball':
        return (
          <Row label="Won by">
            <Segmented
              name="Jump ball winner"
              options={[
                { value: 'home', label: teamNames.home },
                { value: 'away', label: teamNames.away },
              ]}
              value={draft.winner as 'home' | 'away' | undefined}
              onChange={(v) => set({ winner: v })}
            />
          </Row>
        );
      default:
        return null;
    }
  };

  const scoreLines = (['home', 'away'] as const)
    .filter((k) => scoreChange[k] !== 0)
    .map((k) => ({ team: teamNames[k], delta: scoreChange[k] }));

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center bg-black/40 px-3 pt-[4vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-xl flex-col border-2 border-gray-800 bg-white shadow-[0_30px_60px_-20px_rgba(15,23,42,0.5)]"
      >
        {/* Header: what this is and what it was recorded as, on two short lines */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 pb-2.5 pt-3">
          <div className="min-w-0">
            <h3 id={titleId} className="text-base font-bold text-gray-900">
              {editable ? `Edit ${actionTitle(action).toLowerCase()}` : actionTitle(action)}
              <span className="ml-2 text-xs font-normal text-gray-500">
                {entry.period} · {entry.clock}
                {entry.team && entry.team !== '—' ? ` · ${entry.team}` : ''}
              </span>
            </h3>
            <p className="mt-1 truncate border-l-4 border-gray-800 bg-gray-50 px-2 py-1 text-sm text-gray-900">
              <span className="font-semibold text-gray-500">Was: </span>
              <span className="font-semibold">
                {entry.player && entry.player !== '—' ? `${entry.player} · ` : ''}
                {entry.result}
              </span>
            </p>
          </div>
          <SyncChip sync={sync} />
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
          {editable ? renderFields() : (
            <p className="text-sm text-gray-600">
              This can’t be edited on its own. If it was recorded wrong, undo it and record it again.
            </p>
          )}
        </div>

        {/* Score change: its own reserved line, so it never pushes the form around */}
        <div className="min-h-[2.25rem] px-4 pb-1">
          {editable && scoreLines.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900" role="status">
              <strong>Score change:</strong>{' '}
              {scoreLines.map((l, i) => (
                <span key={l.team}>
                  {i > 0 ? ', ' : ''}
                  {l.team} {l.delta > 0 ? `+${l.delta}` : `−${Math.abs(l.delta)}`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="min-h-[4rem] border-t border-gray-200 px-4 py-2.5">
          {confirmingUndo ? (
            <div className="flex flex-col gap-2" role="alertdialog" aria-label="Confirm undo">
              <p className="text-sm text-gray-800">
                <strong>Undo this {actionTitle(action).toLowerCase()}?</strong> {undoDescription}
              </p>
              {undoBlockedReason && <p className="text-sm font-medium text-rose-700">{undoBlockedReason}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingUndo(false)}
                  className="min-h-[44px] border-2 border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:border-gray-500"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  disabled={Boolean(undoBlockedReason)}
                  onClick={onUndo}
                  className="min-h-[44px] bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Yes, undo it
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setConfirmingUndo(true)}
                className="min-h-[44px] border-2 border-rose-300 px-3 text-sm font-semibold text-rose-700 hover:border-rose-500 hover:bg-rose-50"
              >
                Undo this {actionTitle(action).toLowerCase()}
              </button>
              <div className="flex gap-2">
                <button
                  ref={firstFocusRef}
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] border-2 border-gray-300 px-4 text-sm font-semibold text-gray-800 hover:border-gray-500"
                >
                  {editable && dirty ? 'Discard changes' : 'Close'}
                </button>
                {editable && (
                  <button
                    type="button"
                    disabled={!dirty || subBlocked}
                    onClick={onSave}
                    className="min-h-[44px] min-w-[8rem] bg-sky-600 px-5 text-sm font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Save changes
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogEditorModal;

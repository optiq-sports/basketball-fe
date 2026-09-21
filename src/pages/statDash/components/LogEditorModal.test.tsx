import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GameLogEntry, TeamSide } from '../types';
import LogEditorModal, { type LogEditorModalProps } from './LogEditorModal';

const shotEntry: GameLogEntry = {
  id: 'r1', localId: 'L1', period: 'Q1', clock: '09:54', team: 'Sparks', player: '#19 Z. Zhang',
  action: 'shot', result: '3pt made',
  meta: { side: 'home', shooterJersey: 19, result: 'made', shotValue: 3, assistJersey: 16 },
};

function setup(over: Partial<LogEditorModalProps> = {}) {
  const props: LogEditorModalProps = {
    entry: shotEntry,
    draft: { side: 'home', shooterJersey: 19, result: 'made', assistJersey: 16 },
    onDraftChange: vi.fn(),
    dirty: false,
    sync: 'synced',
    teamNames: { home: 'Sparks', away: 'Fresh Stars' },
    getPlayerLabel: (_s: TeamSide | null, j: number) => `#${j} Player ${j}`,
    playersFor: () => [16, 19, 22],
    shotValue: 3,
    hasShotPosition: true,
    foulTypeLabel: (id) => id,
    turnoverTypeLabel: (id) => id,
    scoreChange: { home: 0, away: 0 },
    undoDescription: 'Removes this shot from the game log, takes 3 points off Sparks.',
    onSave: vi.fn(),
    onUndo: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<LogEditorModal {...props} />);
  return props;
}

describe('LogEditorModal', () => {
  it('says in plain words what was recorded and what it is', () => {
    setup();
    expect(screen.getByRole('dialog', { name: /edit shot/i })).toBeTruthy();
    expect(screen.getByText(/#19 Z\. Zhang · 3pt made/)).toBeTruthy();
    expect(screen.getByText(/Q1 · 09:54 · Sparks/)).toBeTruthy();
  });

  it('is one short row per thing to change — shooter, result, assist — each answered with one tap', () => {
    setup();
    expect(screen.getByText('Shooter')).toBeTruthy();
    expect(screen.getByText('Result')).toBeTruthy();
    expect(screen.getByText('Assist')).toBeTruthy();
    const shooter = within(screen.getByRole('radiogroup', { name: 'Shooter' }));
    expect(shooter.getByRole('radio', { name: '#19 Player 19' }).getAttribute('aria-checked')).toBe('true');
    expect(within(screen.getByRole('radiogroup', { name: 'Result' })).getByRole('radio', { name: 'Made' }).getAttribute('aria-checked')).toBe('true');
    const assist = within(screen.getByRole('radiogroup', { name: 'Assist' }));
    expect(assist.getByRole('radio', { name: '#16 Player 16' }).getAttribute('aria-checked')).toBe('true'); // current assist
  });

  it('does not offer the shooter as their own assist, and always offers "No assist"', () => {
    setup();
    const assist = within(screen.getByRole('radiogroup', { name: 'Assist' }));
    expect(assist.queryByRole('radio', { name: '#19 Player 19' })).toBeNull();
    expect(assist.getByRole('radio', { name: 'No assist' })).toBeTruthy();
    expect(assist.getByRole('radio', { name: '#22 Player 22' })).toBeTruthy();
  });

  it('a missed shot keeps the Assist row in place but greyed out, so the form never changes height under a tap', () => {
    setup({ draft: { side: 'home', shooterJersey: 19, result: 'missed' } });
    expect(screen.getByText('Assist')).toBeTruthy();
    const assist = within(screen.getByRole('radiogroup', { name: 'Assist' }));
    for (const r of assist.getAllByRole('radio')) expect((r as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/can’t have an assist/)).toBeTruthy();
  });

  it('shows the five on the court, with the rest of the roster behind "Bench"', () => {
    setup({ playersFor: () => [16, 19, 22], rosterFor: () => [1, 16, 19, 22, 30] });
    const shooter = within(screen.getByRole('radiogroup', { name: 'Shooter' }));
    expect(shooter.queryByRole('radio', { name: '#30 Player 30' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /Bench \(2\)/ })[0]);
    expect(shooter.getByRole('radio', { name: '#30 Player 30' })).toBeTruthy();
    expect(shooter.getByRole('radio', { name: '#1 Player 1' })).toBeTruthy();
  });

  it('opens the bench by itself when the player recorded is on it', () => {
    setup({
      draft: { side: 'home', shooterJersey: 30, result: 'made', assistJersey: 'none' },
      playersFor: () => [16, 19, 22],
      rosterFor: () => [16, 19, 22, 30],
    });
    const shooter = within(screen.getByRole('radiogroup', { name: 'Shooter' }));
    expect(shooter.getByRole('radio', { name: '#30 Player 30' }).getAttribute('aria-checked')).toBe('true');
  });

  it('picking the assister as the shooter clears the assist, since nobody assists themselves', () => {
    const p = setup({ draft: { side: 'home', shooterJersey: 19, result: 'made', assistJersey: 16 } });
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Shooter' })).getByRole('radio', { name: '#16 Player 16' }));
    const updater = (p.onDraftChange as ReturnType<typeof vi.fn>).mock.calls[0][0] as (d: Record<string, unknown>) => Record<string, unknown>;
    expect(updater({ shooterJersey: 19, assistJersey: 16 })).toEqual({ shooterJersey: 16, assistJersey: 'none' });
  });

  it('closes on Escape', () => {
    const p = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(p.onClose).toHaveBeenCalled();
  });

  it('applies a change straight away through onDraftChange', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Missed' }));
    expect(p.onDraftChange).toHaveBeenCalledTimes(1);
    const updater = (p.onDraftChange as ReturnType<typeof vi.fn>).mock.calls[0][0] as (d: Record<string, unknown>) => Record<string, unknown>;
    expect(updater({ result: 'made', shooterJersey: 19 })).toEqual({ result: 'missed', shooterJersey: 19 });
  });

  it('keeps Save switched off until something has actually changed', () => {
    setup({ dirty: false });
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('turns Save on once changed, and saves', () => {
    const p = setup({ dirty: true });
    const save = screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(p.onSave).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Discard changes' })).toBeTruthy(); // Close becomes Discard when edited
  });

  it('warns what a change will do to the score before it is saved', () => {
    setup({ dirty: true, scoreChange: { home: -3, away: 0 } });
    expect(screen.getByRole('status').textContent).toMatch(/Score change/);
    expect(screen.getByRole('status').textContent).toMatch(/Sparks −3/);
  });

  describe('REGRESSION: nothing waits for a sync', () => {
    it('Undo is available while the play is still being sent', () => {
      const p = setup({ sync: 'sending' });
      expect(screen.getByText(/Sending…/)).toBeTruthy();
      const undo = screen.getByRole('button', { name: /undo this shot/i }) as HTMLButtonElement;
      expect(undo.disabled).toBe(false);
      fireEvent.click(undo);
      fireEvent.click(screen.getByRole('button', { name: /yes, undo it/i }));
      expect(p.onUndo).toHaveBeenCalled();
    });

    it('Save is available while the play is still being sent', () => {
      setup({ sync: 'sending', dirty: true });
      expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('a play the server has not accepted yet can still be undone, and says it will retry', () => {
      setup({ sync: 'failed' });
      expect(screen.getByText('Not sent yet')).toBeTruthy();
      expect((screen.getByRole('button', { name: /undo this shot/i }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('shows no sync chip at all once everything is saved', () => {
      setup({ sync: 'synced' });
      expect(screen.queryByText(/sending/i)).toBeNull();
      expect(screen.queryByText(/not sent/i)).toBeNull();
    });
  });

  describe('Undo asks first, and says exactly what it will do', () => {
    it('does not undo on the first tap', () => {
      const p = setup();
      fireEvent.click(screen.getByRole('button', { name: /undo this shot/i }));
      expect(p.onUndo).not.toHaveBeenCalled();
      expect(screen.getByRole('alertdialog').textContent).toMatch(/Removes this shot from the game log, takes 3 points off Sparks\./);
    });

    it('"Keep it" backs out', () => {
      const p = setup();
      fireEvent.click(screen.getByRole('button', { name: /undo this shot/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
      expect(p.onUndo).not.toHaveBeenCalled();
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('explains why a substitution cannot be undone yet, instead of failing silently', () => {
      const p = setup({
        entry: { ...shotEntry, action: 'substitution', result: 'Out #16 · In #12', meta: {} },
        draft: { side: 'home', outJersey: 16, inJersey: 12 },
        substitution: { ok: true, outOptions: [3, 16], inOptions: [9, 12] },
        undoBlockedReason: '#12 isn’t on the court any more — a later substitution changed that. Undo that one first.',
      });
      fireEvent.click(screen.getByRole('button', { name: /undo this substitution/i }));
      expect(screen.getByText(/a later substitution changed that/)).toBeTruthy();
      const confirm = screen.getByRole('button', { name: /yes, undo it/i }) as HTMLButtonElement;
      expect(confirm.disabled).toBe(true);
      fireEvent.click(confirm);
      expect(p.onUndo).not.toHaveBeenCalled();
    });
  });

  describe('substitution — editable', () => {
    const subEntry: GameLogEntry = { ...shotEntry, id: 's1', action: 'substitution', player: '—', result: 'Out #16 · In #12', meta: { side: 'home', outJersey: 16, inJersey: 12 } };
    const draft = { side: 'home', outJersey: 16, inJersey: 12 };

    it('lets the statistician choose who came off and who came on — not just undo it', () => {
      const p = setup({ entry: subEntry, draft, dirty: true, substitution: { ok: true, outOptions: [3, 4, 16], inOptions: [9, 12, 23] } });
      expect(screen.getByRole('dialog', { name: /edit substitution/i })).toBeTruthy();
      const off = within(screen.getByRole('radiogroup', { name: 'Player who came off' }));
      const on = within(screen.getByRole('radiogroup', { name: 'Player who came on' }));
      expect(off.getByRole('radio', { name: '#16 Player 16' }).getAttribute('aria-checked')).toBe('true');
      expect(on.getByRole('radio', { name: '#12 Player 12' }).getAttribute('aria-checked')).toBe('true');
      fireEvent.click(on.getByRole('radio', { name: '#9 Player 9' }));
      const updater = (p.onDraftChange as ReturnType<typeof vi.fn>).mock.calls[0][0] as (d: Record<string, unknown>) => Record<string, unknown>;
      expect(updater(draft)).toEqual({ ...draft, inJersey: 9 });
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
    });

    it('when a later substitution has moved the players, says so and blocks saving rather than letting it fail', () => {
      setup({ entry: subEntry, draft, dirty: true, substitution: { ok: false, reason: '#12 or #16 has been substituted again since — undo the later substitution first, then edit this one.' } });
      expect(screen.getByRole('alert').textContent).toMatch(/undo the later substitution first/);
      expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
      expect(screen.queryByRole('radiogroup', { name: 'Player who came on' })).toBeNull();
    });
  });

  describe('timeout — editable', () => {
    it('lets the statistician change who called it, including officials', () => {
      const p = setup({ entry: { ...shotEntry, action: 'timeout', team: 'Sparks', player: '—', result: 'full', meta: {} }, draft: { choice: 'home' }, dirty: true });
      expect(screen.getByRole('dialog', { name: /edit timeout/i })).toBeTruthy();
      const group = within(screen.getByRole('radiogroup', { name: 'Timeout called by' }));
      expect(group.getByRole('radio', { name: 'Sparks' }).getAttribute('aria-checked')).toBe('true');
      fireEvent.click(group.getByRole('radio', { name: 'Officials' }));
      const updater = (p.onDraftChange as ReturnType<typeof vi.fn>).mock.calls[0][0] as (d: Record<string, unknown>) => Record<string, unknown>;
      expect(updater({ choice: 'home' })).toEqual({ choice: 'officials' });
    });
  });

  describe('jump ball — editable', () => {
    it('lets the statistician change who won the tip', () => {
      const p = setup({ entry: { ...shotEntry, action: 'jump ball', team: 'Sparks', player: '—', result: 'possession', meta: {} }, draft: { winner: 'home' }, dirty: true });
      expect(screen.getByRole('dialog', { name: /edit jump ball/i })).toBeTruthy();
      const group = within(screen.getByRole('radiogroup', { name: 'Jump ball winner' }));
      fireEvent.click(group.getByRole('radio', { name: 'Fresh Stars' }));
      const updater = (p.onDraftChange as ReturnType<typeof vi.fn>).mock.calls[0][0] as (d: Record<string, unknown>) => Record<string, unknown>;
      expect(updater({ winner: 'home' })).toEqual({ winner: 'away' });
    });
  });

  describe('rows that belong to a parent play', () => {
    it('an orphaned assist explains it cannot be edited alone, offers Undo, and has no Save', () => {
      setup({ entry: { ...shotEntry, action: 'assist', result: 'To #19', meta: {} } });
      expect(screen.getByText(/can’t be edited on its own/)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
      expect(screen.getByRole('button', { name: /undo this assist/i })).toBeTruthy();
    });
  });

  it('closes from Close', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(p.onClose).toHaveBeenCalled();
  });
});

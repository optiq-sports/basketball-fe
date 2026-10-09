import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';

function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <Modal open={open} onClose={() => { onClose(); setOpen(false); }} title="Edit">
        <input aria-label="First" />
        <button type="button">Middle</button>
        <button type="button">Last</button>
      </Modal>
    </>
  );
}

describe('Modal focus handling', () => {
  it('moves focus into the dialog when it opens, and back to the trigger when it closes', () => {
    render(<Harness onClose={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
  });

  it('keeps Tab inside: from the last control it wraps to the first (the close button)', () => {
    render(<Harness onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    screen.getByRole('button', { name: 'Last' }).focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('keeps Shift+Tab inside: from the first control (the close button) it wraps to the last', () => {
    render(<Harness onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    screen.getByRole('button', { name: 'Close' }).focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Last' }));
  });

  it('gives each open dialog its own title id, so two modals never share one', () => {
    render(
      <>
        <Modal open onClose={() => undefined} title="One">x</Modal>
        <Modal open onClose={() => undefined} title="Two">y</Modal>
      </>,
    );
    const dialogs = screen.getAllByRole('dialog');
    const ids = dialogs.map((d) => d.getAttribute('aria-labelledby'));
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });
});

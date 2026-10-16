import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  reset: { mutate: vi.fn(), isPending: false },
}));

vi.mock('../../api/hooks', () => ({
  useResetPassword: () => h.reset,
}));

import ResetPassword from './ResetPassword';

const renderAt = (path = '/reset-password?token=abc123') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/login" element={<div>LOGIN</div>} />
        <Route path="/forgot-password" element={<div>FORGOT</div>} />
      </Routes>
    </MemoryRouter>,
  );

const fill = (password: string, confirm = password) => {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Set new password' }));
};

beforeEach(() => {
  h.reset = { mutate: vi.fn(), isPending: false };
});

describe('Reset password', () => {
  it('sends the token from the URL with the new password', () => {
    renderAt();
    fill('an0therpassword');
    expect(h.reset.mutate).toHaveBeenCalledWith({ token: 'abc123', newPassword: 'an0therpassword' }, expect.anything());
  });

  it('never shows the token, because it is a credential', () => {
    renderAt();
    expect(screen.queryByText(/abc123/)).toBeNull();
    expect(screen.queryByDisplayValue('abc123')).toBeNull();
  });

  it('refuses a password under eight characters, matching the backend’s rule', () => {
    renderAt();
    fill('short1');
    expect(screen.getByRole('alert').textContent).toMatch(/at least 8 characters/);
    expect(h.reset.mutate).not.toHaveBeenCalled();
  });

  it('refuses two passwords that differ', () => {
    renderAt();
    fill('an0therpassword', 'an0therpassw0rd');
    expect(screen.getByRole('alert').textContent).toMatch(/don’t match/);
    expect(h.reset.mutate).not.toHaveBeenCalled();
  });

  it('can reveal both passwords together', () => {
    renderAt();
    expect((screen.getByLabelText('New password') as HTMLInputElement).type).toBe('password');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show passwords' }));
    expect((screen.getByLabelText('New password') as HTMLInputElement).type).toBe('text');
    expect((screen.getByLabelText('Confirm new password') as HTMLInputElement).type).toBe('text');
  });

  it('offers a fresh link when the token has expired, rather than only the error', () => {
    h.reset.mutate = vi.fn((_v: unknown, opts: { onError: (e: Error) => void }) => opts.onError(new Error('Invalid or expired password reset token')));
    renderAt();
    fill('an0therpassword');
    expect(screen.getByRole('alert').textContent).toMatch(/Invalid or expired/);
    fireEvent.click(screen.getByRole('link', { name: 'Ask for a new link' }));
    expect(screen.getByText('FORGOT')).toBeInTheDocument();
  });

  it('shows another failure without offering a new link', () => {
    h.reset.mutate = vi.fn((_v: unknown, opts: { onError: (e: Error) => void }) => opts.onError(new Error('Service unavailable')));
    renderAt();
    fill('an0therpassword');
    expect(screen.getByRole('alert').textContent).toMatch(/Service unavailable/);
    expect(screen.queryByRole('link', { name: 'Ask for a new link' })).toBeNull();
  });

  it('sends the user to sign in once the password is changed', async () => {
    h.reset.mutate = vi.fn((_v: unknown, opts: { onSuccess: () => void }) => opts.onSuccess());
    renderAt();
    fill('an0therpassword');
    await waitFor(() => expect(screen.getByText('Password changed')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Go to Login' }));
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  it('says a link with no token can’t be used, and offers a new one', () => {
    renderAt('/reset-password');
    expect(screen.getByText('This link isn’t complete')).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Send a new link' }));
    expect(screen.getByText('FORGOT')).toBeInTheDocument();
  });
});

import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  auth: { changePassword: vi.fn(), logout: vi.fn() },
}));
vi.mock('../../api/ApiClient', () => ({ apiClient: api }));

import ChangePasswordRequired from './ChangePasswordRequired';
import { ToastProvider } from '../../components/ui/ToastProvider';

function setup() {
  const onChanged = vi.fn();
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter>
          <ChangePasswordRequired onChanged={onChanged} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onChanged };
}

const fillAndSubmit = (old: string, next: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText(/current \(temporary\) password/i), { target: { value: old } });
  fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: next } });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: /change password & continue/i }));
};

describe('ChangePasswordRequired', () => {
  beforeEach(() => {
    localStorage.clear();
    api.auth.changePassword.mockReset();
    api.auth.logout.mockReset();
  });

  it('rejects an empty or too-short new password, and a mismatched confirmation, without calling the server', () => {
    setup();
    fillAndSubmit('temp123', '12345', '12345');
    expect(screen.getByText(/at least 6 characters/i)).toBeTruthy();
    expect(api.auth.changePassword).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match the new password', () => {
    setup();
    fillAndSubmit('temp123', 'newpass1', 'newpass2');
    expect(screen.getByText(/doesn.t match the new password/i)).toBeTruthy();
    expect(api.auth.changePassword).not.toHaveBeenCalled();
  });

  it('rejects a new password identical to the current one', () => {
    setup();
    fillAndSubmit('temp123', 'temp123', 'temp123');
    expect(screen.getByText(/different from your current one/i)).toBeTruthy();
    expect(api.auth.changePassword).not.toHaveBeenCalled();
  });

  it('on success, calls POST /auth/change-password with oldPassword/newPassword and then onChanged', async () => {
    api.auth.changePassword.mockResolvedValue({ ok: true, data: { success: true }, status: 200 });
    const { onChanged } = setup();
    fillAndSubmit('temp123', 'brandNewPass1', 'brandNewPass1');
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(api.auth.changePassword).toHaveBeenCalledWith({ oldPassword: 'temp123', newPassword: 'brandNewPass1' });
  });

  it('shows the server error ("Invalid old password") and does not call onChanged', async () => {
    api.auth.changePassword.mockRejectedValue(new Error('Invalid old password'));
    const { onChanged } = setup();
    fillAndSubmit('wrongpass', 'brandNewPass1', 'brandNewPass1');
    await waitFor(() => expect(screen.getByText('Invalid old password')).toBeTruthy());
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('"Not you? Sign out" clears tokens and does not submit a password change', () => {
    localStorage.setItem('access_token', 'tok');
    localStorage.setItem('refresh_token', 'ref');
    setup();
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(api.auth.changePassword).not.toHaveBeenCalled();
  });

  it('"Show passwords" reveals the fields as plain text', () => {
    setup();
    const field = screen.getByLabelText(/current \(temporary\) password/i) as HTMLInputElement;
    expect(field.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: /show passwords/i }));
    expect(field.type).toBe('text');
  });
});

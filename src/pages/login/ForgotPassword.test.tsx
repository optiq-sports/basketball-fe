import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  forgot: { mutate: vi.fn(), isPending: false },
}));

vi.mock('../../api/hooks', () => ({
  useForgotPassword: () => h.forgot,
}));

import ForgotPassword from './ForgotPassword';

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/login" element={<div>LOGIN</div>} />
      </Routes>
    </MemoryRouter>,
  );

/** Drives the form with an address and runs the mutation's callback the test wants. */
const submit = (email: string) => {
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));
};

beforeEach(() => {
  h.forgot = { mutate: vi.fn(), isPending: false };
});

describe('Forgot password: the form', () => {
  it('asks for an email and sends it to the backend', () => {
    h.forgot.mutate = vi.fn();
    renderPage();
    submit('coach@example.com');
    expect(h.forgot.mutate).toHaveBeenCalledWith('coach@example.com', expect.anything());
  });

  it('trims the address before sending it', () => {
    renderPage();
    submit('  coach@example.com  ');
    expect(h.forgot.mutate).toHaveBeenCalledWith('coach@example.com', expect.anything());
  });

  it('refuses an empty address without calling the backend', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(h.forgot.mutate).not.toHaveBeenCalled();
  });

  it('refuses an address that is not an email', () => {
    renderPage();
    submit('coach@');
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(h.forgot.mutate).not.toHaveBeenCalled();
  });

  it('shows the server’s reason when the request fails', () => {
    h.forgot.mutate = vi.fn((_e: string, opts: { onError: (err: Error) => void }) => opts.onError(new Error('Service unavailable')));
    renderPage();
    submit('coach@example.com');
    expect(screen.getByRole('alert').textContent).toMatch(/Service unavailable/);
  });

  it('links back to sign in', () => {
    renderPage();
    fireEvent.click(screen.getByRole('link', { name: 'Login' }));
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });
});

describe('Forgot password: the confirmation', () => {
  const succeed = () => {
    h.forgot.mutate = vi.fn((_e: string, opts: { onSuccess: () => void }) => opts.onSuccess());
  };

  it('does not claim an email was sent, because the backend answers the same for an unknown address', async () => {
    succeed();
    renderPage();
    submit('coach@example.com');
    await waitFor(() => expect(screen.getByText('Check your email')).toBeInTheDocument());
    // The old page said "We've sent a password reset link to {email}" while sending nothing at all.
    expect(screen.queryByText(/We've sent a password reset link/)).toBeNull();
    expect(screen.getByText(/is on an account/)).toBeInTheDocument();
    expect(screen.getByText('coach@example.com')).toBeInTheDocument();
  });

  it('says how long the link lasts', async () => {
    succeed();
    renderPage();
    submit('coach@example.com');
    await waitFor(() => expect(screen.getByText(/lasts one hour/)).toBeInTheDocument());
  });

  it('can send the link again, and still points to an administrator', async () => {
    succeed();
    renderPage();
    submit('coach@example.com');
    await waitFor(() => expect(screen.getByText('Check your email')).toBeInTheDocument());
    expect(screen.getByText(/ask the administrator who set up your account/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'send it again' }));
    expect(h.forgot.mutate).toHaveBeenCalledTimes(2);
  });
});

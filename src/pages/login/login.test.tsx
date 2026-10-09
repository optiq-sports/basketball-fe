import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ mutate: vi.fn(), navigate: vi.fn() }));

vi.mock('../../api/hooks', () => ({ useLogin: () => ({ mutate: h.mutate, isPending: false, error: null, isError: false }) }));
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => h.navigate }));

import AdminLoginPage from './login';

const renderPage = () => render(<MemoryRouter><AdminLoginPage /></MemoryRouter>);

beforeEach(() => {
  h.mutate.mockReset();
  h.navigate.mockReset();
});

describe('Sign in', () => {
  it('asks for both fields and does not call the server', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /sign in|log in|continue/i }));
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it('rejects something that is not an email', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in|log in|continue/i }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(h.mutate).not.toHaveBeenCalled();
  });

  it('signs in with the trimmed email and the password as typed', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: '  ada@example.com ' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: ' secret ' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in|log in|continue/i }));
    await waitFor(() => expect(h.mutate).toHaveBeenCalledWith({ email: 'ada@example.com', password: ' secret ' }, expect.any(Object)));
  });

  it('clears an error once the field is fixed', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /sign in|log in|continue/i }));
    await screen.findByText('Enter your email address.');
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'ada@example.com' } });
    await waitFor(() => expect(screen.queryByText('Enter your email address.')).not.toBeInTheDocument());
  });
});

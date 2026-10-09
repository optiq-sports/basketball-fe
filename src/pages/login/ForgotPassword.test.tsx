import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ForgotPassword from './ForgotPassword';

const renderPage = () => render(<MemoryRouter><ForgotPassword /></MemoryRouter>);

describe('Forgot password', () => {
  it('says that resetting by email is not available, instead of pretending to send one', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Forgot your password?' })).toBeInTheDocument();
    expect(screen.getByText(/isn’t available yet/)).toBeInTheDocument();
    expect(screen.queryByText(/we've sent|we’ve sent|check your email/i)).not.toBeInTheDocument();
  });

  it('has no email field to fill in and no form to submit', () => {
    renderPage();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(document.querySelector('form')).toBeNull();
  });

  it('points to an administrator, and links back to sign in', () => {
    renderPage();
    expect(screen.getByText(/Ask the administrator/)).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: /Back to sign in/ })) expect(link).toHaveAttribute('href', '/login');
  });
});

import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { cn } from '../../lib/utils';
import { Button } from '../ui/primitives/button';
import { Badge } from '../ui/primitives/badge';
import { EmptyState, ErrorState, ListSkeleton, NoResultsState, PageHeader } from './page-states';
import AdminSidebar from './AdminSidebar';
import { SidebarProvider } from '../../contexts/SidebarContext';

describe('cn', () => {
  it('merges conflicting Tailwind classes, later wins', () => {
    expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4');
    expect(cn('bg-court-700', false && 'hidden', undefined, 'text-white')).toBe('bg-court-700 text-white');
  });
});

describe('Button', () => {
  it('uses the court primary style by default and the destructive style when asked', () => {
    const { rerender } = render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).className).toMatch(/bg-court-700/);
    rerender(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toMatch(/bg-rose-600/);
  });

  it('cannot be clicked while disabled', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Badge', () => {
  it('applies the live variant for in-play state', () => {
    render(<Badge variant="live">LIVE</Badge>);
    expect(screen.getByText('LIVE').className).toMatch(/text-signal-700/);
  });
});

describe('page states', () => {
  it('PageHeader renders the title as a heading and places actions beside it', () => {
    render(<PageHeader title="Tournaments" description="All competitions" actions={<Button>New</Button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tournaments' })).toBeTruthy();
    expect(screen.getByText('All competitions')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New' })).toBeTruthy();
  });

  it('ListSkeleton is announced as loading and matches the requested column count', () => {
    render(<ListSkeleton columns={5} rows={2} label="Loading tournaments" />);
    const status = screen.getByRole('status', { name: 'Loading tournaments' });
    const header = status.firstElementChild as HTMLElement;
    expect(header.style.gridTemplateColumns).toBe('repeat(5, minmax(0, 1fr))');
  });

  it('EmptyState offers the primary action that creates the first record', () => {
    const onClick = vi.fn();
    render(<EmptyState title="No tournaments yet" description="Create one to get started." action={{ label: 'New tournament', onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: 'New tournament' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ErrorState says what failed and retries on request', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Network error" onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toMatch(/Couldn’t load this/);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('NoResultsState is distinct from EmptyState and clears the filters', () => {
    const onClear = vi.fn();
    render(<NoResultsState query="harbor" onClear={onClear} />);
    expect(screen.getByText('No matches')).toBeTruthy();
    expect(screen.queryByText('No tournaments yet')).toBeNull();
    expect(screen.getByText(/Nothing matches “harbor”/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe('AdminSidebar', () => {
  const renderSidebar = (role: string, path = '/tournaments') =>
    render(
      <SidebarProvider>
        <MemoryRouter initialEntries={[path]}>
          <AdminSidebar userRole={role} />
        </MemoryRouter>
      </SidebarProvider>,
    );

  it('shows admins the everyday sections but not super-admin-only ones', () => {
    renderSidebar('ADMIN');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: /tournaments/i })).toBeTruthy();
    expect(within(nav).queryByRole('link', { name: /clients/i })).toBeNull();
    expect(within(nav).queryByRole('link', { name: /queue ops/i })).toBeNull();
  });

  it('shows super admins the super-admin sections', () => {
    renderSidebar('SUPER_ADMIN');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: /clients/i })).toBeTruthy();
  });

  it('marks the current page for assistive technology', () => {
    renderSidebar('ADMIN', '/tournaments/abc');
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: /tournaments/i }).getAttribute('aria-current')).toBe('page');
  });
});

import React from 'react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LEGACY_REDIRECTS } from './routes.legacy';
import { menuItems } from './components/admin/menu';

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {LEGACY_REDIRECTS.map(([from, to]) => <Route key={from} path={from} element={<Navigate to={to} replace />} />)}
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Retired Start New wizard addresses', () => {
  it.each([
    ['/start-new', '/tournaments?new=1'],
    ['/teams', '/teams-management'],
    ['/players', '/players-management'],
    ['/team-overview', '/tournaments'],
    ['/complete', '/tournaments'],
  ])('%s lands on %s', (from, to) => {
    renderAt(from);
    expect(screen.getByTestId('where')).toHaveTextContent(to);
  });

  it('never redirects to an address that is itself redirected', () => {
    const sources = new Set(LEGACY_REDIRECTS.map(([from]) => from));
    for (const [, to] of LEGACY_REDIRECTS) expect(sources.has(to.split('?')[0])).toBe(false);
  });
});

describe('Sidebar', () => {
  it('points Start New at the New tournament form', () => {
    expect(menuItems.find((i) => i.key === 'start-new')?.href).toBe('/tournaments?new=1');
  });

  it('calls the admins page Admins, as the page itself does', () => {
    expect(menuItems.find((i) => i.key === 'users')?.label).toBe('Admins');
  });

  it('has no link to a retired address', () => {
    const retired = new Set(LEGACY_REDIRECTS.map(([from]) => from));
    for (const item of menuItems) expect(retired.has(item.href.split('?')[0])).toBe(false);
  });
});

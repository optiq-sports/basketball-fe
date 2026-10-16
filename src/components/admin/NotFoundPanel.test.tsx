import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NotFoundPanel from './NotFoundPanel';

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}</div>;
}

/** The admin shell's route table, reduced to the shape that matters: a real route and the catch-all. */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
        <Route path="/tournaments/:id" element={<div>TOURNAMENT</div>} />
        <Route path="*" element={<NotFoundPanel />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

describe('NotFoundPanel (Bug 203)', () => {
  it('leaves real routes alone', () => {
    renderAt('/tournaments/t1');
    expect(screen.getByText('TOURNAMENT')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /doesn’t exist/ })).toBeNull();
  });

  it('explains an unmatched admin URL instead of rendering an empty page', () => {
    renderAt('/tournaments/t1/nonsense');
    expect(screen.getByRole('heading', { name: /doesn’t exist/ })).toBeTruthy();
  });

  it('shows the path it could not match, so a stale link is obvious', () => {
    const { container } = renderAt('/tournaments/t1/nonsense');
    // Scoped to the panel's own <code>, since the test harness also prints the path.
    expect(container.querySelector('code')?.textContent).toBe('/tournaments/t1/nonsense');
  });

  it('offers a way back to the dashboard', () => {
    renderAt('/nope');
    const link = screen.getByRole('link', { name: 'Go to the dashboard' });
    fireEvent.click(link);
    expect(screen.getByTestId('where').textContent).toBe('/dashboard');
  });

  it('offers a Back button that uses browser history', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    renderAt('/nope');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(back).toHaveBeenCalled();
    back.mockRestore();
  });
});

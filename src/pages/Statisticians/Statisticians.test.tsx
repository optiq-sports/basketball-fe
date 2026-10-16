import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });

const h = vi.hoisted(() => ({
  active: null as unknown,
  inactive: null as unknown,
  one: null as unknown,
  create: { mutate: vi.fn(), isPending: false },
  update: { mutate: vi.fn(), isPending: false },
  deactivate: { mutate: vi.fn(), isPending: false },
  uploadFile: { mutate: vi.fn(), isPending: false },
  toast: { success: vi.fn(), error: vi.fn() },
  asked: [] as unknown[],
}));

vi.mock('../../api/hooks', () => ({
  useStatisticians: (status: unknown) => {
    h.asked.push(status);
    return status === 'INACTIVE' ? h.inactive : h.active;
  },
  useStatistician: () => h.one,
  useCreateStatistician: () => h.create,
  useUpdateStatistician: () => h.update,
  useDeleteStatistician: () => h.deactivate,
  useUploadFile: () => h.uploadFile,
}));
vi.mock('../../hooks/useToast', () => ({ useToast: () => h.toast }));

import Statisticians from './Statisticians';

const stat = (id: string, fullName: string, over: Record<string, unknown> = {}) => ({
  id,
  email: `${id}@example.com`,
  name: fullName,
  status: 'ACTIVE',
  profile: { fullName, phone: '0801', country: 'Nigeria', state: 'Lagos', photos: [] },
  ...over,
});

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.search}</div>;
}

function renderAt(path = '/statisticians') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/statisticians" element={<Statisticians />} /></Routes>
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.asked = [];
  h.active = ok([stat('zed', 'Zed Okoro'), stat('ada', 'Ada Eze', { profile: { fullName: 'Ada Eze', phone: '0802', country: 'Ghana', state: 'Accra', photos: [] } })]);
  h.inactive = ok([]);
  h.one = { data: undefined, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() };
  h.create = { mutate: vi.fn(), isPending: false };
  h.update = { mutate: vi.fn(), isPending: false };
  h.deactivate = { mutate: vi.fn(), isPending: false };
  h.uploadFile = { mutate: vi.fn(), isPending: false };
  h.toast = { success: vi.fn(), error: vi.fn() };
});

/** The photo tiles are plain divs; each tile is the container of its own name heading. */
const tiles = () => screen.getAllByRole('heading', { level: 3 }).map((h3) => h3.closest('div.group') as HTMLElement);

describe('Statisticians: list', () => {
  it('shows statisticians as photo tiles, sorted by name', () => {
    renderAt();
    const cards = tiles();
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Ada Eze')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Accra, Ghana')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Zed Okoro')).toBeInTheDocument();
  });

  it('shows a status badge on each tile', () => {
    renderAt();
    // "Active" is also an option in the filter select, so look inside the tiles.
    for (const card of tiles()) expect(within(card).getByText('Active')).toBeInTheDocument();
  });

  it('asks for both statuses on All, so an inactive statistician is reachable — the old All never was', () => {
    h.inactive = ok([stat('old', 'Old Hand', { status: 'INACTIVE' })]);
    renderAt();
    expect(h.asked).toContain('ACTIVE');
    expect(h.asked).toContain('INACTIVE');
    expect(screen.getByText('Old Hand')).toBeInTheDocument();
    expect(screen.getByText('Zed Okoro')).toBeInTheDocument();
  });

  it('narrows to one status from the filter, and keeps it in the URL', () => {
    h.inactive = ok([stat('old', 'Old Hand', { status: 'INACTIVE' })]);
    renderAt();
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'inactive' } });
    expect(screen.getByTestId('where')).toHaveTextContent('status=inactive');
    expect(screen.getByText('Old Hand')).toBeInTheDocument();
    expect(screen.queryByText('Zed Okoro')).not.toBeInTheDocument();
  });

  it('reads the filter from the URL', () => {
    renderAt('/statisticians?status=active');
    expect((screen.getByLabelText('Filter by status') as HTMLSelectElement).value).toBe('active');
  });

  it('searches the whole list by name, email or place', () => {
    renderAt('/statisticians?q=ghana');
    const cards = tiles();
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByText('Ada Eze')).toBeInTheDocument();
  });

  it('says so when a search finds nothing', () => {
    renderAt('/statisticians?q=nobody');
    expect(screen.getByText('No statisticians found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filter')).toBeInTheDocument();
  });

  it('shows an empty state inviting the first one', () => {
    h.active = ok([]);
    renderAt();
    expect(screen.getByText('No statisticians found')).toBeInTheDocument();
    expect(screen.getByText(/Add the people who will score your games/)).toBeInTheDocument();
  });

  it('shows the error above the list', () => {
    h.active = { ...ok(undefined), isError: true, error: new Error('boom') };
    renderAt();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it('pages the filtered list in the browser, nine to a page', () => {
    h.active = ok(Array.from({ length: 11 }, (_, i) => stat(`s${i}`, `Person ${String(i).padStart(2, '0')}`)));
    renderAt('/statisticians?page=2');
    const cards = tiles();
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Person 09')).toBeInTheDocument();
  });

  it('shows a full first page', () => {
    h.active = ok(Array.from({ length: 11 }, (_, i) => stat(`s${i}`, `Person ${String(i).padStart(2, '0')}`)));
    renderAt();
    expect(tiles()).toHaveLength(9);
  });

  it('opens the profile in a modal when a tile is clicked, as the old page did', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Open Ada Eze' }));
    expect(screen.getByRole('dialog', { name: 'Statistician' })).toBeInTheDocument();
  });
});

describe('Statisticians: deactivate and reactivate', () => {
  it('asks before deactivating, and says it is reversible', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Ada Eze' }));
    expect(screen.getByText(/reactivate them from the Inactive tab/)).toBeInTheDocument();
    expect(h.deactivate.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    expect(h.deactivate.mutate).toHaveBeenCalledWith('ada', expect.any(Object));
  });

  it('never offers a Delete, because the backend does not delete the account', () => {
    renderAt();
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  });

  it('offers Reactivate, not Deactivate, for an inactive statistician', () => {
    h.active = ok([]);
    h.inactive = ok([stat('ada', 'Ada Eze', { status: 'INACTIVE' })]);
    renderAt('/statisticians?status=inactive');
    expect(screen.queryByRole('button', { name: /^Deactivate/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reactivate Ada Eze' }));
    expect(h.update.mutate).toHaveBeenCalledWith({ id: 'ada', data: { status: 'ACTIVE' } }, expect.any(Object));
  });
});

describe('Statisticians: form', () => {
  it('starts a new account with a generated password', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Statistician' }));
    const pw = screen.getByLabelText(/^Password/) as HTMLInputElement;
    expect(pw.value).toHaveLength(12);
  });

  it('will not submit an empty create, and focuses the first problem', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Statistician' }));
    const dialog = screen.getByRole('dialog', { name: 'Add statistician' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await within(dialog).findByText('Enter a first name.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter an email address.')).toBeInTheDocument();
    expect(h.create.mutate).not.toHaveBeenCalled();
    await waitFor(() => expect(within(dialog).getByLabelText(/First name/)).toHaveFocus());
  });

  it('creates with the joined name', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add Statistician' }));
    const dialog = screen.getByRole('dialog', { name: 'Add statistician' });
    fireEvent.change(within(dialog).getByLabelText(/First name/), { target: { value: 'Ngozi' } });
    fireEvent.change(within(dialog).getByLabelText(/Last name/), { target: { value: 'Ade' } });
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: 'ngozi@example.com' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(h.create.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ngozi@example.com', firstName: 'Ngozi', lastName: 'Ade', name: 'Ngozi Ade' }),
        expect.any(Object),
      ),
    );
  });

  it('sends only what changed on an edit, and nothing when nothing did', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada Eze' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit statistician' });
    expect(within(dialog).getByLabelText(/^Email/)).toHaveAttribute('readonly');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Update' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(h.update.mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada Eze' }));
    const again = screen.getByRole('dialog', { name: 'Edit statistician' });
    fireEvent.change(within(again).getByLabelText(/Phone/), { target: { value: '0899' } });
    fireEvent.click(within(again).getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(h.update.mutate).toHaveBeenCalledWith({ id: 'ada', data: { phone: '0899' } }, expect.any(Object)));
  });

  it('refuses to clear a stored phone number, and says why', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada Eze' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit statistician' });
    fireEvent.change(within(dialog).getByLabelText(/Phone/), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Update' }));
    expect(await within(dialog).findByText(/can’t be cleared yet/)).toBeInTheDocument();
    expect(h.update.mutate).not.toHaveBeenCalled();
  });
});

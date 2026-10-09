import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Q<T> = { data?: T; isPending: boolean; isError: boolean; isFetching: boolean; error: unknown; refetch: () => void };
const ok = <T,>(data: T): Q<T> => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: vi.fn() });

const h = vi.hoisted(() => ({
  list: null as unknown,
  create: { mutate: vi.fn(), isPending: false },
  update: { mutate: vi.fn(), isPending: false },
  deactivate: { mutate: vi.fn(), isPending: false },
  uploadFile: { mutate: vi.fn(), isPending: false },
  toast: { success: vi.fn(), error: vi.fn() },
  lastStatus: null as unknown,
}));

vi.mock('../../api/hooks', () => ({
  useStatisticians: (status: unknown) => { h.lastStatus = status; return h.list; },
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
  h.list = ok([stat('zed', 'Zed Okoro'), stat('ada', 'Ada Eze', { profile: { fullName: 'Ada Eze', phone: '0802', country: 'Ghana', state: 'Accra', photos: [] } })]);
  h.create = { mutate: vi.fn(), isPending: false };
  h.update = { mutate: vi.fn(), isPending: false };
  h.deactivate = { mutate: vi.fn(), isPending: false };
  h.uploadFile = { mutate: vi.fn(), isPending: false };
  h.toast = { success: vi.fn(), error: vi.fn() };
});

describe('Statisticians: list', () => {
  it('shows statisticians as cards, sorted by name', () => {
    renderAt();
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Ada Eze')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Accra, Ghana')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Zed Okoro')).toBeInTheDocument();
  });

  it('asks for active statisticians by default and inactive ones on the Inactive tab', () => {
    renderAt();
    expect(h.lastStatus).toBe('ACTIVE');
    fireEvent.click(screen.getByRole('tab', { name: 'Inactive' }));
    expect(screen.getByTestId('where')).toHaveTextContent('status=inactive');
    expect(h.lastStatus).toBe('INACTIVE');
  });

  it('reads the tab from the URL', () => {
    renderAt('/statisticians?status=inactive');
    expect(h.lastStatus).toBe('INACTIVE');
    expect(screen.getByRole('tab', { name: 'Inactive' })).toHaveAttribute('aria-selected', 'true');
  });

  it('searches the whole list by name, email or place', () => {
    renderAt('/statisticians?q=ghana');
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByText('Ada Eze')).toBeInTheDocument();
  });

  it('says so when a search finds nothing', () => {
    renderAt('/statisticians?q=nobody');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.getByText('Nothing matches “nobody”.')).toBeInTheDocument();
  });

  it('shows an empty state with a way to add the first one', () => {
    h.list = ok([]);
    renderAt();
    expect(screen.getByText('No statisticians yet')).toBeInTheDocument();
  });

  it('shows the error with a retry', () => {
    h.list = { ...ok(undefined), isError: true, error: new Error('boom') };
    renderAt();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it('pages the filtered list in the browser', () => {
    h.list = ok(Array.from({ length: 14 }, (_, i) => stat(`s${i}`, `Person ${String(i).padStart(2, '0')}`)));
    renderAt('/statisticians?page=2');
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Person 12')).toBeInTheDocument();
  });

  it('shows a full first page', () => {
    h.list = ok(Array.from({ length: 14 }, (_, i) => stat(`s${i}`, `Person ${String(i).padStart(2, '0')}`)));
    renderAt();
    expect(screen.getAllByRole('article')).toHaveLength(12);
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

  it('offers Reactivate, not Deactivate, for an inactive statistician', () => {
    h.list = ok([stat('ada', 'Ada Eze', { status: 'INACTIVE' })]);
    renderAt('/statisticians?status=inactive');
    expect(screen.queryByRole('button', { name: /^Deactivate/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reactivate Ada Eze' }));
    expect(h.update.mutate).toHaveBeenCalledWith({ id: 'ada', data: { status: 'ACTIVE' } }, expect.any(Object));
  });
});

describe('Statisticians: form', () => {
  it('starts a new account with a generated password', () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add statistician' }));
    const pw = screen.getByLabelText(/^Password/) as HTMLInputElement;
    expect(pw.value).toHaveLength(12);
  });

  it('will not submit an empty create, and focuses the first problem', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add statistician' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add statistician' }));
    expect(await within(dialog).findByText('Enter a first name.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter an email address.')).toBeInTheDocument();
    expect(h.create.mutate).not.toHaveBeenCalled();
    await waitFor(() => expect(within(dialog).getByLabelText(/First name/)).toHaveFocus());
  });

  it('creates with the joined name', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Add statistician' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/First name/), { target: { value: 'Ngozi' } });
    fireEvent.change(within(dialog).getByLabelText(/Last name/), { target: { value: 'Ade' } });
    fireEvent.change(within(dialog).getByLabelText(/^Email/), { target: { value: 'ngozi@example.com' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add statistician' }));
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
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/^Email/)).toHaveAttribute('readonly');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(h.update.mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada Eze' }));
    const again = screen.getByRole('dialog');
    fireEvent.change(within(again).getByLabelText(/Phone/), { target: { value: '0899' } });
    fireEvent.click(within(again).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(h.update.mutate).toHaveBeenCalledWith({ id: 'ada', data: { phone: '0899' } }, expect.any(Object)));
  });

  it('refuses to clear a stored phone number, and says why', async () => {
    renderAt();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Ada Eze' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Phone/), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByText(/can’t be cleared yet/)).toBeInTheDocument();
    expect(h.update.mutate).not.toHaveBeenCalled();
  });
});

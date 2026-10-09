import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Spinner from '../../components/ui/Spinner';
import { PageHeader, ListSkeleton, EmptyState, ErrorState, NoResultsState } from '../../components/admin/page-states';
import { Button } from '../../components/ui/primitives/button';
import { Badge } from '../../components/ui/primitives/badge';
import { cn } from '../../lib/utils';
import RevealedApiKey from '../../components/clients/RevealedApiKey';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import {
  useAdmins,
  useAssignClientUser,
  useClientApiKeys,
  useClients,
  useCreateClient,
  useCreateClientApiKey,
  useRevokeClientApiKey,
} from '../../api/hooks';
import type { Client } from '../../types/api';
import { EMPTY_CLIENT_FORM, clientFormSchema, toClientCreate, type ClientFormValues } from './clientForm';

const fieldClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white';

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

/** Clients and their API keys. SUPER_ADMIN only (the backend's list/create/assign routes are). */
const Clients: React.FC = () => {
  const clientsQuery = useClients();
  const createClient = useCreateClient();
  const toast = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const clients = useMemo(() => clientsQuery.data ?? [], [clientsQuery.data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.websiteUrl ?? '').toLowerCase().includes(q));
  }, [clients, search]);
  const selected = clients.find((c) => c.id === selectedId) ?? null;

  const hasSearch = search.trim().length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description="Organisations that get access to their matches through the external API."
        actions={<Button onClick={() => setIsCreating(true)}>New client</Button>}
      />

      <input
        type="search"
        placeholder="Search by name or website"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`${fieldClass} md:max-w-sm`}
        aria-label="Search clients"
      />

      {clientsQuery.isPending && <ListSkeleton columns={4} rows={4} label="Loading clients" />}
      {clientsQuery.isError && <ErrorState message={(clientsQuery.error as Error).message} onRetry={() => void clientsQuery.refetch()} />}
      {!clientsQuery.isPending && !clientsQuery.isError && clients.length === 0 && (
        <EmptyState
          title="No clients yet"
          description="A client is an organisation that reads its matches through the API. Creating one also creates its first user."
          action={{ label: 'New client', onClick: () => setIsCreating(true) }}
        />
      )}
      {!clientsQuery.isPending && !clientsQuery.isError && clients.length > 0 && filtered.length === 0 && hasSearch && (
        <NoResultsState query={search.trim()} onClear={() => setSearch('')} />
      )}

      {!clientsQuery.isPending && !clientsQuery.isError && filtered.length > 0 && (
        <div className="relative overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Website</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className={cn(
                    'border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800',
                    selectedId === c.id && 'bg-court-50 dark:bg-gray-800',
                  )}
                >
                  <td className="px-4 py-3">
                    {/* A real button, so the row can be opened from the keyboard, not only by clicking. */}
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      aria-expanded={selectedId === c.id}
                      className="cursor-pointer rounded font-medium text-gray-900 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-court-400/50 dark:text-white"
                    >
                      {c.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.websiteUrl || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.isActive ? 'success' : 'neutral'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ClientDetail
          key={selected.id}
          client={selected}
          onClose={() => setSelectedId(null)}
          confirm={confirm}
          toastError={(m) => toast.error(m)}
          toastSuccess={(m) => toast.success(m)}
        />
      )}

      <NewClientModal
        open={isCreating}
        onClose={() => setIsCreating(false)}
        isSaving={createClient.isPending}
        onSubmit={(values) =>
          createClient.mutate(toClientCreate(values), {
            onSuccess: (created) => {
              setIsCreating(false);
              // The backend answers 201 whether or not the email went out (Gap 49), so don't say it did.
              toast.success(`${created.name} created. The server was asked to email a temporary password to ${values.userEmail.trim()}. If it doesn’t arrive, ask whoever runs the server; there is no resend yet.`);
            },
            onError: (err) => toast.error(err.message),
          })
        }
      />

      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

const NewClientModal: React.FC<{
  open: boolean;
  onClose: () => void;
  isSaving: boolean;
  onSubmit: (values: ClientFormValues) => void;
}> = ({ open, onClose, isSaving, onSubmit }) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientFormValues>({ defaultValues: EMPTY_CLIENT_FORM, resolver: zodResolver(clientFormSchema) });

  // A fresh form every time the dialog opens.
  useEffect(() => {
    if (open) reset(EMPTY_CLIENT_FORM);
  }, [open, reset]);

  const submit = handleSubmit((values) => onSubmit(values));

  return (
    <Modal open={open} onClose={onClose} title="New client" size="md">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="text-xs text-gray-500">
          The primary user is a client account. The server emails them a temporary password and they change it when they first sign in. Delivery isn’t confirmed to you, so check that it arrived (see Gap 49).
        </p>
        <Field label="Client name" error={errors.name?.message}>
          <input className={fieldClass} {...register('name')} autoFocus />
        </Field>
        <Field label="Website (optional)" error={errors.websiteUrl?.message}>
          <input className={fieldClass} {...register('websiteUrl')} placeholder="https://" />
        </Field>
        <Field label="Logo URL (optional)" error={errors.logo?.message}>
          <input className={fieldClass} {...register('logo')} placeholder="https://" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Primary user first name" error={errors.userFirstName?.message}>
            <input className={fieldClass} {...register('userFirstName')} />
          </Field>
          <Field label="Primary user last name" error={errors.userLastName?.message}>
            <input className={fieldClass} {...register('userLastName')} />
          </Field>
        </div>
        <Field label="Primary user email" error={errors.userEmail?.message}>
          <input type="email" className={fieldClass} {...register('userEmail')} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Spinner />}
            {isSaving ? 'Creating…' : 'Create client'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const ClientDetail: React.FC<{
  client: Client;
  onClose: () => void;
  confirm: (o: { title?: string; description: React.ReactNode; confirmLabel?: string; tone?: 'danger' | 'default' }) => Promise<boolean>;
  toastError: (m: string) => void;
  toastSuccess: (m: string) => void;
}> = ({ client, onClose, confirm, toastError, toastSuccess }) => {
  const keysQuery = useClientApiKeys(client.id);
  const createKey = useCreateClientApiKey();
  const revokeKey = useRevokeClientApiKey();
  const assignUser = useAssignClientUser();
  const adminsQuery = useAdmins();
  const [keyName, setKeyName] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [revealedKey, setRevealedKey] = useState<{ name: string; apiKey: string } | null>(null);

  const createKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = keyName.trim();
    if (!name) return;
    createKey.mutate(
      { clientId: client.id, name },
      {
        onSuccess: (created) => {
          setKeyName('');
          setRevealedKey({ name: created.name, apiKey: created.apiKey });
        },
        onError: (err) => toastError(err.message),
      },
    );
  };

  const revoke = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Revoke API key?',
      description: `“${name}” will stop working immediately. Any system using it will start getting 401 errors.`,
      confirmLabel: 'Revoke key',
      tone: 'danger',
    });
    if (!ok) return;
    revokeKey.mutate({ id, clientId: client.id }, { onError: (err) => toastError(err.message) });
  };

  const assign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserId) return;
    assignUser.mutate(
      { clientId: client.id, userId: assignUserId },
      {
        onSuccess: () => {
          setAssignUserId('');
          toastSuccess('User can now see this client’s data.');
        },
        onError: (err) => toastError(err.message),
      },
    );
  };

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{client.name}</h2>
          <p className="text-sm text-gray-500">{client.websiteUrl || 'No website'}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">API keys</h3>
        <p className="mb-3 text-xs text-gray-500">
          A key lets an external system read this client’s matches. Keys are shown once, when created.
        </p>
        <form onSubmit={createKeySubmit} className="mb-4 flex flex-wrap gap-2">
          <input
            className={`${fieldClass} sm:max-w-xs`}
            placeholder="Key name, e.g. Scoreboard app"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            aria-label="New API key name"
          />
          <Button type="submit" disabled={!keyName.trim() || createKey.isPending}>
            {createKey.isPending && <Spinner />}
            Create key
          </Button>
        </form>

        {keysQuery.isPending && <p className="text-sm text-gray-500">Loading keys…</p>}
        {keysQuery.isError && <p className="text-sm text-rose-600">{(keysQuery.error as Error).message}</p>}
        {keysQuery.data && keysQuery.data.length === 0 && <p className="text-sm text-gray-500">No keys yet.</p>}
        {keysQuery.data && keysQuery.data.length > 0 && (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {keysQuery.data.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{k.name}</p>
                  <p className="text-xs text-gray-500">
                    Created {formatDate(k.createdAt)} · Last used {k.lastUsed ? formatDate(k.lastUsed) : 'never'}
                  </p>
                </div>
                <Button type="button" variant="destructive-ghost" size="sm" aria-label={`Revoke ${k.name}`} onClick={() => void revoke(k.id, k.name)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Give a user access</h3>
        <form onSubmit={assign} className="flex flex-wrap gap-2">
          <select
            className={`${fieldClass} sm:max-w-xs`}
            value={assignUserId}
            onChange={(e) => setAssignUserId(e.target.value)}
            aria-label="User to give access"
            disabled={adminsQuery.isPending}
          >
            <option value="">Choose a user…</option>
            {(adminsQuery.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ? `${a.name} (${a.email})` : a.email}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" disabled={!assignUserId || assignUser.isPending}>
            {assignUser.isPending && <Spinner />}
            Give access
          </Button>
        </form>
      </div>

      <Modal
        open={revealedKey !== null}
        onClose={() => setRevealedKey(null)}
        title="Copy your new API key"
        size="md"
        closeOnBackdropClick={false}
        closeOnEscape={false}
      >
        {revealedKey && <RevealedApiKey name={revealedKey.name} apiKey={revealedKey.apiKey} onDone={() => setRevealedKey(null)} />}
      </Modal>
    </section>
  );
};

const Field: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({ label, error, children }) => (
  <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
    {label}
    {children}
    {error && <span className="text-xs font-normal text-rose-600">{error}</span>}
  </label>
);

export default Clients;

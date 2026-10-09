import React, { useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { useCreateMyApiKey, useMyApiKeys, useRevokeMyApiKey } from '../../api/hooks';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useToast } from '../../hooks/useToast';
import type { ClientApiKey } from '../../types/api';
import { PageHeader, ListSkeleton, EmptyState, ErrorState } from '../../components/admin/page-states';
import { Button } from '../../components/ui/primitives/button';
import { Card, CardDescription, CardTitle } from '../../components/ui/primitives/card';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Modal from '../../components/ui/Modal';
import RevealedApiKey from '../../components/clients/RevealedApiKey';
import Spinner from '../../components/ui/Spinner';

const dateLabel = (iso?: string | null) => {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

/**
 * The client's own API keys. A key lets your website or app read your match data. The secret is shown
 * once, when created; revoking a key stops it working immediately.
 */
const PortalKeys: React.FC = () => {
  const keysQuery = useMyApiKeys();
  const createKey = useCreateMyApiKey();
  const revokeKey = useRevokeMyApiKey();
  const toast = useToast();
  const { confirm, dialogProps } = useConfirmDialog();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [revealed, setRevealed] = useState<{ name: string; apiKey: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const keys = keysQuery.data ?? [];

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give the key a name, such as “Club website”.');
      return;
    }
    setNameError(undefined);
    createKey.mutate(trimmed, {
      onSuccess: (created) => {
        setName('');
        setCreateOpen(false);
        setRevealed({ name: created.name, apiKey: created.apiKey });
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const revoke = async (key: ClientApiKey) => {
    const ok = await confirm({
      title: 'Revoke this key?',
      description: (
        <>
          <strong>{key.name}</strong> will stop working immediately. Anything that uses it will start getting errors.
        </>
      ),
      confirmLabel: 'Revoke key',
      tone: 'danger',
    });
    if (!ok) return;
    revokeKey.mutate(key.id, {
      onSuccess: () => toast.success(`${key.name} revoked.`),
      onError: (err) => toast.error(err.message),
    });
  };

  const columns = useMemo<ColumnDef<ClientApiKey>[]>(
    () => [
      { id: 'name', header: 'Name', cell: ({ row }) => <span className="font-medium text-gray-900 dark:text-white">{row.original.name}</span> },
      { id: 'created', header: 'Created', cell: ({ row }) => <span className="text-gray-600 dark:text-gray-400">{dateLabel(row.original.createdAt)}</span> },
      { id: 'lastUsed', header: 'Last used', cell: ({ row }) => <span className="text-gray-600 dark:text-gray-400">{dateLabel(row.original.lastUsed)}</span> },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <Button variant="destructive-ghost" size="sm" onClick={() => void revoke(row.original)} aria-label={`Revoke ${row.original.name}`}>
              Revoke
            </Button>
          </div>
        ),
      },
    ],
    // revoke closes over stable hook functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const table = useReactTable({ data: keys, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="API keys"
        description="Keys let your website or app read your match data. Keep them secret; the key is shown only once."
        actions={<Button onClick={() => setCreateOpen(true)}>New key</Button>}
      />

      {keysQuery.isPending && <ListSkeleton columns={4} rows={3} label="Loading keys" />}
      {keysQuery.isError && <ErrorState message={(keysQuery.error as Error).message} onRetry={() => void keysQuery.refetch()} />}

      {!keysQuery.isPending && !keysQuery.isError && keys.length === 0 && (
        <EmptyState
          title="No keys yet"
          description="Create a key to connect your website or app to your match data."
          action={{ label: 'New key', onClick: () => setCreateOpen(true) }}
        />
      )}

      {!keysQuery.isPending && !keysQuery.isError && keys.length > 0 && (
        <div className="relative overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Your API keys</caption>
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-gray-200 dark:border-gray-800">
                  {hg.headers.map((h) => (
                    <th key={h.id} scope="col" className="px-4 py-3 font-semibold">{flexRender(h.column.columnDef.header, h.getContext())}</th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Card>
        <CardTitle>Using a key</CardTitle>
        <CardDescription>
          Send the key in an <code className="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">x-api-key</code> header
          when you call the client API. Match data for your organisation is all a key can read.
        </CardDescription>
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New API key" size="sm">
        <form onSubmit={submitCreate} className="flex flex-col gap-4" noValidate>
          <div>
            <label htmlFor="key-name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Club website"
              autoFocus
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-court-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            {nameError && <p className="mt-1 text-xs text-rose-600">{nameError}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} type="button">Cancel</Button>
            <Button type="submit" disabled={createKey.isPending}>
              {createKey.isPending && <Spinner />}
              {createKey.isPending ? 'Creating…' : 'Create key'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={revealed !== null}
        onClose={() => setRevealed(null)}
        title="Copy your new API key"
        size="md"
        closeOnBackdropClick={false}
        closeOnEscape={false}
      >
        {revealed && <RevealedApiKey name={revealed.name} apiKey={revealed.apiKey} onDone={() => setRevealed(null)} />}
      </Modal>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
};

export default PortalKeys;

import * as React from 'react';
import { Button } from '../ui/primitives/button';
import { Empty } from '../ui/primitives/empty';
import Skeleton from '../ui/Skeleton';
import { cn } from '../../lib/utils';

/** Page title row used at the top of every admin module. Actions sit on the right and wrap on small screens. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Placeholder rows shaped like a table, so the page doesn't jump when data arrives.
 * `columns` should match the real table's column count.
 */
export function ListSkeleton({ rows = 6, columns = 4, label = 'Loading' }: { rows?: number; columns?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="grid gap-4 border-b border-gray-200 px-4 py-3 dark:border-gray-800" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-4 border-b border-gray-100 px-4 py-4 last:border-0 dark:border-gray-800"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-40' : 'w-24')} />
          ))}
        </div>
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** Nothing exists yet. Always offer the primary action that creates the first record. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <Empty>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      {description && <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      {action && (
        <Button className="mt-1" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </Empty>
  );
}

/** The request failed. Say why in plain words, and offer a retry. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Empty role="alert" className="border-rose-200 dark:border-rose-500/30">
      <h2 className="text-base font-semibold text-rose-700 dark:text-rose-300">Couldn’t load this</h2>
      <p className="max-w-sm text-sm text-gray-600 dark:text-gray-400">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-1" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Empty>
  );
}

/** Records exist, but the current search or filter matches none of them. Distinct from EmptyState. */
export function NoResultsState({ query, onClear }: { query?: string; onClear: () => void }) {
  return (
    <Empty>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">No matches</h2>
      <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
        {query ? `Nothing matches “${query}”.` : 'Nothing matches the current filters.'}
      </p>
      <Button variant="secondary" className="mt-1" onClick={onClear}>
        Clear filters
      </Button>
    </Empty>
  );
}

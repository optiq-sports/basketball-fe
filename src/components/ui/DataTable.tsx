import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table';
import { LuArrowUp, LuArrowDown, LuArrowUpDown, LuTriangleAlert, LuRotateCw } from 'react-icons/lu';
import Pagination from './Pagination';
import Skeleton from './Skeleton';

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  /** Default rows per page (also the first entry in the picker unless pageSizeOptions overrides it). */
  pageSize?: number;
  pageSizeOptions?: number[];
  isLoading?: boolean;
  /** Non-null shows a graceful error row with a retry button instead of the table body. */
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  /** Accessible name for the table, for screen readers and for finding it in tests. */
  label?: string;
  /**
   * Server-driven sorting. Passing `sorting` hands the order over to the caller: a header click
   * reports through `onSortingChange` and the table leaves the rows exactly as given, because the
   * server already sorted the page it sent. Without it the table sorts its own rows as before.
   */
  sorting?: SortingState;
  onSortingChange?: (next: SortingState) => void;
  /**
   * Server-driven pagination. Passing `pageIndex` says `data` is already one page: the footer counts
   * from `pageCount`/`totalItems` and a page change reports through `onPageChange` rather than
   * slicing rows here. The rows-per-page picker is hidden, since the page size is the caller's.
   */
  pageIndex?: number;
  pageCount?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
}

function DataTable<T>({
  columns,
  data,
  onRowClick,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  isLoading = false,
  error = null,
  onRetry,
  emptyMessage = 'No results found.',
  label,
  sorting,
  onSortingChange,
  pageIndex,
  pageCount,
  totalItems,
  onPageChange,
}: DataTableProps<T>) {
  const manualSorting = sorting !== undefined;
  const manualPagination = pageIndex !== undefined;

  const [localSorting, setLocalSorting] = useState<SortingState>([]);
  const [localPagination, setLocalPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });

  const sortingState = sorting ?? localSorting;
  const paginationState: PaginationState = manualPagination
    ? { pageIndex, pageSize }
    : localPagination;

  const table = useReactTable({
    data,
    columns,
    state: { sorting: sortingState, pagination: paginationState },
    manualSorting,
    manualPagination,
    // A server sort is always on one column or another, so a third click can't turn it off.
    enableSortingRemoval: !manualSorting,
    ...(manualPagination ? { pageCount: pageCount ?? 1 } : {}),
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sortingState) : updater;
      if (manualSorting) onSortingChange?.(next);
      else setLocalSorting(next);
    },
    onPaginationChange: manualPagination ? undefined : setLocalPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const currentPageSize = table.getState().pagination.pageSize;
  const shownPage = (manualPagination ? pageIndex : table.getState().pagination.pageIndex) + 1;
  const shownPageCount = manualPagination ? (pageCount ?? 1) : table.getPageCount();
  const shownTotal = manualPagination ? (totalItems ?? data.length) : data.length;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="relative overflow-x-auto">
        <table aria-label={label} className="w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-white/[0.02]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  const arrow =
                    sortDir === 'asc' ? (
                      <LuArrowUp aria-hidden className="size-3.5" />
                    ) : sortDir === 'desc' ? (
                      <LuArrowDown aria-hidden className="size-3.5" />
                    ) : (
                      <LuArrowUpDown aria-hidden className="size-3.5 opacity-40" />
                    );
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={canSort ? (sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : 'none') : undefined}
                      className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        // A button, not a clickable `th`, so the sort can be reached by keyboard.
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex cursor-pointer select-none items-center gap-1.5 rounded uppercase tracking-wide outline-none hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:text-gray-200"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {arrow}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading ? (
              Array.from({ length: currentPageSize }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {columns.map((_col, ci) => (
                    <td key={ci} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-[10rem] rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center gap-2 text-sm text-error-600 dark:text-error-500">
                    <LuTriangleAlert className="size-6" />
                    <span>{error}</span>
                    {onRetry && (
                      <button
                        type="button"
                        onClick={onRetry}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                      >
                        <LuRotateCw className="size-3.5" />
                        Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={
                    onRowClick
                      ? 'cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                      : ''
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!isLoading && !error && rows.length > 0 && (
        <Pagination
          currentPage={shownPage}
          totalPages={shownPageCount}
          onPageChange={(page) => (manualPagination ? onPageChange?.(page) : table.setPageIndex(page - 1))}
          totalItems={shownTotal}
          pageSize={currentPageSize}
          onPageSizeChange={manualPagination ? undefined : (size) => table.setPageSize(size)}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  );
}

export default DataTable;

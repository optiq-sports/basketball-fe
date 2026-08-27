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
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const pageIndex = table.getState().pagination.pageIndex;
  const currentPageSize = table.getState().pagination.pageSize;
  const pageCount = table.getPageCount();

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead className="bg-gray-50 dark:bg-white/[0.02]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 ${
                        canSort ? 'cursor-pointer select-none' : ''
                      }`}
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center gap-1.5">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort &&
                            (sortDir === 'asc' ? (
                              <LuArrowUp className="size-3.5" />
                            ) : sortDir === 'desc' ? (
                              <LuArrowDown className="size-3.5" />
                            ) : (
                              <LuArrowUpDown className="size-3.5 opacity-40" />
                            ))}
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
          currentPage={pageIndex + 1}
          totalPages={pageCount}
          onPageChange={(page) => table.setPageIndex(page - 1)}
          totalItems={data.length}
          pageSize={currentPageSize}
          onPageSizeChange={(size) => table.setPageSize(size)}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  );
}

export default DataTable;

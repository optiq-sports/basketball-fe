import React from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

/** Windowed page-number list: current page ± 2, always including first/last. */
function getPageWindow(current: number, total: number): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = [];
  const start = Math.max(1, current - 2);
  const end = Math.min(total, current + 2);

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('ellipsis');
  }
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total) {
    if (end < total - 1) pages.push('ellipsis');
    pages.push(total);
  }
  return pages;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}) => {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const pages = getPageWindow(currentPage, totalPages);

  const buttonBase =
    'flex items-center justify-center h-9 min-w-9 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const inactive =
    'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5';
  const active = 'border-brand-500 bg-brand-500 text-white';

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-4 py-4 dark:border-gray-800 sm:flex-row">
      <div className="flex items-center gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing <span className="font-medium text-gray-700 dark:text-gray-300">{startItem}</span>–
          <span className="font-medium text-gray-700 dark:text-gray-300">{endItem}</span> of{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">{totalItems}</span>
        </p>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <span className="hidden sm:inline">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-gray-300 bg-white py-1 pl-2 pr-6 text-sm text-gray-700 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {totalPages > 1 && (
        <nav className="flex items-center gap-1.5" aria-label="Pagination">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`${buttonBase} ${inactive} px-3`}
          >
            <LuChevronLeft className="size-4" />
          </button>
          {pages.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} className="px-1 text-gray-400 dark:text-gray-500">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === currentPage ? 'page' : undefined}
                className={`${buttonBase} ${p === currentPage ? active : inactive}`}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`${buttonBase} ${inactive} px-3`}
          >
            <LuChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  );
};

export default Pagination;

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, PackageOpen } from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Shared form/button tokens — the single source of truth for the     */
/* "consistent inputs and distinct primary/secondary buttons" polish.  */
/* ------------------------------------------------------------------ */

export const INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:bg-gray-50';

export const LABEL_CLASS = 'mb-1.5 block text-sm font-medium text-gray-700';

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60';

export const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-60';

export const BTN_DANGER =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60';

export const PAGE_HEADER =
  'mb-6 flex flex-wrap items-center justify-between gap-4';

/* ------------------------------------------------------------------ */
/* Loading + empty states                                              */
/* ------------------------------------------------------------------ */

export function Spinner({ className = 'h-5 w-5', label }) {
  return (
    <span className="inline-flex items-center gap-2 text-gray-400">
      <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}

export function LoadingBlock({ label = 'Loading…', className = '' }) {
  return (
    <div
      className={`flex min-h-40 items-center justify-center rounded-2xl border border-gray-200 bg-white text-sm text-gray-400 shadow-sm ${className}`}
    >
      <Spinner label={label} className="h-5 w-5" />
    </div>
  );
}

export function EmptyState({ icon: Icon = PackageOpen, title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
        <Icon className="h-7 w-7 text-gray-400" />
      </div>
      <p className="text-sm font-semibold text-gray-700">{title || 'Nothing here yet'}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-gray-400">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

const PAGE_SIZES = [5, 10, 25, 50];

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange }) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const step = (delta) => onPageChange?.(Math.min(lastPage, Math.max(1, page + delta)));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/60 px-5 py-3">
      <p className="text-xs text-gray-500">
        Showing <span className="font-medium text-gray-700">{from}–{to}</span> of{' '}
        <span className="font-medium text-gray-700">{total}</span>
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-gray-500">
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={page <= 1}
            className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-16 px-2 text-center text-xs font-medium text-gray-600">
            Page {page} of {lastPage}
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={page >= lastPage}
            className="rounded-lg border border-gray-300 bg-white p-1.5 text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DataTable — consistent card shell, skeleton loading, empty state    */
/* and pagination for every list screen.                               */
/* ------------------------------------------------------------------ */

function SkeletonRow({ columns }) {
  return (
    <tr className="border-b border-gray-100">
      {columns.map((col, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="h-3.5 animate-pulse rounded bg-gray-100" style={{ width: `${78 - (i % 3) * 14}%` }} />
        </td>
      ))}
    </tr>
  );
}

/**
 * @param {Array<{label: string, className?: string}>} columns  header cells
 * @param {Array<object>} rows                the full dataset (pagination is internal)
 * @param {(row) => ReactNode} renderRow      must return a complete <tr>
 * @param {boolean} loading
 * @param {{icon?, title, hint, action?}|ReactNode} empty
 * @param {boolean} paginate                  default true
 */
export function DataTable({
  columns,
  rows,
  renderRow,
  rowKey = (row) => row.id,
  loading = false,
  empty,
  paginate = true,
  defaultPageSize = 10,
  toolbar,
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const total = rows?.length ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  // Keep the cursor valid when filters shrink (or grow) the dataset.
  useEffect(() => {
    if (page > lastPage) setPage(lastPage);
  }, [page, lastPage]);

  const pageRows = useMemo(() => {
    if (!paginate) return rows || [];
    const start = (page - 1) * pageSize;
    return (rows || []).slice(start, start + pageSize);
  }, [rows, page, pageSize, paginate]);

  const skeletonRows = Math.min(5, Math.max(1, pageSize));

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {toolbar && <div className="border-b border-gray-200">{toolbar}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/60 text-xs uppercase tracking-wide text-gray-400">
              {columns.map((col, i) => (
                <th key={i} className={`whitespace-nowrap px-4 py-3 font-medium ${col.className || ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <SkeletonRow key={i} columns={columns} />
              ))
            ) : total === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  {empty && typeof empty === 'object' && !Array.isArray(empty) && empty !== null
                    ? <EmptyState {...empty} />
                    : empty || <EmptyState />}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => renderRow(row))
            )}
          </tbody>
        </table>
      </div>

      {paginate && total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}

/**
 * Single badge vocabulary for every lifecycle status in the system — both
 * order states and invoice states share one colour language, so a "Paid"
 * invoice and a "Paid" order read the same everywhere.
 *
 * Colour logic (all soft-tinted chips with a subtle ring for contrast on any
 * background):
 *   - amber  = waiting on someone   (pending review, invoice issued)
 *   - red    = problem / terminal no (cancelled, overdue)
 *   - emerald/green = money in / done (paid, delivered)
 *   - blues/violets = work underway (estimated, in progress, out for delivery)
 */

export const STATUS_LABELS = {
  PENDING_REVIEW: 'Pending review',
  ESTIMATED: 'Estimated',
  INVOICED: 'Invoiced',
  PAID: 'Paid',
  IN_PROGRESS: 'In progress',
  READY_FOR_DELIVERY: 'Ready for delivery',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export const STATUS_STYLES = {
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  ESTIMATED: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  INVOICED: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  READY_FOR_DELIVERY: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20',
  OUT_FOR_DELIVERY: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  DELIVERED: 'bg-green-50 text-green-700 ring-green-600/20',
  CANCELLED: 'bg-red-50 text-red-600 ring-red-600/20',
  // Invoice-only states (no collision with order states above)
  DRAFT: 'bg-gray-100 text-gray-600 ring-gray-500/10',
  ISSUED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  OVERDUE: 'bg-red-50 text-red-600 ring-red-600/20',
};

// Order labels + invoice-only labels. PAID / CANCELLED already exist above.
const ALL_LABELS = {
  ...STATUS_LABELS,
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  OVERDUE: 'Overdue',
};

export default function StatusBadge({ status, dot = true }) {
  const style = STATUS_STYLES[status] || 'bg-gray-50 text-gray-600 ring-gray-500/10';
  const label = ALL_LABELS[status] || status;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {label}
    </span>
  );
}

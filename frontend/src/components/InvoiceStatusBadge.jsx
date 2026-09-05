import StatusBadge, { STATUS_STYLES } from './StatusBadge';

const INVOICE_STATUS_LABELS = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
};

/**
 * Metadata + badge for invoice lifecycle statuses. Rendering delegates to the
 * shared {@link StatusBadge} so invoice and order states share one vocabulary;
 * `INVOICE_STATUS_META` is kept for screens that build their own filter tabs.
 */
export const INVOICE_STATUS_META = Object.fromEntries(
  Object.entries(INVOICE_STATUS_LABELS).map(([status, label]) => [
    status,
    { label, badge: STATUS_STYLES[status] || 'bg-gray-100 text-gray-600' },
  ]),
);

export default function InvoiceStatusBadge({ status }) {
  return <StatusBadge status={status} />;
}

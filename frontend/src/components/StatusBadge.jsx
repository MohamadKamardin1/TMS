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

const STATUS_STYLES = {
  PENDING_REVIEW: 'bg-slate-100 text-slate-700',
  ESTIMATED: 'bg-sky-100 text-sky-700',
  INVOICED: 'bg-violet-100 text-violet-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  READY_FOR_DELIVERY: 'bg-orange-100 text-orange-700',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-teal-100 text-teal-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
        STATUS_STYLES[status] || 'bg-slate-100 text-slate-700'
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}
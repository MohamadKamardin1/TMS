import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Eye,
  Flag,
  Hammer,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  Ruler,
  Scissors,
  Shirt,
} from 'lucide-react';
import api, { mediaUrl } from '../../services/api';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import { formatDate, formatMoney } from '../../utils/format';
import { measurementLabel } from '../../utils/tailoring';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:bg-gray-50';

// ------------------------------------------------------------------ helpers

/** Orders grouped by the tailor's working view. */
const TAB_DEFS = [
  { id: 'pending', label: 'Pending review', hint: 'Awaiting your estimate' },
  { id: 'production', label: 'In production', hint: 'Estimated through delivery' },
  { id: 'completed', label: 'Completed', hint: 'Delivered or cancelled' },
];

const PRODUCTION_STATUSES = [
  'ESTIMATED',
  'INVOICED',
  'PAID',
  'IN_PROGRESS',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
];
const COMPLETED_STATUSES = ['DELIVERED', 'CANCELLED'];

const MILESTONES = [
  { label: 'Request', statuses: ['PENDING_REVIEW'] },
  { label: 'Estimate', statuses: ['ESTIMATED', 'INVOICED'] },
  { label: 'Paid', statuses: ['PAID'] },
  { label: 'Production', statuses: ['IN_PROGRESS', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'] },
  { label: 'Delivered', statuses: ['DELIVERED'] },
];

function milestoneIndex(status) {
  for (let i = 0; i < MILESTONES.length; i += 1) {
    if (MILESTONES[i].statuses.includes(status)) return i;
  }
  return null;
}

function LifecycleMilestones({ status }) {
  const reached = milestoneIndex(status);
  if (status === 'CANCELLED') {
    return (
      <p className="text-xs font-medium text-red-600">
        This order was cancelled and is closed.
      </p>
    );
  }
  if (reached == null) return null;

  return (
    <div className="flex items-center">
      {MILESTONES.map((milestone, index) => {
        const done = index <= reached;
        const isCurrent = index === reached;
        return (
          <div key={milestone.label} className="flex items-center">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                  done
                    ? 'border-gray-800 bg-gray-800 text-white'
                    : 'border-gray-300 bg-white text-gray-300'
                }`}
              >
                {done && !isCurrent ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span
                className={`mt-1 text-[10px] font-medium ${
                  isCurrent ? 'text-gray-800' : done ? 'text-gray-600' : 'text-gray-300'
                }`}
              >
                {milestone.label}
              </span>
            </div>
            {index < MILESTONES.length - 1 && (
              <span
                className={`mx-1 mb-4 h-0.5 w-4 rounded sm:w-6 ${
                  index < reached ? 'bg-gray-800' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function measurementEntries(measurements) {
  return Object.entries(measurements || {}).filter(
    ([key, value]) => key && value != null && String(value).trim() !== '',
  );
}

function SummaryChip({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="truncate text-sm font-medium text-gray-700">{value || '—'}</p>
      </div>
    </div>
  );
}

/** Full read of one request: overview, fit details, notes and images. */
function OrderRequestDetails({ order }) {
  const entries = measurementEntries(order.measurements);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryChip icon={Shirt} label="Garment" value={order.garmentType || '—'} />
        <SummaryChip icon={Scissors} label="Fabric" value={order.fabricType || '—'} />
        <SummaryChip
          icon={CalendarDays}
          label="Preferred delivery"
          value={order.preferredDeliveryDate ? formatDate(order.preferredDeliveryDate) : '—'}
        />
        <SummaryChip icon={Flag} label="Customer" value={order.customerName || '—'} />
      </div>

      {order.description && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Description
          </h4>
          <p className="whitespace-pre-line text-sm text-gray-700">{order.description}</p>
        </div>
      )}

      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
          <Ruler className="h-3.5 w-3.5" />
          Measurements
        </h4>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-400">
            No measurements on this request — check the customer&apos;s saved profile or ask for a
            fitting.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {entries.map(([key, value]) => (
              <div key={key} className="rounded-lg border border-gray-200 px-3 py-2">
                <p className="text-xs text-gray-400">{measurementLabel(key)}</p>
                <p className="text-sm font-semibold text-gray-800">
                  {value}
                  <span className="ml-1 text-xs font-normal text-gray-400">in</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {(order.styleDetails || order.specialInstructions) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {order.styleDetails && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Style details
              </h4>
              <p className="whitespace-pre-line text-sm text-gray-700">{order.styleDetails}</p>
            </div>
          )}
          {order.specialInstructions && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Special instructions
              </h4>
              <p className="whitespace-pre-line text-sm text-gray-700">
                {order.specialInstructions}
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
          <ImageIcon className="h-3.5 w-3.5" />
          Reference images
        </h4>
        {!order.attachments || order.attachments.length === 0 ? (
          <p className="text-sm text-gray-400">No reference images were attached.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {order.attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={mediaUrl(attachment.fileUrl)}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden rounded-xl border border-gray-200"
              >
                <img
                  src={mediaUrl(attachment.fileUrl)}
                  alt={attachment.fileName}
                  className="h-28 w-full object-cover transition group-hover:scale-105"
                />
                <p className="truncate bg-gray-50 px-2 py-1 text-[11px] text-gray-500">
                  {attachment.fileName}
                </p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The action that moves an order forward in the tailor's workflow. */
function statusActionLabel(order) {
  switch (order.status) {
    case 'PENDING_REVIEW':
      return 'Awaiting your estimate';
    case 'ESTIMATED':
    case 'INVOICED':
      return 'Awaiting customer payment';
    case 'PAID':
      return 'Ready — start production';
    case 'IN_PROGRESS':
      return 'In the workshop — mark ready when done';
    case 'READY_FOR_DELIVERY':
      return 'Ready — awaiting dispatch';
    case 'OUT_FOR_DELIVERY':
      return 'Out for delivery';
    case 'DELIVERED':
      return 'Delivered';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return '';
  }
}

// ------------------------------------------------------------------- screen

export default function TailorDashboard() {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  const [estimatingOrder, setEstimatingOrder] = useState(null);
  const [estimateForm, setEstimateForm] = useState({ estimatedPrice: '', estimatedCompletionDate: '', termsAndPolicy: '' });
  const [submitting, setSubmitting] = useState(false);

  const [viewingOrder, setViewingOrder] = useState(null);
  const [actingId, setActingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders');
      setOrders(data.data || []);
    } catch {
      toast.error('Failed to load assigned orders.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(
    () => ({
      pending: orders.filter((order) => order.status === 'PENDING_REVIEW'),
      production: orders.filter((order) => PRODUCTION_STATUSES.includes(order.status)),
      completed: orders.filter((order) => COMPLETED_STATUSES.includes(order.status)),
    }),
    [orders],
  );

  const counts = useMemo(
    () => ({
      pending: grouped.pending.length,
      production: grouped.production.length,
      completed: grouped.completed.length,
    }),
    [grouped],
  );

  const activeOrders = grouped[activeTab] || [];

  const openEstimate = (order) => {
    setEstimatingOrder(order);
    setEstimateForm({
      estimatedPrice: order.estimatedPrice ?? '',
      estimatedCompletionDate: order.estimatedCompletionDate ?? order.preferredDeliveryDate ?? '',
      termsAndPolicy: order.termsAndPolicy ?? '',
    });
  };

  const submitEstimation = async (event) => {
    event.preventDefault();
    if (!estimatingOrder) return;
    setSubmitting(true);
    try {
      await api.post(`/orders/${estimatingOrder.id}/estimation`, {
        estimatedPrice: Number(estimateForm.estimatedPrice),
        estimatedCompletionDate: estimateForm.estimatedCompletionDate,
        termsAndPolicy: estimateForm.termsAndPolicy?.trim() || null,
      });
      toast.success(`Estimation submitted for order #${estimatingOrder.id}.`);
      setEstimatingOrder(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit the estimation.');
    } finally {
      setSubmitting(false);
    }
  };

  const act = async (order, action) => {
    setActingId(order.id);
    try {
      const messages = {
        'start-production': `Production started for order #${order.id}.`,
        'ready-for-delivery': `Order #${order.id} marked ready for delivery.`,
      };
      await api.post(`/orders/${order.id}/${action}`);
      toast.success(messages[action]);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed.');
    } finally {
      setActingId(null);
    }
  };

  const isOverridingPreferredDate =
    estimatingOrder?.preferredDeliveryDate &&
    estimateForm.estimatedCompletionDate &&
    estimateForm.estimatedCompletionDate !== estimatingOrder.preferredDeliveryDate;

  const renderAction = (order) => {
    if (order.status === 'PENDING_REVIEW') {
      return (
        <button
          type="button"
          onClick={() => openEstimate(order)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
        >
          <Flag className="h-4 w-4" />
          Submit estimation
        </button>
      );
    }
    if (order.status === 'PAID') {
      return (
        <button
          type="button"
          disabled={actingId === order.id}
          onClick={() => act(order, 'start-production')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
        >
          {actingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
          Start production
        </button>
      );
    }
    if (order.status === 'IN_PROGRESS') {
      return (
        <button
          type="button"
          disabled={actingId === order.id}
          onClick={() => act(order, 'ready-for-delivery')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
        >
          {actingId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
          Mark ready
        </button>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tailor workbench</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review new requests, set your estimate, then follow each order through production.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {TAB_DEFS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'border-gray-800 bg-gray-800 text-white shadow'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {counts[tab.id]}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white py-24 text-sm text-gray-400 shadow-sm">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading orders...
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-20 text-center shadow-sm">
          <PackageCheck className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">Nothing here</p>
          <p className="mt-1 text-sm text-gray-400">
            {activeTab === 'pending'
              ? 'New requests assigned to you will appear here.'
              : activeTab === 'production'
                ? 'Orders you are working on will appear here.'
                : 'Delivered and cancelled orders will appear here.'}
          </p>
        </div>
      ) : (
        <>
          {activeTab === 'pending' ? (
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">Order #{order.id}</p>
                      <h3 className="truncate text-lg font-semibold text-gray-800">
                        {order.title || order.garmentType || 'Tailoring request'}
                      </h3>
                      <p className="text-sm text-gray-500">{statusActionLabel(order)}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </header>

                  <div className="px-5 py-4">
                    <OrderRequestDetails order={order} />
                  </div>

                  <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-5 py-3">
                    <LifecycleMilestones status={order.status} />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingOrder(order)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                      >
                        <Eye className="h-4 w-4" />
                        Details
                      </button>
                      {renderAction(order)}
                    </div>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                      <th className="px-4 py-3 font-medium">Order</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Est. delivery</th>
                      <th className="px-4 py-3 font-medium">Est. price</th>
                      <th className="px-4 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeOrders.map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800">
                            #{order.id} — {order.title || order.garmentType || 'Tailoring request'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {order.customerName || 'Customer'} · {order.garmentType || '—'}
                            {order.fabricType ? ` · ${order.fabricType}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={order.status} />
                            <span className="text-[11px] text-gray-400">{statusActionLabel(order)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {order.estimatedCompletionDate
                            ? formatDate(order.estimatedCompletionDate)
                            : formatDate(order.preferredDeliveryDate)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{formatMoney(order.estimatedPrice)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setViewingOrder(order)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
                              aria-label="View order details"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden sm:inline">Details</span>
                            </button>
                            {renderAction(order)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Order details modal */}
      <Modal
        open={Boolean(viewingOrder)}
        title={`Order #${viewingOrder?.id || ''} — ${viewingOrder?.title || viewingOrder?.garmentType || ''}`}
        wide
        onClose={() => setViewingOrder(null)}
      >
        {viewingOrder && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge status={viewingOrder.status} />
              {viewingOrder.estimatedPrice != null && (
                <p className="text-sm text-gray-600">
                  Estimated at{' '}
                  <span className="font-semibold text-gray-800">
                    {formatMoney(viewingOrder.estimatedPrice)}
                  </span>
                </p>
              )}
            </div>
            <OrderRequestDetails order={viewingOrder} />
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Lifecycle
              </h4>
              <LifecycleMilestones status={viewingOrder.status} />
            </div>
            {viewingOrder.termsAndPolicy && (
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Terms shared with the customer
                </p>
                <p className="whitespace-pre-line">{viewingOrder.termsAndPolicy}</p>
              </div>
            )}
            {viewingOrder.status === 'PENDING_REVIEW' && (
              <button
                type="button"
                onClick={() => {
                  setViewingOrder(null);
                  openEstimate(viewingOrder);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                <Flag className="h-4 w-4" />
                Submit estimation
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Estimation modal */}
      <Modal
        open={Boolean(estimatingOrder)}
        title={`Submit estimation — Order #${estimatingOrder?.id || ''}`}
        wide
        onClose={() => setEstimatingOrder(null)}
      >
        {estimatingOrder && (
          <form onSubmit={submitEstimation} className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="font-medium text-gray-800">
                {estimatingOrder.title || estimatingOrder.garmentType || 'Tailoring request'}
              </p>
              <p className="text-sm text-gray-500">
                {estimatingOrder.garmentType || 'Garment'}
                {estimatingOrder.fabricType ? ` · ${estimatingOrder.fabricType}` : ''}
                {' · '}Customer prefers{' '}
                <b>
                  {estimatingOrder.preferredDeliveryDate
                    ? formatDate(estimatingOrder.preferredDeliveryDate)
                    : 'no specific date'}
                </b>
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Estimated price (PKR) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={estimateForm.estimatedPrice}
                  onChange={(e) => setEstimateForm({ ...estimateForm, estimatedPrice: e.target.value })}
                  className={inputClass}
                  placeholder="5000"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Estimated completion date *
                </label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                  value={estimateForm.estimatedCompletionDate}
                  onChange={(e) =>
                    setEstimateForm({ ...estimateForm, estimatedCompletionDate: e.target.value })
                  }
                  className={inputClass}
                />
              </div>
            </div>

            {isOverridingPreferredDate && estimatingOrder.preferredDeliveryDate && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  This date differs from the customer&apos;s preferred delivery date of{' '}
                  <b>{formatDate(estimatingOrder.preferredDeliveryDate)}</b>. The customer will see
                  your proposed date with the estimate.
                </p>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Terms & policy
                <span className="ml-1 text-xs font-normal text-gray-400">(shared with the customer)</span>
              </label>
              <textarea
                rows={4}
                value={estimateForm.termsAndPolicy}
                onChange={(e) => setEstimateForm({ ...estimateForm, termsAndPolicy: e.target.value })}
                className={inputClass}
                placeholder="e.g. Half payment upfront to begin, balance on delivery. One free fitting included; additional fittings billed separately."
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Submitting…' : 'Submit estimation'}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}

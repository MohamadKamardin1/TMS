import { useCallback, useEffect, useState } from 'react';
import { Flag, Hammer, Loader2, PackageCheck } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { formatDate, formatMoney } from '../utils/format';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200';

const ACTIONABLE = ['PENDING_REVIEW', 'PAID', 'IN_PROGRESS'];

/**
 * Tailor workbench: orders assigned to the current tailor with the action
 * that moves them forward — estimate (PENDING_REVIEW), start production (PAID),
 * or mark ready for delivery (IN_PROGRESS).
 */
export default function TailorDashboard() {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [estimatingOrder, setEstimatingOrder] = useState(null);
  const [estimateForm, setEstimateForm] = useState({ estimatedPrice: '', estimatedCompletionDate: '', termsAndPolicy: '' });
  const [submitting, setSubmitting] = useState(false);
  const [actingOrder, setActingOrder] = useState(null);

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

  const openEstimate = (order) => {
    setEstimatingOrder(order);
    setEstimateForm({
      estimatedPrice: order.estimatedPrice ?? '',
      estimatedCompletionDate: order.estimatedCompletionDate ?? '',
      termsAndPolicy: order.termsAndPolicy ?? '',
    });
  };

  const submitEstimation = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/orders/${estimatingOrder.id}/estimation`, estimateForm);
      toast.success(`Estimation submitted for order #${estimatingOrder.id}.`);
      setEstimatingOrder(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit estimation.');
    } finally {
      setSubmitting(false);
    }
  };

  const act = async (order, action) => {
    setActingOrder(order.id);
    try {
      const messages = {
        'start-production': 'Production started.',
        'ready-for-delivery': 'Order marked ready for delivery.',
      };
      await api.post(`/orders/${order.id}/${action}`);
      toast.success(messages[action]);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed.');
    } finally {
      setActingOrder(null);
    }
  };

  const actionable = orders.filter((order) => ACTIONABLE.includes(order.status));
  const others = orders.filter((order) => !ACTIONABLE.includes(order.status));

  const actionFor = (order) => {
    if (order.status === 'PENDING_REVIEW') {
      return (
        <button
          type="button"
          onClick={() => openEstimate(order)}
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
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
          disabled={actingOrder === order.id}
          onClick={() => act(order, 'start-production')}
          className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
        >
          {actingOrder === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hammer className="h-4 w-4" />}
          Start production
        </button>
      );
    }
    if (order.status === 'IN_PROGRESS') {
      return (
        <button
          type="button"
          disabled={actingOrder === order.id}
          onClick={() => act(order, 'ready-for-delivery')}
          className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:opacity-60"
        >
          {actingOrder === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
          Mark ready
        </button>
      );
    }
    return null;
  };

  const rows = [...actionable, ...others];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Tailor workbench</h1>
        <p className="mt-1 text-sm text-slate-500">
          Estimate new orders, then move them from production to ready-for-delivery.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl bg-white py-24 text-sm text-slate-400 shadow-sm">
          Loading orders...
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-24 text-center shadow-sm">
          <PackageCheck className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No orders assigned yet</p>
          <p className="mt-1 text-sm text-slate-400">Orders assigned to you will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Required by</th>
                <th className="px-4 py-3 font-medium">Est. price</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">#{order.id} — {order.title}</p>
                    <p className="text-xs text-slate-400">Customer: {order.customerName || '—'}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(order.requiredCompletionDate)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatMoney(order.estimatedPrice)}</td>
                  <td className="px-4 py-3 text-right">{actionFor(order)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Estimation modal */}
      <Modal
        open={Boolean(estimatingOrder)}
        title={`Submit estimation — Order #${estimatingOrder?.id || ''}`}
        onClose={() => setEstimatingOrder(null)}
      >
        <form onSubmit={submitEstimation} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Price (PKR) *</label>
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Completion date *</label>
              <input
                type="date"
                required
                value={estimateForm.estimatedCompletionDate}
                onChange={(e) =>
                  setEstimateForm({ ...estimateForm, estimatedCompletionDate: e.target.value })
                }
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Terms & policy</label>
            <textarea
              rows={3}
              value={estimateForm.termsAndPolicy}
              onChange={(e) => setEstimateForm({ ...estimateForm, termsAndPolicy: e.target.value })}
              className={inputClass}
              placeholder="e.g. Half payment upfront, balance on delivery"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit estimation
          </button>
        </form>
      </Modal>
    </div>
  );
}
import { useCallback, useEffect, useState } from 'react';
import { Loader2, MapPin, Truck } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/Toast';
import StatusBadge from '../components/StatusBadge';
import { formatDate, formatMoney } from '../utils/format';

/**
 * Delivery agent view. Shows orders OUT_FOR_DELIVERY that were assigned to
 * this user (the backend already filters delivery agents to their own jobs)
 * with a one-click Confirm Delivery action.
 */
export default function DeliveryDashboard() {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders', { params: { status: 'OUT_FOR_DELIVERY' } });
      setOrders(data.data || []);
    } catch {
      toast.error('Failed to load deliveries.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelivery = async (order) => {
    setConfirmingId(order.id);
    try {
      await api.post(`/orders/${order.id}/confirm-delivery`);
      toast.success(`Order #${order.id} delivered.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not confirm delivery.');
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Delivery runs</h1>
        <p className="mt-1 text-sm text-slate-500">
          Orders currently out for delivery, assigned to you.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl bg-white py-24 text-sm text-slate-400 shadow-sm">
          Loading deliveries...
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-24 text-center shadow-sm">
          <Truck className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No active deliveries</p>
          <p className="mt-1 text-sm text-slate-400">
            Orders assigned to you will appear here once dispatched.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400">Order #{order.id}</p>
                  <h3 className="mt-0.5 font-semibold text-slate-800">{order.title}</h3>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">Customer</p>
                    <p className="truncate font-medium text-slate-700">
                      {order.customerName || '—'}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <p className="text-xs text-slate-400">Required by</p>
                    <p className="font-medium text-slate-700">{formatDate(order.requiredCompletionDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Amount</p>
                    <p className="font-medium text-slate-700">{formatMoney(order.estimatedPrice)}</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={confirmingId === order.id}
                onClick={() => confirmDelivery(order)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {confirmingId === order.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Truck className="h-4 w-4" />
                )}
                Confirm delivery
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
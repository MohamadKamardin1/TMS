import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleDollarSign, ClipboardList, Loader2, Truck, UserCog } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/Toast';
import StatusBadge from '../components/StatusBadge';
import { formatDate, formatMoney } from '../utils/format';

const PAID_STATES = ['PAID', 'IN_PROGRESS', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED'];

const selectClass =
  'w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50';

/**
 * Admin command center: live order statistics, plus assignment dropdowns to
 * route orders to tailors (PENDING_REVIEW) and delivery agents
 * (READY_FOR_DELIVERY).
 */
export default function AdminDashboard() {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [tailors, setTailors] = useState([]);
  const [deliveryAgents, setDeliveryAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, tailorsRes, deliveryRes] = await Promise.all([
        api.get('/orders'),
        api.get('/users', { params: { role: 'TAILOR' } }),
        api.get('/users', { params: { role: 'DELIVERY' } }),
      ]);
      setOrders(ordersRes.data.data || []);
      setTailors(tailorsRes.data.data || []);
      setDeliveryAgents(deliveryRes.data.data || []);
    } catch {
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length;
    const revenue = orders
      .filter((o) => PAID_STATES.includes(o.status))
      .reduce((sum, o) => sum + Number(o.estimatedPrice || 0), 0);
    return { total, pending, revenue };
  }, [orders]);

  const assign = async (order, kind, id) => {
    if (!id) return;
    setAssigning(`${order.id}-${kind}`);
    try {
      const payload = kind === 'tailor' ? { tailorId: id } : { deliveryUserId: id };
      await api.post(`/orders/${order.id}/${kind === 'tailor' ? 'assign-tailor' : 'assign-delivery'}`, payload);
      toast.success(kind === 'tailor'
        ? `Tailor assigned to order #${order.id}.`
        : `Delivery agent assigned to order #${order.id}.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Assignment failed.');
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Operations overview</h1>
        <p className="mt-1 text-sm text-slate-500">Assign work and keep an eye on the whole pipeline.</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total orders</p>
              <p className="text-2xl font-bold text-slate-800">{loading ? '…' : stats.total}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">In progress (pending)</p>
              <p className="text-2xl font-bold text-slate-800">{loading ? '…' : stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Revenue (paid orders)</p>
              <p className="text-2xl font-bold text-slate-800">
                {loading ? '…' : formatMoney(stats.revenue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Orders */}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Required by</th>
              <th className="px-4 py-3 font-medium">Assigned tailor</th>
              <th className="px-4 py-3 font-medium">Assigned delivery</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-sm text-slate-400">
                  Loading orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-sm text-slate-400">
                  No orders yet.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">#{order.id} — {order.title}</p>
                    <p className="text-xs text-slate-400">Customer: {order.customerName || '—'}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(order.requiredCompletionDate)}</td>

                  <td className="px-4 py-3">
                    {order.status === 'PENDING_REVIEW' ? (
                      <div className="flex items-center gap-2">
                        <select
                          className={selectClass}
                          disabled={tailors.length === 0 || assigning === `${order.id}-tailor`}
                          value=""
                          onChange={(e) => assign(order, 'tailor', Number(e.target.value))}
                        >
                          <option value="" disabled>
                            {tailors.length === 0 ? 'No tailors available' : 'Assign tailor…'}
                          </option>
                          {tailors.map((tailor) => (
                            <option key={tailor.id} value={tailor.id}>
                              {tailor.fullName || tailor.username}
                            </option>
                          ))}
                        </select>
                        {assigning === `${order.id}-tailor` && (
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-600">
                        {order.tailorName ||
                          (order.status === 'READY_FOR_DELIVERY' || order.status === 'OUT_FOR_DELIVERY'
                            ? <span className="text-slate-300">awaiting assignment</span>
                            : '—')}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {order.status === 'READY_FOR_DELIVERY' ? (
                      <div className="flex items-center gap-2">
                        <select
                          className={selectClass}
                          disabled={deliveryAgents.length === 0 || assigning === `${order.id}-delivery`}
                          value=""
                          onChange={(e) => assign(order, 'delivery', Number(e.target.value))}
                        >
                          <option value="" disabled>
                            {deliveryAgents.length === 0 ? 'No delivery agents' : 'Assign delivery…'}
                          </option>
                          {deliveryAgents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                              {agent.fullName || agent.username}
                            </option>
                          ))}
                        </select>
                        {assigning === `${order.id}-delivery` && (
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                        )}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1.5 text-slate-600">
                        {order.deliveryName ? (
                          <>
                            <Truck className="h-3.5 w-3.5 text-slate-400" />
                            {order.deliveryName}
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
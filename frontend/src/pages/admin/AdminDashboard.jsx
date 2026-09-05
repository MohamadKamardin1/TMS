import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CircleDollarSign,
  ClipboardList,
  Loader2,
  ReceiptText,
  RotateCcw,
  Search,
  Truck,
  UserCog,
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import StatusBadge, { STATUS_LABELS } from '../../components/StatusBadge';
import { formatDate, formatMoney } from '../../utils/format';

const TERMINAL_STATUSES = ['DELIVERED', 'CANCELLED'];
const PAYABLE_INVOICE_STATUSES = ['ISSUED', 'OVERDUE'];
const CLOSED_INVOICE_STATUSES = ['PAID', 'CANCELLED'];

const selectClass =
  'w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:opacity-50';
const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200';

/**
 * Admin command center. Aggregates the whole business on one screen: live
 * revenue / workload stats, then a filterable table of every order in the
 * system with the inline assignment controls the admin performs every day
 * (routing PENDING_REVIEW orders to tailors and READY_FOR_DELIVERY orders to a
 * delivery agent).
 */
export default function AdminDashboard() {
  const { toast } = useToast();

  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tailors, setTailors] = useState([]);
  const [deliveryAgents, setDeliveryAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);

  const [filters, setFilters] = useState({
    status: '',
    search: '',
    tailorId: '',
    from: '',
    to: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, invoicesRes, tailorsRes, deliveryRes] = await Promise.all([
        api.get('/orders'),
        api.get('/invoices'),
        api.get('/users', { params: { role: 'TAILOR' } }),
        api.get('/users', { params: { role: 'DELIVERY' } }),
      ]);
      setOrders(ordersRes.data.data || []);
      setInvoices(invoicesRes.data.data || []);
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
    const totalOrders = orders.length;
    const activeOrders = orders.filter((o) => !TERMINAL_STATUSES.includes(o.status)).length;
    const pendingInvoices = invoices.filter(
      (i) => !CLOSED_INVOICE_STATUSES.includes(i.status),
    ).length;
    const payableInvoices = invoices.filter((i) =>
      PAYABLE_INVOICE_STATUSES.includes(i.status),
    ).length;
    const revenue = invoices
      .filter((i) => i.status === 'PAID')
      .reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);
    return { totalOrders, activeOrders, pendingInvoices, payableInvoices, revenue };
  }, [orders, invoices]);

  const filteredOrders = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filters.status && o.status !== filters.status) return false;
      if (filters.tailorId && String(o.tailorId || '') !== filters.tailorId) return false;

      const createdDate = o.createdAt ? String(o.createdAt).slice(0, 10) : '';
      if (filters.from && createdDate && createdDate < filters.from) return false;
      if (filters.to && createdDate && createdDate > filters.to) return false;

      if (q) {
        const haystack = [
          o.id,
          o.title,
          o.garmentType,
          o.customerName,
          o.tailorName,
          o.deliveryName,
        ]
          .filter((v) => v != null)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filters]);

  const clearFilters = () =>
    setFilters({ status: '', search: '', tailorId: '', from: '', to: '' });

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

  const setFilter = (key) => (event) =>
    setFilters((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin control panel</h1>
          <p className="mt-1 text-sm text-gray-500">
            Company-wide overview, user management and the full audit trail.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<ClipboardList className="h-5 w-5" />}
          iconClass="bg-gray-100 text-gray-700"
          label="Total orders"
          value={loading ? '…' : String(stats.totalOrders)}
        />
        <StatCard
          icon={<UserCog className="h-5 w-5" />}
          iconClass="bg-amber-100 text-amber-600"
          label="Active orders"
          value={loading ? '…' : String(stats.activeOrders)}
        />
        <StatCard
          icon={<ReceiptText className="h-5 w-5" />}
          iconClass="bg-sky-100 text-sky-600"
          label="Pending invoices"
          value={loading ? '…' : String(stats.pendingInvoices)}
          hint={`${stats.payableInvoices} awaiting payment`}
        />
        <StatCard
          icon={<CircleDollarSign className="h-5 w-5" />}
          iconClass="bg-emerald-100 text-emerald-600"
          label="Total revenue"
          value={loading ? '…' : formatMoney(stats.revenue)}
        />
      </div>

      {/* Global orders table with filters */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-800">All orders</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {filteredOrders.length} of {orders.length} orders shown.
          </p>
        </div>

        <div className="grid gap-3 border-b border-gray-200 bg-gray-50/60 px-5 py-4 sm:grid-cols-2 lg:grid-cols-6">
          <label className="block lg:col-span-2">
            <span className="mb-1 block text-xs font-medium text-gray-500">Search</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                className={`${inputClass} pl-8`}
                placeholder="Order #, customer, garment…"
                value={filters.search}
                onChange={setFilter('search')}
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Status</span>
            <select className={inputClass} value={filters.status} onChange={setFilter('status')}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">Tailor</span>
            <select className={inputClass} value={filters.tailorId} onChange={setFilter('tailorId')}>
              <option value="">All tailors</option>
              {tailors.map((tailor) => (
                <option key={tailor.id} value={tailor.id}>
                  {tailor.fullName || tailor.username}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">From date</span>
            <input type="date" className={inputClass} value={filters.from} onChange={setFilter('from')} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">To date</span>
            <input type="date" className={inputClass} value={filters.to} onChange={setFilter('to')} />
          </label>
          {(filters.status || filters.search || filters.tailorId || filters.from || filters.to) && (
            <button
              type="button"
              onClick={clearFilters}
              className="self-end rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
            >
              Clear
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Assigned tailor</th>
                <th className="px-4 py-3 font-medium">Delivery</th>
                <th className="px-4 py-3 font-medium">Est. price</th>
                <th className="px-4 py-3 font-medium">Pref. delivery</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-gray-400">
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-gray-400">
                    No orders match the current filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">
                        #{order.id} — {order.title || order.garmentType || 'Tailoring request'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Customer: {order.customerName || '—'}
                        {order.garmentType ? ` · ${order.garmentType}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3">
                      {order.status === 'PENDING_REVIEW' ? (
                        <div className="flex min-w-44 items-center gap-2">
                          <select
                            className={selectClass}
                            disabled={tailors.length === 0 || assigning === `${order.id}-tailor`}
                            value={order.tailorId ?? ''}
                            onChange={(e) => assign(order, 'tailor', Number(e.target.value))}
                          >
                            {!order.tailorId && (
                              <option value="" disabled>
                                {tailors.length === 0 ? 'No tailors available' : 'Assign tailor…'}
                              </option>
                            )}
                            {tailors.map((tailor) => (
                              <option key={tailor.id} value={tailor.id}>
                                {tailor.fullName || tailor.username}
                              </option>
                            ))}
                          </select>
                          {assigning === `${order.id}-tailor` && (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600">
                          {order.tailorName || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {order.status === 'READY_FOR_DELIVERY' ? (
                        <div className="flex min-w-44 items-center gap-2">
                          <select
                            className={selectClass}
                            disabled={deliveryAgents.length === 0 || assigning === `${order.id}-delivery`}
                            value={order.deliveryId ?? ''}
                            onChange={(e) => assign(order, 'delivery', Number(e.target.value))}
                          >
                            {!order.deliveryId && (
                              <option value="" disabled>
                                {deliveryAgents.length === 0 ? 'No delivery agents' : 'Assign delivery…'}
                              </option>
                            )}
                            {deliveryAgents.map((agent) => (
                              <option key={agent.id} value={agent.id}>
                                {agent.fullName || agent.username}
                              </option>
                            ))}
                          </select>
                          {assigning === `${order.id}-delivery` && (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                          )}
                        </div>
                      ) : (
                        <span className="flex items-center gap-1.5 text-gray-600">
                          {order.deliveryName ? (
                            <>
                              <Truck className="h-3.5 w-3.5 text-gray-400" />
                              {order.deliveryName}
                            </>
                          ) : (
                            '—'
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatMoney(order.estimatedPrice)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(order.preferredDeliveryDate)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(order.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, iconClass, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-gray-400">{label}</p>
          <p className="truncate text-2xl font-bold text-gray-800">{value}</p>
          {hint && <p className="truncate text-xs text-gray-400">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

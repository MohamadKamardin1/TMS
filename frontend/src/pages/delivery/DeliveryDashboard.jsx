import { useCallback, useEffect, useMemo, useState } from 'react';
import { PackageCheck, RefreshCw, Truck, Warehouse } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import StatusBadge from '../../components/StatusBadge';
import ConfirmModal from '../../components/ConfirmModal';
import { BTN_SECONDARY, DataTable, LoadingBlock, PAGE_HEADER } from '../../components/ui';
import { formatDate, formatMoney } from '../../utils/format';

// Compact row-action variants so table buttons don't inherit the full-size
// default padding from the shared tokens.
const BTN_ACTION_DARK =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-gray-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60';
const BTN_ACTION_EMERALD =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60';

/**
 * Delivery agent workspace. The backend hands back every order assigned to this
 * agent, so the page splits them into what the agent must do next:
 *
 *   1. READY_FOR_DELIVERY — garments waiting at the shop that this agent
 *      "dispatches" (takes out) to start the run;
 *   2. OUT_FOR_DELIVERY   — active runs the agent completes with a hand-over
 *      confirmation (guarded by a confirmation dialog since it is the final,
 *      irreversible step);
 *   3. DELIVERED          — a read-only history of completed runs.
 */
export default function DeliveryDashboard() {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dispatchingId, setDispatchingId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders');
      setOrders(data.data || []);
    } catch {
      toast.error('Failed to load your deliveries.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const { dispatchQueue, enRoute, completed } = useMemo(
    () => ({
      dispatchQueue: orders.filter((o) => o.status === 'READY_FOR_DELIVERY'),
      enRoute: orders.filter((o) => o.status === 'OUT_FOR_DELIVERY'),
      completed: orders.filter((o) => o.status === 'DELIVERED'),
    }),
    [orders],
  );

  const dispatch = async (order) => {
    setDispatchingId(order.id);
    try {
      await api.post(`/orders/${order.id}/out-for-delivery`);
      toast.success(`Order #${order.id} is now out for delivery.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not dispatch the order.');
    } finally {
      setDispatchingId(null);
    }
  };

  const confirmDelivery = async () => {
    if (!confirmTarget) return;
    setConfirming(true);
    try {
      await api.post(`/orders/${confirmTarget.id}/confirm-delivery`);
      toast.success(`Order #${confirmTarget.id} delivered — thank you!`);
      setConfirmTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not confirm delivery.');
    } finally {
      setConfirming(false);
    }
  };

  const summaryCard = (label, count, icon, tone) => (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-gray-400">{label}</p>
        <p className="truncate text-2xl font-bold text-gray-800">{count}</p>
      </div>
    </div>
  );

  const orderColumns = [
    { label: 'Order' },
    { label: 'Customer' },
    { label: 'Preferred delivery' },
    { label: 'Amount' },
    { label: 'Status' },
    { label: 'Action', className: 'text-right' },
  ];

  const renderCommonRow = (order, actionCell) => (
    <tr key={order.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-800">
          #{order.id} — {order.title || order.garmentType || 'Tailoring request'}
        </p>
        {order.garmentType && <p className="text-xs text-gray-400">{order.garmentType}</p>}
      </td>
      <td className="px-4 py-3 text-gray-600">{order.customerName || '—'}</td>
      <td className="px-4 py-3 text-gray-600">{formatDate(order.preferredDeliveryDate)}</td>
      <td className="px-4 py-3 text-gray-600">{formatMoney(order.estimatedPrice)}</td>
      <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
      {actionCell}
    </tr>
  );

  return (
    <div>
      <div className={PAGE_HEADER}>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Delivery runs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Orders assigned to you — dispatch what is ready, then confirm each hand-over.
          </p>
        </div>
        <button type="button" onClick={load} className={BTN_SECONDARY}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <LoadingBlock label="Loading your deliveries…" />
      ) : (
        <div className="space-y-8">
          {/* Summary strip */}
          <div className="grid gap-4 sm:grid-cols-3">
            {summaryCard('Awaiting dispatch', dispatchQueue.length, <Warehouse className="h-5 w-5" />, 'bg-indigo-50 text-indigo-600')}
            {summaryCard('Out for delivery', enRoute.length, <Truck className="h-5 w-5" />, 'bg-amber-50 text-amber-600')}
            {summaryCard('Delivered', completed.length, <PackageCheck className="h-5 w-5" />, 'bg-emerald-50 text-emerald-600')}
          </div>

          {/* Dispatch queue */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-gray-800">Ready to dispatch</h2>
            <DataTable
              columns={orderColumns}
              rows={dispatchQueue}
              rowKey={(o) => `q-${o.id}`}
              renderRow={(order) =>
                renderCommonRow(
                  order,
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={dispatchingId === order.id}
                      onClick={() => dispatch(order)}
                      className={BTN_ACTION_DARK}
                    >
                      {dispatchingId === order.id && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      Dispatch now
                    </button>
                  </td>,
                )
              }
              empty={{
                icon: Warehouse,
                title: 'Nothing waiting at the shop',
                hint: 'Orders ready for delivery that staff assign to you will appear here.',
              }}
            />
          </section>

          {/* Active runs */}
          <section>
            <h2 className="mb-3 text-base font-semibold text-gray-800">Active deliveries</h2>
            <DataTable
              columns={orderColumns}
              rows={enRoute}
              rowKey={(o) => `r-${o.id}`}
              renderRow={(order) =>
                renderCommonRow(
                  order,
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setConfirmTarget(order)}
                      className={BTN_ACTION_EMERALD}
                    >
                      <PackageCheck className="h-4 w-4" />
                      Confirm delivery
                    </button>
                  </td>,
                )
              }
              empty={{
                icon: Truck,
                title: 'No active deliveries',
                hint: 'Once you dispatch an order, it will show up here for confirmation.',
              }}
            />
          </section>

          {/* History */}
          {completed.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-semibold text-gray-800">Recently delivered</h2>
              <DataTable
                columns={orderColumns}
                rows={completed}
                rowKey={(o) => `d-${o.id}`}
                renderRow={(order) => renderCommonRow(order, <td className="px-4 py-3" />)}
                empty={{ icon: PackageCheck, title: 'No completed runs yet' }}
              />
            </section>
          )}
        </div>
      )}

      {/* Confirm hand-over */}
      <ConfirmModal
        open={Boolean(confirmTarget)}
        title="Confirm delivery"
        confirmLabel={confirming ? 'Confirming…' : 'Yes, delivered'}
        tone="primary"
        icon={<PackageCheck className="h-5 w-5" />}
        confirming={confirming}
        onConfirm={confirmDelivery}
        onClose={() => setConfirmTarget(null)}
        message={
          confirmTarget ? (
            <span>
              Hand <span className="font-semibold text-gray-900">
                {confirmTarget.title || confirmTarget.garmentType || `order #${confirmTarget.id}`}
              </span>{' '}
              over to <span className="font-semibold text-gray-900">{confirmTarget.customerName || 'the customer'}</span> and
              mark order <span className="font-semibold text-gray-900">#{confirmTarget.id}</span> as delivered?
              This finalises the order and unlocks the customer’s review.
            </span>
          ) : null
        }
      />
    </div>
  );
}

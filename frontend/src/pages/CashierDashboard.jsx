import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Banknote, Loader2, Receipt } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { formatMoney } from '../utils/format';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200';

function SectionTable({ title, icon: Icon, rows }) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-indigo-500" />
        <h2 className="font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Cashier station: generate invoices for ESTIMATED orders and mark INVOICED
 * orders as paid. Invoice ids for INVOICED orders are fetched per order.
 */
export default function CashierDashboard() {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [invoiceByOrder, setInvoiceByOrder] = useState({});
  const [loading, setLoading] = useState(true);

  const [invoicingOrder, setInvoicingOrder] = useState(null);
  const [invoiceForm, setInvoiceForm] = useState({ amount: '', accountNumber: '', referenceNumber: '' });
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders');
      const all = data.data || [];
      setOrders(all);

      const invoiced = all.filter((order) => order.status === 'INVOICED');
      const invoiceMap = {};
      await Promise.all(
        invoiced.map(async (order) => {
          try {
            const res = await api.get(`/invoices/order/${order.id}`);
            invoiceMap[order.id] = res.data.data.id;
          } catch {
            /* order has no invoice yet — button stays disabled */
          }
        }),
      );
      setInvoiceByOrder(invoiceMap);
    } catch {
      toast.error('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const estimated = orders.filter((order) => order.status === 'ESTIMATED');
  const invoiced = orders.filter((order) => order.status === 'INVOICED');

  const openInvoice = (order) => {
    setInvoicingOrder(order);
    setInvoiceForm({ amount: order.estimatedPrice ?? '', accountNumber: '', referenceNumber: '' });
  };

  const generateInvoice = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post(`/invoices?orderId=${invoicingOrder.id}`, invoiceForm);
      toast.success(`Invoice ${data.data.referenceNumber} generated for order #${invoicingOrder.id}.`);
      setInvoicingOrder(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not generate invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  const markPaid = async (order) => {
    const invoiceId = invoiceByOrder[order.id];
    if (!invoiceId) return;
    setActionId(order.id);
    try {
      await api.patch(`/invoices/${invoiceId}/status`, { paymentStatus: 'PAID' });
      toast.success(`Payment confirmed for order #${order.id}.`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not mark as paid.');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Billing station</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate invoices for estimated orders and confirm incoming payments.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl bg-white py-24 text-sm text-slate-400 shadow-sm">
          Loading orders...
        </div>
      ) : estimated.length === 0 && invoiced.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-24 text-center shadow-sm">
          <Receipt className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">Nothing to bill right now</p>
          <p className="mt-1 text-sm text-slate-400">
            Estimated orders wait here for an invoice; invoiced orders wait for payment.
          </p>
        </div>
      ) : (
        <>
          <SectionTable
            title="Awaiting invoice"
            icon={Receipt}
            rows={estimated.map((order) => (
              <tr key={order.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">#{order.id} — {order.title}</p>
                  <p className="text-xs text-slate-400">Customer: {order.customerName || '—'}</p>
                </td>
                <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                <td className="px-4 py-3 text-slate-600">{formatMoney(order.estimatedPrice)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => openInvoice(order)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
                  >
                    <Receipt className="h-4 w-4" />
                    Generate invoice
                  </button>
                </td>
              </tr>
            ))}
          />

          <SectionTable
            title="Awaiting payment"
            icon={Banknote}
            rows={invoiced.map((order) => (
              <tr key={order.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">#{order.id} — {order.title}</p>
                  <p className="text-xs text-slate-400">Customer: {order.customerName || '—'}</p>
                </td>
                <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                <td className="px-4 py-3 text-slate-600">{formatMoney(order.estimatedPrice)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={!invoiceByOrder[order.id] || actionId === order.id}
                    onClick={() => markPaid(order)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {actionId === order.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="h-4 w-4" />
                    )}
                    Mark as paid
                  </button>
                </td>
              </tr>
            ))}
          />
        </>
      )}

      {/* Generate invoice modal */}
      <Modal
        open={Boolean(invoicingOrder)}
        title={`Generate invoice — Order #${invoicingOrder?.id || ''}`}
        onClose={() => setInvoicingOrder(null)}
      >
        <form onSubmit={generateInvoice} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount (PKR) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={invoiceForm.amount}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
              className={inputClass}
              placeholder="5000"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Account number *</label>
            <input
              type="text"
              required
              value={invoiceForm.accountNumber}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, accountNumber: e.target.value })}
              className={inputClass}
              placeholder="e.g. 0123-456789-01"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Reference number *</label>
            <input
              type="text"
              required
              value={invoiceForm.referenceNumber}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, referenceNumber: e.target.value })}
              className={inputClass}
              placeholder="e.g. INV-0001"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Generate invoice
          </button>
        </form>
      </Modal>
    </div>
  );
}
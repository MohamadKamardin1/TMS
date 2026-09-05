import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  MessageSquarePlus,
  PackagePlus,
  Plus,
  Receipt,
  Star,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { formatDate, formatDateTime, formatMoney } from '../utils/format';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200';

function OrderCard({ order, onViewInvoice, onFeedback }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">Order #{order.id}</p>
          <h3 className="mt-0.5 font-semibold text-slate-800">{order.title}</h3>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {order.description && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-500">{order.description}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-400">Estimated price</p>
          <p className="font-medium text-slate-700">{formatMoney(order.estimatedPrice)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-400">Required by</p>
          <p className="font-medium text-slate-700">{formatDate(order.requiredCompletionDate)}</p>
        </div>
      </div>

      {(order.status === 'INVOICED' || order.status === 'DELIVERED') && (
        <div className="mt-4 flex gap-2">
          {order.status === 'INVOICED' && (
            <button
              type="button"
              onClick={() => onViewInvoice(order)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              <Receipt className="h-4 w-4" />
              View invoice
            </button>
          )}
          {order.status === 'DELIVERED' && (
            <button
              type="button"
              onClick={() => onFeedback(order)}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              <MessageSquarePlus className="h-4 w-4" />
              Leave feedback
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    requiredCompletionDate: '',
    referenceImage: null,
  });
  const [creating, setCreating] = useState(false);

  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const [feedbackOrder, setFeedbackOrder] = useState(null);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders');
      setOrders(data.data || []);
    } catch {
      toast.error('Failed to load your orders.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreating(true);
    try {
      const formData = new FormData();
      formData.append('title', createForm.title);
      formData.append('description', createForm.description || '');
      if (createForm.requiredCompletionDate) {
        formData.append('requiredCompletionDate', createForm.requiredCompletionDate);
      }
      if (createForm.referenceImage) {
        formData.append('referenceImage', createForm.referenceImage);
      }
      await api.post('/orders', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Order created successfully.');
      setShowCreate(false);
      setCreateForm({ title: '', description: '', requiredCompletionDate: '', referenceImage: null });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create the order.');
    } finally {
      setCreating(false);
    }
  };

  const handleViewInvoice = async (order) => {
    setInvoiceOrder(order);
    setInvoice(null);
    setInvoiceLoading(true);
    try {
      const { data } = await api.get(`/invoices/my-order/${order.id}`);
      setInvoice(data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'No invoice available for this order.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const openFeedback = (order) => {
    setFeedbackOrder(order);
    setRating(0);
    setComments('');
  };

  const handleFeedback = async (event) => {
    event.preventDefault();
    setSendingFeedback(true);
    try {
      await api.post('/feedback', { orderId: feedbackOrder.id, rating, comments });
      toast.success('Thank you for your feedback!');
      setFeedbackOrder(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit feedback.');
    } finally {
      setSendingFeedback(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Hello, {user?.fullName || user?.username || 'there'} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">Your tailoring orders at a glance.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Create New Order
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl bg-white py-24 text-sm text-slate-400 shadow-sm">
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-24 text-center shadow-sm">
          <PackagePlus className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No orders yet</p>
          <p className="mt-1 text-sm text-slate-400">
            Click “Create New Order” to place your first order.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onViewInvoice={handleViewInvoice}
              onFeedback={openFeedback}
            />
          ))}
        </div>
      )}

      {/* Create order */}
      <Modal open={showCreate} title="Create New Order" onClose={() => setShowCreate(false)}>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title *</label>
            <input
              type="text"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              className={inputClass}
              placeholder="e.g. Wedding Sherwani"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              rows={3}
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className={inputClass}
              placeholder="Describe the outfit, fabric, stitching preferences..."
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Required completion date
            </label>
            <input
              type="date"
              value={createForm.requiredCompletionDate}
              onChange={(e) =>
                setCreateForm({ ...createForm, requiredCompletionDate: e.target.value })
              }
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Reference image (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setCreateForm({ ...createForm, referenceImage: e.target.files?.[0] || null })
              }
              className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-600`}
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            {creating ? 'Creating...' : 'Submit order'}
          </button>
        </form>
      </Modal>

      {/* Invoice details */}
      <Modal open={Boolean(invoiceOrder)} title={`Invoice #${invoice?.referenceNumber || '...'}`} onClose={() => setInvoiceOrder(null)}>
        {invoiceLoading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading invoice...</p>
        ) : invoice ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Order</p>
                <p className="text-sm font-medium text-slate-800">#{invoice.orderId}</p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-sm text-slate-500">Amount</p>
                <p className="text-lg font-bold text-slate-800">{formatMoney(invoice.amount)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-sm text-slate-500">Account number</p>
                <p className="text-sm font-medium text-slate-800">{invoice.accountNumber}</p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-sm text-slate-500">Payment status</p>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    invoice.paymentStatus === 'PAID'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {invoice.paymentStatus}
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">Payment instructions</p>
              <p className="mt-1">
                Please pay <b>{formatMoney(invoice.amount)}</b> to account{' '}
                <b>{invoice.accountNumber}</b>. Use the reference{' '}
                <b>{invoice.referenceNumber}</b> in your payment slip — stitching starts once the
                payment is confirmed.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
              <div>
                Issued by: <span className="text-slate-600">{invoice.issuedBy || '—'}</span>
              </div>
              <div>
                Issued at: <span className="text-slate-600">{formatDateTime(invoice.issuedAt)}</span>
              </div>
              {invoice.paidAt && (
                <div className="col-span-2">
                  Paid at: <span className="text-slate-600">{formatDateTime(invoice.paidAt)}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-slate-400">No invoice found.</p>
        )}
      </Modal>

      {/* Feedback */}
      <Modal open={Boolean(feedbackOrder)} title="Leave feedback" onClose={() => setFeedbackOrder(null)}>
        <form onSubmit={handleFeedback} className="space-y-4">
          <div className="flex items-center justify-center gap-1 py-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className="p-1 transition hover:scale-110"
                aria-label={`Rate ${value} star${value === 1 ? '' : 's'}`}
              >
                <Star
                  className={`h-8 w-8 ${
                    value <= rating
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-slate-400">
            {rating > 0 ? `You rated: ${rating}/5` : 'Tap a star to rate'}
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Comments</label>
            <textarea
              rows={4}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className={inputClass}
              placeholder="How was your experience?"
            />
          </div>
          <button
            type="submit"
            disabled={rating === 0 || sendingFeedback}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            {sendingFeedback && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit feedback
          </button>
        </form>
      </Modal>
    </div>
  );
}
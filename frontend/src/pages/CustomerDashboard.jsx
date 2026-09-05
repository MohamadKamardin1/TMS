import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  Eye,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  PackagePlus,
  Plus,
  Receipt,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import InvoiceStatusBadge from '../components/InvoiceStatusBadge';
import FeedbackForm from '../components/FeedbackForm';
import { formatDate, formatDateTime, formatMoney } from '../utils/format';

/** Lifecycle statuses at which an invoice exists and the customer can open it. */
const ORDER_WITH_INVOICE = [
  'INVOICED',
  'PAID',
  'IN_PROGRESS',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

function OrderCard({ order, onViewInvoice, onFeedback }) {
  const displayTitle = order.title || order.garmentType || 'Tailoring request';
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-400">Order #{order.id}</p>
          <h3 className="mt-0.5 font-semibold text-gray-800">{displayTitle}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/customer/orders/${order.id}`}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-400 transition hover:border-gray-300 hover:text-gray-700"
            aria-label={`View full details for order #${order.id}`}
            title="View full details"
          >
            <Eye className="h-4 w-4" />
          </Link>
          <StatusBadge status={order.status} />
        </div>
      </div>

      {(order.garmentType || order.fabricType) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {order.garmentType && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {order.garmentType}
            </span>
          )}
          {order.fabricType && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {order.fabricType}
            </span>
          )}
        </div>
      )}

      {order.description && (
        <p className="mt-2 line-clamp-2 text-sm text-gray-500">{order.description}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-400">Estimated price</p>
          <p className="font-medium text-gray-700">{formatMoney(order.estimatedPrice)}</p>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-400">Preferred delivery</p>
          <p className="font-medium text-gray-700">{formatDate(order.preferredDeliveryDate)}</p>
        </div>
      </div>

      {order.estimatedCompletionDate && order.status !== 'PENDING_REVIEW' && (
        <p className="mt-2 text-xs text-gray-500">
          Tailor estimate: ready by{' '}
          <span className="font-medium text-gray-700">
            {formatDate(order.estimatedCompletionDate)}
          </span>
        </p>
      )}

      {ORDER_WITH_INVOICE.includes(order.status) && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onViewInvoice(order)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
          >
            <Receipt className="h-4 w-4" />
            View invoice
          </button>
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
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Payment-proof verification against the open invoice.
  const [proofs, setProofs] = useState([]);
  const [proofsLoading, setProofsLoading] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [proofMessage, setProofMessage] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState('');
  const [proofSending, setProofSending] = useState(false);
  const [proofError, setProofError] = useState('');

  const [feedbackOrder, setFeedbackOrder] = useState(null);

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

  const resetProof = () => {
    setProofOpen(false);
    setProofMessage('');
    setProofFile(null);
    setProofPreview('');
    setProofError('');
  };

  const loadProofs = async (invoiceId) => {
    setProofsLoading(true);
    try {
      const { data } = await api.get(`/payment-verifications/invoice/${invoiceId}`);
      setProofs(data.data || []);
    } catch {
      setProofs([]);
    } finally {
      setProofsLoading(false);
    }
  };

  const handleViewInvoice = async (order) => {
    setInvoiceOrder(order);
    setInvoice(null);
    setInvoiceLoading(true);
    resetProof();
    setProofs([]);
    try {
      const { data } = await api.get(`/invoices/my-order/${order.id}`);
      setInvoice(data.data);
      if (data.data?.id) {
        await loadProofs(data.data.id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'No invoice available for this order.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleProofFile = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProofError('Please attach an image (screenshot) of the payment.');
      setProofFile(null);
      setProofPreview('');
      event.target.value = '';
      return;
    }
    setProofFile(file);
    setProofError('');
    setProofPreview(URL.createObjectURL(file));
  };

  const handleSubmitProof = async () => {
    if (!invoice) return;
    if (!proofFile) {
      setProofError('Please attach a screenshot of the payment as proof.');
      return;
    }
    if (!proofMessage.trim()) {
      setProofError('Please describe how you made the payment (method and reference).');
      return;
    }
    setProofSending(true);
    setProofError('');
    try {
      const formData = new FormData();
      formData.append('invoiceId', String(invoice.id));
      formData.append('message', proofMessage.trim());
      formData.append('screenshot', proofFile);
      await api.post('/payment-verifications', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Payment proof submitted — the cashier will verify it shortly.');
      resetProof();
      await loadProofs(invoice.id);
    } catch (err) {
      setProofError(err.response?.data?.message || 'Could not submit your payment proof.');
    } finally {
      setProofSending(false);
    }
  };

  const openFeedback = (order) => setFeedbackOrder(order);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Hello, {user?.fullName || user?.username || 'there'} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">Your tailoring orders at a glance.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/customer/orders/new')}
          className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-gray-900"
        >
          <Plus className="h-4 w-4" />
          Create New Order
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white py-24 text-sm text-gray-400 shadow-sm">
          Loading orders...
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white py-24 text-center shadow-sm">
          <PackagePlus className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-600">No orders yet</p>
          <p className="mt-1 text-sm text-gray-400">
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

      {/* Invoice details */}
      <Modal
        open={Boolean(invoiceOrder)}
        title={`Invoice ${invoice?.invoiceNumber || '...'}`}
        onClose={() => setInvoiceOrder(null)}
      >
        {invoiceLoading ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading invoice...</p>
        ) : invoice ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Order</p>
                <p className="text-sm font-medium text-gray-800">
                  #{invoice.orderId} — {invoice.orderTitle}
                </p>
              </div>
              <InvoiceStatusBadge status={invoice.status} />
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200">
              <div className="divide-y divide-gray-100">
                <div className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-700">{formatMoney(invoice.subtotal)}</span>
                </div>
                {Number(invoice.discountAmount) > 0 && (
                  <div className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-gray-700">
                      − {formatMoney(invoice.discountAmount).replace('PKR ', '')}
                    </span>
                  </div>
                )}
                {Number(invoice.taxAmount) > 0 && (
                  <div className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-gray-500">Tax</span>
                    <span className="text-gray-700">{formatMoney(invoice.taxAmount)}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
                <span className="text-sm font-medium text-gray-600">Total payable</span>
                <span className="text-lg font-bold text-gray-800">{formatMoney(invoice.totalAmount)}</span>
              </div>
            </div>

            {invoice.status === 'DRAFT' ? (
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500">
                This invoice is still being prepared by the cashier. Payment details will appear here
                once it is issued.
              </div>
            ) : invoice.paymentInstructions ? (
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">Payment instructions</p>
                <p className="mt-1 whitespace-pre-line">{invoice.paymentInstructions}</p>
              </div>
            ) : null}

            {(() => {
              const pendingProof = proofs.find((p) => p.status === 'PENDING');
              const rejectedProof = proofs.find((p) => p.status === 'REJECTED');
              const approvedProof = proofs.find((p) => p.status === 'APPROVED');
              const payable = invoice.status === 'ISSUED' || invoice.status === 'OVERDUE';
              const canSubmit = payable && !pendingProof;
              const showForm = canSubmit && proofOpen;
              return (
                <div className="space-y-3">
                  {pendingProof && (
                    <div className="flex items-start gap-3 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-800">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">Payment under review</p>
                        <p className="mt-0.5">
                          Your proof was submitted on {formatDateTime(pendingProof.submittedAt)}. The cashier will
                          check the screenshot and confirm your payment.
                        </p>
                      </div>
                    </div>
                  )}

                  {rejectedProof && !pendingProof && (
                    <div className="flex items-start gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">Your proof was not accepted</p>
                        <p className="mt-0.5">{rejectedProof.reviewNote}</p>
                        {rejectedProof.reviewedAt && (
                          <p className="mt-0.5 text-xs text-red-500">
                            Reviewed {formatDateTime(rejectedProof.reviewedAt)}
                            {rejectedProof.reviewedBy ? ` by ${rejectedProof.reviewedBy}` : ''}. You can submit a
                            clearer proof below.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {approvedProof && (
                    <div className="flex items-start gap-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">Payment verified</p>
                        <p className="mt-0.5">
                          Your proof was confirmed{approvedProof.reviewedAt ? ` on ${formatDateTime(approvedProof.reviewedAt)}` : ''}{' '}
                          and the invoice is marked paid.
                        </p>
                      </div>
                    </div>
                  )}

                  {canSubmit && !showForm && (
                    <button
                      type="button"
                      onClick={() => {
                        setProofError('');
                        setProofOpen(true);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
                    >
                      <BadgeCheck className="h-4 w-4" />
                      I have paid — submit proof
                    </button>
                  )}

                  {showForm && (
                    <div className="space-y-3 rounded-xl border border-gray-200 p-4">
                      <div>
                        <p className="mb-1 text-sm font-medium text-gray-700">Payment screenshot (evidence)</p>
                        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-3 text-center transition hover:border-gray-400">
                          {proofPreview ? (
                            <img
                              src={proofPreview}
                              alt="Payment screenshot preview"
                              className="mx-auto max-h-44 rounded-lg object-contain"
                            />
                          ) : (
                            <span className="flex items-center justify-center gap-2 text-sm text-gray-500">
                              <ImagePlus className="h-4 w-4" />
                              Choose a screenshot
                            </span>
                          )}
                          <input type="file" accept="image/*" className="hidden" onChange={handleProofFile} />
                        </label>
                        {proofFile && <p className="mt-1 text-xs text-gray-400">{proofFile.name}</p>}
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Payment message</label>
                        <textarea
                          rows={3}
                          value={proofMessage}
                          onChange={(e) => setProofMessage(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                          placeholder="e.g. Transferred PKR 2,000 via JazzCash (ref #48291) from 0300-1234567."
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          Helps the cashier match your payment to the invoice.
                        </p>
                      </div>
                      {proofError && (
                        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{proofError}</p>
                      )}
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setProofOpen(false);
                            setProofError('');
                          }}
                          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={proofSending}
                          onClick={handleSubmitProof}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                        >
                          {proofSending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <BadgeCheck className="h-4 w-4" />
                          )}
                          Submit proof
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div>
                Due date: <span className="text-gray-600">{formatDate(invoice.dueDate)}</span>
              </div>
              {invoice.status !== 'DRAFT' && (
                <div>
                  Issued by: <span className="text-gray-600">{invoice.issuedBy || '—'}</span>
                </div>
              )}
              {invoice.issuedAt && (
                <div>
                  Issued at: <span className="text-gray-600">{formatDateTime(invoice.issuedAt)}</span>
                </div>
              )}
              {invoice.paidAt && (
                <div>
                  Paid at: <span className="text-gray-600">{formatDateTime(invoice.paidAt)}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">No invoice found.</p>
        )}
      </Modal>

      {/* Feedback */}
      <Modal
        open={Boolean(feedbackOrder)}
        title="Leave feedback"
        onClose={() => setFeedbackOrder(null)}
      >
        <p className="mb-1 text-sm font-medium text-gray-800">
          Order #{feedbackOrder?.id}
          {(feedbackOrder?.title || feedbackOrder?.garmentType) &&
            ` — ${feedbackOrder.title || feedbackOrder.garmentType}`}
        </p>
        <p className="mb-5 text-sm text-gray-400">Share your experience — it takes a few seconds.</p>
        <FeedbackForm
          orderId={feedbackOrder?.id}
          onSuccess={() => {
            setFeedbackOrder(null);
            load();
          }}
        />
      </Modal>
    </div>
  );
}

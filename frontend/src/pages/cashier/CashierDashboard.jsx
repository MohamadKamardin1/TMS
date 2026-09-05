import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  ChevronLeft,
  Eye,
  FileText,
  Loader2,
  Plus,
  Receipt,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import api, { mediaUrl } from '../../services/api';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import InvoiceStatusBadge, { INVOICE_STATUS_META } from '../../components/InvoiceStatusBadge';
import { formatDate, formatDateTime, formatMoney } from '../../utils/format';

const FILTER_TABS = ['ALL', 'DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'CANCELLED'];

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200';
const labelClass = 'mb-1 block text-sm font-medium text-gray-700';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60';
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50';

function localIso(addDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + addDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function toNumber(value) {
  if (value == null || String(value).trim() === '') return NaN;
  return Number(value);
}

function safeMoney(value) {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function StatCard({ icon: Icon, label, value, hint, tone }) {
  const tones = {
    violet: 'bg-violet-100 text-violet-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    red: 'bg-red-100 text-red-600',
  };
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-gray-400">{label}</p>
          <p className="mt-0.5 text-2xl font-bold text-gray-800">{value}</p>
          <p className="mt-0.5 text-xs text-gray-400">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function MoneyBreakdown({ invoice }) {
  const subtotal = safeMoney(invoice.subtotal);
  const tax = safeMoney(invoice.taxAmount);
  const discount = safeMoney(invoice.discountAmount);
  const total = Math.max(0, subtotal + tax - discount);

  const rows = [
    { label: 'Subtotal', value: formatMoney(subtotal), negative: false, muted: subtotal === 0 },
    { label: 'Discount', value: formatMoney(discount), negative: true, muted: discount === 0 },
    { label: 'Tax', value: formatMoney(tax), negative: false, muted: tax === 0 },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div className="divide-y divide-gray-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-4 py-2 text-sm">
            <span className="text-gray-500">{row.label}</span>
            <span className={row.muted ? 'text-gray-300' : 'text-gray-700'}>
              {row.negative ? `− ${row.value.replace('PKR ', '')}` : row.value}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
        <span className="text-sm font-medium text-gray-600">Total payable</span>
        <span className="text-lg font-bold text-gray-800">{formatMoney(total)}</span>
      </div>
    </div>
  );
}

/**
 * Cashier billing hub. Stats on top, then the orders that still need an invoice
 * (ESTIMATED), then the full invoice ledger with status filtering. Every action
 * — draft, adjust amounts, issue, record payment, discard a draft — drives the
 * real backend workflow, so a row in this table always reflects the document.
 */
export default function CashierDashboard({ title = 'Billing station', subtitle } = {}) {
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  // Invoice wizard state
  const [wizard, setWizard] = useState(null); // { order, draft } mode inferred from order presence
  const [step, setStep] = useState(1);
  const [draftId, setDraftId] = useState(null);
  const [fields, setFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [wizardError, setWizardError] = useState('');

  const [paying, setPaying] = useState(null);
  const [discarding, setDiscarding] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Payment-proof verification queue.
  const [verifications, setVerifications] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewBusy, setReviewBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, invoicesRes, verificationsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/invoices'),
        api.get('/payment-verifications'),
      ]);
      setOrders(ordersRes.data.data || []);
      setInvoices(invoicesRes.data.data || []);
      setVerifications(verificationsRes.data.data || []);
    } catch {
      toast.error('Failed to load billing data.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const pending = invoices.filter((inv) => inv.status === 'ISSUED');
    const paid = invoices.filter((inv) => inv.status === 'PAID');
    const overdue = invoices.filter((inv) => inv.status === 'OVERDUE');
    const sum = (list) => list.reduce((total, inv) => total + (toNumber(inv.totalAmount) || 0), 0);
    return {
      pendingCount: pending.length,
      pendingTotal: sum(pending),
      revenue: sum(paid),
      overdueCount: overdue.length,
      overdueTotal: sum(overdue),
    };
  }, [invoices]);

  const awaiting = useMemo(() => orders.filter((order) => order.status === 'ESTIMATED'), [orders]);
  const visible = useMemo(
    () => (filter === 'ALL' ? invoices : invoices.filter((inv) => inv.status === filter)),
    [invoices, filter],
  );

  const awaitingTotal = useMemo(
    () => awaiting.reduce((total, order) => total + (toNumber(order.estimatedPrice) || 0), 0),
    [awaiting],
  );

  // ---------------- Generate / edit wizard ----------------

  const openWizardForOrder = (order) => {
    setWizard({ order });
    setDraftId(null);
    setFields({
      subtotal: order.estimatedPrice ?? '',
      taxAmount: '0',
      discountAmount: '0',
      dueDate: localIso(7),
      paymentInstructions: '',
    });
    setStep(1);
    setWizardError('');
  };

  const openWizardForDraft = (invoice) => {
    setWizard({
      order: {
        id: invoice.orderId,
        title: invoice.orderTitle,
        customerName: invoice.customerName,
        invoiceNumber: invoice.invoiceNumber,
      },
    });
    setDraftId(invoice.id);
    setFields({
      subtotal: invoice.subtotal ?? '',
      taxAmount: invoice.taxAmount ?? '0',
      discountAmount: invoice.discountAmount ?? '0',
      dueDate: invoice.dueDate || localIso(7),
      paymentInstructions: invoice.paymentInstructions || '',
    });
    setStep(2);
    setWizardError('');
  };

  const closeWizard = () => {
    setWizard(null);
    setDraftId(null);
    setStep(1);
    setFields({});
    setWizardError('');
  };

  const draftPayload = () => ({
    subtotal: toNumber(fields.subtotal),
    taxAmount: toNumber(fields.taxAmount) || 0,
    discountAmount: toNumber(fields.discountAmount) || 0,
    paymentInstructions: fields.paymentInstructions || '',
    dueDate: fields.dueDate || null,
  });

  const validateAmounts = () => {
    const subtotal = toNumber(fields.subtotal);
    const tax = toNumber(fields.taxAmount) || 0;
    const discount = toNumber(fields.discountAmount) || 0;
    if (!Number.isFinite(subtotal) || subtotal < 0) return 'Subtotal must be a non-negative number.';
    if (tax < 0) return 'Tax cannot be negative.';
    if (discount < 0) return 'Discount cannot be negative.';
    if (discount > subtotal + tax) return 'Discount cannot exceed the subtotal plus tax.';
    if (!fields.dueDate) return 'A payment due date is required.';
    return '';
  };

  const advanceFromReview = async () => {
    if (draftId) {
      setStep(2);
      return;
    }
    const problem = validateAmounts();
    if (problem) {
      setWizardError(problem);
      return;
    }
    setSaving(true);
    setWizardError('');
    try {
      const { data } = await api.post(`/invoices?orderId=${wizard.order.id}`, draftPayload());
      setDraftId(data.data.id);
      setWizard({ ...wizard, order: { ...wizard.order, invoiceNumber: data.data.invoiceNumber } });
      setStep(2);
      load();
    } catch (err) {
      setWizardError(err.response?.data?.message || 'Could not create the invoice draft.');
    } finally {
      setSaving(false);
    }
  };

  const advanceToPreview = async () => {
    const problem = validateAmounts();
    if (problem) {
      setWizardError(problem);
      return;
    }
    setSaving(true);
    setWizardError('');
    try {
      await api.put(`/invoices/${draftId}`, draftPayload());
      setStep(3);
    } catch (err) {
      setWizardError(err.response?.data?.message || 'Could not save the invoice amounts.');
    } finally {
      setSaving(false);
    }
  };

  const issueInvoice = async () => {
    setSaving(true);
    setWizardError('');
    try {
      await api.post(`/invoices/${draftId}/issue`);
      toast.success('Invoice issued — it is now payable by the customer.');
      closeWizard();
      load();
    } catch (err) {
      setWizardError(err.response?.data?.message || 'Could not issue the invoice.');
      setSaving(false);
    }
  };

  // ---------------- Actions ----------------

  const recordPayment = async (invoice) => {
    setBusyId(invoice.id);
    try {
      const { data } = await api.post(`/invoices/${invoice.id}/record-payment`);
      toast.success(`Payment recorded for ${data.data.invoiceNumber}. Production can start.`);
      setPaying(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not record the payment.');
    } finally {
      setBusyId(null);
    }
  };

  const discardDraft = async (invoice) => {
    setBusyId(invoice.id);
    try {
      await api.delete(`/invoices/${invoice.id}`);
      toast.success(`Draft ${invoice.invoiceNumber} discarded — order returned to the queue.`);
      setDiscarding(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not discard the draft.');
    } finally {
      setBusyId(null);
    }
  };

  // ---------------- Payment-proof review ----------------

  /** Indexes pending verifications by invoice so the ledger can flag them. */
  const pendingProofOf = useMemo(() => {
    const index = {};
    verifications.forEach((verification) => {
      index[verification.invoiceId] = verification;
    });
    return index;
  }, [verifications]);

  const openReview = (verification) => {
    setReviewing(verification);
    setReviewNote('');
    setReviewError('');
  };

  const closeReview = () => {
    setReviewing(null);
    setReviewNote('');
    setReviewError('');
    setReviewBusy(null);
  };

  const approveReview = async () => {
    if (!reviewing) return;
    setReviewBusy('approve');
    setReviewError('');
    try {
      const note = reviewNote.trim();
      await api.post(`/payment-verifications/${reviewing.id}/approve`, note ? { note } : {});
      toast.success(`${reviewing.invoiceNumber} verified — payment recorded and order released.`);
      closeReview();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not approve the payment proof.');
    } finally {
      setReviewBusy(null);
    }
  };

  const rejectReview = async () => {
    if (!reviewing) return;
    if (!reviewNote.trim()) {
      setReviewError('A reason is required to reject a payment proof.');
      return;
    }
    setReviewBusy('reject');
    setReviewError('');
    try {
      await api.post(`/payment-verifications/${reviewing.id}/reject`, { note: reviewNote.trim() });
      toast.success('Proof rejected — the customer has been notified and can resubmit.');
      closeReview();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reject the payment proof.');
    } finally {
      setReviewBusy(null);
    }
  };

  const totalShown = wizard
    ? (toNumber(fields.subtotal) || 0) + (toNumber(fields.taxAmount) || 0) - (toNumber(fields.discountAmount) || 0)
    : 0;

  const stepTitles = ['Review tailor estimate', 'Amounts & payment', 'Preview & issue'];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {subtitle || 'Turn tailor estimates into invoices, then track payments to release orders.'}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Receipt}
          tone="violet"
          label="Pending invoices (issued)"
          value={loading ? '…' : stats.pendingCount}
          hint={loading ? '' : `Worth ${formatMoney(stats.pendingTotal)}`}
        />
        <StatCard
          icon={Banknote}
          tone="emerald"
          label="Revenue collected"
          value={loading ? '…' : formatMoney(stats.revenue)}
          hint="From paid invoices"
        />
        <StatCard
          icon={AlertTriangle}
          tone="red"
          label="Overdue invoices"
          value={loading ? '…' : stats.overdueCount}
          hint={loading ? '' : stats.overdueCount ? `Worth ${formatMoney(stats.overdueTotal)}` : 'Nothing overdue'}
        />
      </div>

      {/* Payment-proof review queue */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-700">Payment proof to verify</h2>
              <p className="text-xs text-gray-400">
                Customers who say they have paid upload a screenshot and a message here. Verify before recording
                the payment.
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              verifications.length ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {verifications.length} pending
          </span>
        </div>

        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">Loading payment proofs…</p>
        ) : verifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
            <BadgeCheck className="mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm text-gray-500">No payment proofs awaiting review — all clear.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {verifications.map((verification) => (
              <div key={verification.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <button
                  type="button"
                  onClick={() => openReview(verification)}
                  className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                  aria-label={`View proof screenshot for ${verification.invoiceNumber}`}
                >
                  <img
                    src={mediaUrl(verification.screenshotUrl)}
                    alt="Payment proof screenshot"
                    className="h-full w-full object-cover"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-800">
                    {verification.invoiceNumber} — {verification.customerName || 'Customer'}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    Order #{verification.orderId} · {verification.orderTitle} · due {formatDate(verification.dueDate)}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs italic text-gray-500">&ldquo;{verification.message}&rdquo;</p>
                  <p className="text-xs text-gray-400">Submitted {formatDateTime(verification.submittedAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold text-gray-800">{formatMoney(verification.totalAmount)}</p>
                  <button
                    type="button"
                    onClick={() => openReview(verification)}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Orders awaiting invoice */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-gray-700">Orders awaiting invoice</h2>
            <p className="text-xs text-gray-400">
              Estimated orders waiting for the cashier to issue a document.
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
            {awaiting.length} · {formatMoney(awaitingTotal)}
          </span>
        </div>

        {loading ? (
          <p className="px-5 py-12 text-center text-sm text-gray-400">Loading orders…</p>
        ) : awaiting.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">
            No estimated orders waiting — all clear.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {awaiting.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-800">
                    #{order.id} — {order.title || order.garmentType || 'Tailoring request'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {order.customerName || 'Customer'} · {order.garmentType || 'Garment'} ·{' '}
                    {order.fabricType || 'fabric unspecified'}
                  </p>
                  <p className="text-xs text-gray-400">
                    Tailor estimate {formatMoney(order.estimatedPrice)} · ready by{' '}
                    {formatDate(order.estimatedCompletionDate)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openWizardForOrder(order)}
                  className={`${primaryBtn} bg-violet-600 hover:bg-violet-700`}
                >
                  <Plus className="h-4 w-4" />
                  Generate invoice
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoice ledger */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-gray-700">Invoice ledger</h2>
            <p className="text-xs text-gray-400">
              Drafts can still be edited; issued documents are only payable or overdue.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === tab ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab === 'ALL' ? 'All' : INVOICE_STATUS_META[tab].label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="px-5 py-20 text-center text-sm text-gray-400">Loading invoices…</p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-20 text-center">
            <FileText className="mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-600">No invoices here</p>
            <p className="mt-1 text-sm text-gray-400">
              {filter === 'ALL'
                ? 'Invoices you generate will appear in this ledger.'
                : `No invoices with the "${INVOICE_STATUS_META[filter].label}" status.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-5 py-3 font-medium">Invoice</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Due</th>
                  <th className="px-5 py-3 font-medium text-right">Total</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-800">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-gray-400">
                        Order #{invoice.orderId} — {invoice.orderTitle}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(invoice.createdAt)}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{invoice.customerName || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={invoice.status === 'OVERDUE' ? 'font-medium text-red-600' : 'text-gray-600'}>
                        {formatDate(invoice.dueDate)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-800">
                      {formatMoney(invoice.totalAmount)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <InvoiceStatusBadge status={invoice.status} />
                        {pendingProofOf[invoice.id] && (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                            Proof submitted
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {invoice.status === 'DRAFT' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openWizardForDraft(invoice)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              Continue draft
                            </button>
                            <button
                              type="button"
                              disabled={busyId === invoice.id}
                              onClick={() => setDiscarding(invoice)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Discard
                            </button>
                          </>
                        )}
                        {(invoice.status === 'ISSUED' || invoice.status === 'OVERDUE') && (
                          <>
                            {pendingProofOf[invoice.id] ? (
                              <button
                                type="button"
                                onClick={() => openReview(pendingProofOf[invoice.id])}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Review proof
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPaying(invoice)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                              >
                                <BadgeCheck className="h-3.5 w-3.5" />
                                Record payment
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setViewing(invoice)}
                              className="rounded-lg border border-gray-300 p-1.5 text-gray-500 transition hover:bg-gray-50"
                              aria-label={`View ${invoice.invoiceNumber}`}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        {(invoice.status === 'PAID' || invoice.status === 'CANCELLED') && (
                          <button
                            type="button"
                            onClick={() => setViewing(invoice)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------- Generate / edit wizard ---------------- */}
      <Modal open={Boolean(wizard)} title="Invoice wizard" onClose={closeWizard} wide>
        {wizard && (
          <div>
            {/* Steps */}
            <div className="mb-5 flex items-center">
              {stepTitles.map((label, index) => {
                const number = index + 1;
                const active = step === number;
                const done = number < step;
                return (
                  <div key={label} className={`flex items-center ${index > 0 ? 'flex-1' : ''}`}>
                    {index > 0 && (
                      <div className={`mx-2 h-0.5 flex-1 ${done ? 'bg-gray-800' : 'bg-gray-200'}`} />
                    )}
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          done ? 'bg-gray-800 text-white' : active ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {done ? '✓' : number}
                      </span>
                      <span className={`hidden text-xs font-medium sm:block ${active ? 'text-gray-800' : 'text-gray-400'}`}>
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {wizardError && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{wizardError}</div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-400">Order #{wizard.order.id}</p>
                  <h3 className="font-semibold text-gray-800">
                    {wizard.order.title || wizard.order.garmentType || 'Tailoring request'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Customer: <span className="text-gray-700">{wizard.order.customerName || '—'}</span>
                  </p>
                  {wizard.order.description && (
                    <p className="mt-2 text-sm text-gray-500">{wizard.order.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-gray-500">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">
                      Garment: {wizard.order.garmentType || '—'}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">
                      Fabric: {wizard.order.fabricType || '—'}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5">
                      Preferred delivery: {formatDate(wizard.order.preferredDeliveryDate)}
                    </span>
                  </div>
                </div>

                {wizard.order.estimatedPrice != null && (
                  <div className="rounded-xl border border-gray-200 p-4">
                    <h4 className="text-sm font-semibold text-gray-700">Tailor estimate</h4>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">Estimated price</p>
                        <p className="font-semibold text-gray-800">{formatMoney(wizard.order.estimatedPrice)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Estimated completion</p>
                        <p className="font-semibold text-gray-800">{formatDate(wizard.order.estimatedCompletionDate)}</p>
                      </div>
                    </div>
                    {wizard.order.termsAndPolicy && (
                      <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
                        <span className="font-medium text-gray-600">Terms:</span> {wizard.order.termsAndPolicy}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={advanceFromReview}
                    className={`${primaryBtn} bg-violet-600 hover:bg-violet-700`}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {draftId ? 'Continue to amounts' : 'Start invoice draft'}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass} htmlFor="inv-subtotal">Subtotal (PKR)</label>
                  <input
                    id="inv-subtotal"
                    type="number"
                    min="0"
                    step="0.01"
                    value={fields.subtotal ?? ''}
                    onChange={(e) => setFields({ ...fields, subtotal: e.target.value })}
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-gray-400">Defaults to the tailor&apos;s estimated price.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} htmlFor="inv-tax">Tax amount (PKR)</label>
                    <input
                      id="inv-tax"
                      type="number"
                      min="0"
                      step="0.01"
                      value={fields.taxAmount ?? ''}
                      onChange={(e) => setFields({ ...fields, taxAmount: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="inv-discount">Discount (PKR)</label>
                    <input
                      id="inv-discount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={fields.discountAmount ?? ''}
                      onChange={(e) => setFields({ ...fields, discountAmount: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass} htmlFor="inv-due">Payment due date</label>
                  <input
                    id="inv-due"
                    type="date"
                    min={localIso(0)}
                    value={fields.dueDate || ''}
                    onChange={(e) => setFields({ ...fields, dueDate: e.target.value })}
                    className={inputClass}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Invoices unpaid by this date are flagged overdue.
                  </p>
                </div>

                <div>
                  <label className={labelClass} htmlFor="inv-instructions">Payment instructions</label>
                  <textarea
                    id="inv-instructions"
                    rows={3}
                    value={fields.paymentInstructions || ''}
                    onChange={(e) => setFields({ ...fields, paymentInstructions: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. Bank transfer to ACC 0123-456789-01 (Meezan Bank), account title AM Developers. Use the invoice number as the payment reference."
                  />
                  <p className="mt-1 text-xs text-gray-400">Shown to the customer so they know how to pay.</p>
                </div>

                <div className="flex justify-between">
                  <button type="button" onClick={() => setStep(1)} className={secondaryBtn}>
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                  <button type="button" disabled={saving} onClick={advanceToPreview} className={`${primaryBtn} bg-violet-600 hover:bg-violet-700`}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save &amp; preview
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Invoice</p>
                      <p className="text-lg font-bold text-gray-800">{draftId ? 'Draft invoice' : 'New invoice'}</p>
                    </div>
                    <InvoiceStatusBadge status="DRAFT" />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Order #{wizard.order.id} — {wizard.order.title || wizard.order.garmentType || 'Tailoring request'}
                  </p>
                  <p className="text-sm text-gray-500">Customer: {wizard.order.customerName || '—'}</p>
                  <p className="text-sm text-gray-500">Due {formatDate(fields.dueDate)}</p>
                </div>

                <MoneyBreakdown
                  invoice={{ subtotal: fields.subtotal, taxAmount: fields.taxAmount, discountAmount: fields.discountAmount }}
                />

                {fields.paymentInstructions ? (
                  <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                    <p className="font-semibold text-gray-700">Payment instructions</p>
                    <p className="mt-1 whitespace-pre-line">{fields.paymentInstructions}</p>
                  </div>
                ) : null}

                <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Issuing makes this invoice payable and locks the amounts. The customer will be asked to pay{' '}
                  <b>{formatMoney(Math.max(0, totalShown))}</b> before production starts.
                </div>

                <div className="flex justify-between">
                  <button type="button" onClick={() => setStep(2)} className={secondaryBtn}>
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                  <button type="button" disabled={saving} onClick={issueInvoice} className={`${primaryBtn} bg-emerald-600 hover:bg-emerald-700`}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                    Issue invoice
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ---------------- Record payment ---------------- */}
      <Modal
        open={Boolean(paying)}
        title="Confirm payment receipt"
        onClose={() => setPaying(null)}
      >
        {paying && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Confirm that the customer has paid{' '}
              <b>{formatMoney(paying.totalAmount)}</b> for{' '}
              <b>{paying.invoiceNumber}</b> (order #{paying.orderId}).
            </p>
            <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500">
              <p>Due date: {formatDate(paying.dueDate)}</p>
              <p>Status: <InvoiceStatusBadge status={paying.status} /></p>
            </div>
            <p className="text-xs text-gray-400">
              Recording the payment marks the invoice paid and automatically releases the order to the tailor to start production.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setPaying(null)} className={`${secondaryBtn} flex-1`}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === paying.id}
                onClick={() => recordPayment(paying)}
                className={`${primaryBtn} flex-1 bg-emerald-600 hover:bg-emerald-700`}
              >
                {busyId === paying.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                Confirm payment
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- Discard draft ---------------- */}
      <Modal
        open={Boolean(discarding)}
        title="Discard draft invoice?"
        onClose={() => setDiscarding(null)}
      >
        {discarding && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Discard <b>{discarding.invoiceNumber}</b> for order #{discarding.orderId}? The order will be returned to
              the &ldquo;awaiting invoice&rdquo; queue so you can start again.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDiscarding(null)} className={`${secondaryBtn} flex-1`}>
                Keep draft
              </button>
              <button
                type="button"
                disabled={busyId === discarding.id}
                onClick={() => discardDraft(discarding)}
                className={`${primaryBtn} flex-1 bg-red-600 hover:bg-red-700`}
              >
                {busyId === discarding.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Discard
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- View invoice ---------------- */}
      <Modal open={Boolean(viewing)} title="Invoice details" onClose={() => setViewing(null)} wide>
        {viewing && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400">Invoice</p>
                <p className="text-xl font-bold text-gray-800">{viewing.invoiceNumber}</p>
                <p className="text-sm text-gray-500">
                  Order #{viewing.orderId} — {viewing.orderTitle} · {viewing.customerName || '—'}
                </p>
              </div>
              <InvoiceStatusBadge status={viewing.status} />
            </div>

            <MoneyBreakdown
              invoice={{ subtotal: viewing.subtotal, taxAmount: viewing.taxAmount, discountAmount: viewing.discountAmount }}
            />

            <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 sm:grid-cols-3">
              <div>Due date: <span className="text-gray-600">{formatDate(viewing.dueDate)}</span></div>
              <div>Issued by: <span className="text-gray-600">{viewing.issuedBy || '—'}</span></div>
              <div>Issued at: <span className="text-gray-600">{formatDateTime(viewing.issuedAt)}</span></div>
              {viewing.paidAt && (
                <div>Paid at: <span className="text-gray-600">{formatDateTime(viewing.paidAt)}</span></div>
              )}
            </div>

            {viewing.paymentInstructions && (
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <p className="font-semibold text-gray-700">Payment instructions</p>
                <p className="mt-1 whitespace-pre-line">{viewing.paymentInstructions}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ---------------- Review payment proof ---------------- */}
      <Modal
        open={Boolean(reviewing)}
        title={reviewing ? `Review proof — ${reviewing.invoiceNumber}` : 'Review payment proof'}
        onClose={closeReview}
        wide
      >
        {reviewing && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-400">Payment proof</p>
                  <p className="text-lg font-bold text-gray-800">{formatMoney(reviewing.totalAmount)}</p>
                  <p className="text-sm text-gray-500">Order #{reviewing.orderId} — {reviewing.orderTitle}</p>
                  <p className="text-xs text-gray-400">
                    {reviewing.customerName || 'Customer'} · submitted {formatDateTime(reviewing.submittedAt)}
                  </p>
                </div>
                <InvoiceStatusBadge status={reviewing.invoiceStatus} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">Customer&apos;s message</p>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  <p className="whitespace-pre-line">{reviewing.message}</p>
                </div>
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Only approve if the screenshot clearly shows a payment matching{' '}
                  {formatMoney(reviewing.totalAmount)} for {reviewing.invoiceNumber}.
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">Payment screenshot</p>
                <a href={mediaUrl(reviewing.screenshotUrl)} target="_blank" rel="noreferrer">
                  <img
                    src={mediaUrl(reviewing.screenshotUrl)}
                    alt={`Payment proof for ${reviewing.invoiceNumber}`}
                    className="w-full rounded-xl border border-gray-200 object-contain"
                  />
                </a>
              </div>
            </div>

            <div>
              <label className={labelClass} htmlFor="review-note">
                Review note
              </label>
              <textarea
                id="review-note"
                rows={2}
                value={reviewNote}
                onChange={(e) => {
                  setReviewNote(e.target.value);
                  setReviewError('');
                }}
                className={inputClass}
                placeholder="Optional when approving — required when rejecting (the note is shown to the customer)."
              />
              {reviewError && <p className="mt-1 text-sm text-red-600">{reviewError}</p>}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={closeReview} className={`${secondaryBtn} flex-1`}>
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(reviewBusy)}
                onClick={rejectReview}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                {reviewBusy === 'reject' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Reject proof
              </button>
              <button
                type="button"
                disabled={Boolean(reviewBusy)}
                onClick={approveReview}
                className={`${primaryBtn} flex-1 bg-emerald-600 hover:bg-emerald-700`}
              >
                {reviewBusy === 'approve' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BadgeCheck className="h-4 w-4" />
                )}
                Approve &amp; mark paid
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

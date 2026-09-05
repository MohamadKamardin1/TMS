import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  CalendarDays,
  Check,
  CircleDot,
  Clock,
  Image as ImageIcon,
  Lock,
  MessageSquareHeart,
  PackageSearch,
  Receipt,
  Ruler,
  Scissors,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import api, { mediaUrl } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import StatusBadge from '../../components/StatusBadge';
import InvoiceStatusBadge from '../../components/InvoiceStatusBadge';
import StarRating from '../../components/StarRating';
import FeedbackForm from '../../components/FeedbackForm';
import { LoadingBlock, BTN_SECONDARY, BTN_PRIMARY } from '../../components/ui';
import { formatDate, formatDateTime, formatMoney } from '../../utils/format';

const JOURNEY = [
  { status: 'PENDING_REVIEW', label: 'Requested', hint: 'Waiting for a tailor to review' },
  { status: 'ESTIMATED', label: 'Estimated', hint: 'Price and timeline confirmed' },
  { status: 'INVOICED', label: 'Invoiced', hint: 'An invoice was prepared' },
  { status: 'PAID', label: 'Paid', hint: 'Payment received' },
  { status: 'IN_PROGRESS', label: 'In production', hint: 'Your garment is being made' },
  { status: 'READY_FOR_DELIVERY', label: 'Ready', hint: 'Ready for pickup / delivery' },
  { status: 'OUT_FOR_DELIVERY', label: 'On the way', hint: 'A delivery agent is bringing it' },
  { status: 'DELIVERED', label: 'Delivered', hint: 'Handed over — thanks!' },
];

function humanize(key) {
  return String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function SectionCard({ icon: Icon, title, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          {Icon && <Icon className="h-4 w-4 text-gray-400" />}
          {title}
        </h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-800">{value || '—'}</span>
    </div>
  );
}

function JourneyTimeline({ status }) {
  const currentIndex = JOURNEY.findIndex((s) => s.status === status);
  return (
    <ol className="space-y-0">
      {JOURNEY.map((step, i) => {
        const done = currentIndex >= 0 && i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={step.status} className="relative flex gap-3 pb-5 last:pb-0">
            {i < JOURNEY.length - 1 && (
              <span
                className={`absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-0.5 ${
                  done || current ? 'bg-emerald-200' : 'bg-gray-100'
                }`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ${
                done
                  ? 'bg-emerald-500 text-white ring-emerald-100'
                  : current
                    ? 'bg-gray-800 text-white ring-gray-200'
                    : 'bg-white text-gray-300 ring-gray-200'
              }`}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : <CircleDot className="h-3 w-3" />}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-sm font-medium ${current || done ? 'text-gray-800' : 'text-gray-400'}`}>
                {step.label}
              </p>
              <p className="text-xs text-gray-400">{step.hint}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useAuth();

  const [order, setOrder] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.data);
    } catch (err) {
      setLoadError(err.response?.data?.message || 'This order could not be loaded.');
      return;
    } finally {
      setLoading(false);
    }

    // Feedback + invoice are best-effort reads on the same order.
    try {
      const fb = await api.get(`/feedback/order/${id}`);
      setFeedback(fb.data?.data || null);
    } catch {
      setFeedback(null);
    }
    try {
      const inv = await api.get(`/invoices/my-order/${id}`);
      setInvoice(inv.data?.data || null);
    } catch {
      setInvoice(null);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const displayTitle = useMemo(
    () => order?.title || order?.garmentType || `Order #${order?.id}`,
    [order],
  );

  const measurementRows = useMemo(() => {
    const map = order?.measurements || {};
    return Object.entries(map).filter(([key, value]) => key && value != null && value !== '');
  }, [order]);

  if (loading) {
    return <LoadingBlock label="Loading order details…" />;
  }

  if (loadError || !order) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <PackageSearch className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-700">{loadError || 'Order not found.'}</p>
        <button type="button" onClick={() => navigate('/customer/dashboard')} className={`${BTN_PRIMARY} mt-5`}>
          Back to my orders
        </button>
      </div>
    );
  }

  const alreadyReviewed = Boolean(feedback?.rating);
  const showFeedbackForm = order.status === 'DELIVERED' && !alreadyReviewed;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">{displayTitle}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Order #{order.id} · placed {formatDate(order.createdAt)}
            {order.estimatedCompletionDate && ` · tailor estimate ready ${formatDate(order.estimatedCompletionDate)}`}
          </p>
        </div>
        {role === 'CUSTOMER' && (
          <Link to="/customer/orders" className={BTN_SECONDARY}>
            <Receipt className="h-4 w-4" />
            All orders
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* -------- Left column: what was requested -------- */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard icon={Scissors} title="Request details">
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-sm font-medium text-gray-700">Garment</p>
                <div className="flex flex-wrap gap-2">
                  {order.garmentType && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {order.garmentType}
                    </span>
                  )}
                  {order.fabricType && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {order.fabricType}
                    </span>
                  )}
                </div>
              </div>

              {order.description && (
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700">Description</p>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{order.description}</p>
                </div>
              )}

              {order.styleDetails && (
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700">Style details</p>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{order.styleDetails}</p>
                </div>
              )}

              <InfoRow label="Preferred delivery" value={formatDate(order.preferredDeliveryDate)} />
              {order.specialInstructions && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    Special instructions
                  </p>
                  <p className="whitespace-pre-line text-sm text-amber-800">{order.specialInstructions}</p>
                </div>
              )}
            </div>
          </SectionCard>

          {measurementRows.length > 0 && (
            <SectionCard icon={Ruler} title="Measurements">
              <dl className="grid grid-cols-2 gap-x-8 sm:grid-cols-3">
                {measurementRows.map(([key, value]) => (
                  <div key={key} className="border-b border-gray-100 py-2.5 last:border-0">
                    <dt className="text-xs text-gray-400">{humanize(key)}</dt>
                    <dd className="text-sm font-medium text-gray-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </SectionCard>
          )}

          {order.attachments?.length > 0 && (
            <SectionCard icon={ImageIcon} title="Reference images">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {order.attachments.map((file) => (
                  <a
                    key={file.id}
                    href={mediaUrl(file.fileUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                    title={file.fileName || 'Reference image'}
                  >
                    <img
                      src={mediaUrl(file.fileUrl)}
                      alt={file.fileName || 'Reference image'}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        {/* -------- Right column: progress + money + team -------- */}
        <div className="space-y-6">
          <SectionCard icon={Clock} title="Progress">
            <JourneyTimeline status={order.status} />
            {order.status === 'CANCELLED' && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">This order was cancelled.</p>
            )}
          </SectionCard>

          {order.estimatedPrice != null && (
            <SectionCard icon={Receipt} title="Estimate">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-gray-400">Estimated price</p>
                  <p className="text-2xl font-bold text-gray-800">{formatMoney(order.estimatedPrice)}</p>
                </div>
                {order.estimatedCompletionDate && (
                  <div className="text-right">
                    <p className="flex items-center justify-end gap-1 text-xs text-gray-400">
                      <CalendarDays className="h-3.5 w-3.5" /> Ready by
                    </p>
                    <p className="text-sm font-semibold text-gray-700">{formatDate(order.estimatedCompletionDate)}</p>
                  </div>
                )}
              </div>
              {order.termsAndPolicy && (
                <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2">
                  <p className="text-xs font-medium text-gray-500">Terms &amp; policy</p>
                  <p className="mt-0.5 whitespace-pre-line text-xs text-gray-600">{order.termsAndPolicy}</p>
                </div>
              )}
            </SectionCard>
          )}

          {(order.tailorName || order.deliveryName) && (
            <SectionCard icon={ShieldCheck} title="Team">
              <div className="space-y-3 text-sm">
                {order.tailorName && (
                  <InfoRow label="Tailor" value={order.tailorName} />
                )}
                {order.deliveryName && (
                  <InfoRow label="Delivery" value={order.deliveryName} />
                )}
              </div>
            </SectionCard>
          )}

          {invoice && (
            <SectionCard icon={Receipt} title="Invoice">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">{invoice.invoiceNumber || '—'}</span>
                <InvoiceStatusBadge status={invoice.status} />
              </div>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-gray-500">Total payable</span>
                  <span className="font-bold text-gray-800">{formatMoney(invoice.totalAmount)}</span>
                </div>
                {invoice.status === 'DRAFT' ? (
                  <div className="px-3 py-2 text-xs text-gray-400">
                    Invoice still being prepared — payment will open once issued.
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-400">
                    <span>Due {formatDate(invoice.dueDate)}</span>
                    {invoice.status === 'PAID' && invoice.paidAt && <span>Paid {formatDate(invoice.paidAt)}</span>}
                  </div>
                )}
              </div>
              {(invoice.status === 'ISSUED' || invoice.status === 'OVERDUE') && (
                <Link to="/customer/dashboard" className={`${BTN_PRIMARY} mt-3 w-full`}>
                  <BadgeCheck className="h-4 w-4" />
                  Manage payment
                </Link>
              )}
            </SectionCard>
          )}
        </div>
      </div>

      {/* -------- Feedback -------- */}
      <div className="mt-6">
        {showFeedbackForm ? (
          <SectionCard icon={MessageSquareHeart} title="Leave feedback" className="border-emerald-200">
            <div className="mx-auto max-w-xl text-center">
              <p className="mb-1 text-sm font-medium text-gray-800">How was your experience?</p>
              <p className="mb-5 text-sm text-gray-400">
                A quick star rating helps other customers and gives your tailor the recognition they deserve.
              </p>
              <FeedbackForm
                orderId={order.id}
                onSuccess={() => {
                  setFeedback((prev) => ({ ...(prev || {}), orderId: order.id }));
                  load();
                }}
              />
            </div>
          </SectionCard>
        ) : alreadyReviewed ? (
          <SectionCard icon={BadgeCheck} title="Your review">
            <div className="flex flex-col items-center gap-2 text-center">
              <StarRating value={feedback.rating} size="lg" readOnly showValue />
              {feedback.comments && (
                <p className="max-w-xl text-sm italic leading-relaxed text-gray-600">“{feedback.comments}”</p>
              )}
              <p className="text-xs text-gray-400">Submitted {formatDateTime(feedback.createdAt)}</p>
            </div>
          </SectionCard>
        ) : (
          <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-5 py-6 text-sm text-gray-400">
            <Lock className="h-4 w-4 text-gray-300" aria-hidden="true" />
            {order.status === 'CANCELLED'
              ? 'This order was cancelled, so feedback is not available.'
              : 'Feedback opens once your order is delivered — thank you for your patience!'}
          </div>
        )}
      </div>
    </div>
  );
}


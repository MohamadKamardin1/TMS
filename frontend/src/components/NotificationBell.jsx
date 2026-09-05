import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  PackageCheck,
  Receipt,
  Ruler,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';

const TONES = {
  violet: 'bg-violet-50 text-violet-600',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-gray-100 text-gray-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
};

function item(id, icon, tone, title, subtitle, to) {
  return { id, icon, tone: TONES[tone] || TONES.gray, title, subtitle, to };
}

const plural = (n) => (n === 1 ? '' : 's');

/**
 * Fetches role-appropriate operational alerts straight from the endpoints the
 * dashboards already use, so the bell always shows live, clickable work: payment
 * proofs for staff, drafts/overdue invoices for billing, dispatch/confirm queues
 * for delivery, estimation/production items for tailors and delivered orders the
 * customer has not yet rated.
 */
async function buildNotifications(role) {
  const to = `/${role.toLowerCase()}/dashboard`;
  const adminTo = role === 'ADMIN' ? '/admin/invoices' : to;

  if (role === 'ADMIN' || role === 'CASHIER') {
    const [{ data: pvRes }, { data: invoiceRes }] = await Promise.all([
      api.get('/payment-verifications'),
      api.get('/invoices'),
    ]);
    const proofs = (pvRes.data || []).filter((p) => p.status === 'PENDING').length;
    const overdue = (invoiceRes.data || []).filter((i) => i.status === 'OVERDUE').length;
    const drafts = (invoiceRes.data || []).filter((i) => i.status === 'DRAFT').length;

    const out = [];
    if (proofs > 0) {
      out.push(item('proofs', ShieldCheck, 'violet', `${proofs} payment proof${plural(proofs)} to verify`,
        'Customers waiting on confirmation', adminTo));
    }
    if (overdue > 0) {
      out.push(item('overdue', Receipt, 'red', `${overdue} invoice${plural(overdue)} overdue`,
        'Follow up to collect payment', adminTo));
    }
    if (drafts > 0) {
      out.push(item('drafts', Receipt, 'gray', `${drafts} draft invoice${plural(drafts)} to finalize`,
        'Finish and issue them', adminTo));
    }
    return out;
  }

  if (role === 'DELIVERY') {
    const { data } = await api.get('/orders');
    const ready = (data.data || []).filter((o) => o.status === 'READY_FOR_DELIVERY').length;
    const enRoute = (data.data || []).filter((o) => o.status === 'OUT_FOR_DELIVERY').length;
    const out = [];
    if (ready > 0) {
      out.push(item('dispatch', Truck, 'indigo', `${ready} order${plural(ready)} ready to dispatch`,
        'Pick them up from the shop', to));
    }
    if (enRoute > 0) {
      out.push(item('confirm', PackageCheck, 'emerald', `${enRoute} order${plural(enRoute)} out for delivery`,
        'Confirm hand-over with the customer', to));
    }
    return out;
  }

  if (role === 'TAILOR') {
    const { data } = await api.get('/orders');
    const toEstimate = (data.data || []).filter((o) => o.status === 'PENDING_REVIEW').length;
    const inProduction = (data.data || []).filter((o) => o.status === 'IN_PROGRESS').length;
    const out = [];
    if (toEstimate > 0) {
      out.push(item('estimate', Ruler, 'amber', `${toEstimate} order${plural(toEstimate)} awaiting your estimate`,
        'Add a price and timeline', to));
    }
    if (inProduction > 0) {
      out.push(item('produce', Sparkles, 'sky', `${inProduction} order${plural(inProduction)} in production`,
        'Mark them ready when complete', to));
    }
    return out;
  }

  if (role === 'CUSTOMER') {
    const { data } = await api.get('/orders');
    const delivered = (data.data || []).filter((o) => o.status === 'DELIVERED').length;
    const inProgress = (data.data || []).filter((o) =>
      ['PENDING_REVIEW', 'ESTIMATED', 'INVOICED', 'PAID', 'IN_PROGRESS'].includes(o.status),
    ).length;
    const out = [];
    if (delivered > 0) {
      out.push(item('review', Star, 'amber', `${delivered} order${plural(delivered)} delivered`,
        'Rate your experience — it takes 10 seconds', to));
    }
    if (inProgress > 0) {
      out.push(item('progress', Sparkles, 'sky', `${inProgress} order${plural(inProgress)} in progress`,
        'Follow status updates here', to));
    }
    return out;
  }

  return [];
}

export default function NotificationBell() {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadedForRole, setLoadedForRole] = useState(null);
  const panelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    try {
      setItems(await buildNotifications(role));
      setLoadedForRole(role);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    // Role changes while signed in (admin self-switch) invalidate the cache.
    if (loadedForRole && loadedForRole !== role) {
      setItems([]);
      setLoadedForRole(null);
    }
  }, [role, loadedForRole]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && loadedForRole !== role) refresh();
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={toggle}
        className="relative rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
        aria-label={`Notifications${items.length ? ` (${items.length} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {items.length > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {items.length > 9 ? '9+' : items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="text-sm font-semibold text-gray-800">Notifications</p>
            <button
              type="button"
              onClick={refresh}
              className="text-xs font-medium text-gray-400 transition hover:text-gray-600"
            >
              Refresh
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-gray-400">
                <Spinner label="Loading…" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <CheckCheck className="h-8 w-8 text-gray-200" />
                <p className="text-sm font-medium text-gray-600">You’re all caught up</p>
                <p className="text-xs text-gray-400">Nothing needs your attention right now.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {items.map(({ id, icon: Icon, tone, title, subtitle, to }) => (
                  <li key={id}>
                    <Link
                      to={to}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 transition hover:bg-gray-50"
                    >
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-800">{title}</span>
                        <span className="block text-xs text-gray-400">{subtitle}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

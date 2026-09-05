import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, RefreshCw, Search, ScrollText } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import { formatDateTime } from '../../utils/format';

const ACTION_META = {
  ORDER_CREATED: { label: 'Order created', tone: 'bg-sky-50 text-sky-700' },
  ORDER_TAILOR_ASSIGNED: { label: 'Tailor assigned', tone: 'bg-sky-100 text-sky-800' },
  ORDER_ESTIMATED: { label: 'Order estimated', tone: 'bg-indigo-100 text-indigo-800' },
  ORDER_DELIVERY_ASSIGNED: { label: 'Delivery assigned', tone: 'bg-sky-100 text-sky-800' },
  ORDER_STATUS_CHANGED: { label: 'Order status changed', tone: 'bg-sky-50 text-sky-700' },
  INVOICE_GENERATED: { label: 'Invoice generated', tone: 'bg-violet-100 text-violet-800' },
  INVOICE_UPDATED: { label: 'Invoice updated', tone: 'bg-violet-50 text-violet-700' },
  INVOICE_ISSUED: { label: 'Invoice issued', tone: 'bg-violet-100 text-violet-800' },
  INVOICE_PAID: { label: 'Payment recorded', tone: 'bg-emerald-100 text-emerald-800' },
  INVOICE_DISCARDED: { label: 'Draft discarded', tone: 'bg-rose-100 text-rose-700' },
  INVOICE_MARKED_OVERDUE: { label: 'Marked overdue', tone: 'bg-amber-100 text-amber-800' },
  USER_ROLE_CHANGED: { label: 'Role changed', tone: 'bg-indigo-100 text-indigo-800' },
  USER_STATUS_CHANGED: { label: 'Account status changed', tone: 'bg-amber-100 text-amber-800' },
  USER_PASSWORD_RESET: { label: 'Password reset', tone: 'bg-rose-100 text-rose-800' },
};

const ENTITY_LABELS = { ORDER: 'Order', INVOICE: 'Invoice', USER: 'User' };

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200';

function actionMeta(action) {
  return (
    ACTION_META[action] || {
      label: prettyAction(action),
      tone: 'bg-gray-100 text-gray-700',
    }
  );
}

function prettyAction(action) {
  if (!action) return action;
  return action
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function prettyKey(key) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
}

function formatValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/**
 * Keys whose value changed between the old and new snapshots. Equal fields are
 * omitted so each row reads as a focused before → after diff.
 */
function changedKeys(oldValues, newValues) {
  const oldMap = oldValues || {};
  const newMap = newValues || {};
  const keys = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
  const changed = [];
  keys.forEach((key) => {
    const before = oldMap[key] ?? null;
    const after = newMap[key] ?? null;
    if (JSON.stringify(before) !== JSON.stringify(after)) changed.push(key);
  });
  return changed;
}

function ValueCell({ values, keys, missing }) {
  if (keys.length === 0) {
    return <span className="text-gray-300">{missing}</span>;
  }
  return (
    <div className="space-y-1">
      {keys.map((key) => (
        <div key={key} className="flex gap-2 text-xs leading-5">
          <span className="w-24 shrink-0 text-gray-400">{prettyKey(key)}</span>
          <span className="break-all text-gray-700">{formatValue(values?.[key])}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Read-only audit ledger. Every row is an immutable before/after snapshot of a
 * state change across orders, invoices and user accounts — including who did it
 * and when. Writes never happen here; the services record entries themselves.
 */
export default function AuditLogs() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/audit-logs');
      setLogs(data.data || []);
    } catch {
      toast.error('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const actionOptions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.action))).sort(),
    [logs],
  );
  const entityOptions = useMemo(
    () => Array.from(new Set(logs.map((log) => log.entityType))).sort(),
    [logs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) return false;
      if (entityFilter && log.entityType !== entityFilter) return false;
      if (q) {
        const haystack = [
          log.actorName,
          log.action,
          log.entityType,
          log.entityId,
        ]
          .filter((v) => v != null)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, actionFilter, entityFilter]);

  const resetFilters = () => {
    setSearch('');
    setActionFilter('');
    setEntityFilter('');
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <ScrollText className="h-6 w-6 text-gray-400" />
            Audit logs
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Every state change across orders, invoices and accounts ({logs.length} entries).
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-gray-500">Search</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className={`${inputClass} pl-8`}
              placeholder="Who, action, entity…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Action</span>
          <select className={inputClass} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">All actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Entity</span>
          <div className="flex gap-2">
            <select className={inputClass} value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
              <option value="">All entities</option>
              {entityOptions.map((entity) => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
            {(search || actionFilter || entityFilter) && (
              <button
                type="button"
                onClick={resetFilters}
                className="shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 text-gray-500 transition hover:bg-gray-50"
                aria-label="Clear filters"
              >
                <History className="h-4 w-4" />
              </button>
            )}
          </div>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Who</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">On</th>
              <th className="px-4 py-3 font-medium">Old value</th>
              <th className="px-4 py-3 font-medium">New value</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-gray-400">
                  Loading audit trail...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-gray-400">
                  No audit entries match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((log) => {
                const keys = changedKeys(log.oldValues, log.newValues);
                const meta = actionMeta(log.action);
                const entityLabel = ENTITY_LABELS[log.entityType] || log.entityType;
                return (
                  <tr key={log.id} className="border-b border-gray-100 align-top last:border-0 hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{log.actorName || 'System'}</p>
                      <p className="text-xs text-gray-400">{log.actorId ? `#${log.actorId}` : 'automated'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {entityLabel}
                      <span className="text-gray-400">{log.entityId ? ` #${log.entityId}` : ''}</span>
                    </td>
                    <td className="min-w-40 px-4 py-3">
                      <ValueCell values={log.oldValues} keys={keys} missing="—" />
                    </td>
                    <td className="min-w-40 px-4 py-3">
                      <ValueCell values={log.newValues} keys={keys} missing="—" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, PackageOpen, RefreshCw } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import StatusBadge from '../components/StatusBadge';
import { BTN_SECONDARY, DataTable, PAGE_HEADER } from '../components/ui';
import { formatDate, formatMoney } from '../utils/format';

/**
 * Role-filtered order list (the service returns only the orders the current
 * user may see). Customers get a "Details" action into their order page; other
 * roles read the same shared table. Loads on mount with a skeleton, refresh
 * button, empty state and built-in pagination.
 */
export default function Orders() {
  const { role } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders');
      setOrders(data.data || []);
    } catch {
      toast.error('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const showDetails = role === 'CUSTOMER';

  const columns = [
    { label: '#' },
    { label: 'Title' },
    { label: 'Status' },
    { label: 'Est. price' },
    { label: 'Customer' },
    { label: 'Preferred delivery' },
    { label: 'Created' },
    ...(showDetails ? [{ label: '', className: 'text-right' }] : []),
  ];

  const renderRow = (order) => (
    <tr key={order.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-700">#{order.id}</td>
      <td className="max-w-64 px-4 py-3">
        <p className="truncate font-medium text-gray-800">
          {order.title || order.garmentType || 'Tailoring request'}
        </p>
        {order.garmentType && <p className="text-xs text-gray-400">{order.garmentType}</p>}
      </td>
      <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatMoney(order.estimatedPrice)}</td>
      <td className="px-4 py-3 text-gray-600">{order.customerName || '—'}</td>
      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(order.preferredDeliveryDate)}</td>
      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(order.createdAt)}</td>
      {showDetails && (
        <td className="px-4 py-3 text-right">
          <Link
            to={`/customer/orders/${order.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
          >
            Details
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </td>
      )}
    </tr>
  );

  return (
    <div>
      <div className={PAGE_HEADER}>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            All orders in your workspace ({orders.length}).
          </p>
        </div>
        <button type="button" onClick={load} className={BTN_SECONDARY}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={orders}
        loading={loading}
        renderRow={renderRow}
        empty={{
          icon: PackageOpen,
          title: 'No orders yet',
          hint:
            role === 'CUSTOMER'
              ? 'Create your first tailoring order and it will show up here.'
              : 'Orders will appear here once they enter your workspace.',
        }}
      />
    </div>
  );
}

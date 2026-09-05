import { Link, useNavigate } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Invoice management (ADMIN / CASHIER). Placeholder until the invoice CRUD
 * screen is built — generation, payment status updates and per-order lookups
 * are already available on the backend.
 */
export default function Invoices() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const prefix = `/${role.toLowerCase()}`;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">Invoices</h1>
      <p className="mt-1 text-sm text-slate-500">
        Generate invoices for estimated orders and track payments.
      </p>

      <div className="mt-6 flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <Receipt className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-slate-700">Invoice workspace coming soon</h2>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          The backend already exposes invoice generation
          (POST /api/invoices), payment status updates
          (PATCH /api/invoices/{'{id}'}/status) and lookup
          (GET /api/invoices/order/{'{orderId}'}). A dedicated management screen
          will be built on top of these in the next step.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            to="/logout"
            onClick={(event) => {
              event.preventDefault();
              navigate(-1);
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Back
          </Link>
          <Link
            to={`${prefix}/orders`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Review orders
          </Link>
        </div>
      </div>
    </div>
  );
}
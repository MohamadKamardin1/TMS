import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, PlusCircle, Receipt, ScrollText, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Left navigation filtered by the current role. Every role gets a Dashboard
 * and Orders page; the cashier's billing hub lives on their Dashboard, so the
 * separate Invoices, Users and Audit-log sections are ADMIN-only. Only
 * CUSTOMER gets "New order".
 */
export default function Sidebar({ open, onClose }) {
  const { role } = useAuth();
  const prefix = role ? `/${role.toLowerCase()}` : '';

  const links = [
    { to: `${prefix}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
    { to: `${prefix}/orders`, label: 'Orders', icon: Package },
  ];

  if (role === 'CUSTOMER') {
    links.splice(1, 0, { to: `${prefix}/orders/new`, label: 'New order', icon: PlusCircle });
  }

  if (role === 'ADMIN') {
    links.push({ to: `${prefix}/invoices`, label: 'Invoices', icon: Receipt });
    links.push({ to: `${prefix}/users`, label: 'Users', icon: Users });
    links.push({ to: `${prefix}/audit-logs`, label: 'Audit logs', icon: ScrollText });
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed z-40 flex h-full w-64 flex-col border-r border-gray-200 bg-white shadow-lg transition-transform duration-200 lg:static lg:translate-x-0 lg:shadow-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-gray-800 text-white shadow'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-4 text-xs text-gray-400">
          Tailor Management System
        </div>
      </aside>
    </>
  );
}
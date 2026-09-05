import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, Receipt } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Left navigation filtered by the current role. Every role gets a Dashboard
 * and Orders page; only ADMIN and CASHIER get the Invoices section.
 */
export default function Sidebar({ open, onClose }) {
  const { role } = useAuth();
  const prefix = role ? `/${role.toLowerCase()}` : '';

  const links = [
    { to: `${prefix}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
    { to: `${prefix}/orders`, label: 'Orders', icon: Package },
  ];

  if (role === 'ADMIN' || role === 'CASHIER') {
    links.push({ to: `${prefix}/invoices`, label: 'Invoices', icon: Receipt });
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
        className={`fixed z-40 flex h-full w-64 flex-col border-r border-slate-200 bg-white shadow-lg transition-transform duration-200 lg:static lg:translate-x-0 lg:shadow-none ${
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
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4 text-xs text-slate-400">
          Tailor Management System
        </div>
      </aside>
    </>
  );
}
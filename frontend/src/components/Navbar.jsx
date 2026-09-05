import { Menu, Scissors, LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  ADMIN: 'Admin',
  TAILOR: 'Tailor',
  CASHIER: 'Cashier',
  DELIVERY: 'Delivery',
  CUSTOMER: 'Customer',
};

/**
 * Top bar shown inside the authenticated app shell: brand, mobile menu
 * trigger, current user, role badge and a logout button.
 */
export default function Navbar({ onMenu }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-2 text-slate-800">
        <Scissors className="h-6 w-6 text-indigo-600" />
        <span className="text-lg font-semibold tracking-tight">TMS</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-2 sm:flex">
          <div className="rounded-full bg-indigo-100 p-2 text-indigo-600">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium text-slate-800">
              {user?.fullName || user?.username || 'User'}
            </p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[role] || role}</p>
          </div>
        </div>
        {role && (
          <span className="hidden rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 md:inline-block">
            {ROLE_LABELS[role] || role}
          </span>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LayoutDashboard, LogOut, Menu, Scissors } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const ROLE_LABELS = {
  ADMIN: 'Administrator',
  TAILOR: 'Tailor',
  CASHIER: 'Cashier',
  DELIVERY: 'Delivery agent',
  CUSTOMER: 'Customer',
};

function initialsOf(name) {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

/**
 * Top app bar: mobile drawer trigger + brand on the left; on the right the
 * notification bell and a profile menu (avatar, name, role) whose dropdown
 * carries navigation + logout so destructive/account actions live behind a
 * single click, not always on screen.
 */
export default function Navbar({ onMenu }) {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const displayName = user?.fullName || user?.username || 'User';
  const roleLabel = ROLE_LABELS[role] || role || '';
  const dashboardTo = `/${(role || '').toLowerCase()}/dashboard`;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMenu}
        className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 lg:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-800 text-white">
          <Scissors className="h-5 w-5" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-base font-bold tracking-tight text-gray-800">TMS</span>
          <span className="hidden text-xs text-gray-400 sm:block">Tailor Management System</span>
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />

        <div className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" aria-hidden="true" />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition hover:bg-gray-100"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm font-semibold text-white">
              {initialsOf(displayName)}
            </span>
            <span className="hidden min-w-0 text-left leading-tight sm:block">
              <span className="block max-w-40 truncate text-sm font-semibold text-gray-800">{displayName}</span>
              <span className="block text-xs text-gray-400">{roleLabel}</span>
            </span>
            <ChevronDown className={`hidden h-4 w-4 text-gray-400 transition sm:block ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
              <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm font-semibold text-white">
                  {initialsOf(displayName)}
                </span>
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-sm font-semibold text-gray-800">{displayName}</p>
                  <p className="text-xs text-gray-400">{user?.email || roleLabel}</p>
                </div>
              </div>

              <div className="p-1.5">
                {dashboardTo && role && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(dashboardTo);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    <LayoutDashboard className="h-4 w-4 text-gray-400" />
                    Go to dashboard
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

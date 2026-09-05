import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, Scissors } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { label: 'Admin', username: 'admin@gmail.com', password: '123456' },
  { label: 'Tailor', username: 'tailor@gmail.com', password: '123456' },
  { label: 'Cashier', username: 'cashier@gmail.com', password: '123456' },
  { label: 'Delivery', username: 'delivery@gmail.com', password: '123456' },
  { label: 'Customer', username: 'customer@gmail.com', password: '123456' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form);
      navigate(`/${user.role.toLowerCase()}/dashboard`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fill = (username, password) => {
    setForm({ username, password });
    setError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-800 via-gray-700 to-gray-900 p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl lg:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden flex-col justify-between bg-gradient-to-br from-gray-800 to-gray-900 p-10 text-white lg:flex">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-2.5">
              <Scissors className="h-7 w-7" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Tailor Management System</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold leading-tight">
              Order, stitch, deliver — all in one place.
            </h2>
            <p className="mt-3 text-gray-300">
              Manage customer orders, tailoring, invoicing and delivery from a
              single dashboard.
            </p>
          </div>
        </div>

        {/* Form panel */}
        <div className="p-6 sm:p-10">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <Scissors className="h-6 w-6 text-gray-700" />
            <span className="text-xl font-bold text-gray-800">TMS</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-800">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to continue to your dashboard.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="username"
                  type="text"
                  required
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm text-gray-800 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                  placeholder="e.g. customer@gmail.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-sm text-gray-800 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-800 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-medium text-gray-700 hover:underline">
              Register as a customer
            </Link>
          </p>

          <div className="mt-6 border-t border-gray-200 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Demo accounts (seeded)
            </p>
            <div className="flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => fill(account.username, account.password)}
                  className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-300 hover:bg-gray-100 hover:text-gray-700"
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCog,
  UserRound,
} from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../components/Toast';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/format';

const ROLE_OPTIONS = ['CUSTOMER', 'TAILOR', 'CASHIER', 'DELIVERY', 'ADMIN'];

const ROLE_STYLES = {
  CUSTOMER: 'bg-gray-100 text-gray-700',
  TAILOR: 'bg-indigo-100 text-indigo-700',
  CASHIER: 'bg-sky-100 text-sky-700',
  DELIVERY: 'bg-orange-100 text-orange-700',
  ADMIN: 'bg-violet-100 text-violet-700',
};

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200';
const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-50';
const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50';

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

/**
 * Full account directory for the admin. Every user with role + status, plus the
 * three administrative actions (change role, activate/deactivate, reset
 * password) behind explicit confirmations. The backend enforces the lockout
 * guards (self-change, last admin, in-flight assignments) — the UI simply
 * surfaces the error when one applies.
 */
export default function UserManagement() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id;

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [roleModal, setRoleModal] = useState(null); // { user }
  const [roleChoice, setRoleChoice] = useState('');
  const [passwordModal, setPasswordModal] = useState(null); // { user }
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [statusModal, setStatusModal] = useState(null); // { user, nextActive }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data.data || []);
    } catch {
      toast.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const byRole = Object.fromEntries(ROLE_OPTIONS.map((r) => [r, 0]));
    let active = 0;
    users.forEach((u) => {
      if (u.role && byRole[u.role] != null) byRole[u.role] += 1;
      if (u.active) active += 1;
    });
    return { byRole, active, total: users.length };
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && !u.active) return false;
      if (statusFilter === 'inactive' && u.active) return false;
      if (q) {
        const haystack = [u.fullName, u.username, u.email, u.phone, u.role]
          .filter((v) => v != null)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const resetFilters = () => {
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
  };

  const openRoleModal = (user) => {
    setRoleChoice(user.role);
    setRoleModal(user);
  };

  const changeRole = async () => {
    if (!roleModal || roleChoice === roleModal.role) return;
    setBusyId(`${roleModal.id}-role`);
    try {
      const { data } = await api.patch(`/users/${roleModal.id}/role`, { role: roleChoice });
      toast.success(`Role updated to ${data.data.role}.`);
      setRoleModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update the role.');
    } finally {
      setBusyId(null);
    }
  };

  const openPasswordModal = (user) => {
    setNewPassword('');
    setConfirmPassword('');
    setPasswordModal(user);
  };

  const resetPassword = async () => {
    if (!passwordModal) return;
    setBusyId(`${passwordModal.id}-password`);
    try {
      await api.put(`/users/${passwordModal.id}/password`, { newPassword });
      toast.success(`Password reset for ${passwordModal.fullName || passwordModal.username}.`);
      setPasswordModal(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reset the password.');
    } finally {
      setBusyId(null);
    }
  };

  const openStatusToggle = (user) => {
    setStatusModal({ user, nextActive: !user.active });
  };

  const toggleStatus = async () => {
    if (!statusModal) return;
    const { user, nextActive } = statusModal;
    setBusyId(`${user.id}-status`);
    try {
      const { data } = await api.patch(`/users/${user.id}/status`, { active: nextActive });
      toast.success(data.message || (nextActive ? 'Account activated.' : 'Account deactivated.'));
      setStatusModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update account status.');
    } finally {
      setBusyId(null);
    }
  };

  const generatePassword = () => {
    const chars =
      'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const specials = '!@#$%';
    let pw = '';
    for (let i = 0; i < 10; i += 1) {
      pw += chars[Math.floor(Math.random() * chars.length)];
    }
    pw += specials[Math.floor(Math.random() * specials.length)];
    setNewPassword(pw);
    setConfirmPassword(pw);
  };

  const passwordValid =
    newPassword.length >= 8 && newPassword.length <= 64 && newPassword === confirmPassword;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User management</h1>
          <p className="mt-1 text-sm text-gray-500">
            {counts.total} accounts · {counts.active} active.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Role summary chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ROLE_OPTIONS.map((role) => (
          <span
            key={role}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${ROLE_STYLES[role]}`}
          >
            {role}
            <span className="font-bold">{counts.byRole[role]}</span>
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-gray-500">Search</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className={`${inputClass} pl-8`}
              placeholder="Name, username, email, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Role</span>
          <select className={inputClass} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">All roles</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">Status</span>
          <div className="flex gap-2">
            <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {(search || roleFilter || statusFilter) && (
              <button
                type="button"
                onClick={resetFilters}
                className="shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 text-gray-500 transition hover:bg-gray-50"
                aria-label="Clear filters"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </label>
      </div>

      {/* Users table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-gray-400">
                  Loading users...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-gray-400">
                  No users match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((user) => {
                const isSelf = user.id === currentUserId;
                const busy = busyId?.startsWith(`${user.id}-`);
                return (
                  <tr key={user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
                          {initials(user.fullName)}
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium text-gray-800">
                            <UserRound className="h-3.5 w-3.5 text-gray-400" />
                            {user.fullName || user.username}
                            {isSelf && (
                              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                                you
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-gray-400">
                            @{user.username} · {user.email || 'no email'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_STYLES[user.role] || 'bg-gray-50 text-gray-600'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${user.active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDateTime(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isSelf || busy}
                          onClick={() => openRoleModal(user)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                          title={isSelf ? 'You cannot change your own role' : 'Change role'}
                        >
                          <UserCog className="h-3.5 w-3.5" />
                          Role
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openPasswordModal(user)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
                          title="Reset password"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Password
                        </button>
                        <button
                          type="button"
                          disabled={isSelf || busy}
                          onClick={() => openStatusToggle(user)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                            user.active
                              ? 'border-red-200 bg-white text-red-600 hover:bg-red-50'
                              : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                          }`}
                          title={isSelf ? 'You cannot deactivate your own account' : user.active ? 'Deactivate account' : 'Activate account'}
                        >
                          {user.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Change-role modal */}
      <Modal open={Boolean(roleModal)} onClose={() => setRoleModal(null)} title="Change role">
        {roleModal && (
          <div>
            <p className="mb-4 text-sm text-gray-600">
              Assign a new role for{' '}
              <span className="font-medium text-gray-800">
                {roleModal.fullName || roleModal.username}
              </span>
              . Changing a role takes effect on that account&apos;s next request.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">New role</span>
              <select className={inputClass} value={roleChoice} onChange={(e) => setRoleChoice(e.target.value)}>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </label>
            {roleChoice === roleModal.role && (
              <p className="mt-2 text-xs text-amber-600">Choose a different role to save.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setRoleModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={roleChoice === roleModal.role || busyId === `${roleModal.id}-role`}
                onClick={changeRole}
              >
                {busyId === `${roleModal.id}-role` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Save role
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reset-password modal */}
      <Modal open={Boolean(passwordModal)} onClose={() => setPasswordModal(null)} title="Reset password">
        {passwordModal && (
          <div>
            <p className="mb-4 text-sm text-gray-600">
              Set a fresh password for{' '}
              <span className="font-medium text-gray-800">
                {passwordModal.fullName || passwordModal.username}
              </span>
              . The user will sign in with this password next time.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-500">New password</span>
              <input
                type="text"
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-gray-500">Confirm password</span>
              <input
                type="text"
                className={inputClass}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat the new password"
              />
            </label>
            {newPassword && newPassword !== confirmPassword && (
              <p className="mt-2 text-xs text-red-600">Passwords do not match.</p>
            )}
            {newPassword && newPassword.length < 8 && (
              <p className="mt-2 text-xs text-amber-600">Must be at least 8 characters.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={generatePassword} className={btnGhost}>
                Generate secure password
              </button>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setPasswordModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={!passwordValid || busyId === `${passwordModal.id}-password`}
                onClick={resetPassword}
              >
                {busyId === `${passwordModal.id}-password` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                Reset password
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm status toggle modal */}
      <Modal
        open={Boolean(statusModal)}
        onClose={() => setStatusModal(null)}
        title={statusModal?.nextActive ? 'Activate account' : 'Deactivate account'}
      >
        {statusModal && (
          <div>
            <p className="text-sm text-gray-600">
              {statusModal.nextActive
                ? `Reactivate ${statusModal.user.fullName || statusModal.user.username}? They will be able to sign in again immediately.`
                : `Deactivate ${statusModal.user.fullName || statusModal.user.username}? Their current session is revoked and they can no longer sign in.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={() => setStatusModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={statusModal.nextActive ? btnPrimary : 'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50'}
                disabled={busyId === `${statusModal.user.id}-status`}
                onClick={toggleStatus}
              >
                {busyId === `${statusModal.user.id}-status` ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  statusModal.nextActive ? 'Activate' : 'Deactivate'
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

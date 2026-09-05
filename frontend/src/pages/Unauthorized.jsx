import { Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Unauthorized() {
  const { role, logout } = useAuth();
  const navigate = useNavigate();

  const goHome = () => {
    if (!role) {
      logout();
      navigate('/login');
      return;
    }
    navigate(`/${role.toLowerCase()}/dashboard`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Access denied</h1>
        <p className="mt-2 text-sm text-gray-500">
          Your account does not have permission to view this page. If you believe
          this is a mistake, please contact the administrator.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={goHome}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-900"
          >
            Go to my dashboard
          </button>
          <Link
            to="/login"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Sign in as different user
          </Link>
        </div>
      </div>
    </div>
  );
}
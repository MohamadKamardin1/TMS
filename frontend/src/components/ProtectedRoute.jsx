import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Guards a route. Redirects unauthenticated users to /login and authenticated
 * users whose role is not in `allowedRoles` to /unauthorized. When used as a
 * layout route (element form) it renders the nested <Outlet/>; when given
 * `children` directly it renders those instead.
 *
 *   <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
 *     <Route path="/admin" element={<AppLayout />}>...
 */
export default function ProtectedRoute({ allowedRoles, children }) {
  const { isAuthenticated, role } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ?? <Outlet />;
}
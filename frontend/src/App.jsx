import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Unauthorized from './pages/Unauthorized';
import AdminDashboard from './pages/AdminDashboard';
import TailorDashboard from './pages/TailorDashboard';
import CashierDashboard from './pages/CashierDashboard';
import DeliveryDashboard from './pages/DeliveryDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import Orders from './pages/Orders';
import Invoices from './pages/Invoices';

function HomeRedirect() {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={`/${role.toLowerCase()}/dashboard`} replace />;
}

const SECTIONS = [
  { prefix: 'admin', roles: ['ADMIN'], dashboard: AdminDashboard, invoices: true },
  { prefix: 'tailor', roles: ['TAILOR'], dashboard: TailorDashboard, invoices: false },
  { prefix: 'cashier', roles: ['CASHIER'], dashboard: CashierDashboard, invoices: true },
  { prefix: 'delivery', roles: ['DELIVERY'], dashboard: DeliveryDashboard, invoices: false },
  { prefix: 'customer', roles: ['CUSTOMER'], dashboard: CustomerDashboard, invoices: false },
];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/" element={<HomeRedirect />} />

      {SECTIONS.map(({ prefix, roles, dashboard: Dashboard, invoices }) => (
        <Route key={prefix} element={<ProtectedRoute allowedRoles={roles} />}>
          <Route path={`/${prefix}`} element={<AppLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            {invoices && <Route path="invoices" element={<Invoices />} />}
          </Route>
        </Route>
      ))}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
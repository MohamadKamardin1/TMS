import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Unauthorized from './pages/Unauthorized';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import AuditLogs from './pages/admin/AuditLogs';
import TailorDashboard from './pages/tailor/TailorDashboard';
import CashierDashboard from './pages/cashier/CashierDashboard';
import DeliveryDashboard from './pages/delivery/DeliveryDashboard';
import CustomerDashboard from './pages/CustomerDashboard';
import CreateOrder from './pages/customer/CreateOrder';
import OrderDetails from './pages/customer/OrderDetails';
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
  {
    prefix: 'admin',
    roles: ['ADMIN'],
    dashboard: AdminDashboard,
    invoices: true,
    children: [
      { path: 'users', element: <UserManagement /> },
      { path: 'audit-logs', element: <AuditLogs /> },
    ],
  },
  {
    prefix: 'tailor',
    roles: ['TAILOR'],
    dashboard: TailorDashboard,
    invoices: false,
    children: [],
  },
  {
    prefix: 'cashier',
    roles: ['CASHIER'],
    dashboard: CashierDashboard,
    invoices: false,
    children: [],
  },
  {
    prefix: 'delivery',
    roles: ['DELIVERY'],
    dashboard: DeliveryDashboard,
    invoices: false,
    children: [],
  },
  {
    prefix: 'customer',
    roles: ['CUSTOMER'],
    dashboard: CustomerDashboard,
    invoices: false,
    children: [
      { path: 'orders/new', element: <CreateOrder /> },
      { path: 'orders/:id', element: <OrderDetails /> },
    ],
  },
];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/" element={<HomeRedirect />} />

      {SECTIONS.map(({ prefix, roles, dashboard: Dashboard, invoices, children }) => (
        <Route key={prefix} element={<ProtectedRoute allowedRoles={roles} />}>
          <Route path={`/${prefix}`} element={<AppLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            {invoices && <Route path="invoices" element={<Invoices />} />}
            {children.map((child) => (
              <Route key={child.path} path={child.path} element={child.element} />
            ))}
          </Route>
        </Route>
      ))}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

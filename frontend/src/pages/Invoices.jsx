import CashierDashboard from './cashier/CashierDashboard';

/**
 * Invoice management screen for the admin role. It runs the same billing
 * workspace the cashier sees on their dashboard: statistics, the orders
 * awaiting invoices, the full invoice ledger and every invoice action.
 */
export default function Invoices() {
  return (
    <CashierDashboard
      title="Invoice management"
      subtitle="Full invoice lifecycle — draft, issue, record payments and track overdue documents."
    />
  );
}

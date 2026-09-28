import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RequireAuth, useAuth } from './auth/AuthContext';
import { AccessDenied, RequirePermission } from './auth/RequirePermission';
import { AppLayout } from './layout/AppLayout';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { AuditPage } from './pages/AuditPage';
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage';
import { CustomerCreatePage, CustomerEditPage } from './pages/customers/CustomerFormPages';
import { CustomerListPage } from './pages/customers/CustomerListPage';
import { DashboardPage } from './pages/DashboardPage';
import { DepositCreatePage } from './pages/deposits/DepositCreatePage';
import { DepositDetailPage } from './pages/deposits/DepositDetailPage';
import { DepositListPage } from './pages/deposits/DepositListPage';
import { LoanCreatePage } from './pages/loans/LoanCreatePage';
import { LoanDetailPage } from './pages/loans/LoanDetailPage';
import { LoanListPage } from './pages/loans/LoanListPage';
import { LoanPipelinePage } from './pages/loans/LoanPipelinePage';
import { EmiCalculatorPage } from './pages/EmiCalculatorPage';
import { SchedulePage } from './pages/loans/SchedulePage';
import { ScheduleLookupPage } from './pages/loans/ScheduleLookupPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { StatementPage } from './pages/StatementPage';
import { TellerPage } from './pages/transactions/TellerPage';
import { TransactionListPage } from './pages/transactions/TransactionListPage';
import { UserGuidePage } from './pages/UserGuidePage';
import { UserManagementPage } from './pages/UserManagementPage';

function NotFound() {
  return (
    <div className="mx-auto mt-12 max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center" data-testid="not-found">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">The page you are looking for does not exist.</p>
      <Link to="/dashboard" className="mt-4 inline-block text-sm font-medium text-teal-700 hover:underline" data-testid="not-found-home-link">
        Go to Dashboard
      </Link>
    </div>
  );
}

/** Safe post-login destination: the `next` query param when it is an internal path, else the dashboard. */
export function postLoginPath(search: string): string {
  const next = new URLSearchParams(search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/dashboard';
}

function LoginRoute() {
  const { user } = useAuth();
  const location = useLocation();
  return user ? <Navigate to={postLoginPath(location.search)} replace /> : <LoginPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/guide" element={<UserGuidePage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/customers" element={<RequirePermission perm="customer.view"><CustomerListPage /></RequirePermission>} />
        <Route path="/customers/new" element={<RequirePermission perm="customer.create"><CustomerCreatePage /></RequirePermission>} />
        <Route path="/customers/:customerId" element={<RequirePermission perm="customer.view"><CustomerDetailPage /></RequirePermission>} />
        <Route path="/customers/:customerId/edit" element={<RequirePermission perm="customer.edit"><CustomerEditPage /></RequirePermission>} />

        <Route path="/deposits" element={<RequirePermission perm="deposit.view"><DepositListPage /></RequirePermission>} />
        <Route path="/deposits/new" element={<RequirePermission perm="deposit.create"><DepositCreatePage /></RequirePermission>} />
        <Route path="/deposits/:accountNo" element={<RequirePermission perm="deposit.view"><DepositDetailPage /></RequirePermission>} />

        <Route path="/loans" element={<RequirePermission perm="loan.view"><LoanListPage /></RequirePermission>} />
        <Route path="/loans/pipeline" element={<RequirePermission perm="loan.view"><LoanPipelinePage /></RequirePermission>} />
        <Route path="/tools/emi-calculator" element={<EmiCalculatorPage />} />
        <Route path="/loans/new" element={<RequirePermission perm="loan.create"><LoanCreatePage /></RequirePermission>} />
        <Route path="/loans/:loanNo" element={<RequirePermission perm="loan.view"><LoanDetailPage /></RequirePermission>} />
        <Route path="/loans/:loanNo/schedule" element={<RequirePermission perm="schedule.view"><SchedulePage /></RequirePermission>} />
        <Route path="/schedules" element={<RequirePermission perm="schedule.view"><ScheduleLookupPage /></RequirePermission>} />

        <Route path="/statements" element={<RequirePermission perm="statement.view"><StatementPage /></RequirePermission>} />
        <Route path="/transactions" element={<RequirePermission perm="txn.view"><TransactionListPage /></RequirePermission>} />
        <Route path="/transactions/new" element={<RequirePermission perm="txn.post"><TellerPage /></RequirePermission>} />
        <Route
          path="/approvals"
          element={<RequirePermission perm={['kyc.verify', 'deposit.approve', 'loan.approve', 'txn.approve']}><ApprovalsPage /></RequirePermission>}
        />
        <Route path="/reports" element={<RequirePermission perm="report.view"><ReportsPage /></RequirePermission>} />
        <Route path="/audit" element={<RequirePermission perm="audit.view"><AuditPage /></RequirePermission>} />
        <Route path="/admin/users" element={<RequirePermission perm="user.manage"><UserManagementPage /></RequirePermission>} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/access-denied" element={<AccessDenied />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

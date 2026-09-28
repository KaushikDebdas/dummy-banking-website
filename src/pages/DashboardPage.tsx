import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import { SimpleTable } from '../components/table/SimpleTable';
import { Button, Card, PageHeader, Spinner, StatusBadge } from '../components/ui';
import { InfoTip } from '../components/ui/advanced';
import { BRANCHES, DEPOSIT_PRODUCTS, LOAN_PRODUCTS, ROLE_LABELS, branchName } from '../data/reference';
import { canAccessBranch } from '../auth/permissions';
import { formatDateTime, nowISO } from '../lib/dates';
import { installmentStatus } from '../lib/loanCalc';
import { money, round2 } from '../lib/format';
import { useStore } from '../store/StoreContext';
import { visibleCustomers, visibleDeposits, visibleLoans, visibleTransactions } from '../store/selectors';

function StatCard({ testId, label, value, raw, sub, to, info }: { testId: string; label: string; value: string; raw: number; sub?: string; to?: string; info?: ReactNode }) {
  const body = (
    <div className="h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-teal-300" data-testid={testId}>
      <div className="flex items-center text-xs font-medium uppercase tracking-wide text-slate-500" data-testid={`${testId}-label`}>
        {label}
        {info && <InfoTip id={testId} text={info} />}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900" data-testid={`${testId}-value`} data-value={raw}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

const BALANCE_STATUSES = ['Active', 'Frozen', 'Matured'];

export function DashboardPage() {
  const user = useCurrentUser();
  const { can } = useAuth();
  const { state } = useStore();
  const customers = visibleCustomers(state, user);
  const deposits = visibleDeposits(state, user);
  const loans = visibleLoans(state, user);
  const txns = visibleTransactions(state, user);

  const depositBalance = round2(deposits.filter((d) => BALANCE_STATUSES.includes(d.status)).reduce((a, d) => a + d.balance, 0));
  const activeLoans = loans.filter((l) => l.status === 'Active');
  const outstanding = round2(activeLoans.reduce((a, l) => a + l.outstandingPrincipal, 0));
  const pendingApprovals =
    customers.filter((c) => c.kycStatus === 'Pending').length +
    deposits.filter((d) => d.status === 'Pending Approval').length +
    loans.filter((l) => l.status === 'Applied').length +
    txns.filter((t) => t.status === 'Pending Approval').length;
  const overdue = activeLoans.reduce((a, l) => a + l.schedule.filter((i) => installmentStatus(i) === 'Overdue').length, 0);

  const recentTxns = [...txns].sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : b.seq - a.seq)).slice(0, 5);
  const branches = BRANCHES.filter((b) => canAccessBranch(user, b.code));

  return (
    <div data-testid="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            Welcome back, <span data-testid="dashboard-welcome-name">{user.fullName}</span> · {ROLE_LABELS[user.role]} · <span data-testid="dashboard-scope">{branchName(user.branch)}</span>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard testId="card-total-customers" label="Total Customers" value={String(customers.length)} raw={customers.length} sub={`${customers.filter((c) => c.status === 'Active').length} active`} to="/customers" />
        <StatCard testId="card-total-deposit-accounts" label="Total Deposit Accounts" value={String(deposits.length)} raw={deposits.length} sub={`${deposits.filter((d) => d.status === 'Active').length} active`} to="/deposits" />
        <StatCard testId="card-total-loan-accounts" label="Total Loan Accounts" value={String(loans.length)} raw={loans.length} sub={`${activeLoans.length} active`} to="/loans" />
        <StatCard testId="card-total-deposit-balance" label="Total Deposit Balance (BDT)" value={money(depositBalance)} raw={depositBalance} info="Sum of balances of Active, Frozen and Matured deposit accounts." />
        <StatCard testId="card-total-outstanding" label="Total Outstanding Loan (BDT)" value={money(outstanding)} raw={outstanding} info="Unpaid principal of all Active loans." />
        <StatCard info="KYC, deposit accounts, loans and large withdrawals waiting for a checker." testId="card-pending-approvals" label="Pending Approvals" value={String(pendingApprovals)} raw={pendingApprovals} to={can('deposit.approve') || can('kyc.verify') ? '/approvals' : undefined} />
        <StatCard info="Unpaid installments of Active loans whose due date has passed." testId="card-overdue-installments" label="Overdue Installments" value={String(overdue)} raw={overdue} to={can('report.view') ? '/reports' : undefined} />
        <StatCard testId="card-total-transactions" label="Total Transactions" value={String(txns.length)} raw={txns.length} to="/transactions" />
      </div>

      <ExchangeRates />

      <Card title="Branch Summary" testId="branch-summary" className="mt-6">
        <SimpleTable
          id="branch-summary"
          rowTestIdPrefix="branch-row"
          rows={branches}
          rowId={(b) => b.code}
          columns={[
            { key: 'branch', header: 'Branch', value: (b) => b.name },
            { key: 'customers', header: 'Customers', value: (b) => customers.filter((c) => c.branch === b.code).length, align: 'right' },
            { key: 'deposits', header: 'Deposit A/Cs', value: (b) => deposits.filter((d) => d.branch === b.code).length, align: 'right' },
            {
              key: 'depositBalance',
              header: 'Deposit Balance',
              value: (b) => round2(deposits.filter((d) => d.branch === b.code && BALANCE_STATUSES.includes(d.status)).reduce((a, d) => a + d.balance, 0)),
              render: (b) => money(deposits.filter((d) => d.branch === b.code && BALANCE_STATUSES.includes(d.status)).reduce((a, d) => a + d.balance, 0)),
              align: 'right',
            },
            { key: 'loans', header: 'Loan A/Cs', value: (b) => loans.filter((l) => l.branch === b.code).length, align: 'right' },
            {
              key: 'outstanding',
              header: 'Outstanding',
              value: (b) => round2(activeLoans.filter((l) => l.branch === b.code).reduce((a, l) => a + l.outstandingPrincipal, 0)),
              render: (b) => money(activeLoans.filter((l) => l.branch === b.code).reduce((a, l) => a + l.outstandingPrincipal, 0)),
              align: 'right',
            },
          ]}
        />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Recent Customer Registrations" testId="recent-customers">
          <SimpleTable
            id="recent-customers"
            rowTestIdPrefix="recent-customer-row"
            rows={customers.slice(0, 5)}
            rowId={(c) => c.customerId}
            columns={[
              { key: 'customerId', header: 'Customer ID', value: (c) => c.customerId, render: (c) => <Link className="text-teal-700 hover:underline" to={`/customers/${c.customerId}`}>{c.customerId}</Link> },
              { key: 'fullName', header: 'Name', value: (c) => c.fullName },
              { key: 'createdAt', header: 'Registered', value: (c) => formatDateTime(c.createdAt) },
              { key: 'kycStatus', header: 'KYC', value: (c) => c.kycStatus, render: (c) => <StatusBadge status={c.kycStatus} /> },
            ]}
          />
        </Card>
        <Card title="Recently Created Deposit Accounts" testId="recent-deposits">
          <SimpleTable
            id="recent-deposits"
            rowTestIdPrefix="recent-deposit-row"
            rows={deposits.slice(0, 5)}
            rowId={(d) => d.accountNo}
            columns={[
              { key: 'accountNo', header: 'Account No', value: (d) => d.accountNo, render: (d) => <Link className="text-teal-700 hover:underline" to={`/deposits/${d.accountNo}`}>{d.accountNo}</Link> },
              { key: 'product', header: 'Product', value: (d) => DEPOSIT_PRODUCTS[d.product].shortCode },
              { key: 'balance', header: 'Balance', value: (d) => d.balance, render: (d) => money(d.balance), align: 'right' },
              { key: 'status', header: 'Status', value: (d) => d.status, render: (d) => <StatusBadge status={d.status} /> },
            ]}
          />
        </Card>
        <Card title="Recently Created Loan Accounts" testId="recent-loans">
          <SimpleTable
            id="recent-loans"
            rowTestIdPrefix="recent-loan-row"
            rows={loans.slice(0, 5)}
            rowId={(l) => l.loanAccountNo}
            columns={[
              { key: 'loanAccountNo', header: 'Loan A/C No', value: (l) => l.loanAccountNo, render: (l) => <Link className="text-teal-700 hover:underline" to={`/loans/${l.loanAccountNo}`}>{l.loanAccountNo}</Link> },
              { key: 'product', header: 'Product', value: (l) => LOAN_PRODUCTS[l.product].name },
              { key: 'amount', header: 'Amount', value: (l) => l.amount, render: (l) => money(l.amount), align: 'right' },
              { key: 'status', header: 'Status', value: (l) => l.status, render: (l) => <StatusBadge status={l.status} /> },
            ]}
          />
        </Card>
        <Card title="Recent Transactions" testId="recent-transactions">
          <SimpleTable
            id="recent-transactions"
            rowTestIdPrefix="recent-txn-row"
            rows={recentTxns}
            rowId={(t) => t.txnId}
            columns={[
              { key: 'txnId', header: 'Txn ID', value: (t) => t.txnId },
              { key: 'accountNo', header: 'Account', value: (t) => t.accountNo },
              { key: 'type', header: 'Type', value: (t) => t.type },
              { key: 'amount', header: 'Amount', value: (t) => t.debit || t.credit, render: (t) => money(t.debit || t.credit), align: 'right' },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

const RATES = [
  { code: 'USD', name: 'US Dollar', buy: 121.5, sell: 122.5 },
  { code: 'EUR', name: 'Euro', buy: 131.2, sell: 133.1 },
  { code: 'GBP', name: 'British Pound', buy: 154.8, sell: 157.0 },
  { code: 'SAR', name: 'Saudi Riyal', buy: 32.1, sell: 32.8 },
  { code: 'INR', name: 'Indian Rupee', buy: 1.42, sell: 1.47 },
  { code: 'MYR', name: 'Malaysian Ringgit', buy: 27.4, sell: 28.2 },
];
export const EXCHANGE_RATE_DELAY_MS = 1500;

/** Simulates a slow API: skeleton first, data after 1.5 s. Refresh reloads with the same delay. */
function ExchangeRates() {
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState('');
  const load = useCallback(() => {
    setLoading(true);
    return window.setTimeout(() => {
      setLoading(false);
      setUpdatedAt(nowISO());
    }, EXCHANGE_RATE_DELAY_MS);
  }, []);
  useEffect(() => {
    const t = load();
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <Card
      title="Foreign Exchange Rates (BDT)"
      testId="exchange-rates"
      className="mt-6"
      actions={
        <Button size="sm" variant="secondary" testId="exchange-rates-refresh-btn" disabled={loading} onClick={() => load()}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      }
    >
      {loading ? (
        <div data-testid="exchange-rates-loading" aria-busy="true" className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner className="text-teal-700" /> Fetching latest rates...
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-slate-200" />
          ))}
        </div>
      ) : (
        <>
          <SimpleTable
            id="exchange-rates"
            rowTestIdPrefix="rate-row"
            rows={RATES}
            rowId={(r) => r.code}
            columns={[
              { key: 'code', header: 'Currency', value: (r) => r.code },
              { key: 'name', header: 'Name', value: (r) => r.name },
              { key: 'buy', header: 'Buying', value: (r) => r.buy, render: (r) => r.buy.toFixed(2), align: 'right' },
              { key: 'sell', header: 'Selling', value: (r) => r.sell, render: (r) => r.sell.toFixed(2), align: 'right' },
            ]}
          />
          <p className="mt-2 text-xs text-slate-500" data-testid="exchange-rates-updated">
            Last updated {formatDateTime(updatedAt)} · indicative rates for practice only
          </p>
        </>
      )}
    </Card>
  );
}

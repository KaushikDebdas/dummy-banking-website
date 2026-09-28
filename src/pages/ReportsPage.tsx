import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '../auth/AuthContext';
import { canAccessBranch } from '../auth/permissions';
import { DataTable } from '../components/table/DataTable';
import { SimpleTable } from '../components/table/SimpleTable';
import { Card, Field, PageHeader, StatusBadge, TextInput, cx } from '../components/ui';
import { BRANCHES, DEPOSIT_PRODUCT_LIST, LOAN_PRODUCT_LIST, branchName } from '../data/reference';
import { addDays, diffDays, today } from '../lib/dates';
import { money, round2 } from '../lib/format';
import { installmentStatus } from '../lib/loanCalc';
import { useStore } from '../store/StoreContext';
import { visibleCustomers, visibleDeposits, visibleLoans, visibleTransactions } from '../store/selectors';
import type { Customer, DepositAccount } from '../types';
import { AccountLink, CustomerLink } from './common';

type Tab = 'portfolio' | 'overdue' | 'maturity' | 'kyc' | 'activity';
const TABS: { key: Tab; label: string }[] = [
  { key: 'portfolio', label: 'Portfolio Summary' },
  { key: 'overdue', label: 'Overdue Installments' },
  { key: 'maturity', label: 'Deposit Maturity' },
  { key: 'kyc', label: 'KYC Pending' },
  { key: 'activity', label: 'Transaction Activity' },
];

interface OverdueRow {
  id: string;
  loanAccountNo: string;
  customerId: string;
  customerName: string;
  installmentNo: number;
  dueDate: string;
  amount: number;
  daysOverdue: number;
  branch: string;
}

export function ReportsPage() {
  const user = useCurrentUser();
  const { state } = useStore();
  // Active tab lives in the URL (?tab=portfolio|overdue|maturity|kyc|activity).
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((t) => t.key === params.get('tab'))?.key ?? 'portfolio';
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });
  const [from, setFrom] = useState(addDays(today(), -90));
  const [to, setTo] = useState(today());

  const deposits = visibleDeposits(state, user);
  const loans = visibleLoans(state, user);
  const customers = visibleCustomers(state, user);
  const txns = visibleTransactions(state, user);

  const overdue: OverdueRow[] = loans
    .filter((l) => l.status === 'Active')
    .flatMap((l) =>
      l.schedule
        .filter((i) => installmentStatus(i) === 'Overdue')
        .map((i) => ({
          id: `${l.loanAccountNo}-${i.installmentNo}`,
          loanAccountNo: l.loanAccountNo,
          customerId: l.customerId,
          customerName: l.customerName,
          installmentNo: i.installmentNo,
          dueDate: i.dueDate,
          amount: i.installmentAmount,
          daysOverdue: diffDays(i.dueDate, today()),
          branch: l.branch,
        })),
    );
  const maturing = deposits.filter((d) => d.maturityDate && d.status === 'Active' && d.maturityDate <= addDays(today(), 90));
  const kycPending = customers.filter((c) => c.kycStatus !== 'Verified');
  const periodTxns = txns.filter((t) => t.date >= from && t.date <= to && (t.status === 'Posted' || t.status === 'Reversed'));
  const activity = Object.entries(
    periodTxns.reduce<Record<string, { count: number; debit: number; credit: number }>>((acc, t) => {
      const r = (acc[t.type] ??= { count: 0, debit: 0, credit: 0 });
      r.count++;
      r.debit += t.debit;
      r.credit += t.credit;
      return acc;
    }, {}),
  ).map(([type, v]) => ({ type, count: v.count, debit: round2(v.debit), credit: round2(v.credit) }));

  return (
    <div data-testid="reports-page">
      <PageHeader title="Reports" subtitle={`Management reports for ${branchName(user.branch)}`} />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            data-testid={`reports-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={cx('-mb-px border-b-2 px-4 py-2 text-sm font-medium', tab === t.key ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'portfolio' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Card title="Deposits by Product" testId="report-deposits-by-product">
            <SimpleTable
              id="report-deposits"
              rowTestIdPrefix="report-deposit-row"
              rows={DEPOSIT_PRODUCT_LIST}
              rowId={(p) => p.code}
              columns={[
                { key: 'product', header: 'Product', value: (p) => p.name },
                { key: 'accounts', header: 'Accounts', align: 'right', value: (p) => deposits.filter((d) => d.product === p.code).length },
                { key: 'active', header: 'Active', align: 'right', value: (p) => deposits.filter((d) => d.product === p.code && d.status === 'Active').length },
                {
                  key: 'balance',
                  header: 'Balance',
                  align: 'right',
                  value: (p) => round2(deposits.filter((d) => d.product === p.code).reduce((a, d) => a + d.balance, 0)),
                  render: (p) => money(deposits.filter((d) => d.product === p.code).reduce((a, d) => a + d.balance, 0)),
                },
              ]}
            />
          </Card>
          <Card title="Loans by Product" testId="report-loans-by-product">
            <SimpleTable
              id="report-loans"
              rowTestIdPrefix="report-loan-row"
              rows={LOAN_PRODUCT_LIST}
              rowId={(p) => p.code}
              columns={[
                { key: 'product', header: 'Product', value: (p) => p.name },
                { key: 'accounts', header: 'Accounts', align: 'right', value: (p) => loans.filter((l) => l.product === p.code).length },
                { key: 'active', header: 'Active', align: 'right', value: (p) => loans.filter((l) => l.product === p.code && l.status === 'Active').length },
                {
                  key: 'outstanding',
                  header: 'Outstanding',
                  align: 'right',
                  value: (p) => round2(loans.filter((l) => l.product === p.code && l.status === 'Active').reduce((a, l) => a + l.outstandingPrincipal, 0)),
                  render: (p) => money(loans.filter((l) => l.product === p.code && l.status === 'Active').reduce((a, l) => a + l.outstandingPrincipal, 0)),
                },
              ]}
            />
          </Card>
          <Card title="Branch Comparison" testId="report-branch-comparison" className="xl:col-span-2">
            <SimpleTable
              id="report-branches"
              rowTestIdPrefix="report-branch-row"
              rows={BRANCHES.filter((b) => canAccessBranch(user, b.code))}
              rowId={(b) => b.code}
              columns={[
                { key: 'branch', header: 'Branch', value: (b) => b.name },
                { key: 'customers', header: 'Customers', align: 'right', value: (b) => customers.filter((c) => c.branch === b.code).length },
                { key: 'kycPending', header: 'KYC Pending', align: 'right', value: (b) => kycPending.filter((c) => c.branch === b.code).length },
                { key: 'overdue', header: 'Overdue Inst.', align: 'right', value: (b) => overdue.filter((o) => o.branch === b.code).length },
                {
                  key: 'overdueAmount',
                  header: 'Overdue Amount',
                  align: 'right',
                  value: (b) => round2(overdue.filter((o) => o.branch === b.code).reduce((a, o) => a + o.amount, 0)),
                  render: (b) => money(overdue.filter((o) => o.branch === b.code).reduce((a, o) => a + o.amount, 0)),
                },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === 'overdue' && (
        <Card title="Overdue Installments" testId="report-overdue-card">
          <DataTable<OverdueRow>
            id="report-overdue"
            rowTestIdPrefix="overdue-row"
            rows={overdue}
            rowId={(o) => o.id}
            searchPlaceholder="Search by loan account or customer"
            exportFileName="overdue_installments.csv"
            emptyMessage="No overdue installments."
            dateFilter={{ label: 'Due Date', value: (o) => o.dueDate }}
            columns={[
              { key: 'loanAccountNo', header: 'Loan A/C No', render: (o) => <AccountLink accountNo={o.loanAccountNo} /> },
              { key: 'customerId', header: 'Customer ID' },
              { key: 'customerName', header: 'Customer' },
              { key: 'installmentNo', header: 'Inst. No', searchable: false, align: 'center' },
              { key: 'dueDate', header: 'Due Date', searchable: false },
              { key: 'amount', header: 'Amount', searchable: false, align: 'right', render: (o) => money(o.amount) },
              { key: 'daysOverdue', header: 'Days Overdue', searchable: false, align: 'right' },
              { key: 'branch', header: 'Branch', searchable: false },
            ]}
          />
        </Card>
      )}

      {tab === 'maturity' && (
        <Card title="Deposits Matured or Maturing within 90 Days" testId="report-maturity-card">
          <DataTable<DepositAccount>
            id="report-maturity"
            rowTestIdPrefix="maturity-row"
            rows={maturing}
            rowId={(d) => d.accountNo}
            searchPlaceholder="Search by account number or customer"
            emptyMessage="No deposits are maturing in the next 90 days."
            columns={[
              { key: 'accountNo', header: 'Account No', render: (d) => <AccountLink accountNo={d.accountNo} /> },
              { key: 'customerId', header: 'Customer ID' },
              { key: 'customerName', header: 'Customer' },
              { key: 'product', header: 'Product', searchable: false },
              { key: 'maturityDate', header: 'Maturity Date', searchable: false },
              { key: 'maturityAmount', header: 'Maturity Amount', searchable: false, align: 'right', render: (d) => money(d.maturityAmount) },
              { key: 'due', header: 'State', searchable: false, value: (d) => ((d.maturityDate ?? '') <= today() ? 'Matured - pending processing' : 'Upcoming') },
            ]}
          />
        </Card>
      )}

      {tab === 'kyc' && (
        <Card title="Customers without Verified KYC" testId="report-kyc-card">
          <DataTable<Customer>
            id="report-kyc"
            rowTestIdPrefix="report-kyc-row"
            rows={kycPending}
            rowId={(c) => c.customerId}
            searchPlaceholder="Search by customer ID or name"
            emptyMessage="All customers are KYC verified."
            filters={[{ key: 'kycStatus', label: 'KYC Status', options: ['Pending', 'Rejected'].map((s) => ({ value: s, label: s })) }]}
            columns={[
              { key: 'customerId', header: 'Customer ID', render: (c) => <CustomerLink id={c.customerId} /> },
              { key: 'fullName', header: 'Name' },
              { key: 'mobile', header: 'Mobile' },
              { key: 'branch', header: 'Branch', searchable: false },
              { key: 'kycStatus', header: 'KYC', searchable: false, render: (c) => <StatusBadge status={c.kycStatus} /> },
              { key: 'kycRemarks', header: 'Remarks', searchable: false, value: (c) => c.kycRemarks ?? '-' },
            ]}
          />
        </Card>
      )}

      {tab === 'activity' && (
        <Card title="Transaction Activity by Type" testId="report-activity-card">
          <div className="mb-4 flex flex-wrap gap-4">
            <Field id="report-activity-from" label="From Date">
              <TextInput id="report-activity-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field id="report-activity-to" label="To Date">
              <TextInput id="report-activity-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <SimpleTable
            id="report-activity"
            rowTestIdPrefix="activity-row"
            rows={activity}
            rowId={(a) => a.type.replace(/\s+/g, '-').toLowerCase()}
            emptyMessage="No transactions in the selected period."
            columns={[
              { key: 'type', header: 'Transaction Type', value: (a) => a.type },
              { key: 'count', header: 'Count', align: 'right', value: (a) => a.count },
              { key: 'debit', header: 'Total Debit', align: 'right', value: (a) => a.debit, render: (a) => money(a.debit) },
              { key: 'credit', header: 'Total Credit', align: 'right', value: (a) => a.credit, render: (a) => money(a.credit) },
            ]}
          />
          <p className="mt-3 text-xs text-slate-500" data-testid="report-activity-total" data-count={periodTxns.length}>
            {periodTxns.length} transactions between {from} and {to}
          </p>
        </Card>
      )}
    </div>
  );
}

import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '../auth/AuthContext';
import { canAccessBranch } from '../auth/permissions';
import { DataTable } from '../components/table/DataTable';
import { Alert, Button, Card, Field, PageHeader, SelectInput, StatusBadge, TextInput } from '../components/ui';
import { DEPOSIT_PRODUCTS, LOAN_PRODUCTS, branchName } from '../data/reference';
import { downloadCSV, toCSV } from '../lib/csv';
import { today } from '../lib/dates';
import { money } from '../lib/format';
import { useStore } from '../store/StoreContext';
import { buildStatement, visibleCustomers } from '../store/selectors';
import type { Transaction } from '../types';

export function StatementPage() {
  const user = useCurrentUser();
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const customers = visibleCustomers(state, user);

  const paramAccount = (params.get('account') ?? '').toUpperCase();
  const paramOwner =
    state.deposits.find((d) => d.accountNo === paramAccount)?.customerId ?? state.loans.find((l) => l.loanAccountNo === paramAccount)?.customerId ?? params.get('customerId') ?? '';

  const [customerId, setCustomerId] = useState(paramOwner);
  const [accountNo, setAccountNo] = useState(paramAccount);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today());

  const accounts = useMemo(() => {
    if (!customerId) return [];
    const deps = state.deposits
      .filter((d) => d.customerId === customerId && !['Pending Approval', 'Rejected'].includes(d.status))
      .map((d) => ({ value: d.accountNo, label: `${d.accountNo} - ${DEPOSIT_PRODUCTS[d.product].name} (${d.status})` }));
    const loans = state.loans
      .filter((l) => l.customerId === customerId && ['Active', 'Closed', 'Written Off'].includes(l.status))
      .map((l) => ({ value: l.loanAccountNo, label: `${l.loanAccountNo} - ${LOAN_PRODUCTS[l.product].name} (${l.status})` }));
    return [...deps, ...loans];
  }, [state, customerId]);

  const deposit = state.deposits.find((d) => d.accountNo === accountNo);
  const loan = state.loans.find((l) => l.loanAccountNo === accountNo);
  const account = deposit ?? loan;
  const allowed = account ? canAccessBranch(user, account.branch) : false;
  const isLoan = !!loan;
  const startDate = deposit?.openingDate ?? loan?.startDate ?? '';
  const effectiveFrom = from || startDate;
  const dateError = effectiveFrom && to && effectiveFrom > to ? 'From Date cannot be after To Date' : '';
  const stmt = account && allowed && !dateError ? buildStatement(state, account === deposit ? deposit.accountNo : loan!.loanAccountNo, effectiveFrom, to) : null;
  const balanceLabel = isLoan ? 'Outstanding Loan Balance' : 'Running Balance';

  const selectCustomer = (id: string) => {
    setCustomerId(id);
    setAccountNo('');
    setFrom('');
    setParams({}, { replace: true });
  };
  const selectAccount = (no: string) => {
    setAccountNo(no);
    setFrom('');
    setParams(no ? { account: no } : {}, { replace: true });
  };

  const exportCsv = () => {
    if (!stmt || !account) return;
    const header = ['Transaction Date', 'Transaction ID', 'Transaction Type', 'Description', 'Debit Amount', 'Credit Amount', balanceLabel, 'Status'];
    const rows: unknown[][] = [
      [effectiveFrom, '', 'Opening Balance', '', '', '', stmt.openingBalance.toFixed(2), ''],
      ...stmt.rows.map((t) => [t.date, t.txnId, t.type, t.description, t.debit ? t.debit.toFixed(2) : '', t.credit ? t.credit.toFixed(2) : '', t.balanceAfter.toFixed(2), t.status]),
      [to, '', 'Closing Balance', '', stmt.totalDebit.toFixed(2), stmt.totalCredit.toFixed(2), stmt.closingBalance.toFixed(2), ''],
    ];
    downloadCSV(`statement_${accountNo}_${effectiveFrom}_${to}.csv`, toCSV(header, rows));
  };

  return (
    <div data-testid="statement-page">
      <PageHeader title="Account Statements" subtitle="Select a customer and a deposit or loan account to view its statement." />

      <Card title="Statement Criteria" testId="statement-criteria">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field id="statement-customer" label="Customer" required>
            <SelectInput
              id="statement-customer"
              value={customerId}
              onChange={(e) => selectCustomer(e.target.value)}
              placeholder="-- Select Customer --"
              options={customers.map((c) => ({ value: c.customerId, label: `${c.customerId} - ${c.fullName}` }))}
            />
          </Field>
          <Field id="statement-account" label="Account" required hint={customerId && accounts.length === 0 ? 'This customer has no accounts with transactions' : undefined}>
            <SelectInput id="statement-account" value={accountNo} disabled={!customerId} onChange={(e) => selectAccount(e.target.value)} placeholder="-- Select Account --" options={accounts} />
          </Field>
          <Field id="statement-from" label="From Date" error={dateError}>
            <TextInput id="statement-from" type="date" value={effectiveFrom} invalid={!!dateError} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field id="statement-to" label="To Date">
            <TextInput id="statement-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </Card>

      {account && !allowed && (
        <div className="mt-5">
          <Alert testId="statement-access-denied">Access denied: account {accountNo} belongs to {branchName(account.branch)}.</Alert>
        </div>
      )}

      {!account && (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500" data-testid="statement-placeholder">
          {paramAccount && !account ? `Account ${paramAccount} not found.` : 'Select a customer and an account to view the statement.'}
        </div>
      )}

      {stmt && account && (
        <>
          <Card title="Account Summary" testId="statement-account-info" className="mt-5" actions={<Button variant="secondary" size="sm" testId="statement-export-csv-btn" onClick={exportCsv}>Export CSV</Button>}>
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <SummaryItem label="Account Number" id="statement-account-no" value={accountNo} />
              <SummaryItem label="Customer" id="statement-customer-name" value={`${account.customerName} (${account.customerId})`} />
              <SummaryItem label="Account Type" id="statement-account-type" value={deposit ? DEPOSIT_PRODUCTS[deposit.product].name : LOAN_PRODUCTS[loan!.product].name} />
              <SummaryItem label="Status" id="statement-account-status" value={<StatusBadge status={account.status} />} raw={account.status} />
              <SummaryItem label="Statement Period" id="statement-period" value={`${effectiveFrom} to ${to}`} />
              <SummaryItem label={isLoan ? 'Current Outstanding' : 'Current Balance'} id="statement-current-balance" value={money(deposit ? deposit.balance : loan!.outstandingPrincipal)} raw={deposit ? deposit.balance : loan!.outstandingPrincipal} />
              <SummaryItem label="Opening Balance" id="statement-opening-balance" value={money(stmt.openingBalance)} raw={stmt.openingBalance} />
              <SummaryItem label="Closing Balance" id="statement-closing-balance" value={money(stmt.closingBalance)} raw={stmt.closingBalance} />
              <SummaryItem label="Total Debit" id="statement-total-debit" value={money(stmt.totalDebit)} raw={stmt.totalDebit} />
              <SummaryItem label="Total Credit" id="statement-total-credit" value={money(stmt.totalCredit)} raw={stmt.totalCredit} />
              <SummaryItem label="Transactions" id="statement-txn-count" value={String(stmt.rows.length)} raw={stmt.rows.length} />
              <SummaryItem label="Branch" id="statement-branch" value={branchName(account.branch)} />
            </dl>
          </Card>

          <Card title="Transactions" testId="statement-transactions-card" className="mt-5">
            <DataTable<Transaction>
              key={`${accountNo}-${effectiveFrom}-${to}`}
              id="statement"
              rowTestIdPrefix="statement-row"
              rows={stmt.rows}
              rowId={(t) => t.txnId}
              searchPlaceholder="Search by Transaction ID"
              defaultPageSize={25}
              emptyMessage="No transactions found for the selected period."
              columns={[
                { key: 'date', header: 'Transaction Date', sortable: false, searchable: false },
                { key: 'txnId', header: 'Transaction ID', sortable: false },
                { key: 'type', header: 'Transaction Type', sortable: false, searchable: false },
                { key: 'description', header: 'Description', sortable: false, searchable: false, className: 'whitespace-normal min-w-[12rem]' },
                { key: 'debit', header: 'Debit Amount', sortable: false, searchable: false, align: 'right', render: (t) => (t.debit ? money(t.debit) : '-') },
                { key: 'credit', header: 'Credit Amount', sortable: false, searchable: false, align: 'right', render: (t) => (t.credit ? money(t.credit) : '-') },
                { key: 'balanceAfter', header: balanceLabel, sortable: false, searchable: false, align: 'right', render: (t) => money(t.balanceAfter) },
                { key: 'status', header: 'Status', sortable: false, searchable: false, render: (t) => <StatusBadge status={t.status} /> },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryItem({ label, id, value, raw }: { label: string; id: string; value: ReactNode; raw?: string | number }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900" data-testid={id} data-value={raw ?? (typeof value === 'string' ? value : undefined)}>
        {value}
      </dd>
    </div>
  );
}

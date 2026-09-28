import { useState } from 'react';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import type { Permission } from '../auth/permissions';
import { DataTable } from '../components/table/DataTable';
import { Alert, Button, Card, PageHeader, StatusBadge, cx } from '../components/ui';
import { useFeedback } from '../components/ui/feedback';
import { DEPOSIT_PRODUCTS, LOAN_PRODUCTS } from '../data/reference';
import { useAction } from '../hooks/useAction';
import { formatDateTime } from '../lib/dates';
import { money } from '../lib/format';
import { useStore } from '../store/StoreContext';
import { visibleCustomers, visibleDeposits, visibleLoans, visibleTransactions } from '../store/selectors';
import * as svc from '../store/services';
import type { Customer, DepositAccount, LoanAccount, Transaction } from '../types';
import { AccountLink, CustomerLink } from './common';

type Tab = 'kyc' | 'deposits' | 'loans' | 'transactions';

export function ApprovalsPage() {
  const user = useCurrentUser();
  const { can } = useAuth();
  const { state } = useStore();
  const { confirm } = useFeedback();
  const act = useAction();

  const kyc = visibleCustomers(state, user).filter((c) => c.kycStatus === 'Pending');
  const deposits = visibleDeposits(state, user).filter((d) => d.status === 'Pending Approval');
  const loans = visibleLoans(state, user).filter((l) => l.status === 'Applied' || l.status === 'Approved');
  const txns = visibleTransactions(state, user).filter((t) => t.status === 'Pending Approval');

  const tabs: { key: Tab; label: string; count: number; perm: Permission }[] = [
    { key: 'kyc', label: 'KYC Verification', count: kyc.length, perm: 'kyc.verify' },
    { key: 'deposits', label: 'Deposit Accounts', count: deposits.length, perm: 'deposit.approve' },
    { key: 'loans', label: 'Loans', count: loans.length, perm: 'loan.approve' },
    { key: 'transactions', label: 'Transactions', count: txns.length, perm: 'txn.approve' },
  ];
  const allowedTabs = tabs.filter((t) => can(t.perm));
  const [tab, setTab] = useState<Tab>(allowedTabs[0]?.key ?? 'kyc');

  const rejectWithRemarks = async (title: string, message: string) =>
    confirm({ title, message, confirmLabel: 'Reject', variant: 'danger', remarks: true, remarksRequired: true });

  const makerNote = (maker: string) =>
    maker === user.username ? (
      <span className="text-[11px] font-medium text-amber-700" data-testid="own-record-note">
        (you are the maker)
      </span>
    ) : null;

  return (
    <div data-testid="approvals-page">
      <PageHeader title="Approvals" subtitle="Maker-checker queue. You cannot approve or reject records that you created yourself." />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
        {allowedTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            data-testid={`approvals-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={cx('-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium', tab === t.key ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >
            {t.label}
            <span className="rounded-full bg-slate-200 px-2 text-xs text-slate-700" data-testid={`approvals-count-${t.key}`} data-count={t.count}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'kyc' && can('kyc.verify') && (
        <Card testId="approvals-kyc-card">
          <DataTable<Customer>
            id="approvals-kyc"
            rowTestIdPrefix="kyc-row"
            rows={kyc}
            rowId={(c) => c.customerId}
            searchPlaceholder="Search by customer ID or name"
            emptyMessage="No customers are waiting for KYC verification."
            columns={[
              { key: 'customerId', header: 'Customer ID', render: (c) => <CustomerLink id={c.customerId} /> },
              { key: 'fullName', header: 'Name' },
              { key: 'nid', header: 'NID' },
              { key: 'branch', header: 'Branch', searchable: false },
              { key: 'createdBy', header: 'Maker', searchable: false, render: (c) => <>{c.createdBy} {makerNote(c.createdBy)}</> },
              { key: 'createdAt', header: 'Submitted', searchable: false, render: (c) => formatDateTime(c.createdAt) },
            ]}
            actions={(c) => (
              <>
                <Button size="sm" variant="success" testId={`approve-btn-${c.customerId}`} onClick={() => act((d, u) => svc.decideKyc(d, u, c.customerId, 'Verified'))}>
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  testId={`reject-btn-${c.customerId}`}
                  onClick={async () => {
                    const r = await rejectWithRemarks('Reject KYC', `Reject KYC of ${c.customerId}?`);
                    if (r.confirmed) await act((d, u) => svc.decideKyc(d, u, c.customerId, 'Rejected', r.remarks));
                  }}
                >
                  Reject
                </Button>
              </>
            )}
          />
        </Card>
      )}

      {tab === 'deposits' && can('deposit.approve') && (
        <Card testId="approvals-deposits-card">
          <DataTable<DepositAccount>
            id="approvals-deposits"
            rowTestIdPrefix="approval-deposit-row"
            rows={deposits}
            rowId={(d) => d.accountNo}
            searchPlaceholder="Search by account number or customer ID"
            emptyMessage="No deposit accounts are pending approval."
            selectable
            bulkActions={(selected, clear) => (
              <Button
                size="sm"
                variant="success"
                testId="bulk-approve-btn"
                onClick={async () => {
                  const res = await act((s, u) => svc.bulkApproveDeposits(s, u, selected.map((d) => d.accountNo)));
                  if (res.ok) clear();
                }}
              >
                Approve Selected
              </Button>
            )}
            columns={[
              { key: 'accountNo', header: 'Account No', render: (d) => <AccountLink accountNo={d.accountNo} /> },
              { key: 'customerId', header: 'Customer ID' },
              { key: 'customerName', header: 'Customer Name' },
              { key: 'product', header: 'Product', searchable: false, render: (d) => DEPOSIT_PRODUCTS[d.product].name },
              { key: 'initialDeposit', header: 'Amount', searchable: false, align: 'right', render: (d) => money(d.initialDeposit) },
              { key: 'kyc', header: 'Customer KYC', searchable: false, value: (d) => state.customers.find((c) => c.customerId === d.customerId)?.kycStatus, render: (d) => <StatusBadge status={state.customers.find((c) => c.customerId === d.customerId)?.kycStatus ?? '-'} /> },
              { key: 'createdBy', header: 'Maker', searchable: false, render: (d) => <>{d.createdBy} {makerNote(d.createdBy)}</> },
            ]}
            actions={(d) => (
              <>
                <Button size="sm" variant="success" testId={`approve-btn-${d.accountNo}`} onClick={() => act((s, u) => svc.approveDeposit(s, u, d.accountNo))}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  testId={`reject-btn-${d.accountNo}`}
                  onClick={async () => {
                    const r = await rejectWithRemarks('Reject Account', `Reject ${d.accountNo}?`);
                    if (r.confirmed) await act((s, u) => svc.rejectDeposit(s, u, d.accountNo, r.remarks));
                  }}
                >
                  Reject
                </Button>
              </>
            )}
          />
        </Card>
      )}

      {tab === 'loans' && can('loan.approve') && (
        <Card testId="approvals-loans-card">
          <DataTable<LoanAccount>
            id="approvals-loans"
            rowTestIdPrefix="approval-loan-row"
            rows={loans}
            rowId={(l) => l.loanAccountNo}
            searchPlaceholder="Search by loan account number or customer ID"
            emptyMessage="No loans are waiting for approval or disbursement."
            filters={[{ key: 'status', label: 'Stage', options: [{ value: 'Applied', label: 'Awaiting Approval' }, { value: 'Approved', label: 'Awaiting Disbursement' }] }]}
            columns={[
              { key: 'loanAccountNo', header: 'Loan A/C No', render: (l) => <AccountLink accountNo={l.loanAccountNo} /> },
              { key: 'customerId', header: 'Customer ID' },
              { key: 'customerName', header: 'Customer Name' },
              { key: 'product', header: 'Product', searchable: false, render: (l) => LOAN_PRODUCTS[l.product].name },
              { key: 'amount', header: 'Amount', searchable: false, align: 'right', render: (l) => money(l.amount) },
              { key: 'installmentAmount', header: 'Installment', searchable: false, align: 'right', render: (l) => money(l.installmentAmount) },
              { key: 'status', header: 'Status', searchable: false, render: (l) => <StatusBadge status={l.status} /> },
              { key: 'createdBy', header: 'Maker', searchable: false, render: (l) => <>{l.createdBy} {makerNote(l.createdBy)}</> },
            ]}
            actions={(l) =>
              l.status === 'Applied' ? (
                <>
                  <Button size="sm" variant="success" testId={`approve-btn-${l.loanAccountNo}`} onClick={() => act((d, u) => svc.approveLoan(d, u, l.loanAccountNo))}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    testId={`reject-btn-${l.loanAccountNo}`}
                    onClick={async () => {
                      const r = await rejectWithRemarks('Reject Loan', `Reject ${l.loanAccountNo}?`);
                      if (r.confirmed) await act((d, u) => svc.rejectLoan(d, u, l.loanAccountNo, r.remarks));
                    }}
                  >
                    Reject
                  </Button>
                </>
              ) : can('loan.disburse') ? (
                <Button size="sm" variant="success" testId={`disburse-btn-${l.loanAccountNo}`} onClick={() => act((d, u) => svc.disburseLoan(d, u, l.loanAccountNo))}>
                  Disburse
                </Button>
              ) : null
            }
          />
        </Card>
      )}

      {tab === 'transactions' && can('txn.approve') && (
        <Card testId="approvals-transactions-card">
          <div className="mb-3">
            <Alert kind="info">Cash withdrawals above 500,000.00 BDT require approval before they are posted.</Alert>
          </div>
          <DataTable<Transaction>
            id="approvals-txns"
            rowTestIdPrefix="approval-txn-row"
            rows={txns}
            rowId={(t) => t.txnId}
            searchPlaceholder="Search by transaction ID or account number"
            emptyMessage="No transactions are pending approval."
            columns={[
              { key: 'txnId', header: 'Transaction ID' },
              { key: 'accountNo', header: 'Account No', render: (t) => <AccountLink accountNo={t.accountNo} /> },
              { key: 'type', header: 'Type', searchable: false },
              { key: 'debit', header: 'Amount', searchable: false, align: 'right', render: (t) => money(t.debit) },
              { key: 'date', header: 'Requested', searchable: false },
              { key: 'createdBy', header: 'Maker', searchable: false, render: (t) => <>{t.createdBy} {makerNote(t.createdBy)}</> },
            ]}
            actions={(t) => (
              <>
                <Button size="sm" variant="success" testId={`approve-btn-${t.txnId}`} onClick={() => act((d, u) => svc.approveTxn(d, u, t.txnId))}>
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  testId={`reject-btn-${t.txnId}`}
                  onClick={async () => {
                    const r = await rejectWithRemarks('Reject Transaction', `Reject ${t.txnId}?`);
                    if (r.confirmed) await act((d, u) => svc.rejectTxn(d, u, t.txnId, r.remarks));
                  }}
                >
                  Reject
                </Button>
              </>
            )}
          />
        </Card>
      )}
    </div>
  );
}

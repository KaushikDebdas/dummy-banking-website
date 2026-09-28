import { useNavigate } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../../auth/AuthContext';
import { DataTable, type FilterDef } from '../../components/table/DataTable';
import { Button, Card, PageHeader, StatusBadge } from '../../components/ui';
import { useFeedback } from '../../components/ui/feedback';
import { BRANCHES, branchName } from '../../data/reference';
import { useAction } from '../../hooks/useAction';
import { downloadCSV, toCSV } from '../../lib/csv';
import { today } from '../../lib/dates';
import { money } from '../../lib/format';
import { useStore } from '../../store/StoreContext';
import { visibleTransactions } from '../../store/selectors';
import * as svc from '../../store/services';
import type { Transaction, TxnType } from '../../types';
import { AccountLink } from '../common';

const TXN_TYPES: TxnType[] = [
  'Opening Deposit',
  'Deposit',
  'Withdrawal',
  'Transfer In',
  'Transfer Out',
  'Interest Credit',
  'Profit Payout',
  'Maturity Payout',
  'Reversal',
  'Loan Disbursement',
  'Interest Charge',
  'Installment Payment',
];

export function TransactionListPage() {
  const user = useCurrentUser();
  const { can } = useAuth();
  const { state } = useStore();
  const { confirm } = useFeedback();
  const act = useAction();
  const navigate = useNavigate();
  const rows = [...visibleTransactions(state, user)].sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : b.seq - a.seq));

  const reverse = async (t: Transaction) => {
    const r = await confirm({
      title: 'Reverse Transaction',
      message: `Reverse ${t.type.toLowerCase()} ${t.txnId} of ${money(t.debit || t.credit)} on ${t.accountNo}?`,
      confirmLabel: 'Reverse',
      variant: 'danger',
      remarks: true,
      remarksRequired: true,
      remarksLabel: 'Reversal Reason',
    });
    if (r.confirmed) await act((d, u) => svc.reverseTxn(d, u, t.txnId, r.remarks));
  };

  const filters: FilterDef<Transaction>[] = [
    { key: 'type', label: 'Type', options: TXN_TYPES.map((t) => ({ value: t, label: t })) },
    { key: 'accountKind', label: 'Account Type', options: [{ value: 'DEPOSIT', label: 'Deposit' }, { value: 'LOAN', label: 'Loan' }] },
    { key: 'status', label: 'Status', options: ['Posted', 'Reversed', 'Pending Approval', 'Rejected'].map((s) => ({ value: s, label: s })) },
  ];
  if (user.branch === 'ALL') filters.push({ key: 'branch', label: 'Branch', options: BRANCHES.map((b) => ({ value: b.code, label: b.name })) });

  const reversible = (t: Transaction) => t.status === 'Posted' && t.accountKind === 'DEPOSIT' && ['Deposit', 'Withdrawal'].includes(t.type) && t.date === today();

  return (
    <div data-testid="transaction-list-page">
      <PageHeader
        title="Transactions"
        subtitle={`All posted and pending transactions of ${branchName(user.branch)}`}
        actions={
          can('txn.post') && (
            <Button testId="new-transaction-btn" onClick={() => navigate('/transactions/new')}>
              + New Transaction
            </Button>
          )
        }
      />
      <Card>
        <DataTable<Transaction>
          id="transactions"
          rowTestIdPrefix="txn-row"
          rows={rows}
          rowId={(t) => t.txnId}
          searchPlaceholder="Search by transaction ID, account number or customer ID"
          filters={filters}
          dateFilter={{ label: 'Date', value: (t) => t.date }}
          exportFileName="transactions.csv"
          emptyMessage="No transactions found for the selected criteria."
          selectable
          bulkActions={(selected) => (
            <Button
              size="sm"
              variant="secondary"
              testId="bulk-export-btn"
              onClick={() =>
                downloadCSV(
                  'transactions_selected.csv',
                  toCSV(
                    ['Transaction ID', 'Date', 'Account', 'Type', 'Debit', 'Credit', 'Status'],
                    selected.map((t) => [t.txnId, t.date, t.accountNo, t.type, t.debit, t.credit, t.status]),
                  ),
                )
              }
            >
              Export Selected
            </Button>
          )}
          columns={[
            { key: 'txnId', header: 'Transaction ID' },
            { key: 'date', header: 'Date', searchable: false },
            { key: 'accountNo', header: 'Account No', render: (t) => <AccountLink accountNo={t.accountNo} /> },
            { key: 'customerId', header: 'Customer ID' },
            { key: 'type', header: 'Type', searchable: false },
            { key: 'description', header: 'Description', searchable: false, className: 'whitespace-normal min-w-[12rem]' },
            { key: 'debit', header: 'Debit', searchable: false, align: 'right', render: (t) => (t.debit ? money(t.debit) : '-') },
            { key: 'credit', header: 'Credit', searchable: false, align: 'right', render: (t) => (t.credit ? money(t.credit) : '-') },
            { key: 'balanceAfter', header: 'Balance After', searchable: false, align: 'right', render: (t) => (t.status === 'Pending Approval' ? '-' : money(t.balanceAfter)) },
            { key: 'createdBy', header: 'Posted By', searchable: false },
            { key: 'status', header: 'Status', searchable: false, render: (t) => <StatusBadge status={t.status} /> },
          ]}
          actions={
            can('txn.reverse')
              ? (t) =>
                  reversible(t) ? (
                    <Button size="sm" variant="danger" testId={`reverse-btn-${t.txnId}`} onClick={() => reverse(t)}>
                      Reverse
                    </Button>
                  ) : null
              : undefined
          }
        />
      </Card>
    </div>
  );
}

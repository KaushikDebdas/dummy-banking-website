import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../../auth/AuthContext';
import { DataTable, type ContextMenuItem, type FilterDef } from '../../components/table/DataTable';
import { Button, Card, PageHeader, StatusBadge } from '../../components/ui';
import { HoverCard } from '../../components/ui/advanced';
import { useFeedback } from '../../components/ui/feedback';
import { copyText } from '../../lib/clipboard';
import { BRANCHES, DEPOSIT_PRODUCTS, DEPOSIT_PRODUCT_LIST, branchName } from '../../data/reference';
import { useAction } from '../../hooks/useAction';
import { money } from '../../lib/format';
import { useStore } from '../../store/StoreContext';
import { visibleDeposits } from '../../store/selectors';
import * as svc from '../../store/services';
import type { DepositAccount } from '../../types';
import { CustomerLink } from '../common';

export function DepositListPage() {
  const user = useCurrentUser();
  const { can } = useAuth();
  const { state } = useStore();
  const act = useAction();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const highlight = (useLocation().state as { highlight?: string } | null)?.highlight;
  const rows = visibleDeposits(state, user);
  const { toast } = useFeedback();

  const menuFor = (d: DepositAccount): ContextMenuItem[] => [
    { key: 'view', label: 'View account', onClick: () => navigate(`/deposits/${d.accountNo}`) },
    { key: 'statement', label: 'View statement', onClick: () => navigate(`/statements?account=${d.accountNo}`), disabled: ['Pending Approval', 'Rejected'].includes(d.status) },
    { key: 'transact', label: 'New transaction', onClick: () => navigate(`/transactions/new?account=${d.accountNo}`), disabled: !can('txn.post') || !['Active', 'Frozen'].includes(d.status) },
    { key: 'customer', label: 'Open customer', onClick: () => navigate(`/customers/${d.customerId}`) },
    {
      key: 'copy-account',
      label: 'Copy account number',
      onClick: async () => {
        const copied = await copyText(d.accountNo);
        toast(copied ? 'success' : 'error', copied ? `Copied ${d.accountNo} to clipboard` : 'Clipboard access was denied by the browser');
      },
    },
  ];

  const filters: FilterDef<DepositAccount>[] = [
    { key: 'product', label: 'Product', options: DEPOSIT_PRODUCT_LIST.map((p) => ({ value: p.code, label: p.name })) },
    { key: 'status', label: 'Status', options: ['Pending Approval', 'Active', 'Frozen', 'Matured', 'Closed', 'Rejected'].map((s) => ({ value: s, label: s })) },
  ];
  if (user.branch === 'ALL') filters.push({ key: 'branch', label: 'Branch', options: BRANCHES.map((b) => ({ value: b.code, label: b.name })) });

  return (
    <div data-testid="deposit-list-page">
      <PageHeader
        title="Deposit Accounts"
        subtitle={`Savings, Current, FDR, DPS and MBS accounts of ${branchName(user.branch)}`}
        actions={
          can('deposit.create') && (
            <Button testId="new-deposit-btn" onClick={() => navigate('/deposits/new')}>
              + New Deposit Account
            </Button>
          )
        }
      />
      <Card>
        <DataTable<DepositAccount>
          id="deposits"
          rowTestIdPrefix="deposit-row"
          rows={rows}
          rowId={(d) => d.accountNo}
          initialSearch={params.get('customerId') ?? ''}
          searchPlaceholder="Search by account number, customer ID or name"
          filters={filters}
          exportFileName="deposit_accounts.csv"
          emptyMessage="No deposit accounts match your search criteria."
          rowClassName={(d) => (d.accountNo === highlight ? 'bg-teal-50' : undefined)}
          onRowDoubleClick={(d) => navigate(`/deposits/${d.accountNo}`)}
          contextMenu={menuFor}
          columns={[
            {
              key: 'accountNo',
              header: 'Account No',
              render: (d) => (
                <button type="button" className="font-medium text-teal-700 hover:underline" data-testid={`account-link-${d.accountNo}`} onClick={() => navigate(`/deposits/${d.accountNo}`)}>
                  {d.accountNo}
                </button>
              ),
            },
            {
              key: 'customerId',
              header: 'Customer ID',
              render: (d) => {
                const c = state.customers.find((x) => x.customerId === d.customerId);
                return (
                  <HoverCard testId={`customer-hovercard-${d.accountNo}`} trigger={<CustomerLink id={d.customerId} />}>
                    <div className="font-semibold text-slate-900">{c?.fullName}</div>
                    <div className="text-xs text-slate-500">{d.customerId}</div>
                    <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
                      <dt className="text-slate-500">Mobile</dt>
                      <dd data-testid="hovercard-mobile">{c?.mobile}</dd>
                      <dt className="text-slate-500">KYC</dt>
                      <dd data-testid="hovercard-kyc">{c?.kycStatus}</dd>
                      <dt className="text-slate-500">Accounts</dt>
                      <dd data-testid="hovercard-accounts">{state.deposits.filter((x) => x.customerId === d.customerId).length}</dd>
                    </dl>
                  </HoverCard>
                );
              },
            },
            { key: 'customerName', header: 'Customer Name' },
            { key: 'product', header: 'Product', searchable: false, render: (d) => DEPOSIT_PRODUCTS[d.product].name },
            { key: 'openingDate', header: 'Opening Date', searchable: false },
            { key: 'interestRate', header: 'Rate %', searchable: false, align: 'right', render: (d) => d.interestRate.toFixed(2) },
            { key: 'balance', header: 'Balance', searchable: false, align: 'right', render: (d) => money(d.balance) },
            { key: 'maturityDate', header: 'Maturity', searchable: false, render: (d) => d.maturityDate ?? '-' },
            { key: 'branch', header: 'Branch', searchable: false },
            { key: 'status', header: 'Status', searchable: false, render: (d) => <StatusBadge status={d.status} /> },
          ]}
          actions={(d) => (
            <>
              <Button size="sm" variant="secondary" testId={`view-btn-${d.accountNo}`} onClick={() => navigate(`/deposits/${d.accountNo}`)}>
                View
              </Button>
              {can('deposit.approve') && d.status === 'Pending Approval' && (
                <Button size="sm" variant="success" testId={`approve-btn-${d.accountNo}`} onClick={() => act((s, u) => svc.approveDeposit(s, u, d.accountNo))}>
                  Approve
                </Button>
              )}
              {can('txn.post') && ['Active', 'Frozen'].includes(d.status) && (
                <Button size="sm" variant="ghost" testId={`transact-btn-${d.accountNo}`} onClick={() => navigate(`/transactions/new?account=${d.accountNo}`)}>
                  Transact
                </Button>
              )}
              {can('statement.view') && d.status !== 'Pending Approval' && d.status !== 'Rejected' && (
                <Button size="sm" variant="ghost" testId={`statement-btn-${d.accountNo}`} onClick={() => navigate(`/statements?account=${d.accountNo}`)}>
                  Statement
                </Button>
              )}
            </>
          )}
        />
      </Card>
    </div>
  );
}

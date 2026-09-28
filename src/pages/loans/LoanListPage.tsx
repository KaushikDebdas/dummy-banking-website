import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../../auth/AuthContext';
import { DataTable, type FilterDef } from '../../components/table/DataTable';
import { Button, Card, PageHeader, StatusBadge } from '../../components/ui';
import { useFeedback } from '../../components/ui/feedback';
import { BRANCHES, LOAN_PRODUCTS, LOAN_PRODUCT_LIST, branchName } from '../../data/reference';
import { useAction } from '../../hooks/useAction';
import { money } from '../../lib/format';
import { installmentStatus, scheduleTotals } from '../../lib/loanCalc';
import { useStore } from '../../store/StoreContext';
import { visibleLoans } from '../../store/selectors';
import * as svc from '../../store/services';
import type { LoanAccount } from '../../types';
import { CustomerLink } from '../common';

export const LOAN_STATUSES = ['Applied', 'Approved', 'Active', 'Closed', 'Rejected', 'Written Off'];

export function LoanListPage() {
  const user = useCurrentUser();
  const { can } = useAuth();
  const { state } = useStore();
  const { confirm } = useFeedback();
  const act = useAction();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const highlight = (useLocation().state as { highlight?: string } | null)?.highlight;
  const rows = visibleLoans(state, user);

  const filters: FilterDef<LoanAccount>[] = [
    { key: 'product', label: 'Product', options: LOAN_PRODUCT_LIST.map((p) => ({ value: p.code, label: p.name })) },
    { key: 'status', label: 'Status', options: LOAN_STATUSES.map((s) => ({ value: s, label: s })) },
  ];
  if (user.branch === 'ALL') filters.push({ key: 'branch', label: 'Branch', options: BRANCHES.map((b) => ({ value: b.code, label: b.name })) });

  const disburse = async (l: LoanAccount) => {
    const { confirmed } = await confirm({ title: 'Disburse Loan', message: `Disburse ${money(l.amount)} for ${l.loanAccountNo}?`, confirmLabel: 'Disburse', variant: 'success' });
    if (confirmed) await act((d, u) => svc.disburseLoan(d, u, l.loanAccountNo));
  };

  return (
    <div data-testid="loan-list-page">
      <PageHeader
        title="Loan Accounts"
        subtitle={`Loan portfolio of ${branchName(user.branch)}`}
        actions={
          <>
            <Button variant="secondary" testId="loan-pipeline-btn" onClick={() => navigate('/loans/pipeline')}>
              Pipeline Board
            </Button>
            {can('loan.create') && (
              <Button testId="new-loan-btn" onClick={() => navigate('/loans/new')}>
                + New Loan Account
              </Button>
            )}
          </>
        }
      />
      <Card>
        <DataTable<LoanAccount>
          id="loans"
          rowTestIdPrefix="loan-row"
          rows={rows}
          rowId={(l) => l.loanAccountNo}
          initialSearch={params.get('customerId') ?? ''}
          searchPlaceholder="Search by loan account number, customer ID or name"
          filters={filters}
          exportFileName="loan_accounts.csv"
          emptyMessage="No loan accounts match your search criteria."
          rowClassName={(l) => (l.loanAccountNo === highlight ? 'bg-teal-50' : undefined)}
          onRowDoubleClick={(l) => navigate(`/loans/${l.loanAccountNo}`)}
          renderExpanded={(l) => {
            const t = scheduleTotals(l.schedule);
            return (
              <div className="grid gap-4 text-sm md:grid-cols-4" data-testid={`loan-summary-${l.loanAccountNo}`}>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Schedule</div>
                  <div data-testid="summary-schedule">{l.schedule.length ? `${t.paidCount} of ${t.totalInstallments} paid` : 'Not generated'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Next Due</div>
                  <div data-testid="summary-next-due">{t.nextDue ? `#${t.nextDue.installmentNo} · ${t.nextDue.dueDate} · ${money(t.nextDue.installmentAmount)} (${installmentStatus(t.nextDue)})` : '-'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Overdue</div>
                  <div data-testid="summary-overdue">{t.overdueCount} installment(s) · {money(t.overdueAmount)}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Collateral</div>
                  <div data-testid="summary-collateral">{l.collateral?.length ? l.collateral.join(', ') : 'None'}</div>
                </div>
              </div>
            );
          }}
          columns={[
            {
              key: 'loanAccountNo',
              header: 'Loan A/C No',
              render: (l) => (
                <button type="button" className="font-medium text-teal-700 hover:underline" data-testid={`account-link-${l.loanAccountNo}`} onClick={() => navigate(`/loans/${l.loanAccountNo}`)}>
                  {l.loanAccountNo}
                </button>
              ),
            },
            { key: 'customerId', header: 'Customer ID', render: (l) => <CustomerLink id={l.customerId} /> },
            { key: 'customerName', header: 'Customer Name' },
            { key: 'product', header: 'Product', searchable: false, render: (l) => LOAN_PRODUCTS[l.product].name },
            { key: 'amount', header: 'Loan Amount', searchable: false, align: 'right', render: (l) => money(l.amount) },
            { key: 'interestRate', header: 'Rate %', searchable: false, align: 'right', render: (l) => l.interestRate.toFixed(2) },
            { key: 'tenureMonths', header: 'Tenure', searchable: false, align: 'right' },
            { key: 'frequency', header: 'Frequency', searchable: false },
            { key: 'installmentAmount', header: 'Installment', searchable: false, align: 'right', render: (l) => money(l.installmentAmount) },
            { key: 'outstandingPrincipal', header: 'Outstanding', searchable: false, align: 'right', render: (l) => money(l.outstandingPrincipal) },
            { key: 'startDate', header: 'Start Date', searchable: false },
            { key: 'branch', header: 'Branch', searchable: false },
            { key: 'status', header: 'Status', searchable: false, render: (l) => <StatusBadge status={l.status} /> },
          ]}
          actions={(l) => (
            <>
              <Button size="sm" variant="secondary" testId={`view-btn-${l.loanAccountNo}`} onClick={() => navigate(`/loans/${l.loanAccountNo}`)}>
                View
              </Button>
              {can('loan.approve') && l.status === 'Applied' && (
                <Button size="sm" variant="success" testId={`approve-btn-${l.loanAccountNo}`} onClick={() => act((d, u) => svc.approveLoan(d, u, l.loanAccountNo))}>
                  Approve
                </Button>
              )}
              {can('loan.disburse') && l.status === 'Approved' && (
                <Button size="sm" variant="success" testId={`disburse-btn-${l.loanAccountNo}`} onClick={() => disburse(l)}>
                  Disburse
                </Button>
              )}
              <Button size="sm" variant="ghost" testId={`schedule-btn-${l.loanAccountNo}`} onClick={() => navigate(`/loans/${l.loanAccountNo}/schedule`)}>
                Schedule
              </Button>
              {['Active', 'Closed', 'Written Off'].includes(l.status) && (
                <Button size="sm" variant="ghost" testId={`statement-btn-${l.loanAccountNo}`} onClick={() => navigate(`/statements?account=${l.loanAccountNo}`)}>
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

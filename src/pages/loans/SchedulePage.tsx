import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../../auth/AuthContext';
import { canAccessBranch } from '../../auth/permissions';
import { AccessDenied } from '../../auth/RequirePermission';
import { DataTable } from '../../components/table/DataTable';
import { Alert, Button, Card, PageHeader, StatusBadge } from '../../components/ui';
import { useFeedback } from '../../components/ui/feedback';
import { LOAN_PRODUCTS } from '../../data/reference';
import { useAction } from '../../hooks/useAction';
import { money } from '../../lib/format';
import { installmentStatus, scheduleTotals } from '../../lib/loanCalc';
import { useStore } from '../../store/StoreContext';
import * as svc from '../../store/services';
import type { Installment } from '../../types';
import { EntityNotFound } from '../common';

export function SchedulePage() {
  const { loanNo = '' } = useParams();
  const user = useCurrentUser();
  const { can } = useAuth();
  const { state } = useStore();
  const { confirm } = useFeedback();
  const act = useAction();
  const navigate = useNavigate();
  const l = state.loans.find((x) => x.loanAccountNo === loanNo);

  if (!l) return <EntityNotFound testId="loan-not-found" message={`Loan account ${loanNo} does not exist.`} />;
  if (!canAccessBranch(user, l.branch)) return <AccessDenied />;

  const t = scheduleTotals(l.schedule);
  const canPay = can('schedule.pay') && l.status === 'Active';

  const pay = async (inst: Installment) => {
    const { confirmed } = await confirm({
      title: 'Collect Installment',
      message: `Collect installment #${inst.installmentNo} of ${money(inst.installmentAmount)} (principal ${money(inst.principal)} + interest ${money(inst.interest)}) for ${l.loanAccountNo}?`,
      confirmLabel: 'Mark as Paid',
      variant: 'success',
    });
    if (confirmed) await act((d, u) => svc.payInstallment(d, u, l.loanAccountNo, inst.installmentNo));
  };

  const summary = [
    { id: 'schedule-total-installments', label: 'Total Installments', value: String(t.totalInstallments), raw: t.totalInstallments },
    { id: 'schedule-installment-amount', label: `${l.frequency} Installment`, value: money(l.installmentAmount), raw: l.installmentAmount },
    { id: 'schedule-total-interest', label: 'Total Interest Payable', value: money(t.totalInterest), raw: t.totalInterest },
    { id: 'schedule-total-repayment', label: 'Total Repayment Amount', value: money(t.totalRepayment), raw: t.totalRepayment },
    { id: 'schedule-paid-count', label: 'Installments Paid', value: String(t.paidCount), raw: t.paidCount },
    { id: 'schedule-overdue-count', label: 'Overdue Installments', value: String(t.overdueCount), raw: t.overdueCount },
    { id: 'schedule-outstanding', label: 'Outstanding Principal', value: money(l.outstandingPrincipal), raw: l.outstandingPrincipal },
    { id: 'schedule-next-due', label: 'Next Due Date', value: t.nextDue?.dueDate ?? '-', raw: t.nextDue?.dueDate ?? '' },
  ];

  return (
    <div data-testid="schedule-page" data-loan-no={l.loanAccountNo}>
      <PageHeader
        title="Loan Repayment Schedule"
        subtitle={
          <>
            <Link to={`/loans/${l.loanAccountNo}`} className="font-medium text-teal-700 hover:underline" data-testid="schedule-loan-no">
              {l.loanAccountNo}
            </Link>{' '}
            · {l.customerName} ({l.customerId}) · {LOAN_PRODUCTS[l.product].name} · {money(l.amount)} @ {l.interestRate.toFixed(2)}% · {l.tenureMonths} months · <StatusBadge status={l.status} testId="schedule-loan-status" />
          </>
        }
        actions={
          <>
            {can('schedule.generate') && l.schedule.length === 0 && ['Applied', 'Approved', 'Active'].includes(l.status) && (
              <Button testId="generate-schedule-btn" onClick={() => act((d, u) => svc.generateLoanSchedule(d, u, l.loanAccountNo))}>
                Generate Schedule
              </Button>
            )}
            <Button variant="secondary" testId="schedule-back-btn" onClick={() => navigate(`/loans/${l.loanAccountNo}`)}>
              Back to Loan
            </Button>
          </>
        }
      />

      {l.schedule.length === 0 ? (
        <Card testId="schedule-empty-card">
          <div className="py-6 text-center text-sm text-slate-600" data-testid="schedule-not-generated">
            {['Rejected', 'Closed', 'Written Off'].includes(l.status)
              ? `No repayment schedule is available for a ${l.status} loan.`
              : 'Repayment schedule has not been generated yet for this loan.'}
          </div>
        </Card>
      ) : (
        <>
          {l.status !== 'Active' && (
            <div className="mb-4">
              <Alert kind="info" testId="schedule-status-info">
                {l.status === 'Closed' ? 'Loan is fully repaid and closed.' : `Loan status is ${l.status}. Installments can be collected only after disbursement (Active).`}
              </Alert>
            </div>
          )}
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="schedule-summary">
            {summary.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">{s.label}</div>
                <div className="mt-1 text-lg font-semibold" data-testid={s.id} data-value={s.raw}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <Card testId="schedule-card">
            <DataTable<Installment>
              id="schedule"
              rowTestIdPrefix="installment-row"
              rows={l.schedule}
              rowId={(i) => String(i.installmentNo)}
              hideSearch
              pageSizeOptions={[6, 12, 24, 60, 120, 300]}
              defaultPageSize={12}
              exportFileName={`schedule_${l.loanAccountNo}.csv`}
              emptyMessage="No installments match the selected filter."
              filters={[
                {
                  key: 'status',
                  label: 'Payment Status',
                  options: ['Pending', 'Paid', 'Overdue'].map((s) => ({ value: s, label: s })),
                  predicate: (i, v) => installmentStatus(i) === v,
                },
              ]}
              dateFilter={{ label: 'Due Date', value: (i) => i.dueDate }}
              rowClassName={(i) => (installmentStatus(i) === 'Overdue' ? 'bg-rose-50/60' : undefined)}
              columns={[
                { key: 'installmentNo', header: 'Inst. No', align: 'center' },
                { key: 'dueDate', header: 'Due Date' },
                { key: 'openingPrincipal', header: 'Opening Principal', align: 'right', render: (i) => money(i.openingPrincipal) },
                { key: 'installmentAmount', header: 'Installment', align: 'right', render: (i) => money(i.installmentAmount) },
                { key: 'principal', header: 'Principal', align: 'right', render: (i) => money(i.principal) },
                { key: 'interest', header: 'Interest', align: 'right', render: (i) => money(i.interest) },
                { key: 'closingPrincipal', header: 'Closing Principal', align: 'right', render: (i) => money(i.closingPrincipal) },
                { key: 'status', header: 'Status', value: (i) => installmentStatus(i), render: (i) => <StatusBadge status={installmentStatus(i)} /> },
                { key: 'paidDate', header: 'Paid On', value: (i) => i.paidDate ?? '' , render: (i) => i.paidDate ?? '-' },
                { key: 'paymentTxnId', header: 'Payment Txn', value: (i) => i.paymentTxnId ?? '', render: (i) => i.paymentTxnId ?? '-' },
              ]}
              actions={
                canPay
                  ? (i) =>
                      i.paid ? (
                        <span className="text-xs text-emerald-700" data-testid={`paid-label-${i.installmentNo}`}>
                          Paid
                        </span>
                      ) : (
                        <Button size="sm" variant="success" testId={`pay-btn-${i.installmentNo}`} onClick={() => pay(i)}>
                          Mark Paid
                        </Button>
                      )
                  : undefined
              }
            />
          </Card>
        </>
      )}
    </div>
  );
}

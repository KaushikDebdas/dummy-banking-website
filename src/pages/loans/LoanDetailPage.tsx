import { useNavigate, useParams } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../../auth/AuthContext';
import { canAccessBranch } from '../../auth/permissions';
import { AccessDenied } from '../../auth/RequirePermission';
import { Alert, Button, Card, DetailGrid, PageHeader, StatusBadge, cx } from '../../components/ui';
import { useFeedback } from '../../components/ui/feedback';
import { LOAN_PRODUCTS, branchName } from '../../data/reference';
import { useAction } from '../../hooks/useAction';
import { formatDateTime } from '../../lib/dates';
import { money } from '../../lib/format';
import { scheduleTotals } from '../../lib/loanCalc';
import { useStore } from '../../store/StoreContext';
import * as svc from '../../store/services';
import { CustomerLink, EntityNotFound } from '../common';

const WORKFLOW = ['Applied', 'Approved', 'Active', 'Closed'];

export function LoanDetailPage() {
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

  const cfg = LOAN_PRODUCTS[l.product];
  const totals = scheduleTotals(l.schedule);
  const stepIndex = WORKFLOW.indexOf(l.status);

  const approve = async () => {
    const { confirmed } = await confirm({ title: 'Approve Loan', message: `Approve loan ${l.loanAccountNo} of ${money(l.amount)}?`, confirmLabel: 'Approve', variant: 'success' });
    if (confirmed) await act((d, u) => svc.approveLoan(d, u, l.loanAccountNo));
  };
  const reject = async () => {
    const r = await confirm({ title: 'Reject Loan', message: `Reject loan ${l.loanAccountNo}?`, confirmLabel: 'Reject', variant: 'danger', remarks: true, remarksRequired: true });
    if (r.confirmed) await act((d, u) => svc.rejectLoan(d, u, l.loanAccountNo, r.remarks));
  };
  const disburse = async () => {
    const { confirmed } = await confirm({ title: 'Disburse Loan', message: `Disburse ${money(l.amount)} for ${l.loanAccountNo}? The repayment schedule will be generated if it does not exist yet.`, confirmLabel: 'Disburse', variant: 'success' });
    if (confirmed) await act((d, u) => svc.disburseLoan(d, u, l.loanAccountNo));
  };
  const generate = async () => {
    const res = await act((d, u) => svc.generateLoanSchedule(d, u, l.loanAccountNo));
    if (res.ok) navigate(`/loans/${l.loanAccountNo}/schedule`);
  };
  const writeOff = async () => {
    const r = await confirm({ title: 'Write Off Loan', message: `Write off ${l.loanAccountNo} with outstanding ${money(l.outstandingPrincipal)}?`, confirmLabel: 'Write Off', variant: 'danger', remarks: true, remarksRequired: true });
    if (r.confirmed) await act((d, u) => svc.writeOffLoan(d, u, l.loanAccountNo, r.remarks));
  };

  return (
    <div data-testid="loan-detail-page" data-loan-no={l.loanAccountNo}>
      <PageHeader
        title={cfg.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span data-testid="loan-account-no-value">{l.loanAccountNo}</span>
            <StatusBadge status={l.status} testId="loan-status-badge" />
          </span>
        }
        actions={
          <>
            {can('loan.approve') && l.status === 'Applied' && (
              <Button variant="success" testId="loan-approve-btn" onClick={approve}>
                Approve
              </Button>
            )}
            {can('loan.approve') && ['Applied', 'Approved'].includes(l.status) && (
              <Button variant="danger" testId="loan-reject-btn" onClick={reject}>
                Reject
              </Button>
            )}
            {can('loan.disburse') && l.status === 'Approved' && (
              <Button variant="success" testId="loan-disburse-btn" onClick={disburse}>
                Disburse
              </Button>
            )}
            {can('schedule.generate') && l.schedule.length === 0 && ['Applied', 'Approved', 'Active'].includes(l.status) && (
              <Button testId="loan-generate-schedule-btn" onClick={generate}>
                Generate Schedule
              </Button>
            )}
            <Button variant="secondary" testId="loan-view-schedule-btn" onClick={() => navigate(`/loans/${l.loanAccountNo}/schedule`)}>
              Repayment Schedule
            </Button>
            {can('statement.view') && ['Active', 'Closed', 'Written Off'].includes(l.status) && (
              <Button variant="secondary" testId="loan-statement-btn" onClick={() => navigate(`/statements?account=${l.loanAccountNo}`)}>
                View Statement
              </Button>
            )}
            {can('loan.writeoff') && l.status === 'Active' && (
              <Button variant="danger" testId="loan-writeoff-btn" onClick={writeOff}>
                Write Off
              </Button>
            )}
          </>
        }
      />

      <ol className="mb-5 flex flex-wrap items-center gap-2 text-xs" data-testid="loan-workflow" data-status={l.status}>
        {WORKFLOW.map((s, i) => (
          <li
            key={s}
            data-testid={`loan-workflow-step-${s.toLowerCase()}`}
            data-complete={stepIndex >= i}
            className={cx('rounded-full border px-3 py-1 font-medium', stepIndex >= i ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-500')}
          >
            {i + 1}. {s === 'Active' ? 'Disbursed / Active' : s}
          </li>
        ))}
        {['Rejected', 'Written Off'].includes(l.status) && <StatusBadge status={l.status} />}
      </ol>

      {l.remarks && (
        <div className="mb-4">
          <Alert kind={l.status === 'Rejected' || l.status === 'Written Off' ? 'error' : 'info'} testId="loan-remarks-alert">
            Remarks: {l.remarks}
          </Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { id: 'loan-amount', label: 'Loan Amount (BDT)', value: l.amount },
          { id: 'loan-outstanding', label: 'Outstanding Principal (BDT)', value: l.outstandingPrincipal },
          { id: 'loan-installment', label: `${l.frequency} Installment (BDT)`, value: l.installmentAmount },
          { id: 'loan-overdue', label: `Overdue (${totals.overdueCount} inst.)`, value: totals.overdueAmount },
        ].map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4" data-testid={`${c.id}-card`}>
            <div className="text-xs uppercase text-slate-500">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold" data-testid={`${c.id}-value`} data-value={c.value}>
              {money(c.value)}
            </div>
          </div>
        ))}
      </div>

      <Card title="Loan Information" testId="loan-info-card">
        <DetailGrid
          prefix="loan-detail"
          items={[
            { key: 'loanAccountNo', label: 'Loan Account Number', value: l.loanAccountNo },
            { key: 'customerId', label: 'Customer ID', value: <CustomerLink id={l.customerId} />, raw: l.customerId },
            { key: 'customerName', label: 'Customer Name', value: l.customerName },
            { key: 'product', label: 'Loan Product', value: cfg.name, raw: l.product },
            { key: 'amount', label: 'Loan Amount', value: money(l.amount), raw: l.amount },
            { key: 'interestRate', label: 'Interest Rate', value: `${l.interestRate.toFixed(2)}%`, raw: l.interestRate },
            { key: 'tenureMonths', label: 'Loan Tenure', value: `${l.tenureMonths} months`, raw: l.tenureMonths },
            { key: 'frequency', label: 'Repayment Frequency', value: l.frequency },
            { key: 'numberOfInstallments', label: 'No. of Installments', value: l.numberOfInstallments },
            { key: 'installmentAmount', label: 'Installment Amount', value: money(l.installmentAmount), raw: l.installmentAmount },
            { key: 'startDate', label: 'Loan Start Date', value: l.startDate },
            { key: 'maturityDate', label: 'Loan Maturity Date', value: l.maturityDate },
            { key: 'purpose', label: 'Purpose', value: l.purpose },
            { key: 'collateral', label: 'Collateral', value: l.collateral?.length ? l.collateral.join(', ') : 'None' },
            { key: 'insurance', label: 'Credit Life Insurance', value: l.insurance ? 'Yes' : 'No', raw: String(!!l.insurance) },
            { key: 'documents', label: 'Documents', value: l.documents?.length ? l.documents.map((d) => d.name).join(', ') : 'None', raw: l.documents?.length ?? 0 },
            { key: 'outstandingPrincipal', label: 'Outstanding Balance', value: money(l.outstandingPrincipal), raw: l.outstandingPrincipal },
            { key: 'nextDue', label: 'Next Due', value: totals.nextDue ? `#${totals.nextDue.installmentNo} on ${totals.nextDue.dueDate} (${money(totals.nextDue.installmentAmount)})` : '-' },
            { key: 'paidInstallments', label: 'Installments Paid', value: `${totals.paidCount} of ${l.schedule.length || l.numberOfInstallments}`, raw: totals.paidCount },
            { key: 'branch', label: 'Branch', value: branchName(l.branch), raw: l.branch },
            { key: 'status', label: 'Loan Status', value: l.status },
            { key: 'createdBy', label: 'Created By (Maker)', value: `${l.createdBy} · ${formatDateTime(l.createdAt)}` },
            { key: 'approvedBy', label: 'Approved By (Checker)', value: l.approvedBy ? `${l.approvedBy} · ${formatDateTime(l.approvedAt)}` : '-' },
            { key: 'disbursedAt', label: 'Disbursed At', value: formatDateTime(l.disbursedAt) },
          ]}
        />
      </Card>
    </div>
  );
}

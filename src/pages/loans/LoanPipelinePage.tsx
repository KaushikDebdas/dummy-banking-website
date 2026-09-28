import { useState, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../../auth/AuthContext';
import { Alert, Button, PageHeader, cx } from '../../components/ui';
import { InfoTip } from '../../components/ui/advanced';
import { useFeedback } from '../../components/ui/feedback';
import { LOAN_PRODUCTS, branchName } from '../../data/reference';
import { useAction } from '../../hooks/useAction';
import { money } from '../../lib/format';
import { useStore } from '../../store/StoreContext';
import { visibleLoans } from '../../store/selectors';
import * as svc from '../../store/services';
import type { LoanAccount, LoanStatus } from '../../types';

const COLUMNS: { status: LoanStatus; title: string; hint: string }[] = [
  { status: 'Applied', title: 'Applied', hint: 'New applications waiting for a checker' },
  { status: 'Approved', title: 'Approved', hint: 'Drop here to approve an Applied loan' },
  { status: 'Active', title: 'Disbursed / Active', hint: 'Drop an Approved loan here to disburse it' },
  { status: 'Rejected', title: 'Rejected', hint: 'Drop an Applied or Approved loan here to reject it' },
];

/**
 * Kanban-style loan pipeline. Cards are moved with native HTML5 drag-and-drop
 * (Playwright: locator.drag_to(target)). Each drop calls the same service as the
 * buttons elsewhere, so permissions and maker-checker rules still apply.
 */
export function LoanPipelinePage() {
  const user = useCurrentUser();
  const { can } = useAuth();
  const { state } = useStore();
  const { confirm, toast } = useFeedback();
  const act = useAction();
  const navigate = useNavigate();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<LoanStatus | null>(null);
  const loans = visibleLoans(state, user).filter((l) => COLUMNS.some((c) => c.status === l.status));

  const move = async (loanNo: string, to: LoanStatus) => {
    const loan = state.loans.find((l) => l.loanAccountNo === loanNo);
    if (!loan || loan.status === to) return;
    const from = loan.status;
    if (from === 'Applied' && to === 'Approved') return act((d, u) => svc.approveLoan(d, u, loanNo));
    if (from === 'Approved' && to === 'Active') {
      const { confirmed } = await confirm({ title: 'Disburse Loan', message: `Disburse ${money(loan.amount)} for ${loanNo}?`, confirmLabel: 'Disburse', variant: 'success' });
      if (confirmed) await act((d, u) => svc.disburseLoan(d, u, loanNo));
      return;
    }
    if ((from === 'Applied' || from === 'Approved') && to === 'Rejected') {
      const r = await confirm({ title: 'Reject Loan', message: `Reject ${loanNo}?`, confirmLabel: 'Reject', variant: 'danger', remarks: true, remarksRequired: true });
      if (r.confirmed) await act((d, u) => svc.rejectLoan(d, u, loanNo, r.remarks));
      return;
    }
    toast('error', `Moving a loan from ${from} to ${to === 'Active' ? 'Disbursed / Active' : to} is not allowed`);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>, to: LoanStatus) => {
    e.preventDefault();
    const loanNo = e.dataTransfer.getData('text/plain') || dragging;
    setOver(null);
    setDragging(null);
    if (loanNo) move(loanNo, to);
  };

  return (
    <div data-testid="loan-pipeline-page">
      <PageHeader
        title="Loan Pipeline"
        subtitle={`Drag loan cards between columns to approve, disburse or reject them · ${branchName(user.branch)}`}
        actions={
          <Button variant="secondary" testId="pipeline-back-btn" onClick={() => navigate('/loans')}>
            Back to Loan List
          </Button>
        }
      />
      {!can('loan.approve') && (
        <div className="mb-4">
          <Alert kind="info" testId="pipeline-readonly-alert">
            Your role cannot approve or disburse loans. You can still drag cards, but the move will be rejected with an access-denied message.
          </Alert>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="pipeline-board">
        {COLUMNS.map((col) => {
          const items = loans.filter((l) => l.status === col.status);
          return (
            <div
              key={col.status}
              data-testid={`pipeline-column-${col.status}`}
              data-status={col.status}
              data-drag-over={over === col.status}
              aria-label={`${col.title} column`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setOver(col.status);
              }}
              onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
              onDrop={(e) => onDrop(e, col.status)}
              className={cx('flex min-h-[18rem] flex-col rounded-lg border-2 p-3 transition-colors', over === col.status ? 'border-teal-500 bg-teal-50' : 'border-dashed border-slate-300 bg-slate-50')}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center text-sm font-semibold text-slate-800">
                  {col.title}
                  <InfoTip id={`pipeline-${col.status}`} text={col.hint} />
                </h2>
                <span className="rounded-full bg-slate-200 px-2 text-xs font-medium text-slate-700" data-testid={`pipeline-count-${col.status}`} data-count={items.length}>
                  {items.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {items.length === 0 && (
                  <p className="py-6 text-center text-xs text-slate-400" data-testid={`pipeline-empty-${col.status}`}>
                    Drop loans here
                  </p>
                )}
                {items.map((l) => (
                  <LoanCard
                    key={l.loanAccountNo}
                    loan={l}
                    dragging={dragging === l.loanAccountNo}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', l.loanAccountNo);
                      e.dataTransfer.effectAllowed = 'move';
                      setDragging(l.loanAccountNo);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoanCard({ loan, dragging, onDragStart, onDragEnd }: { loan: LoanAccount; dragging: boolean; onDragStart: (e: DragEvent<HTMLDivElement>) => void; onDragEnd: () => void }) {
  return (
    <div
      draggable
      data-testid={`pipeline-card-${loan.loanAccountNo}`}
      data-loan-no={loan.loanAccountNo}
      data-status={loan.status}
      aria-roledescription="Draggable loan card"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cx('cursor-grab rounded-md border border-slate-200 bg-white p-3 text-sm shadow-sm active:cursor-grabbing', dragging && 'opacity-50')}
    >
      <div className="flex items-center justify-between gap-2">
        <Link to={`/loans/${loan.loanAccountNo}`} className="font-medium text-teal-700 hover:underline" data-testid={`pipeline-link-${loan.loanAccountNo}`} draggable={false}>
          {loan.loanAccountNo}
        </Link>
        <span className="text-xs text-slate-500" aria-hidden="true">
          ⠿
        </span>
      </div>
      <div className="mt-1 text-slate-800">{loan.customerName}</div>
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{LOAN_PRODUCTS[loan.product].name}</span>
        <span data-testid={`pipeline-amount-${loan.loanAccountNo}`}>{money(loan.amount)}</span>
      </div>
    </div>
  );
}

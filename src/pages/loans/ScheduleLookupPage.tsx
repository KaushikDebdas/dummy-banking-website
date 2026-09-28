import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../../auth/AuthContext';
import { canAccessBranch } from '../../auth/permissions';
import { DataTable } from '../../components/table/DataTable';
import { Button, Card, Field, PageHeader, StatusBadge, TextInput } from '../../components/ui';
import { LOAN_PRODUCTS, branchName } from '../../data/reference';
import { money } from '../../lib/format';
import { scheduleTotals } from '../../lib/loanCalc';
import { useStore } from '../../store/StoreContext';
import { visibleLoans } from '../../store/selectors';
import type { LoanAccount } from '../../types';

export function ScheduleLookupPage() {
  const user = useCurrentUser();
  const { state } = useStore();
  const navigate = useNavigate();
  const [loanNo, setLoanNo] = useState('');
  const [error, setError] = useState('');
  const rows = visibleLoans(state, user).filter((l) => !['Rejected'].includes(l.status));

  const lookup = (e: FormEvent) => {
    e.preventDefault();
    const no = loanNo.trim().toUpperCase();
    if (!no) return setError('Loan Account Number is required');
    const loan = state.loans.find((l) => l.loanAccountNo === no);
    if (!loan) return setError(`Loan account ${no} not found`);
    if (!canAccessBranch(user, loan.branch)) return setError(`Loan account ${no} belongs to ${branchName(loan.branch)}. Access denied.`);
    navigate(`/loans/${no}/schedule`);
  };

  return (
    <div data-testid="schedule-lookup-page">
      <PageHeader title="Loan Repayment Schedules" subtitle="Open the repayment schedule of any loan account." />
      <Card title="Find Schedule by Loan Account Number" testId="schedule-lookup-card">
        <form onSubmit={lookup} noValidate className="flex flex-wrap items-end gap-3" data-testid="schedule-lookup-form">
          <Field id="schedule-lookup-input" label="Loan Account Number" required error={error} className="min-w-[16rem] flex-1">
            <TextInput
              id="schedule-lookup-input"
              value={loanNo}
              invalid={!!error}
              placeholder="LN-DHK-PER-000002"
              onChange={(e) => {
                setLoanNo(e.target.value);
                setError('');
              }}
            />
          </Field>
          <Button type="submit" testId="schedule-lookup-btn">
            View Schedule
          </Button>
        </form>
      </Card>

      <Card title="Loan Accounts" testId="schedule-loans-card" className="mt-5">
        <DataTable<LoanAccount>
          id="schedule-loans"
          rowTestIdPrefix="schedule-loan-row"
          rows={rows}
          rowId={(l) => l.loanAccountNo}
          searchPlaceholder="Search by loan account number or customer"
          filters={[{ key: 'status', label: 'Status', options: ['Applied', 'Approved', 'Active', 'Closed', 'Written Off'].map((s) => ({ value: s, label: s })) }]}
          columns={[
            { key: 'loanAccountNo', header: 'Loan A/C No' },
            { key: 'customerId', header: 'Customer ID' },
            { key: 'customerName', header: 'Customer Name' },
            { key: 'product', header: 'Product', searchable: false, render: (l) => LOAN_PRODUCTS[l.product].name },
            { key: 'installments', header: 'Installments', searchable: false, align: 'right', value: (l) => l.schedule.length || l.numberOfInstallments },
            { key: 'paid', header: 'Paid', searchable: false, align: 'right', value: (l) => scheduleTotals(l.schedule).paidCount },
            { key: 'overdue', header: 'Overdue', searchable: false, align: 'right', value: (l) => scheduleTotals(l.schedule).overdueCount },
            { key: 'outstandingPrincipal', header: 'Outstanding', searchable: false, align: 'right', render: (l) => money(l.outstandingPrincipal) },
            { key: 'generated', header: 'Schedule', searchable: false, value: (l) => (l.schedule.length ? 'Generated' : 'Not Generated') },
            { key: 'status', header: 'Status', searchable: false, render: (l) => <StatusBadge status={l.status} /> },
          ]}
          actions={(l) => (
            <Button size="sm" variant="secondary" testId={`view-schedule-btn-${l.loanAccountNo}`} onClick={() => navigate(`/loans/${l.loanAccountNo}/schedule`)}>
              View Schedule
            </Button>
          )}
        />
      </Card>
    </div>
  );
}

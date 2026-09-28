import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '../../auth/AuthContext';
import { canAccessBranch } from '../../auth/permissions';
import { Alert, Button, Card, Field, PageHeader, StatusBadge, TextArea, TextInput, cx } from '../../components/ui';
import { DEPOSIT_PRODUCTS, LARGE_WITHDRAWAL_LIMIT, LOAN_PRODUCTS } from '../../data/reference';
import { useAction } from '../../hooks/useAction';
import { money } from '../../lib/format';
import { installmentStatus } from '../../lib/loanCalc';
import { useStore } from '../../store/StoreContext';
import * as svc from '../../store/services';
import type { Transaction } from '../../types';

type Tab = 'deposit' | 'withdrawal' | 'transfer' | 'loan-repayment';
const TABS: { key: Tab; label: string }[] = [
  { key: 'deposit', label: 'Cash Deposit' },
  { key: 'withdrawal', label: 'Cash Withdrawal' },
  { key: 'transfer', label: 'Fund Transfer' },
  { key: 'loan-repayment', label: 'Loan Repayment' },
];

export function TellerPage() {
  const user = useCurrentUser();
  const { state } = useStore();
  const act = useAction();
  const [params] = useSearchParams();
  const initialAccount = params.get('account') ?? '';
  const [tab, setTab] = useState<Tab>(initialAccount.startsWith('LN-') ? 'loan-repayment' : ((params.get('type') as Tab) || 'deposit'));
  const [accountNo, setAccountNo] = useState(initialAccount.startsWith('LN-') ? '' : initialAccount);
  const [loanNo, setLoanNo] = useState(initialAccount.startsWith('LN-') ? initialAccount : '');
  const [toAccount, setToAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [narration, setNarration] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [result, setResult] = useState<{ message: string; txn: Transaction } | null>(null);

  const acct = state.deposits.find((d) => d.accountNo === accountNo.trim().toUpperCase());
  const acctVisible = acct && canAccessBranch(user, acct.branch) ? acct : undefined;
  const toAcct = state.deposits.find((d) => d.accountNo === toAccount.trim().toUpperCase());
  const loan = state.loans.find((l) => l.loanAccountNo === loanNo.trim().toUpperCase());
  const loanVisible = loan && canAccessBranch(user, loan.branch) ? loan : undefined;
  const nextInst = loanVisible?.schedule.find((i) => !i.paid);

  const switchTab = (t: Tab) => {
    setTab(t);
    setErrors({});
    setFormError('');
    setResult(null);
    setAmount('');
    setNarration('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setResult(null);
    const errs: Record<string, string> = {};
    if (tab === 'loan-repayment') {
      if (!loanNo.trim()) errs.loanNo = 'Loan Account Number is required';
    } else {
      if (!accountNo.trim()) errs.accountNo = tab === 'transfer' ? 'From Account Number is required' : 'Account Number is required';
      if (!amount.trim()) errs.amount = 'Amount is required';
      if (tab === 'transfer' && !toAccount.trim()) errs.toAccountNo = 'To Account Number is required';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const res = await act((d, u) => {
      if (tab === 'deposit') return svc.cashDeposit(d, u, accountNo, amount, narration);
      if (tab === 'withdrawal') return svc.cashWithdrawal(d, u, accountNo, amount, narration);
      if (tab === 'transfer') return svc.fundTransfer(d, u, accountNo, toAccount, amount, narration);
      const l = d.loans.find((x) => x.loanAccountNo === loanNo.trim().toUpperCase());
      const next = l?.schedule.find((i) => !i.paid);
      if (!l) return { ok: false, error: `Loan account ${loanNo} not found`, field: 'loanNo' };
      if (!next) return { ok: false, error: l.schedule.length ? 'All installments of this loan are already paid' : 'Repayment schedule has not been generated for this loan', field: 'loanNo' };
      return svc.payInstallment(d, u, l.loanAccountNo, next.installmentNo);
    });
    if (res.ok) {
      setResult({ message: res.message, txn: res.data });
      setAmount('');
      setNarration('');
    } else {
      setFormError(res.error);
      if (res.field) setErrors({ [res.field === 'accountNo' && tab === 'loan-repayment' ? 'loanNo' : res.field]: res.error });
    }
  };

  return (
    <div data-testid="teller-page">
      <PageHeader title="Teller Transactions" subtitle="Post cash deposits, withdrawals, transfers and loan repayments." actions={<Link to="/transactions" className="text-sm font-medium text-teal-700 hover:underline" data-testid="teller-view-transactions-link">View all transactions</Link>} />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200" role="tablist" data-testid="teller-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            data-testid={`teller-tab-${t.key}`}
            onClick={() => switchTab(t.key)}
            className={cx('-mb-px border-b-2 px-4 py-2 text-sm font-medium', tab === t.key ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card title={TABS.find((t) => t.key === tab)!.label} testId="teller-form-card">
          <form onSubmit={submit} noValidate className="flex flex-col gap-4" data-testid="teller-form" data-type={tab}>
            {formError && <Alert testId="teller-error">{formError}</Alert>}
            {result && (
              <Alert kind="success" testId="teller-result">
                {result.message}
                <div className="mt-1 text-xs">
                  Transaction ID: <strong data-testid="teller-result-txn-id">{result.txn.txnId}</strong> · Status: <span data-testid="teller-result-status">{result.txn.status}</span>
                </div>
              </Alert>
            )}

            {tab === 'loan-repayment' ? (
              <Field id="teller-loan-no" label="Loan Account Number" required error={errors.loanNo}>
                <TextInput id="teller-loan-no" value={loanNo} invalid={!!errors.loanNo} placeholder="LN-DHK-PER-000002" onChange={(e) => setLoanNo(e.target.value)} />
              </Field>
            ) : (
              <Field id="teller-account-no" label={tab === 'transfer' ? 'From Account Number' : 'Account Number'} required error={errors.accountNo}>
                <TextInput id="teller-account-no" value={accountNo} invalid={!!errors.accountNo} placeholder="DHK-SAV-0000003" onChange={(e) => setAccountNo(e.target.value)} />
              </Field>
            )}
            {tab === 'transfer' && (
              <Field id="teller-to-account-no" label="To Account Number" required error={errors.toAccountNo} hint={toAcct ? `${toAcct.customerName} · ${DEPOSIT_PRODUCTS[toAcct.product].name} · ${toAcct.status}` : undefined}>
                <TextInput id="teller-to-account-no" value={toAccount} invalid={!!errors.toAccountNo} onChange={(e) => setToAccount(e.target.value)} />
              </Field>
            )}
            {tab !== 'loan-repayment' && (
              <>
                <Field
                  id="teller-amount"
                  label="Amount (BDT)"
                  required
                  error={errors.amount}
                  hint={tab === 'withdrawal' ? `Withdrawals above ${money(LARGE_WITHDRAWAL_LIMIT)} require checker approval` : acctVisible?.product === 'DPS' ? `DPS installment: ${money(acctVisible.initialDeposit)}` : undefined}
                >
                  <TextInput id="teller-amount" type="number" min={0} step="0.01" value={amount} invalid={!!errors.amount} onChange={(e) => setAmount(e.target.value)} />
                </Field>
                <Field id="teller-narration" label="Narration">
                  <TextArea id="teller-narration" value={narration} onChange={(e) => setNarration(e.target.value)} maxLength={100} />
                </Field>
              </>
            )}
            {tab === 'loan-repayment' && loanVisible && nextInst && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm" data-testid="teller-next-installment">
                Next installment <strong data-testid="teller-next-installment-no">#{nextInst.installmentNo}</strong> due{' '}
                <strong data-testid="teller-next-installment-due">{nextInst.dueDate}</strong> · Amount{' '}
                <strong data-testid="teller-next-installment-amount" data-value={nextInst.installmentAmount}>
                  {money(nextInst.installmentAmount)}
                </strong>{' '}
                <StatusBadge status={installmentStatus(nextInst)} />
              </div>
            )}
            <div className="flex justify-between gap-2">
              <Button
                variant="secondary"
                testId="teller-clear-btn"
                onClick={() => {
                  // Native browser confirm() dialog.
                  if (!window.confirm('Clear all entered values?')) return;
                  setAccountNo('');
                  setLoanNo('');
                  setToAccount('');
                  setAmount('');
                  setNarration('');
                  setErrors({});
                  setFormError('');
                  setResult(null);
                }}
              >
                Clear
              </Button>
              <Button type="submit" testId="teller-submit-btn">
                {tab === 'loan-repayment' ? 'Collect Installment' : 'Post Transaction'}
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Account Information" testId="teller-account-info">
          {tab === 'loan-repayment' ? (
            loanVisible ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Loan Account" id="teller-info-account" value={loanVisible.loanAccountNo} />
                <Info label="Customer" id="teller-info-name" value={`${loanVisible.customerName} (${loanVisible.customerId})`} />
                <Info label="Product" id="teller-info-product" value={LOAN_PRODUCTS[loanVisible.product].name} />
                <Info label="Status" id="teller-info-status" value={loanVisible.status} />
                <Info label="Outstanding" id="teller-info-balance" value={money(loanVisible.outstandingPrincipal)} raw={loanVisible.outstandingPrincipal} />
                <Info label="Installment" id="teller-info-installment" value={money(loanVisible.installmentAmount)} raw={loanVisible.installmentAmount} />
              </dl>
            ) : (
              <p className="text-sm text-slate-500" data-testid="teller-info-empty">
                {loanNo.trim() ? 'Loan account not found in your branch.' : 'Enter a loan account number to see its details.'}
              </p>
            )
          ) : acctVisible ? (
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Account" id="teller-info-account" value={acctVisible.accountNo} />
              <Info label="Customer" id="teller-info-name" value={`${acctVisible.customerName} (${acctVisible.customerId})`} />
              <Info label="Product" id="teller-info-product" value={DEPOSIT_PRODUCTS[acctVisible.product].name} />
              <Info label="Status" id="teller-info-status" value={acctVisible.status} />
              <Info label="Balance" id="teller-info-balance" value={money(acctVisible.balance)} raw={acctVisible.balance} />
              <Info label="Minimum Balance" id="teller-info-min-balance" value={money(DEPOSIT_PRODUCTS[acctVisible.product].minBalance)} />
            </dl>
          ) : (
            <p className="text-sm text-slate-500" data-testid="teller-info-empty">
              {accountNo.trim() ? 'Account not found in your branch.' : 'Enter an account number to see its details.'}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Info({ label, id, value, raw }: { label: string; id: string; value: string; raw?: number }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900" data-testid={id} data-value={raw}>
        {value}
      </dd>
    </div>
  );
}

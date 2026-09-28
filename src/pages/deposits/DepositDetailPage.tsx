import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../../auth/AuthContext';
import { canAccessBranch } from '../../auth/permissions';
import { AccessDenied } from '../../auth/RequirePermission';
import { DataTable } from '../../components/table/DataTable';
import { Alert, Button, Card, DetailGrid, Field, PageHeader, SelectInput, StatusBadge } from '../../components/ui';
import { useFeedback } from '../../components/ui/feedback';
import { Modal } from '../../components/ui/Modal';
import { DEPOSIT_PRODUCTS, branchName } from '../../data/reference';
import { useAction } from '../../hooks/useAction';
import { formatDateTime, today } from '../../lib/dates';
import { money, round2 } from '../../lib/format';
import { useStore } from '../../store/StoreContext';
import { accountTransactions } from '../../store/selectors';
import * as svc from '../../store/services';
import type { Transaction } from '../../types';
import { CustomerLink, EntityNotFound } from '../common';

export function DepositDetailPage() {
  const { accountNo = '' } = useParams();
  const user = useCurrentUser();
  const { can } = useAuth();
  const { state } = useStore();
  const { confirm } = useFeedback();
  const act = useAction();
  const navigate = useNavigate();
  const [maturityOpen, setMaturityOpen] = useState(false);
  const [mode, setMode] = useState<'LINKED' | 'RENEW' | 'CASH'>('LINKED');
  const [target, setTarget] = useState('');
  const [maturityError, setMaturityError] = useState('');

  const a = state.deposits.find((x) => x.accountNo === accountNo);
  if (!a) return <EntityNotFound testId="deposit-not-found" message={`Deposit account ${accountNo} does not exist.`} />;
  if (!canAccessBranch(user, a.branch)) return <AccessDenied />;

  const cfg = DEPOSIT_PRODUCTS[a.product];
  const txns = accountTransactions(state, a.accountNo).reverse();
  const available = a.status === 'Active' && cfg.allowWithdrawal ? round2(Math.max(0, a.balance - cfg.minBalance)) : 0;
  const matured = cfg.term && a.status === 'Active' && !!a.maturityDate && a.maturityDate <= today();
  const payoutAccounts = state.deposits.filter((d) => d.customerId === a.customerId && ['SAVINGS', 'CURRENT'].includes(d.product) && d.status === 'Active');

  const withRemarks = async (title: string, message: string, label: string, variant: 'danger' | 'warning' | 'success', required = true) =>
    confirm({ title, message, confirmLabel: label, variant, remarks: true, remarksRequired: required, remarksLabel: 'Remarks' });

  const approve = async () => {
    const { confirmed } = await confirm({ title: 'Approve Account', message: `Approve and activate ${a.accountNo}? An opening deposit of ${money(a.initialDeposit)} will be posted.`, confirmLabel: 'Approve', variant: 'success' });
    if (confirmed) await act((d, u) => svc.approveDeposit(d, u, a.accountNo));
  };
  const reject = async () => {
    const r = await withRemarks('Reject Account', `Reject account ${a.accountNo}?`, 'Reject', 'danger');
    if (r.confirmed) await act((d, u) => svc.rejectDeposit(d, u, a.accountNo, r.remarks));
  };
  const freeze = async () => {
    const r = await confirm({ title: 'Freeze Account', message: `Freeze ${a.accountNo}? Debit transactions will be blocked.`, confirmLabel: 'Freeze', variant: 'warning', remarks: true, remarksRequired: true, remarksLabel: 'Freeze Reason' });
    if (r.confirmed) await act((d, u) => svc.setDepositFreeze(d, u, a.accountNo, true, r.remarks));
  };
  const unfreeze = async () => {
    const { confirmed } = await confirm({ title: 'Unfreeze Account', message: `Unfreeze ${a.accountNo}?`, confirmLabel: 'Unfreeze', variant: 'success' });
    if (confirmed) await act((d, u) => svc.setDepositFreeze(d, u, a.accountNo, false));
  };
  const close = async () => {
    const { confirmed } = await confirm({ title: 'Close Account', message: `Close ${a.accountNo}? This cannot be undone.`, confirmLabel: 'Close Account', variant: 'danger' });
    if (confirmed) await act((d, u) => svc.closeDeposit(d, u, a.accountNo));
  };
  const interest = async () => {
    const { confirmed } = await confirm({ title: 'Post Monthly Interest', message: `Post monthly interest @${a.interestRate.toFixed(2)}% on balance ${money(a.balance)}?`, confirmLabel: 'Post Interest' });
    if (confirmed) await act((d, u) => svc.postSavingsInterest(d, u, a.accountNo));
  };
  // Native window.prompt / window.alert — practise page.on("dialog") in Playwright.
  const addNote = async () => {
    const text = window.prompt(`Add a note to account ${a.accountNo}:`, '');
    if (text === null) return; // cancelled
    if (!text.trim()) {
      window.alert('Note cannot be empty.');
      return;
    }
    await act((d, u) => svc.addDepositNote(d, u, a.accountNo, text));
  };

  const processMaturity = async () => {
    setMaturityError('');
    const res = await act((d, u) => svc.processMaturity(d, u, a.accountNo, mode, target), { toastOnError: false });
    if (res.ok) setMaturityOpen(false);
    else setMaturityError(res.error);
  };

  return (
    <div data-testid="deposit-detail-page" data-account-no={a.accountNo}>
      <PageHeader
        title={`${cfg.name}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span data-testid="deposit-account-no-value">{a.accountNo}</span>
            <StatusBadge status={a.status} testId="deposit-status-badge" />
          </span>
        }
        actions={
          <>
            {can('deposit.approve') && a.status === 'Pending Approval' && (
              <>
                <Button variant="success" testId="deposit-approve-btn" onClick={approve}>
                  Approve
                </Button>
                <Button variant="danger" testId="deposit-reject-btn" onClick={reject}>
                  Reject
                </Button>
              </>
            )}
            {can('txn.post') && ['Active', 'Frozen'].includes(a.status) && (
              <Button testId="deposit-transact-btn" onClick={() => navigate(`/transactions/new?account=${a.accountNo}`)}>
                New Transaction
              </Button>
            )}
            {can('deposit.interest') && a.product === 'SAVINGS' && ['Active', 'Frozen'].includes(a.status) && (
              <Button variant="secondary" testId="deposit-post-interest-btn" onClick={interest}>
                Post Interest
              </Button>
            )}
            {can('deposit.maturity') && cfg.term && a.status === 'Active' && (
              <Button variant="secondary" testId="deposit-process-maturity-btn" onClick={() => { setMaturityError(''); setMode(a.product === 'FDR' ? 'RENEW' : 'LINKED'); setTarget(payoutAccounts[0]?.accountNo ?? ''); setMaturityOpen(true); }}>
                Process Maturity
              </Button>
            )}
            {can('deposit.freeze') && a.status === 'Active' && (
              <Button variant="warning" testId="deposit-freeze-btn" onClick={freeze}>
                Freeze
              </Button>
            )}
            {can('deposit.freeze') && a.status === 'Frozen' && (
              <Button variant="success" testId="deposit-unfreeze-btn" onClick={unfreeze}>
                Unfreeze
              </Button>
            )}
            {can('deposit.close') && ['Active', 'Matured', 'Frozen'].includes(a.status) && (
              <Button variant="danger" testId="deposit-close-btn" onClick={close}>
                Close Account
              </Button>
            )}
            {can('account.note') && (
              <Button variant="secondary" testId="deposit-add-note-btn" onClick={addNote}>
                Add Note
              </Button>
            )}
            {can('statement.view') && (
              <Button variant="secondary" testId="deposit-statement-btn" onClick={() => navigate(`/statements?account=${a.accountNo}`)}>
                View Statement
              </Button>
            )}
          </>
        }
      />

      {a.status === 'Frozen' && (
        <div className="mb-4">
          <Alert kind="warning" testId="deposit-frozen-alert">
            Account is frozen: {a.freezeReason}. Withdrawals and transfers out are blocked.
          </Alert>
        </div>
      )}
      {matured && (
        <div className="mb-4">
          <Alert kind="info" testId="deposit-matured-alert">
            This account matured on {a.maturityDate}. Maturity processing is pending.
          </Alert>
        </div>
      )}
      {a.status === 'Rejected' && a.remarks && (
        <div className="mb-4">
          <Alert testId="deposit-rejected-alert">Rejected: {a.remarks}</Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4" data-testid="deposit-balance-card">
          <div className="text-xs uppercase text-slate-500">Current Balance (BDT)</div>
          <div className="mt-1 text-2xl font-semibold" data-testid="deposit-balance-value" data-value={a.balance}>
            {money(a.balance)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4" data-testid="deposit-available-card">
          <div className="text-xs uppercase text-slate-500">Available for Withdrawal</div>
          <div className="mt-1 text-2xl font-semibold" data-testid="deposit-available-value" data-value={available}>
            {money(available)}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4" data-testid="deposit-maturity-card">
          <div className="text-xs uppercase text-slate-500">{cfg.term ? 'Maturity Amount' : 'Minimum Balance'}</div>
          <div className="mt-1 text-2xl font-semibold" data-testid="deposit-maturity-value" data-value={cfg.term ? a.maturityAmount : cfg.minBalance}>
            {money(cfg.term ? a.maturityAmount : cfg.minBalance)}
          </div>
        </div>
      </div>

      <Card title="Account Information" testId="deposit-info-card">
        <DetailGrid
          prefix="deposit-detail"
          items={[
            { key: 'accountNo', label: 'Account Number', value: a.accountNo },
            { key: 'customerId', label: 'Customer ID', value: <CustomerLink id={a.customerId} />, raw: a.customerId },
            { key: 'customerName', label: 'Customer Name', value: a.customerName },
            { key: 'product', label: 'Deposit Product', value: cfg.name, raw: a.product },
            { key: 'openingDate', label: 'Opening Date', value: a.openingDate },
            { key: 'initialDeposit', label: a.product === 'DPS' ? 'Monthly Installment' : 'Initial Deposit', value: money(a.initialDeposit), raw: a.initialDeposit },
            { key: 'interestRate', label: 'Interest Rate', value: `${a.interestRate.toFixed(2)}%`, raw: a.interestRate },
            { key: 'tenure', label: 'Tenure', value: a.tenureMonths ? `${a.tenureMonths} months` : 'N/A', raw: a.tenureMonths },
            { key: 'maturityDate', label: 'Maturity Date', value: a.maturityDate ?? 'N/A' },
            { key: 'nominee', label: 'Nominee', value: a.nomineeName ? `${a.nomineeName} (${a.nomineeRelation}) · ${a.nomineeShare ?? 100}%` : 'N/A' },
            { key: 'linkedAccountNo', label: 'Linked Account', value: a.linkedAccountNo ?? 'N/A' },
            { key: 'branch', label: 'Branch', value: branchName(a.branch), raw: a.branch },
            { key: 'status', label: 'Account Status', value: a.status },
            { key: 'createdBy', label: 'Created By (Maker)', value: `${a.createdBy} · ${formatDateTime(a.createdAt)}` },
            { key: 'approvedBy', label: 'Approved By (Checker)', value: a.approvedBy ? `${a.approvedBy} · ${formatDateTime(a.approvedAt)}` : '-' },
          ]}
        />
      </Card>

      <Card title={`Account Notes (${a.notes?.length ?? 0})`} testId="deposit-notes-card" className="mt-5">
        {a.notes?.length ? (
          <ul className="flex flex-col gap-2 text-sm" data-testid="deposit-notes">
            {a.notes.map((n, i) => (
              <li key={i} data-testid={`deposit-note-${i}`} className="rounded border border-slate-200 px-3 py-2">
                <div data-testid={`deposit-note-text-${i}`}>{n.text}</div>
                <div className="text-xs text-slate-500">
                  {n.by} · {formatDateTime(n.at)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500" data-testid="deposit-notes-empty">
            No notes yet.
          </p>
        )}
      </Card>

      <Card title="Transaction History" testId="deposit-transactions-card" className="mt-5">
        <DataTable<Transaction>
          id="deposit-txns"
          rowTestIdPrefix="txn-row"
          rows={txns}
          rowId={(t) => t.txnId}
          searchPlaceholder="Search by transaction ID or description"
          defaultPageSize={10}
          emptyMessage="No transactions available for this account."
          columns={[
            { key: 'date', header: 'Date' },
            { key: 'txnId', header: 'Transaction ID' },
            { key: 'type', header: 'Type' },
            { key: 'description', header: 'Description', className: 'whitespace-normal' },
            { key: 'debit', header: 'Debit', align: 'right', searchable: false, render: (t) => (t.debit ? money(t.debit) : '-') },
            { key: 'credit', header: 'Credit', align: 'right', searchable: false, render: (t) => (t.credit ? money(t.credit) : '-') },
            { key: 'balanceAfter', header: 'Balance', align: 'right', searchable: false, render: (t) => money(t.balanceAfter) },
            { key: 'status', header: 'Status', searchable: false, render: (t) => <StatusBadge status={t.status} /> },
          ]}
        />
      </Card>

      <Modal
        open={maturityOpen}
        title={`Process Maturity - ${a.accountNo}`}
        testId="maturity-modal"
        onClose={() => setMaturityOpen(false)}
        footer={
          <>
            <Button variant="secondary" testId="maturity-cancel-btn" onClick={() => setMaturityOpen(false)}>
              Cancel
            </Button>
            <Button testId="maturity-confirm-btn" onClick={processMaturity}>
              Process
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 text-sm">
          <p>
            Balance {money(a.balance)} · Maturity date <strong>{a.maturityDate}</strong> · Maturity amount {money(a.maturityAmount)}
          </p>
          {maturityError && <Alert testId="maturity-error">{maturityError}</Alert>}
          <Field id="maturity-mode" label="Maturity Instruction" required>
            <SelectInput
              id="maturity-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
              options={[
                ...(a.product === 'FDR' ? [{ value: 'RENEW', label: 'Renew (principal + interest)' }] : []),
                { value: 'LINKED', label: 'Transfer to Savings/Current account' },
                { value: 'CASH', label: 'Cash payout' },
              ]}
            />
          </Field>
          {mode === 'LINKED' && (
            <Field id="maturity-target-account" label="Payout Account" required>
              <SelectInput
                id="maturity-target-account"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="-- Select Account --"
                options={payoutAccounts.map((p) => ({ value: p.accountNo, label: `${p.accountNo} (${DEPOSIT_PRODUCTS[p.product].name})` }))}
              />
            </Field>
          )}
        </div>
      </Modal>
    </div>
  );
}

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../../auth/AuthContext';
import { DataTable, type ContextMenuItem, type FilterDef } from '../../components/table/DataTable';
import { Button, Card, PageHeader, StatusBadge } from '../../components/ui';
import { Tooltip } from '../../components/ui/advanced';
import { useFeedback } from '../../components/ui/feedback';
import { BRANCHES, DEPOSIT_PRODUCTS, LOAN_PRODUCTS, branchName } from '../../data/reference';
import { useAction } from '../../hooks/useAction';
import { copyText } from '../../lib/clipboard';
import { downloadCSV, toCSV } from '../../lib/csv';
import { formatDateTime } from '../../lib/dates';
import { money } from '../../lib/format';
import { useStore } from '../../store/StoreContext';
import { visibleCustomers } from '../../store/selectors';
import * as svc from '../../store/services';
import type { Customer } from '../../types';

export function CustomerListPage() {
  const user = useCurrentUser();
  const { can } = useAuth();
  const { state, run } = useStore();
  const { confirm, toast, withLoading } = useFeedback();
  const act = useAction();
  const navigate = useNavigate();
  const location = useLocation();
  const highlight = (location.state as { highlight?: string } | null)?.highlight;
  const rows = visibleCustomers(state, user);

  const toggleStatus = async (c: Customer) => {
    const target = c.status === 'Active' ? 'Inactive' : 'Active';
    const { confirmed } = await confirm({
      title: `${target === 'Active' ? 'Activate' : 'Deactivate'} Customer`,
      message: `Are you sure you want to ${target === 'Active' ? 'activate' : 'deactivate'} customer ${c.customerId} (${c.fullName})?`,
      confirmLabel: target === 'Active' ? 'Activate' : 'Deactivate',
      variant: target === 'Active' ? 'success' : 'danger',
    });
    if (confirmed) await act((d, u) => svc.setCustomerStatus(d, u, c.customerId, target));
  };

  const bulkStatus = async (selected: Customer[], clear: () => void, status: 'Active' | 'Inactive') => {
    const { confirmed } = await confirm({
      title: `${status === 'Active' ? 'Activate' : 'Deactivate'} ${selected.length} Customer(s)`,
      message: `${status === 'Active' ? 'Activate' : 'Deactivate'}: ${selected.map((c) => c.customerId).join(', ')}`,
      confirmLabel: status === 'Active' ? 'Activate All' : 'Deactivate All',
      variant: status === 'Active' ? 'success' : 'danger',
    });
    if (!confirmed) return;
    const res = await act((d, u) => svc.bulkSetCustomerStatus(d, u, selected.map((c) => c.customerId), status));
    if (res.ok) clear();
  };

  const bulkKyc = async (selected: Customer[], clear: () => void) => {
    const res = await act((d, u) => svc.bulkVerifyKyc(d, u, selected.map((c) => c.customerId)));
    if (res.ok) clear();
  };

  const exportSelected = (selected: Customer[]) => {
    downloadCSV(
      'customers_selected.csv',
      toCSV(
        ['Customer ID', 'Full Name', 'Mobile', 'Email', 'Branch', 'KYC', 'Status'],
        selected.map((c) => [c.customerId, c.fullName, c.mobile, c.email, c.branch, c.kycStatus, c.status]),
      ),
    );
    toast('success', `${selected.length} customer(s) exported to customers_selected.csv`);
  };

  const copyId = async (id: string) => {
    const copied = await copyText(id);
    toast(copied ? 'success' : 'error', copied ? `Copied ${id} to clipboard` : 'Clipboard access was denied by the browser');
  };

  const menuFor = (c: Customer): ContextMenuItem[] => [
    { key: 'view', label: 'View details', onClick: () => navigate(`/customers/${c.customerId}`) },
    { key: 'edit', label: 'Edit customer', onClick: () => navigate(`/customers/${c.customerId}/edit`), disabled: !can('customer.edit') },
    { key: 'open-deposit', label: 'Open deposit account', onClick: () => navigate(`/deposits/new?customerId=${c.customerId}`), disabled: !can('deposit.create') || c.status !== 'Active' },
    { key: 'open-loan', label: 'Create loan', onClick: () => navigate(`/loans/new?customerId=${c.customerId}`), disabled: !can('loan.create') || c.status !== 'Active' },
    { key: 'copy-id', label: 'Copy Customer ID', onClick: () => copyId(c.customerId) },
    { key: 'toggle-status', label: c.status === 'Active' ? 'Deactivate' : 'Activate', onClick: () => toggleStatus(c), danger: c.status === 'Active', disabled: !can('customer.status') },
  ];

  const saveEmail = async (c: Customer, value: string) => {
    const res = await withLoading(() => run((d) => svc.updateCustomerEmail(d, user, c.customerId, value)));
    if (!res.ok) return res.error;
    toast('success', res.message);
    return null;
  };

  const filters: FilterDef<Customer>[] = [
    { key: 'status', label: 'Status', options: ['Active', 'Inactive'].map((v) => ({ value: v, label: v })) },
    { key: 'kycStatus', label: 'KYC Status', options: ['Pending', 'Verified', 'Rejected'].map((v) => ({ value: v, label: v })) },
    { key: 'customerType', label: 'Customer Type', options: ['Individual', 'Business'].map((v) => ({ value: v, label: v })) },
  ];
  if (user.branch === 'ALL') filters.unshift({ key: 'branch', label: 'Branch', options: BRANCHES.map((b) => ({ value: b.code, label: b.name })) });

  return (
    <div data-testid="customer-list-page">
      <PageHeader
        title="Customer Management"
        subtitle={`Customers of ${branchName(user.branch)}`}
        actions={
          can('customer.create') && (
            <Button testId="new-customer-btn" onClick={() => navigate('/customers/new')}>
              + New Customer
            </Button>
          )
        }
      />
      <Card>
        <DataTable<Customer>
          id="customers"
          rowTestIdPrefix="customer-row"
          rows={rows}
          rowId={(c) => c.customerId}
          searchPlaceholder="Search by name, customer ID or mobile number"
          filters={filters}
          exportFileName="customers.csv"
          emptyMessage="No customers match your search criteria."
          rowClassName={(c) => (c.customerId === highlight ? 'bg-teal-50' : undefined)}
          selectable
          bulkActions={(selected, clear) => (
            <>
              <Button size="sm" variant="secondary" testId="bulk-export-btn" onClick={() => exportSelected(selected)}>
                Export Selected
              </Button>
              {can('kyc.verify') && (
                <Button size="sm" variant="success" testId="bulk-verify-kyc-btn" onClick={() => bulkKyc(selected, clear)}>
                  Verify KYC
                </Button>
              )}
              {can('customer.status') && (
                <>
                  <Button size="sm" variant="success" testId="bulk-activate-btn" onClick={() => bulkStatus(selected, clear, 'Active')}>
                    Activate
                  </Button>
                  <Button size="sm" variant="danger" testId="bulk-deactivate-btn" onClick={() => bulkStatus(selected, clear, 'Inactive')}>
                    Deactivate
                  </Button>
                </>
              )}
            </>
          )}
          onRowDoubleClick={(c) => navigate(`/customers/${c.customerId}`)}
          contextMenu={menuFor}
          renderExpanded={(c) => <CustomerSummary customer={c} />}
          columns={[
            {
              key: 'customerId',
              header: 'Customer ID',
              render: (c) => (
                <Link to={`/customers/${c.customerId}`} className="font-medium text-teal-700 hover:underline" data-testid={`customer-link-${c.customerId}`}>
                  {c.customerId}
                </Link>
              ),
            },
            { key: 'fullName', header: 'Full Name' },
            { key: 'mobile', header: 'Mobile' },
            {
              key: 'email',
              header: 'Email',
              searchable: false,
              editable: can('customer.edit') ? { inputType: 'email', onSave: saveEmail } : undefined,
            },
            { key: 'customerType', header: 'Type', searchable: false },
            { key: 'branch', header: 'Branch', searchable: false },
            { key: 'monthlyIncome', header: 'Monthly Income', searchable: false, align: 'right', render: (c) => money(c.monthlyIncome) },
            {
              key: 'kycStatus',
              header: 'KYC',
              searchable: false,
              render: (c) => (
                <Tooltip testId={`kyc-tooltip-${c.customerId}`} content={c.kycStatus === 'Verified' ? `Verified by ${c.kycVerifiedBy ?? '-'}` : c.kycStatus === 'Rejected' ? `Rejected: ${c.kycRemarks ?? ''}` : 'Waiting for a Branch Manager to verify KYC'}>
                  <span tabIndex={0} data-testid={`kyc-badge-${c.customerId}`}>
                    <StatusBadge status={c.kycStatus} />
                  </span>
                </Tooltip>
              ),
            },
            { key: 'status', header: 'Status', searchable: false, render: (c) => <StatusBadge status={c.status} /> },
            { key: 'createdAt', header: 'Created At', searchable: false, render: (c) => formatDateTime(c.createdAt) },
          ]}
          actions={(c) => (
            <>
              <Button size="sm" variant="secondary" testId={`view-btn-${c.customerId}`} onClick={() => navigate(`/customers/${c.customerId}`)}>
                View
              </Button>
              {can('customer.edit') && (
                <Button size="sm" variant="secondary" testId={`edit-btn-${c.customerId}`} onClick={() => navigate(`/customers/${c.customerId}/edit`)}>
                  Edit
                </Button>
              )}
              {can('customer.status') && (
                <Button size="sm" variant={c.status === 'Active' ? 'danger' : 'success'} testId={`toggle-status-btn-${c.customerId}`} onClick={() => toggleStatus(c)}>
                  {c.status === 'Active' ? 'Deactivate' : 'Activate'}
                </Button>
              )}
              {can('deposit.create') && c.status === 'Active' && (
                <Button size="sm" variant="ghost" testId={`open-deposit-btn-${c.customerId}`} onClick={() => navigate(`/deposits/new?customerId=${c.customerId}`)}>
                  + Deposit
                </Button>
              )}
              {can('loan.create') && c.status === 'Active' && (
                <Button size="sm" variant="ghost" testId={`open-loan-btn-${c.customerId}`} onClick={() => navigate(`/loans/new?customerId=${c.customerId}`)}>
                  + Loan
                </Button>
              )}
            </>
          )}
        />
      </Card>
    </div>
  );
}

/** Expanded-row content: the customer's accounts at a glance. */
function CustomerSummary({ customer }: { customer: Customer }) {
  const { state } = useStore();
  const deposits = state.deposits.filter((d) => d.customerId === customer.customerId);
  const loans = state.loans.filter((l) => l.customerId === customer.customerId);
  return (
    <div className="grid gap-4 text-sm md:grid-cols-3" data-testid={`customer-summary-${customer.customerId}`}>
      <div>
        <div className="text-xs font-semibold uppercase text-slate-500">Contact</div>
        <div data-testid="summary-nid">NID: {customer.nid}</div>
        <div>
          {customer.district}, {customer.division}
        </div>
        <div>Documents: {customer.documents?.length ?? 0}</div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-slate-500">Deposit Accounts ({deposits.length})</div>
        <ul data-testid="summary-deposits">
          {deposits.length === 0 && <li className="text-slate-500">None</li>}
          {deposits.map((d) => (
            <li key={d.accountNo} data-testid={`summary-deposit-${d.accountNo}`}>
              {d.accountNo} · {DEPOSIT_PRODUCTS[d.product].shortCode} · {money(d.balance)} · {d.status}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-slate-500">Loans ({loans.length})</div>
        <ul data-testid="summary-loans">
          {loans.length === 0 && <li className="text-slate-500">None</li>}
          {loans.map((l) => (
            <li key={l.loanAccountNo} data-testid={`summary-loan-${l.loanAccountNo}`}>
              {l.loanAccountNo} · {LOAN_PRODUCTS[l.product].name} · {money(l.outstandingPrincipal)} · {l.status}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

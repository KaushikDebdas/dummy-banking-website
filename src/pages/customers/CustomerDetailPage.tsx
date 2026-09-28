import { useNavigate, useParams } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../../auth/AuthContext';
import { canAccessBranch } from '../../auth/permissions';
import { AccessDenied } from '../../auth/RequirePermission';
import { DataTable } from '../../components/table/DataTable';
import { Alert, Button, Card, DetailGrid, PageHeader, StatusBadge } from '../../components/ui';
import { useFeedback } from '../../components/ui/feedback';
import { DEPOSIT_PRODUCTS, LOAN_PRODUCTS, branchName } from '../../data/reference';
import { useAction } from '../../hooks/useAction';
import { formatDateTime } from '../../lib/dates';
import { money } from '../../lib/format';
import { useStore } from '../../store/StoreContext';
import * as svc from '../../store/services';
import type { DepositAccount, LoanAccount } from '../../types';
import { AccountLink, EntityNotFound } from '../common';

export function CustomerDetailPage() {
  const { customerId = '' } = useParams();
  const user = useCurrentUser();
  const { can } = useAuth();
  const { state } = useStore();
  const { confirm } = useFeedback();
  const act = useAction();
  const navigate = useNavigate();
  const c = state.customers.find((x) => x.customerId === customerId);

  if (!c) return <EntityNotFound testId="customer-not-found" message={`Customer ${customerId} does not exist.`} />;
  if (!canAccessBranch(user, c.branch)) return <AccessDenied />;

  const deposits = state.deposits.filter((d) => d.customerId === c.customerId);
  const loans = state.loans.filter((l) => l.customerId === c.customerId);

  const toggleStatus = async () => {
    const target = c.status === 'Active' ? 'Inactive' : 'Active';
    const { confirmed } = await confirm({
      title: `${target === 'Active' ? 'Activate' : 'Deactivate'} Customer`,
      message: `Are you sure you want to ${target === 'Active' ? 'activate' : 'deactivate'} customer ${c.customerId}?`,
      confirmLabel: target === 'Active' ? 'Activate' : 'Deactivate',
      variant: target === 'Active' ? 'success' : 'danger',
    });
    if (confirmed) await act((d, u) => svc.setCustomerStatus(d, u, c.customerId, target));
  };

  const kyc = async (decision: 'Verified' | 'Rejected') => {
    const { confirmed, remarks } = await confirm({
      title: decision === 'Verified' ? 'Verify KYC' : 'Reject KYC',
      message: decision === 'Verified' ? `Confirm that KYC documents of ${c.fullName} (${c.customerId}) have been verified.` : `Reject KYC of ${c.customerId}?`,
      confirmLabel: decision === 'Verified' ? 'Verify KYC' : 'Reject KYC',
      variant: decision === 'Verified' ? 'success' : 'danger',
      remarks: true,
      remarksRequired: decision === 'Rejected',
    });
    if (confirmed) await act((d, u) => svc.decideKyc(d, u, c.customerId, decision, remarks));
  };

  return (
    <div data-testid="customer-detail-page" data-customer-id={c.customerId}>
      <PageHeader
        title={c.fullName}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span data-testid="customer-id-value">{c.customerId}</span>
            <StatusBadge status={c.status} testId="customer-status-badge" />
            <span className="text-xs text-slate-500">KYC:</span>
            <StatusBadge status={c.kycStatus} testId="customer-kyc-badge" />
          </span>
        }
        actions={
          <>
            {can('customer.edit') && (
              <Button variant="secondary" testId="customer-edit-btn" onClick={() => navigate(`/customers/${c.customerId}/edit`)}>
                Edit
              </Button>
            )}
            {can('kyc.verify') && c.kycStatus !== 'Verified' && (
              <>
                <Button variant="success" testId="kyc-verify-btn" onClick={() => kyc('Verified')}>
                  Verify KYC
                </Button>
                {c.kycStatus === 'Pending' && (
                  <Button variant="danger" testId="kyc-reject-btn" onClick={() => kyc('Rejected')}>
                    Reject KYC
                  </Button>
                )}
              </>
            )}
            {can('customer.status') && (
              <Button variant={c.status === 'Active' ? 'danger' : 'success'} testId="customer-toggle-status-btn" onClick={toggleStatus}>
                {c.status === 'Active' ? 'Deactivate' : 'Activate'}
              </Button>
            )}
            {can('deposit.create') && c.status === 'Active' && (
              <Button testId="customer-open-deposit-btn" onClick={() => navigate(`/deposits/new?customerId=${c.customerId}`)}>
                + Deposit Account
              </Button>
            )}
            {can('loan.create') && c.status === 'Active' && (
              <Button testId="customer-open-loan-btn" onClick={() => navigate(`/loans/new?customerId=${c.customerId}`)}>
                + Loan Account
              </Button>
            )}
          </>
        }
      />

      {c.kycStatus !== 'Verified' && (
        <div className="mb-4">
          <Alert kind="warning" testId="customer-kyc-alert">
            KYC is <strong>{c.kycStatus}</strong>
            {c.kycRemarks ? ` (${c.kycRemarks})` : ''}. Accounts and loans of this customer cannot be approved until KYC is Verified.
          </Alert>
        </div>
      )}

      <div className="flex flex-col gap-5">
        <Card title="Personal Information" testId="customer-personal-card">
          <DetailGrid
            prefix="customer-detail"
            items={[
              { key: 'customerId', label: 'Customer ID', value: c.customerId },
              { key: 'customerType', label: 'Customer Type', value: c.customerType },
              { key: 'fullName', label: 'Full Name', value: c.fullName },
              { key: 'fatherName', label: "Father's Name", value: c.fatherName },
              { key: 'motherName', label: "Mother's Name", value: c.motherName },
              { key: 'dob', label: 'Date of Birth', value: c.dob },
              { key: 'gender', label: 'Gender', value: c.gender },
              ...(c.customerType === 'Business'
                ? [
                    { key: 'businessName', label: 'Business Name', value: c.businessName },
                    { key: 'tradeLicense', label: 'Trade License No.', value: c.tradeLicense },
                  ]
                : []),
            ]}
          />
        </Card>
        <Card title="Contact, Identity & Address" testId="customer-contact-card">
          <DetailGrid
            prefix="customer-detail"
            items={[
              { key: 'mobile', label: 'Mobile Number', value: c.mobile },
              { key: 'email', label: 'Email Address', value: c.email },
              { key: 'nid', label: 'National ID', value: c.nid },
              { key: 'presentAddress', label: 'Present Address', value: c.presentAddress },
              { key: 'division', label: 'Division', value: c.division },
              { key: 'district', label: 'District', value: c.district },
              { key: 'permanentAddress', label: 'Permanent Address', value: c.permanentAddress },
            ]}
          />
        </Card>
        <Card title="Financial & Bank Information" testId="customer-financial-card">
          <DetailGrid
            prefix="customer-detail"
            items={[
              { key: 'occupation', label: 'Occupation', value: c.occupation },
              { key: 'monthlyIncome', label: 'Monthly Income (BDT)', value: money(c.monthlyIncome), raw: c.monthlyIncome },
              { key: 'branch', label: 'Branch', value: branchName(c.branch), raw: c.branch },
              { key: 'status', label: 'Customer Status', value: c.status },
              { key: 'kycStatus', label: 'KYC Status', value: c.kycStatus },
              { key: 'kycVerifiedBy', label: 'KYC Verified By', value: c.kycVerifiedBy ?? '-' },
              { key: 'smsAlerts', label: 'SMS Alerts', value: c.smsAlerts ? 'On' : 'Off', raw: String(!!c.smsAlerts) },
              { key: 'eStatement', label: 'e-Statement', value: c.eStatement ? 'On' : 'Off', raw: String(!!c.eStatement) },
              { key: 'createdBy', label: 'Created By', value: c.createdBy },
              { key: 'createdAt', label: 'Created At', value: formatDateTime(c.createdAt) },
              { key: 'updatedAt', label: 'Last Updated', value: c.updatedAt ? `${formatDateTime(c.updatedAt)} by ${c.updatedBy}` : '-' },
            ]}
          />
        </Card>

        <Card title={`KYC Documents (${c.documents?.length ?? 0})`} testId="customer-documents-card">
          {c.documents?.length ? (
            <ul className="flex flex-col gap-1 text-sm" data-testid="customer-documents">
              {c.documents.map((d, i) => (
                <li key={d.name} data-testid={`customer-document-${i}`} className="flex items-center justify-between rounded border border-slate-200 px-3 py-1.5">
                  <span>📄 {d.name}</span>
                  <span className="text-xs text-slate-500">
                    {d.type || 'unknown'} · {(d.size / 1024).toFixed(1)} KB
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500" data-testid="customer-documents-empty">
              No documents uploaded.
            </p>
          )}
        </Card>

        <Card title={`Deposit Accounts (${deposits.length})`} testId="customer-deposits-card">
          <DataTable<DepositAccount>
            id="customer-deposits"
            rowTestIdPrefix="customer-deposit-row"
            rows={deposits}
            rowId={(d) => d.accountNo}
            hideSearch
            defaultPageSize={5}
            emptyMessage="This customer has no deposit accounts."
            columns={[
              { key: 'accountNo', header: 'Account No', render: (d) => <AccountLink accountNo={d.accountNo} /> },
              { key: 'product', header: 'Product', value: (d) => DEPOSIT_PRODUCTS[d.product].name },
              { key: 'openingDate', header: 'Opened' },
              { key: 'balance', header: 'Balance', align: 'right', render: (d) => money(d.balance) },
              { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> },
            ]}
          />
        </Card>
        <Card title={`Loan Accounts (${loans.length})`} testId="customer-loans-card">
          <DataTable<LoanAccount>
            id="customer-loans"
            rowTestIdPrefix="customer-loan-row"
            rows={loans}
            rowId={(l) => l.loanAccountNo}
            hideSearch
            defaultPageSize={5}
            emptyMessage="This customer has no loan accounts."
            columns={[
              { key: 'loanAccountNo', header: 'Loan A/C No', render: (l) => <AccountLink accountNo={l.loanAccountNo} /> },
              { key: 'product', header: 'Product', value: (l) => LOAN_PRODUCTS[l.product].name },
              { key: 'amount', header: 'Amount', align: 'right', render: (l) => money(l.amount) },
              { key: 'outstandingPrincipal', header: 'Outstanding', align: 'right', render: (l) => money(l.outstandingPrincipal) },
              { key: 'status', header: 'Status', render: (l) => <StatusBadge status={l.status} /> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

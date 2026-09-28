import { useNavigate, useParams } from 'react-router-dom';
import { useCurrentUser } from '../../auth/AuthContext';
import { canAccessBranch } from '../../auth/permissions';
import { AccessDenied } from '../../auth/RequirePermission';
import { PageHeader } from '../../components/ui';
import { useFeedback } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import type { CustomerFormValues } from '../../lib/validation';
import { useStore } from '../../store/StoreContext';
import * as svc from '../../store/services';
import { CustomerForm } from './CustomerForm';

export function CustomerCreatePage() {
  const user = useCurrentUser();
  const { state } = useStore();
  const { confirm } = useFeedback();
  const act = useAction();
  const navigate = useNavigate();

  const defaults: CustomerFormValues = {
    customerType: 'Individual',
    fullName: '',
    fatherName: '',
    motherName: '',
    dob: '',
    gender: '',
    mobile: '',
    email: '',
    nid: '',
    presentAddress: '',
    division: '',
    district: '',
    permanentAddress: '',
    occupation: '',
    monthlyIncome: '',
    branch: user.branch === 'ALL' ? '' : user.branch,
    status: 'Active',
    smsAlerts: true,
    eStatement: false,
    documents: [],
    businessName: '',
    tradeLicense: '',
  };

  const onSubmit = async (values: CustomerFormValues) => {
    // Soft duplicate check: same name + date of birth (not blocking).
    const similar = state.customers.find((c) => c.fullName.toLowerCase() === values.fullName.trim().toLowerCase() && c.dob === values.dob);
    if (similar) {
      const { confirmed } = await confirm({
        title: 'Possible Duplicate Customer',
        message: `A customer with the same name and date of birth already exists (${similar.customerId}). Do you still want to create this customer?`,
        confirmLabel: 'Create Anyway',
        variant: 'warning',
      });
      if (!confirmed) return { error: 'Customer creation cancelled: possible duplicate customer.' };
    }
    const res = await act((d, u) => svc.createCustomer(d, u, values), { toastOnError: true });
    if (!res.ok) return { error: res.error, field: res.field };
    navigate('/customers', { state: { highlight: res.data.customerId } });
    return null;
  };

  return (
    <div data-testid="customer-create-page">
      <PageHeader title="New Customer Onboarding" subtitle="Complete all steps. Customer ID is generated automatically on submit." />
      <CustomerForm mode="create" defaultValues={defaults} userBranch={user.branch} onSubmit={onSubmit} onCancel={() => navigate('/customers')} />
    </div>
  );
}

export function CustomerEditPage() {
  const { customerId = '' } = useParams();
  const user = useCurrentUser();
  const { state } = useStore();
  const act = useAction();
  const navigate = useNavigate();
  const c = state.customers.find((x) => x.customerId === customerId);

  if (!c)
    return (
      <div className="rounded-lg border bg-white p-6 text-sm" data-testid="customer-not-found">
        Customer {customerId} not found.
      </div>
    );
  if (!canAccessBranch(user, c.branch)) return <AccessDenied />;

  const defaults: CustomerFormValues = {
    customerType: c.customerType,
    fullName: c.fullName,
    fatherName: c.fatherName,
    motherName: c.motherName,
    dob: c.dob,
    gender: c.gender,
    mobile: c.mobile,
    email: c.email,
    nid: c.nid,
    presentAddress: c.presentAddress,
    division: c.division ?? '',
    district: c.district ?? '',
    permanentAddress: c.permanentAddress,
    occupation: c.occupation,
    monthlyIncome: String(c.monthlyIncome),
    branch: c.branch,
    status: c.status,
    smsAlerts: !!c.smsAlerts,
    eStatement: !!c.eStatement,
    documents: c.documents ?? [],
    businessName: c.businessName ?? '',
    tradeLicense: c.tradeLicense ?? '',
  };

  const onSubmit = async (values: CustomerFormValues) => {
    const res = await act((d, u) => svc.updateCustomer(d, u, customerId, values));
    if (!res.ok) return { error: res.error, field: res.field };
    navigate(`/customers/${customerId}`);
    return null;
  };

  return (
    <div data-testid="customer-edit-page">
      <PageHeader title={`Edit Customer ${customerId}`} subtitle="Changing the NID of a KYC-verified customer resets KYC to Pending." />
      <CustomerForm mode="edit" customerId={customerId} defaultValues={defaults} userBranch={user.branch} onSubmit={onSubmit} onCancel={() => navigate(`/customers/${customerId}`)} />
    </div>
  );
}

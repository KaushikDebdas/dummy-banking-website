import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '../../auth/AuthContext';
import { canAccessBranch } from '../../auth/permissions';
import { Alert, Button, Card, Field, PageHeader, SelectInput, StatusBadge, TextInput } from '../../components/ui';
import { Combobox, InfoTip, RangeField } from '../../components/ui/advanced';
import { DEPOSIT_PRODUCTS, DEPOSIT_PRODUCT_LIST, MAX_BACK_VALUE_DAYS, branchName } from '../../data/reference';
import { useAction } from '../../hooks/useAction';
import { useCustomerSearch } from '../../hooks/useCustomerSearch';
import { today } from '../../lib/dates';
import { mbsMonthlyProfit } from '../../lib/depositCalc';
import { money } from '../../lib/format';
import { makeResolver, validateDeposit, type DepositFormValues } from '../../lib/validation';
import { useStore } from '../../store/StoreContext';
import * as svc from '../../store/services';
import type { DepositProduct } from '../../types';

const RELATIONS = ['Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'];

export function DepositCreatePage() {
  const user = useCurrentUser();
  const { state } = useStore();
  const act = useAction();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState('');

  const searchCustomers = useCustomerSearch();
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<DepositFormValues>({
    resolver: makeResolver(validateDeposit),
    mode: 'onTouched',
    defaultValues: {
      customerId: params.get('customerId') ?? '',
      product: '',
      openingDate: today(),
      amount: '',
      tenureMonths: '',
      nomineeName: '',
      nomineeRelation: '',
      nomineeShare: '100',
      linkedAccountNo: '',
    },
  });

  const v = watch();
  const cfg = DEPOSIT_PRODUCTS[v.product as DepositProduct];
  const custId = v.customerId.trim().toUpperCase();
  const customer = custId ? state.customers.find((c) => c.customerId === custId) : undefined;
  const inScope = customer ? canAccessBranch(user, customer.branch) : false;
  const linkable = customer ? state.deposits.filter((d) => d.customerId === customer.customerId && ['SAVINGS', 'CURRENT'].includes(d.product) && d.status === 'Active') : [];
  const terms = svc.previewDepositTerms(v.product, v.amount, v.openingDate, v.tenureMonths);
  const err = (f: keyof DepositFormValues) => errors[f]?.message as string | undefined;
  const id = (f: string) => `deposit-form-${f}`;

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError('');
      const res = await act((d, u) => svc.createDeposit(d, u, values));
      if (!res.ok) {
        setFormError(res.error);
        if (res.field) setError(res.field as keyof DepositFormValues, { type: 'server', message: res.error });
        return;
      }
      navigate('/deposits', { state: { highlight: res.data.accountNo } });
    },
    () => setFormError('Please correct the highlighted fields before submitting.'),
  );

  const productChanged = (p: string) => {
    setValue('product', p, { shouldValidate: false });
    setValue('tenureMonths', '');
    setValue('linkedAccountNo', '');
  };

  const customerHint = () => {
    if (!custId) return 'Enter an existing Customer ID, e.g. CUS-DHK-000002';
    if (!customer) return undefined;
    return `${customer.fullName} · ${branchName(customer.branch)} · KYC ${customer.kycStatus} · ${customer.status}`;
  };

  return (
    <div data-testid="deposit-create-page">
      <PageHeader title="Open Deposit Account" subtitle="New accounts are created in Pending Approval status and activated by a checker (maker-checker)." />
      <form onSubmit={onSubmit} noValidate data-testid="deposit-form">
        {formError && (
          <div className="mb-4">
            <Alert testId="deposit-form-error">{formError}</Alert>
          </div>
        )}
        <div className="flex flex-col gap-5">
          <Card title="Customer" testId="deposit-form-customer-section">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field
                id={id('customerId')}
                label="Customer ID"
                required
                error={err('customerId')}
                hint={customerHint()}
                labelExtra={<InfoTip id={id('customerId')} text="Autocomplete: type 2+ characters of an ID, name or mobile number and pick a suggestion, or type the full Customer ID." />}
              >
                <Controller
                  control={control}
                  name="customerId"
                  render={({ field }) => (
                    <Combobox id={id('customerId')} freeText minChars={2} value={field.value} onChange={field.onChange} onBlur={field.onBlur} loadOptions={searchCustomers} invalid={!!err('customerId')} placeholder="Type ID, name or mobile..." emptyText="No matching active customer" />
                  )}
                />
              </Field>
              <Field id={id('customerName')} label="Customer Name">
                <TextInput id={id('customerName')} readOnly value={customer && inScope ? customer.fullName : ''} placeholder="Auto-filled from Customer ID" />
              </Field>
              <Field id={id('branch')} label="Branch">
                <TextInput id={id('branch')} readOnly value={customer && inScope ? branchName(customer.branch) : ''} />
              </Field>
            </div>
            {custId.length >= 14 && !customer && (
              <p className="mt-2 text-xs font-medium text-rose-600" data-testid="deposit-form-customer-not-found">
                No customer found with ID {custId}
              </p>
            )}
            {customer && !inScope && (
              <p className="mt-2 text-xs font-medium text-rose-600" data-testid="deposit-form-customer-out-of-scope">
                Customer {customer.customerId} belongs to {branchName(customer.branch)}. You can only open accounts for {branchName(user.branch)}.
              </p>
            )}
            {customer && inScope && customer.kycStatus !== 'Verified' && (
              <div className="mt-3">
                <Alert kind="warning" testId="deposit-form-kyc-warning">
                  Customer KYC is {customer.kycStatus}. The account can be created but will not be approved until KYC is Verified.
                </Alert>
              </div>
            )}
          </Card>

          <Card title="Account Details" testId="deposit-form-account-section">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field id={id('accountNo')} label="Account Number">
                <TextInput id={id('accountNo')} readOnly value="Auto-generated on save" />
              </Field>
              <Field id={id('product')} label="Deposit Product" required error={err('product')} hint={cfg?.description}>
                <SelectInput
                  id={id('product')}
                  invalid={!!err('product')}
                  placeholder="-- Select Product --"
                  options={DEPOSIT_PRODUCT_LIST.map((p) => ({ value: p.code, label: p.name }))}
                  {...register('product', { onChange: (e) => productChanged(e.target.value) })}
                />
              </Field>
              <Field id={id('openingDate')} label="Account Opening Date" required error={err('openingDate')} hint={`Today or up to ${MAX_BACK_VALUE_DAYS} days back`}>
                <TextInput id={id('openingDate')} type="date" invalid={!!err('openingDate')} {...register('openingDate')} />
              </Field>
              <Field
                id={id('amount')}
                label={cfg ? `${cfg.amountLabel} (BDT)` : 'Initial Deposit Amount (BDT)'}
                required
                error={err('amount')}
                hint={cfg ? `Min ${money(cfg.minAmount)} · Max ${money(cfg.maxAmount)}${cfg.code === 'DPS' ? ' · multiples of 500' : ''}` : undefined}
              >
                <TextInput id={id('amount')} type="number" min={0} step="0.01" invalid={!!err('amount')} {...register('amount')} />
              </Field>
              <Field id={id('interestRate')} label="Interest Rate (% p.a.)">
                <TextInput id={id('interestRate')} readOnly value={cfg && terms && (!cfg.term || v.tenureMonths) ? terms.rate.toFixed(2) : ''} placeholder="Auto" />
              </Field>
              {cfg?.term && (
                <Field id={id('tenureMonths')} label="Account Term / Tenure" required error={err('tenureMonths')}>
                  <SelectInput
                    id={id('tenureMonths')}
                    invalid={!!err('tenureMonths')}
                    placeholder="-- Select Tenure --"
                    options={cfg.tenures.map((t) => ({ value: String(t), label: t % 12 === 0 && t >= 36 ? `${t / 12} Years (${t} months)` : `${t} Months` }))}
                    {...register('tenureMonths')}
                  />
                </Field>
              )}
              {cfg?.term && (
                <Field id={id('maturityDate')} label="Maturity Date">
                  <TextInput id={id('maturityDate')} readOnly value={terms?.maturityDate ?? ''} placeholder="Auto" />
                </Field>
              )}
              {cfg && (cfg.code === 'FDR' || cfg.code === 'DPS') && (
                <Field id={id('maturityAmount')} label="Estimated Maturity Amount (BDT)">
                  <TextInput id={id('maturityAmount')} readOnly value={terms?.maturityAmount && Number(v.amount) >= cfg.minAmount ? money(terms.maturityAmount) : ''} placeholder="Auto" />
                </Field>
              )}
              {cfg?.code === 'MBS' && (
                <Field id={id('monthlyProfit')} label="Monthly Profit (BDT)">
                  <TextInput id={id('monthlyProfit')} readOnly value={terms && v.tenureMonths && Number(v.amount) ? money(mbsMonthlyProfit(Number(v.amount), terms.rate)) : ''} placeholder="Auto" />
                </Field>
              )}
              <Field id={id('status')} label="Account Status">
                <div className="pt-1.5">
                  <StatusBadge status="Pending Approval" testId={id('status')} />
                </div>
              </Field>
            </div>
          </Card>

          {cfg?.term && (
            <Card title="Nominee & Payout" testId="deposit-form-nominee-section">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field id={id('nomineeName')} label="Nominee Name" required error={err('nomineeName')}>
                  <TextInput id={id('nomineeName')} invalid={!!err('nomineeName')} {...register('nomineeName')} />
                </Field>
                <Field id={id('nomineeRelation')} label="Nominee Relation" required error={err('nomineeRelation')}>
                  <SelectInput id={id('nomineeRelation')} invalid={!!err('nomineeRelation')} placeholder="-- Select --" options={RELATIONS.map((r) => ({ value: r, label: r }))} {...register('nomineeRelation')} />
                </Field>
                <Field id={id('nomineeShare')} label="Nominee Share (%)" required error={err('nomineeShare')} className="md:col-span-2">
                  <Controller
                    control={control}
                    name="nomineeShare"
                    render={({ field }) => <RangeField id={id('nomineeShare')} value={field.value} onChange={field.onChange} onBlur={field.onBlur} min={1} max={100} suffix="%" invalid={!!err('nomineeShare')} />}
                  />
                </Field>
                {cfg.requiresLinkedAccount && (
                  <Field
                    id={id('linkedAccountNo')}
                    label="Linked Account (profit payout)"
                    required
                    error={err('linkedAccountNo')}
                    hint={customer && linkable.length === 0 ? 'Customer has no Active Savings/Current account to link' : undefined}
                  >
                    <SelectInput
                      id={id('linkedAccountNo')}
                      invalid={!!err('linkedAccountNo')}
                      placeholder="-- Select Account --"
                      options={linkable.map((a) => ({ value: a.accountNo, label: `${a.accountNo} (${DEPOSIT_PRODUCTS[a.product].name})` }))}
                      {...register('linkedAccountNo')}
                    />
                  </Field>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="mt-5 flex justify-between gap-2">
          <Button variant="secondary" testId="deposit-form-cancel-btn" onClick={() => navigate('/deposits')}>
            Cancel
          </Button>
          <Button type="submit" testId="deposit-form-submit-btn">
            Create Deposit Account
          </Button>
        </div>
      </form>
    </div>
  );
}

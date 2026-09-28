import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '../../auth/AuthContext';
import { canAccessBranch } from '../../auth/permissions';
import { Alert, Button, Card, Field, PageHeader, SelectInput, StatusBadge, TextInput } from '../../components/ui';
import { Combobox, FileUpload, InfoTip, MultiSelect, RangeField, ToggleSwitch } from '../../components/ui/advanced';
import { COLLATERAL_TYPES, LOAN_PRODUCTS, LOAN_PRODUCT_LIST, LOAN_PURPOSES, REPAYMENT_FREQUENCIES, branchName } from '../../data/reference';
import { useAction } from '../../hooks/useAction';
import { useCustomerSearch } from '../../hooks/useCustomerSearch';
import { today } from '../../lib/dates';
import { money } from '../../lib/format';
import { FREQUENCY_MONTHS } from '../../lib/loanCalc';
import { makeResolver, validateLoan, type LoanFormValues } from '../../lib/validation';
import { useStore } from '../../store/StoreContext';
import * as svc from '../../store/services';
import type { LoanProduct, RepaymentFrequency } from '../../types';

export function LoanCreatePage() {
  const user = useCurrentUser();
  const { state } = useStore();
  const act = useAction();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [formError, setFormError] = useState('');
  const searchCustomers = useCustomerSearch();

  // Values can be pre-filled from the EMI Calculator (?product=&amount=&rate=&tenure=&frequency=).
  const preProduct = LOAN_PRODUCTS[(params.get('product') ?? '') as LoanProduct] ? (params.get('product') as string) : '';
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<LoanFormValues>({
    resolver: makeResolver(validateLoan),
    mode: 'onTouched',
    defaultValues: {
      customerId: params.get('customerId') ?? '',
      product: preProduct,
      amount: params.get('amount') ?? '',
      interestRate: params.get('rate') ?? (preProduct ? String(LOAN_PRODUCTS[preProduct as LoanProduct].defaultRate) : ''),
      tenureMonths: params.get('tenure') ?? '',
      frequency: REPAYMENT_FREQUENCIES.includes(params.get('frequency') as RepaymentFrequency) ? (params.get('frequency') as string) : 'Monthly',
      startDate: today(),
      purpose: '',
      collateral: [],
      insurance: false,
      documents: [],
    },
  });

  const v = watch();
  const cfg = LOAN_PRODUCTS[v.product as LoanProduct];
  const custId = v.customerId.trim().toUpperCase();
  const customer = custId ? state.customers.find((c) => c.customerId === custId) : undefined;
  const inScope = customer ? canAccessBranch(user, customer.branch) : false;
  const preview = svc.previewLoan(v.product, v.amount, v.interestRate, v.tenureMonths, v.frequency, v.startDate);
  const err = (f: keyof LoanFormValues) => errors[f]?.message as string | undefined;
  const id = (f: string) => `loan-form-${f}`;
  const step = FREQUENCY_MONTHS[(v.frequency || 'Monthly') as RepaymentFrequency] ?? 1;

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError('');
      const res = await act((d, u) => svc.createLoan(d, u, values));
      if (!res.ok) {
        setFormError(res.error);
        if (res.field) setError(res.field as keyof LoanFormValues, { type: 'server', message: res.error });
        return;
      }
      navigate('/loans', { state: { highlight: res.data.loanAccountNo } });
    },
    () => setFormError('Please correct the highlighted fields before submitting.'),
  );

  return (
    <div data-testid="loan-create-page">
      <PageHeader title="Create Loan Account" subtitle="The installment is calculated with the reducing-balance (EMI) method. New loans start in Applied status." />
      <form onSubmit={onSubmit} noValidate data-testid="loan-form">
        {formError && (
          <div className="mb-4">
            <Alert testId="loan-form-error">{formError}</Alert>
          </div>
        )}
        <div className="flex flex-col gap-5">
          <Card title="Borrower" testId="loan-form-customer-section">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field
                id={id('customerId')}
                label="Customer ID"
                required
                error={err('customerId')}
                hint={customer && inScope ? `${customer.customerType} · Income ${money(customer.monthlyIncome)} · KYC ${customer.kycStatus}` : 'Type 2+ characters to search'}
                labelExtra={<InfoTip id={id('customerId')} text="Autocomplete: suggestions load from a simulated server search after a short delay." />}
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
              <p className="mt-2 text-xs font-medium text-rose-600" data-testid="loan-form-customer-not-found">
                No customer found with ID {custId}
              </p>
            )}
            {customer && !inScope && (
              <p className="mt-2 text-xs font-medium text-rose-600" data-testid="loan-form-customer-out-of-scope">
                Customer {customer.customerId} belongs to {branchName(customer.branch)}. You can only create loans for {branchName(user.branch)}.
              </p>
            )}
          </Card>

          <Card title="Loan Terms" testId="loan-form-terms-section">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field id={id('loanAccountNo')} label="Loan Account Number">
                <TextInput id={id('loanAccountNo')} readOnly value="Auto-generated on save" />
              </Field>
              <Field id={id('product')} label="Loan Product" required error={err('product')} hint={cfg?.description}>
                <SelectInput
                  id={id('product')}
                  invalid={!!err('product')}
                  placeholder="-- Select Product --"
                  options={LOAN_PRODUCT_LIST.map((p) => ({ value: p.code, label: p.name }))}
                  {...register('product', {
                    onChange: (e) => {
                      const p = LOAN_PRODUCTS[e.target.value as LoanProduct];
                      setValue('interestRate', p ? String(p.defaultRate) : '');
                      if (p && !v.tenureMonths) setValue('tenureMonths', String(p.minTenure));
                    },
                  })}
                />
              </Field>
              <Field id={id('amount')} label="Loan Amount (BDT)" required error={err('amount')} hint={cfg ? `${money(cfg.minAmount)} - ${money(cfg.maxAmount)}` : undefined}>
                <TextInput id={id('amount')} type="number" min={0} step="1000" invalid={!!err('amount')} {...register('amount')} />
              </Field>
              <Field id={id('interestRate')} label="Interest Rate (% p.a.)" required error={err('interestRate')} hint={cfg ? `${cfg.minRate}% - ${cfg.maxRate}%` : undefined}>
                <TextInput id={id('interestRate')} type="number" min={0} max={30} step="0.01" invalid={!!err('interestRate')} {...register('interestRate')} />
              </Field>
              <Field id={id('frequency')} label="Repayment Frequency" required error={err('frequency')}>
                <SelectInput id={id('frequency')} invalid={!!err('frequency')} options={REPAYMENT_FREQUENCIES.map((f) => ({ value: f, label: f }))} {...register('frequency')} />
              </Field>
              <Field id={id('startDate')} label="Loan Start Date" required error={err('startDate')} hint="First installment falls due one period after this date">
                <TextInput id={id('startDate')} type="date" invalid={!!err('startDate')} {...register('startDate')} />
              </Field>
              <Field
                id={id('tenureMonths')}
                label="Loan Tenure (months)"
                required
                error={err('tenureMonths')}
                hint={cfg ? `${cfg.minTenure} - ${cfg.maxTenure} months, in steps of ${step}` : 'Select a product to enable the slider range'}
                className="md:col-span-2"
              >
                <Controller
                  control={control}
                  name="tenureMonths"
                  render={({ field }) => (
                    <RangeField id={id('tenureMonths')} value={field.value} onChange={field.onChange} onBlur={field.onBlur} min={cfg?.minTenure ?? 6} max={cfg?.maxTenure ?? 300} step={step} suffix="months" invalid={!!err('tenureMonths')} />
                  )}
                />
              </Field>
              <Field id={id('purpose')} label="Loan Purpose" required error={err('purpose')}>
                <SelectInput id={id('purpose')} invalid={!!err('purpose')} placeholder="-- Select --" options={LOAN_PURPOSES.map((p) => ({ value: p, label: p }))} {...register('purpose')} />
              </Field>
              <Field
                id={id('collateral')}
                label="Collateral / Security"
                required={!!cfg?.requiresCollateral}
                error={err('collateral')}
                hint={cfg ? (cfg.requiresCollateral ? `Required for ${cfg.name}` : 'Optional for this product') : undefined}
                className="md:col-span-2"
              >
                <Controller
                  control={control}
                  name="collateral"
                  render={({ field }) => (
                    <MultiSelect id={id('collateral')} value={field.value ?? []} onChange={field.onChange} onBlur={field.onBlur} invalid={!!err('collateral')} options={COLLATERAL_TYPES.map((c) => ({ value: c, label: c }))} />
                  )}
                />
              </Field>
              <div className="flex flex-col justify-end">
                <Controller
                  control={control}
                  name="insurance"
                  render={({ field }) => <ToggleSwitch id={id('insurance')} label="Credit Life Insurance" description="Covers the outstanding balance" checked={!!field.value} onChange={field.onChange} />}
                />
              </div>
              <Field id={id('status')} label="Loan Status">
                <div className="pt-1.5">
                  <StatusBadge status="Applied" testId={id('status')} />
                </div>
              </Field>
            </div>
          </Card>

          <Card title="Supporting Documents (optional)" testId="loan-form-documents-section">
            <Field id={id('documents')} label="Salary certificate, bank statement, trade license..." error={err('documents')}>
              <Controller control={control} name="documents" render={({ field }) => <FileUpload id={id('documents')} value={field.value ?? []} onChange={field.onChange} invalid={!!err('documents')} />} />
            </Field>
          </Card>

          <Card title="Calculated Repayment" testId="loan-form-calculation-section">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Field id={id('installmentAmount')} label="Installment Amount (BDT)">
                <TextInput id={id('installmentAmount')} readOnly value={preview ? money(preview.installment) : ''} data-value={preview?.installment ?? ''} placeholder="Auto-calculated" />
              </Field>
              <Field id={id('numberOfInstallments')} label="No. of Installments">
                <TextInput id={id('numberOfInstallments')} readOnly value={preview ? String(preview.numberOfInstallments) : ''} placeholder="Auto" />
              </Field>
              <Field id={id('maturityDate')} label="Loan Maturity Date">
                <TextInput id={id('maturityDate')} readOnly value={preview?.maturityDate ?? ''} placeholder="Auto" />
              </Field>
              <Field id={id('totalRepayment')} label="Total Repayment (approx.)">
                <TextInput id={id('totalRepayment')} readOnly value={preview ? money(preview.totalRepayment) : ''} placeholder="Auto" />
              </Field>
            </div>
          </Card>
        </div>

        <div className="mt-5 flex justify-between gap-2">
          <Button variant="secondary" testId="loan-form-cancel-btn" onClick={() => navigate('/loans')}>
            Cancel
          </Button>
          <Button type="submit" testId="loan-form-submit-btn">
            Create Loan Account
          </Button>
        </div>
      </form>
    </div>
  );
}

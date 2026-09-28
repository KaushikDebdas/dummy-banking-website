import { useEffect, useState } from 'react';
import { Controller, useForm, type Path } from 'react-hook-form';
import { useCurrentUser } from '../../auth/AuthContext';
import { Alert, Button, Card, Field, SelectInput, Spinner, TextArea, TextInput, cx } from '../../components/ui';
import { Combobox, FileUpload, InfoTip, RadioGroup, ToggleSwitch } from '../../components/ui/advanced';
import { BRANCHES, DIVISIONS, DIVISION_NAMES, OCCUPATIONS, branchName } from '../../data/reference';
import { makeResolver, validateCustomer, type CustomerFormValues } from '../../lib/validation';
import type { BranchScope } from '../../types';

type F = keyof CustomerFormValues;

export const CUSTOMER_STEPS: { title: string; fields: F[] }[] = [
  { title: 'Personal Information', fields: ['customerType', 'fullName', 'fatherName', 'motherName', 'dob', 'gender', 'businessName', 'tradeLicense'] },
  { title: 'Contact & Identity', fields: ['mobile', 'email', 'nid', 'documents'] },
  { title: 'Address', fields: ['presentAddress', 'division', 'district', 'permanentAddress'] },
  { title: 'Financial & Preferences', fields: ['occupation', 'monthlyIncome', 'branch', 'status', 'smsAlerts', 'eStatement'] },
  { title: 'Review & Submit', fields: [] },
];

const LABELS: Record<F, string> = {
  customerType: 'Customer Type',
  fullName: 'Full Name',
  fatherName: "Father's Name",
  motherName: "Mother's Name",
  dob: 'Date of Birth',
  gender: 'Gender',
  businessName: 'Business Name',
  tradeLicense: 'Trade License No.',
  mobile: 'Mobile Number',
  email: 'Email Address',
  nid: 'National ID (NID)',
  documents: 'KYC Documents',
  presentAddress: 'Present Address',
  division: 'Division',
  district: 'District',
  permanentAddress: 'Permanent Address',
  occupation: 'Occupation',
  monthlyIncome: 'Monthly Income (BDT)',
  branch: 'Branch',
  status: 'Customer Status',
  smsAlerts: 'SMS Alerts',
  eStatement: 'e-Statement',
};

/** Fields that are optional (everything else is required). */
const OPTIONAL: F[] = ['documents', 'smsAlerts', 'eStatement'];
const DISTRICT_LOAD_MS = 600;

interface Props {
  mode: 'create' | 'edit';
  defaultValues: CustomerFormValues;
  userBranch: BranchScope;
  customerId?: string;
  /** Returns an error (optionally tied to a field) or null on success. */
  onSubmit: (values: CustomerFormValues) => Promise<{ error: string; field?: string } | null>;
  onCancel: () => void;
}

export function CustomerForm({ mode, defaultValues, userBranch, customerId, onSubmit, onCancel }: Props) {
  const user = useCurrentUser();
  const {
    register,
    control,
    handleSubmit,
    watch,
    trigger,
    setValue,
    setError,
    getValues,
    formState: { errors, isDirty, isSubmitSuccessful },
  } = useForm<CustomerFormValues>({ defaultValues, resolver: makeResolver(validateCustomer), mode: 'onTouched' });
  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState('');
  const [sameAddress, setSameAddress] = useState(false);
  const [districts, setDistricts] = useState<string[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const type = watch('customerType');
  const division = watch('division');
  const multiStep = mode === 'create';
  const lastStep = CUSTOMER_STEPS.length - 1;
  const id = (f: F) => `customer-form-${f}`;
  const err = (f: F) => errors[f]?.message as string | undefined;

  // Cascading dropdown: districts are "fetched" for the chosen division after a short delay.
  useEffect(() => {
    if (!division) {
      setDistricts([]);
      return;
    }
    setDistrictsLoading(true);
    const t = window.setTimeout(() => {
      setDistricts(DIVISIONS[division] ?? []);
      setDistrictsLoading(false);
    }, DISTRICT_LOAD_MS);
    return () => window.clearTimeout(t);
  }, [division]);

  // Warn before leaving the page with unsaved changes (native "beforeunload" dialog).
  useEffect(() => {
    if (!isDirty || isSubmitSuccessful) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, isSubmitSuccessful]);

  const visible = (f: F) => {
    if ((f === 'businessName' || f === 'tradeLicense') && type !== 'Business') return false;
    if (f === 'status' && mode === 'edit') return false;
    return true;
  };

  const next = async () => {
    const fields = CUSTOMER_STEPS[step].fields.filter(visible) as Path<CustomerFormValues>[];
    const valid = await trigger(fields);
    if (valid) {
      setFormError('');
      setStep((s) => Math.min(s + 1, lastStep));
    } else setFormError('Please correct the highlighted fields before continuing.');
  };

  const cancel = () => {
    // Native browser confirm() — practise page.on("dialog") in Playwright.
    if (isDirty && !window.confirm('You have unsaved changes. Discard them and leave this page?')) return;
    onCancel();
  };

  const submit = handleSubmit(
    async (values) => {
      setFormError('');
      const res = await onSubmit(values);
      if (res) {
        setFormError(res.error);
        if (res.field && res.field in LABELS) {
          setError(res.field as F, { type: 'server', message: res.error });
          const stepIdx = CUSTOMER_STEPS.findIndex((s) => s.fields.includes(res.field as F));
          if (multiStep && stepIdx >= 0) setStep(stepIdx);
        }
      }
    },
    (errs) => {
      setFormError('Please correct the highlighted fields before submitting.');
      if (multiStep) {
        const first = CUSTOMER_STEPS.findIndex((s) => s.fields.some((f) => errs[f]));
        if (first >= 0) setStep(first);
      }
    },
  );

  const copyAddress = (checked: boolean) => {
    setSameAddress(checked);
    if (checked) setValue('permanentAddress', getValues('presentAddress'), { shouldValidate: true, shouldDirty: true });
  };

  const renderField = (f: F) => {
    if (!visible(f)) return null;
    const common = { id: id(f), invalid: !!err(f), ...register(f) };
    const required = !OPTIONAL.includes(f);
    let control_;
    let span = false;
    let labelExtra;
    switch (f) {
      case 'gender':
        return (
          <RadioGroup
            key={f}
            id={id(f)}
            label={LABELS[f]}
            required
            error={err(f)}
            options={['Male', 'Female', 'Other'].map((g) => ({ value: g, label: g }))}
            inputProps={register('gender')}
          />
        );
      case 'smsAlerts':
      case 'eStatement':
        return (
          <Controller
            key={f}
            control={control}
            name={f}
            render={({ field }) => (
              <div className="rounded-md border border-slate-200 p-3">
                <ToggleSwitch
                  id={id(f)}
                  label={LABELS[f]}
                  description={f === 'smsAlerts' ? 'Send an SMS for every transaction' : 'Email monthly statements instead of paper'}
                  checked={!!field.value}
                  onChange={field.onChange}
                />
              </div>
            )}
          />
        );
      case 'customerType':
        control_ = <SelectInput {...common} placeholder="-- Select --" options={[{ value: 'Individual', label: 'Individual' }, { value: 'Business', label: 'Business' }]} />;
        break;
      case 'occupation':
        labelExtra = <InfoTip id="customer-form-occupation" text="Searchable dropdown: type to filter, use ↑ ↓ and Enter to select." />;
        control_ = (
          <Controller
            control={control}
            name="occupation"
            render={({ field }) => (
              <Combobox
                id={id(f)}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                invalid={!!err(f)}
                placeholder="Search occupation..."
                options={OCCUPATIONS.map((o) => ({ value: o, label: o }))}
              />
            )}
          />
        );
        break;
      case 'division':
        control_ = (
          <SelectInput
            {...common}
            {...register('division', { onChange: () => setValue('district', '', { shouldDirty: true }) })}
            placeholder="-- Select Division --"
            options={DIVISION_NAMES.map((d) => ({ value: d, label: d }))}
          />
        );
        break;
      case 'district':
        control_ = (
          <Controller
            control={control}
            name="district"
            render={({ field }) => (
              <div className="relative">
                <SelectInput
                  id={id(f)}
                  invalid={!!err(f)}
                  value={districtsLoading ? '' : field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  disabled={!division || districtsLoading}
                  aria-busy={districtsLoading}
                  placeholder={!division ? '-- Select a division first --' : districtsLoading ? 'Loading districts...' : '-- Select District --'}
                  options={districtsLoading ? [] : districts.map((d) => ({ value: d, label: d }))}
                />
                {districtsLoading && (
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-teal-700" data-testid="customer-form-district-loading">
                    <Spinner />
                  </span>
                )}
              </div>
            )}
          />
        );
        break;
      case 'documents':
        span = true;
        labelExtra = <InfoTip id="customer-form-documents" text="Optional. Upload NID copy and photo. Only file names and sizes are stored." />;
        control_ = (
          <Controller control={control} name="documents" render={({ field }) => <FileUpload id={id(f)} value={field.value ?? []} onChange={field.onChange} invalid={!!err(f)} />} />
        );
        break;
      case 'branch':
        // A locked branch is display-only (not registered): RHF would drop a disabled field's value.
        control_ =
          userBranch !== 'ALL' || mode === 'edit' ? (
            <SelectInput id={id(f)} disabled value={defaultValues.branch} options={BRANCHES.map((b) => ({ value: b.code, label: b.name }))} />
          ) : (
            <SelectInput {...common} placeholder="-- Select --" options={BRANCHES.map((b) => ({ value: b.code, label: b.name }))} />
          );
        break;
      case 'status':
        control_ = <SelectInput {...common} options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />;
        break;
      case 'presentAddress':
        span = true;
        control_ = <TextArea {...common} />;
        break;
      case 'permanentAddress':
        span = true;
        control_ = <TextArea {...common} readOnly={sameAddress} />;
        break;
      case 'dob':
        control_ = <TextInput {...common} type="date" max={new Date().toISOString().slice(0, 10)} />;
        break;
      case 'mobile':
        control_ = <TextInput {...common} type="tel" inputMode="numeric" maxLength={11} placeholder="01XXXXXXXXX" />;
        break;
      case 'nid':
        labelExtra = <InfoTip id="customer-form-nid" text="Bangladeshi National ID: exactly 10, 13 or 17 digits. Must be unique." />;
        control_ = <TextInput {...common} inputMode="numeric" maxLength={17} placeholder="10, 13 or 17 digits" />;
        break;
      case 'monthlyIncome':
        control_ = <TextInput {...common} type="number" min={0} step="0.01" placeholder="e.g. 50000" />;
        break;
      case 'email':
        control_ = <TextInput {...common} type="email" placeholder="name@example.com" />;
        break;
      case 'tradeLicense':
        control_ = <TextInput {...common} placeholder="TL-1234567" />;
        break;
      default:
        control_ = <TextInput {...common} />;
    }
    const hint =
      f === 'branch' && userBranch !== 'ALL' ? `Locked to your branch (${branchName(userBranch)})` : f === 'district' && !division ? 'Districts load after you pick a division' : undefined;
    return (
      <Field key={f} id={id(f)} label={LABELS[f]} required={required} error={err(f)} hint={hint} labelExtra={labelExtra} className={span ? 'md:col-span-2' : undefined}>
        {control_}
        {f === 'presentAddress' && (
          <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" data-testid="customer-form-same-address" checked={sameAddress} onChange={(e) => copyAddress(e.target.checked)} />
            Permanent address is the same as present address
          </label>
        )}
      </Field>
    );
  };

  const values = watch();
  const reviewFields = CUSTOMER_STEPS.slice(0, lastStep).flatMap((s) => s.fields).filter(visible);
  const reviewValue = (f: F) => {
    const v = values[f];
    if (f === 'branch') return branchName(values.branch);
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) return v.length ? v.map((d) => d.name).join(', ') : 'None';
    return String(v ?? '') || '-';
  };

  return (
    <form onSubmit={submit} noValidate data-testid="customer-form" data-mode={mode}>
      {/* Hidden fields: not visible, but present in the DOM (assert with to_have_value / to_be_hidden). */}
      <input type="hidden" name="channel" value="BRANCH" data-testid="customer-form-channel" />
      <input type="hidden" name="maker" value={user.username} data-testid="customer-form-maker" />

      {multiStep && (
        <ol className="mb-5 flex flex-wrap gap-2" data-testid="customer-form-step-indicator" data-step={step + 1}>
          {CUSTOMER_STEPS.map((s, i) => (
            <li
              key={s.title}
              data-testid={`customer-form-step-${i + 1}`}
              data-active={i === step}
              data-complete={i < step}
              aria-current={i === step ? 'step' : undefined}
              className={cx(
                'flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
                i === step ? 'border-teal-600 bg-teal-50 text-teal-800' : i < step ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500',
              )}
            >
              <span>{i < step ? '✓' : i + 1}</span> {s.title}
            </li>
          ))}
        </ol>
      )}

      {formError && (
        <div className="mb-4">
          <Alert testId="customer-form-error">{formError}</Alert>
        </div>
      )}

      {multiStep ? (
        <Card title={`Step ${step + 1} of ${CUSTOMER_STEPS.length}: ${CUSTOMER_STEPS[step].title}`} testId={`customer-form-section-${step + 1}`}>
          {step < lastStep ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{CUSTOMER_STEPS[step].fields.map(renderField)}</div>
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="customer-form-review">
              {reviewFields.map((f) => (
                <div key={f}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{LABELS[f]}</dt>
                  <dd className="text-sm text-slate-900" data-testid={`review-${f}`}>
                    {reviewValue(f)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Card title="Customer ID" testId="customer-form-section-id">
            <TextInput id="customer-form-customerId" value={customerId} readOnly />
          </Card>
          {CUSTOMER_STEPS.slice(0, lastStep).map((s, i) => (
            <Card key={s.title} title={s.title} testId={`customer-form-section-${i + 1}`}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{s.fields.map(renderField)}</div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <Button variant="secondary" testId="customer-form-cancel-btn" onClick={cancel}>
          Cancel
        </Button>
        <div className="flex gap-2">
          {multiStep && step > 0 && (
            <Button variant="secondary" testId="customer-form-back-btn" onClick={() => setStep((s) => s - 1)}>
              ‹ Back
            </Button>
          )}
          {/* Distinct keys: reusing one <button> and flipping its type to "submit" mid-click would submit the form early. */}
          {multiStep && step < lastStep ? (
            <Button key="next" testId="customer-form-next-btn" onClick={next}>
              Next ›
            </Button>
          ) : (
            <Button key="submit" type="submit" testId="customer-form-submit-btn">
              {mode === 'create' ? 'Create Customer' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

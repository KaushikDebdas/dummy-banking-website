/**
 * Validation shared by the forms (field-level messages) and by the service
 * layer (defence in depth). Form values are kept as strings, exactly as typed,
 * and converted to numbers by the services.
 *
 * Each validator = a Zod base schema (format rules per field) + a plain
 * function for cross-field / conditional rules. Both always run, so every
 * field error is reported at once, regardless of which other fields are invalid.
 */
import { z } from 'zod';
import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import { DEPOSIT_PRODUCTS, DIVISIONS, DOCUMENT_RULES, LOAN_PRODUCTS, MAX_BACK_VALUE_DAYS } from '../data/reference';
import type { DepositProduct, DocMeta, LoanProduct, RepaymentFrequency } from '../types';
import { addDays, ageOn, isValidISODate, today } from './dates';
import { FREQUENCY_MONTHS } from './loanCalc';

export const MOBILE_REGEX = /^01[3-9]\d{8}$/;
export const NID_REGEX = /^(\d{10}|\d{13}|\d{17})$/;
export const NAME_REGEX = /^[A-Za-z][A-Za-z .'-]*$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const TRADE_LICENSE_REGEX = /^TL-\d{6,10}$/;
export const AMOUNT_REGEX = /^\d+(\.\d{1,2})?$/;
export const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,20}$/;
export const PASSWORD_MESSAGE = 'Password must be 8-20 characters with upper case, lower case, a digit and a special character';

export type Errors = Record<string, string>;
type Add = (field: string, message: string) => void;

function validateWith<S extends z.ZodTypeAny>(schema: S, values: unknown, extra?: (v: z.input<S>, add: Add) => void): Errors {
  const errors: Errors = {};
  const add: Add = (f, m) => {
    if (!errors[f]) errors[f] = m;
  };
  const res = schema.safeParse(values);
  if (!res.success) for (const i of res.error.issues) add(String(i.path[0] ?? 'form'), i.message);
  extra?.(values as z.input<S>, add);
  return errors;
}

/** First error as { error, field } (used by services). */
export function firstError(errors: Errors): { error: string; field: string } | null {
  const k = Object.keys(errors)[0];
  return k ? { error: errors[k], field: k } : null;
}

/** react-hook-form resolver from a validator. */
export function makeResolver<T extends FieldValues>(validate: (v: T) => Errors): Resolver<T> {
  return async (values) => {
    const errs = validate(values);
    if (Object.keys(errs).length === 0) return { values, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const [k, m] of Object.entries(errs)) errors[k] = { type: 'validation', message: m };
    return { values: {}, errors: errors as FieldErrors<T> };
  };
}

// ------------------------------------------------------------------ field builders
const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => v.length >= 3 && v.length <= 60, `${label} must be between 3 and 60 characters`)
    .refine((v) => NAME_REGEX.test(v), `${label} must contain only letters, spaces, dots, apostrophes or hyphens`);

const requiredText = (label: string) => z.string().trim().min(1, `${label} is required`);

const amountString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .refine((v) => AMOUNT_REGEX.test(v), `${label} must be a valid amount (up to 2 decimals)`);

// ------------------------------------------------------------------ customer
const customerBase = z.object({
  customerType: z.enum(['Individual', 'Business'], { message: 'Customer Type is required' }),
  fullName: nameField('Full Name'),
  fatherName: nameField("Father's Name"),
  motherName: nameField("Mother's Name"),
  dob: z.string().min(1, 'Date of Birth is required').refine(isValidISODate, 'Date of Birth must be a valid date'),
  gender: requiredText('Gender'),
  mobile: z
    .string()
    .trim()
    .min(1, 'Mobile Number is required')
    .refine((v) => MOBILE_REGEX.test(v), 'Mobile Number must be a valid 11-digit Bangladeshi number (e.g. 01712345678)'),
  email: z
    .string()
    .trim()
    .min(1, 'Email Address is required')
    .refine((v) => EMAIL_REGEX.test(v), 'Email Address must be a valid email (e.g. name@example.com)'),
  nid: z
    .string()
    .trim()
    .min(1, 'National ID is required')
    .refine((v) => NID_REGEX.test(v), 'National ID must be exactly 10, 13 or 17 digits'),
  presentAddress: z
    .string()
    .trim()
    .min(1, 'Present Address is required')
    .refine((v) => v.length >= 10 && v.length <= 200, 'Present Address must be between 10 and 200 characters'),
  division: requiredText('Division'),
  district: requiredText('District'),
  permanentAddress: z
    .string()
    .trim()
    .min(1, 'Permanent Address is required')
    .refine((v) => v.length >= 10 && v.length <= 200, 'Permanent Address must be between 10 and 200 characters'),
  occupation: requiredText('Occupation'),
  monthlyIncome: z
    .string()
    .trim()
    .min(1, 'Monthly Income is required')
    .refine((v) => AMOUNT_REGEX.test(v), 'Monthly Income must be a valid non-negative amount')
    .refine((v) => Number(v) <= 100000000, 'Monthly Income cannot exceed 100,000,000'),
  branch: requiredText('Branch'),
  status: z.enum(['Active', 'Inactive'], { message: 'Customer Status is required' }),
  businessName: z.string().optional(),
  tradeLicense: z.string().optional(),
});

export interface CustomerFormValues {
  customerType: 'Individual' | 'Business' | '';
  fullName: string;
  fatherName: string;
  motherName: string;
  dob: string;
  gender: string;
  mobile: string;
  email: string;
  nid: string;
  presentAddress: string;
  division: string;
  district: string;
  permanentAddress: string;
  occupation: string;
  monthlyIncome: string;
  branch: string;
  status: 'Active' | 'Inactive' | '';
  smsAlerts: boolean;
  eStatement: boolean;
  documents: DocMeta[];
  businessName?: string;
  tradeLicense?: string;
}

/** Checks one file against DOCUMENT_RULES; returns an error message or null. */
export function documentError(file: { name: string; size: number; type: string }): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!DOCUMENT_RULES.extensions.includes(ext) || (file.type && !DOCUMENT_RULES.accept.includes(file.type)))
    return `${file.name}: file type not allowed. Allowed types: JPG, PNG, PDF`;
  if (file.size > DOCUMENT_RULES.maxSizeMB * 1024 * 1024) return `${file.name}: file is larger than ${DOCUMENT_RULES.maxSizeMB} MB`;
  if (file.size === 0) return `${file.name}: file is empty`;
  return null;
}

function validateDocuments(docs: DocMeta[] | undefined, field: string, add: Add) {
  if (!docs) return;
  if (docs.length > DOCUMENT_RULES.maxFiles) add(field, `You can upload at most ${DOCUMENT_RULES.maxFiles} documents`);
  for (const d of docs) {
    const e = documentError(d);
    if (e) return add(field, e);
  }
}

export function validateCustomer(v: CustomerFormValues): Errors {
  return validateWith(customerBase, v, (x, add) => {
    if (x.division && x.district && !(DIVISIONS[x.division] ?? []).includes(x.district)) add('district', `District ${x.district} is not in ${x.division} division`);
    validateDocuments(v.documents, 'documents', add);
    if (x.dob && isValidISODate(x.dob)) {
      if (x.dob > today()) add('dob', 'Date of Birth cannot be in the future');
      else if (ageOn(x.dob) < 18) add('dob', x.customerType === 'Business' ? 'Proprietor must be at least 18 years old' : 'Customer must be at least 18 years old');
      else if (ageOn(x.dob) > 100) add('dob', 'Customer age cannot exceed 100 years');
    }
    if (x.customerType === 'Business') {
      const bn = (x.businessName ?? '').trim();
      const tl = (x.tradeLicense ?? '').trim();
      if (bn.length < 3) add('businessName', 'Business Name is required for business customers (min 3 characters)');
      if (!tl) add('tradeLicense', 'Trade License No. is required for business customers');
      else if (!TRADE_LICENSE_REGEX.test(tl)) add('tradeLicense', 'Trade License No. must look like TL-1234567 (6-10 digits)');
    }
  });
}

// ------------------------------------------------------------------ deposit
const depositBase = z.object({
  customerId: requiredText('Customer ID'),
  product: requiredText('Deposit Product'),
  openingDate: z.string().min(1, 'Account Opening Date is required').refine(isValidISODate, 'Account Opening Date must be a valid date'),
  amount: amountString('Amount'),
});

export interface DepositFormValues {
  customerId: string;
  product: string;
  openingDate: string;
  amount: string;
  tenureMonths: string;
  nomineeName: string;
  nomineeRelation: string;
  nomineeShare: string;
  linkedAccountNo: string;
}

export function validateDeposit(v: DepositFormValues): Errors {
  return validateWith(depositBase, v, (x, add) => {
    const cfg = DEPOSIT_PRODUCTS[x.product as DepositProduct];
    if (isValidISODate(x.openingDate)) {
      if (x.openingDate > today()) add('openingDate', 'Account Opening Date cannot be in the future');
      else if (x.openingDate < addDays(today(), -MAX_BACK_VALUE_DAYS)) add('openingDate', `Account Opening Date cannot be more than ${MAX_BACK_VALUE_DAYS} days in the past`);
    }
    if (!cfg) return;
    if (AMOUNT_REGEX.test(x.amount.trim())) {
      const amt = Number(x.amount);
      if (amt < cfg.minAmount) add('amount', `${cfg.amountLabel} must be at least ${cfg.minAmount.toLocaleString('en-US')}`);
      else if (amt > cfg.maxAmount) add('amount', `${cfg.amountLabel} cannot exceed ${cfg.maxAmount.toLocaleString('en-US')}`);
      else if (cfg.code === 'DPS' && amt % 500 !== 0) add('amount', 'Monthly Installment must be a multiple of 500');
    }
    if (cfg.term) {
      if (!v.tenureMonths) add('tenureMonths', 'Tenure is required');
      else if (!cfg.tenures.includes(Number(v.tenureMonths))) add('tenureMonths', 'Select a valid tenure for this product');
    }
    if (cfg.requiresNominee) {
      const n = (v.nomineeName ?? '').trim();
      if (n.length < 3) add('nomineeName', 'Nominee Name is required (min 3 characters)');
      else if (!NAME_REGEX.test(n)) add('nomineeName', 'Nominee Name must contain only letters, spaces, dots, apostrophes or hyphens');
      if (!v.nomineeRelation) add('nomineeRelation', 'Nominee Relation is required');
      const share = Number(v.nomineeShare);
      if (!/^\d+$/.test(String(v.nomineeShare ?? '')) || share < 1 || share > 100) add('nomineeShare', 'Nominee Share must be a whole number between 1 and 100');
    }
    if (cfg.requiresLinkedAccount && !v.linkedAccountNo) add('linkedAccountNo', 'Linked Account is required for MBS profit payout');
  });
}

// ------------------------------------------------------------------ loan
const loanBase = z.object({
  customerId: requiredText('Customer ID'),
  product: requiredText('Loan Product'),
  amount: amountString('Loan Amount'),
  interestRate: z
    .string()
    .trim()
    .min(1, 'Interest Rate is required')
    .refine((v) => AMOUNT_REGEX.test(v), 'Interest Rate must be a number with up to 2 decimals'),
  tenureMonths: z
    .string()
    .trim()
    .min(1, 'Loan Tenure is required')
    .refine((v) => /^\d+$/.test(v), 'Loan Tenure must be a whole number of months'),
  frequency: requiredText('Repayment Frequency'),
  startDate: z.string().min(1, 'Loan Start Date is required').refine(isValidISODate, 'Loan Start Date must be a valid date'),
  purpose: requiredText('Loan Purpose'),
});

export interface LoanFormValues {
  customerId: string;
  product: string;
  amount: string;
  interestRate: string;
  tenureMonths: string;
  frequency: string;
  startDate: string;
  purpose: string;
  collateral: string[];
  insurance: boolean;
  documents: DocMeta[];
}

export function validateLoan(v: LoanFormValues): Errors {
  return validateWith(loanBase, v, (x, add) => {
    const cfg = LOAN_PRODUCTS[x.product as LoanProduct];
    if (isValidISODate(x.startDate)) {
      if (x.startDate < addDays(today(), -365)) add('startDate', 'Loan Start Date cannot be more than 365 days in the past');
      else if (x.startDate > addDays(today(), 90)) add('startDate', 'Loan Start Date cannot be more than 90 days in the future');
    }
    validateDocuments(v.documents, 'documents', add);
    if (!cfg) return;
    if (cfg.requiresCollateral && (!v.collateral || v.collateral.length === 0)) add('collateral', `At least one collateral type is required for ${cfg.name}`);
    if (AMOUNT_REGEX.test(x.amount.trim())) {
      const amt = Number(x.amount);
      if (amt < cfg.minAmount || amt > cfg.maxAmount)
        add('amount', `Loan Amount must be between ${cfg.minAmount.toLocaleString('en-US')} and ${cfg.maxAmount.toLocaleString('en-US')} for ${cfg.name}`);
    }
    if (AMOUNT_REGEX.test(x.interestRate.trim())) {
      const r = Number(x.interestRate);
      if (r < cfg.minRate || r > cfg.maxRate) add('interestRate', `Interest Rate must be between ${cfg.minRate}% and ${cfg.maxRate}% for ${cfg.name}`);
    }
    if (/^\d+$/.test(x.tenureMonths.trim())) {
      const t = Number(x.tenureMonths);
      const step = FREQUENCY_MONTHS[x.frequency as RepaymentFrequency];
      if (t < cfg.minTenure || t > cfg.maxTenure) add('tenureMonths', `Loan Tenure must be between ${cfg.minTenure} and ${cfg.maxTenure} months for ${cfg.name}`);
      else if (step && t % step !== 0) add('tenureMonths', `Loan Tenure must be a multiple of ${step} months for ${x.frequency} repayment`);
    }
  });
}

// ------------------------------------------------------------------ users / password
const userBase = z.object({
  username: z
    .string()
    .trim()
    .min(1, 'Username is required')
    .refine((v) => /^[a-z][a-z0-9._]{3,29}$/.test(v), 'Username must be 4-30 lowercase letters, digits, dots or underscores and start with a letter'),
  fullName: nameField('Full Name'),
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .refine((v) => EMAIL_REGEX.test(v), 'Email must be a valid email address'),
  role: requiredText('Role'),
  branch: requiredText('Branch'),
  password: z.string().min(1, 'Password is required').refine((v) => PASSWORD_RULE.test(v), PASSWORD_MESSAGE),
});

export interface UserFormValues {
  username: string;
  fullName: string;
  email: string;
  role: string;
  branch: string;
  password: string;
}

export function validateUser(v: UserFormValues): Errors {
  return validateWith(userBase, v, (x, add) => {
    if (!x.role || !x.branch) return;
    const globalRole = x.role === 'ADMIN' || x.role === 'AUDITOR';
    if (globalRole && x.branch !== 'ALL') add('branch', 'Admin and Auditor users must be assigned to All Branches');
    if (!globalRole && x.branch === 'ALL') add('branch', 'Branch users must be assigned to a specific branch');
  });
}

const passwordBase = z.object({
  currentPassword: z.string().min(1, 'Current Password is required'),
  newPassword: z.string().min(1, 'New Password is required').refine((v) => PASSWORD_RULE.test(v), PASSWORD_MESSAGE),
  confirmPassword: z.string().min(1, 'Confirm Password is required'),
});

export interface PasswordChangeValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function validatePasswordChange(v: PasswordChangeValues): Errors {
  return validateWith(passwordBase, v, (x, add) => {
    if (x.newPassword && x.currentPassword && x.newPassword === x.currentPassword) add('newPassword', 'New Password must be different from the current password');
    if (x.confirmPassword && x.newPassword !== x.confirmPassword) add('confirmPassword', 'Passwords do not match');
  });
}

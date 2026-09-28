/**
 * Business logic. Every function receives a mutable *draft* of the bank state
 * and the acting user, validates permissions + business rules, mutates the
 * draft and returns a Result. The store commits the draft only when ok === true.
 */
import { can, canAccessBranch, permissionError, type Permission } from '../auth/permissions';
import { DEPOSIT_PRODUCTS, LARGE_WITHDRAWAL_LIMIT, LOAN_PRODUCTS, MAX_FAILED_LOGINS, branchName } from '../data/reference';
import { addMonths, nowISO, today } from '../lib/dates';
import { dpsMaturityAmount, fdrMaturityAmount, monthlySavingsInterest } from '../lib/depositCalc';
import { money, round2 } from '../lib/format';
import { makeAuditId, makeCustomerId, makeDepositNo, makeLoanNo, makeTxnId } from '../lib/ids';
import { FREQUENCY_MONTHS, calculateInstallment, generateSchedule, installmentStatus, numberOfInstallments } from '../lib/loanCalc';
import {
  AMOUNT_REGEX,
  EMAIL_REGEX,
  firstError,
  validateCustomer,
  validateDeposit,
  validateLoan,
  validatePasswordChange,
  validateUser,
  type CustomerFormValues,
  type DepositFormValues,
  type LoanFormValues,
  type PasswordChangeValues,
  type UserFormValues,
} from '../lib/validation';
import type {
  AuditEntity,
  BankState,
  BranchCode,
  BranchScope,
  Customer,
  DepositAccount,
  DepositProduct,
  LoanAccount,
  LoanProduct,
  RepaymentFrequency,
  Result,
  Role,
  Transaction,
  TxnType,
  User,
} from '../types';

// ------------------------------------------------------------------ helpers
const ok = <T>(data: T, message: string): Result<T> => ({ ok: true, data, message });
const fail = (error: string, field?: string): { ok: false; error: string; field?: string } => ({ ok: false, error, field });

function denied(user: User, perm: Permission) {
  return can(user, perm) ? null : fail(permissionError(perm));
}

function outOfScope(user: User, branch: BranchCode, what: string) {
  return canAccessBranch(user, branch) ? null : fail(`Access denied: this ${what} belongs to ${branchName(branch)}. You can only access ${branchName(user.branch)} data.`);
}

export function addAudit(s: BankState, user: User | null, action: string, entityType: AuditEntity, entityId: string, details: string) {
  s.counters.audit++;
  s.auditLogs.push({
    id: makeAuditId(s.counters.audit),
    timestamp: nowISO(),
    username: user?.username ?? 'SYSTEM',
    role: user?.role ?? 'SYSTEM',
    branch: user?.branch ?? 'ALL',
    action,
    entityType,
    entityId,
    details,
  });
}

interface TxnInput {
  accountNo: string;
  accountKind: 'DEPOSIT' | 'LOAN';
  customerId: string;
  branch: BranchCode;
  type: TxnType;
  description: string;
  debit?: number;
  credit?: number;
  balanceAfter: number;
  status?: Transaction['status'];
  date?: string;
  reversalOf?: string;
}

function postTxn(s: BankState, user: User, t: TxnInput): Transaction {
  s.counters.txn++;
  const date = t.date ?? today();
  const txn: Transaction = {
    txnId: makeTxnId(date, s.counters.txn),
    seq: s.counters.txn,
    date,
    timestamp: nowISO(),
    accountNo: t.accountNo,
    accountKind: t.accountKind,
    customerId: t.customerId,
    branch: t.branch,
    type: t.type,
    description: t.description,
    debit: round2(t.debit ?? 0),
    credit: round2(t.credit ?? 0),
    balanceAfter: round2(t.balanceAfter),
    status: t.status ?? 'Posted',
    reversalOf: t.reversalOf,
    createdBy: user.username,
  };
  s.transactions.push(txn);
  return txn;
}

function trimAll<T extends object>(values: T): T {
  const out = { ...values } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (typeof out[k] === 'string') out[k] = (out[k] as string).trim();
  return out as T;
}

function parseAmount(v: string | number, label = 'Amount') {
  const str = String(v ?? '').trim();
  if (!str) return fail(`${label} is required`, 'amount');
  if (!AMOUNT_REGEX.test(str)) return fail(`${label} must be a valid amount (up to 2 decimals)`, 'amount');
  const n = Number(str);
  if (n <= 0) return fail(`${label} must be greater than zero`, 'amount');
  if (n > 10000000) return fail(`${label} cannot exceed 10,000,000 per transaction`, 'amount');
  return n;
}

// ------------------------------------------------------------------ auth
export function login(s: BankState, username: string, password: string): Result<User> {
  const u = username.trim().toLowerCase();
  if (!u) return fail('Username is required', 'username');
  if (!password) return fail('Password is required', 'password');
  const user = s.users.find((x) => x.username === u);
  if (!user) return fail('Invalid username or password');
  if (user.status === 'Locked') return fail('Your account is locked. Please contact the administrator.');
  if (user.password !== password) {
    user.failedAttempts++;
    if (user.failedAttempts >= MAX_FAILED_LOGINS) {
      user.status = 'Locked';
      addAudit(s, null, 'USER_LOCKED', 'Auth', user.username, `Locked after ${MAX_FAILED_LOGINS} failed login attempts`);
      return fail(`Invalid username or password. Your account has been locked after ${MAX_FAILED_LOGINS} failed attempts.`);
    }
    addAudit(s, null, 'LOGIN_FAILED', 'Auth', user.username, `Failed login attempt ${user.failedAttempts}`);
    return fail(`Invalid username or password. ${MAX_FAILED_LOGINS - user.failedAttempts} attempt(s) remaining.`);
  }
  user.failedAttempts = 0;
  user.lastLogin = nowISO();
  addAudit(s, user, 'LOGIN', 'Auth', user.username, 'User logged in');
  return ok(user, `Welcome, ${user.fullName}`);
}

export function logout(s: BankState, user: User): Result {
  addAudit(s, user, 'LOGOUT', 'Auth', user.username, 'User logged out');
  return ok(undefined, 'You have been logged out');
}

export function changePassword(s: BankState, user: User, values: PasswordChangeValues): Result {
  const err = firstError(validatePasswordChange(values));
  if (err) return fail(err.error, err.field);
  const u = s.users.find((x) => x.username === user.username)!;
  if (u.password !== values.currentPassword) return fail('Current Password is incorrect', 'currentPassword');
  u.password = values.newPassword;
  addAudit(s, user, 'PASSWORD_CHANGED', 'User', user.username, 'Password changed');
  return ok(undefined, 'Password changed successfully');
}

// ------------------------------------------------------------------ users
export function createUser(s: BankState, actor: User, values: UserFormValues): Result<User> {
  const d = denied(actor, 'user.manage');
  if (d) return d;
  const v = trimAll(values);
  const err = firstError(validateUser(v));
  if (err) return fail(err.error, err.field);
  if (s.users.some((x) => x.username === v.username)) return fail(`Username "${v.username}" is already taken`, 'username');
  const role = v.role as Role;
  const globalRole = role === 'ADMIN' || role === 'AUDITOR';
  if (globalRole && v.branch !== 'ALL') return fail('Admin and Auditor users must be assigned to All Branches', 'branch');
  if (!globalRole && v.branch === 'ALL') return fail('Branch users must be assigned to a specific branch', 'branch');
  const user: User = {
    username: v.username,
    password: v.password,
    fullName: v.fullName,
    email: v.email,
    role,
    branch: v.branch as BranchScope,
    status: 'Active',
    failedAttempts: 0,
    createdAt: nowISO(),
  };
  s.users.push(user);
  addAudit(s, actor, 'USER_CREATED', 'User', user.username, `Role ${role}, branch ${user.branch}`);
  return ok(user, `User ${user.username} created successfully`);
}

export function setUserStatus(s: BankState, actor: User, username: string, status: 'Active' | 'Locked'): Result<User> {
  const d = denied(actor, 'user.manage');
  if (d) return d;
  const user = s.users.find((x) => x.username === username);
  if (!user) return fail('User not found');
  if (user.username === actor.username) return fail('You cannot lock or unlock your own account');
  if (user.status === status) return fail(`User is already ${status}`);
  user.status = status;
  if (status === 'Active') user.failedAttempts = 0;
  addAudit(s, actor, status === 'Locked' ? 'USER_LOCKED' : 'USER_UNLOCKED', 'User', username, `Status set to ${status}`);
  return ok(user, `User ${username} ${status === 'Locked' ? 'locked' : 'unlocked'} successfully`);
}

// ------------------------------------------------------------------ customers
export function findDuplicateCustomer(s: BankState, nid: string, mobile: string, excludeId?: string) {
  const others = s.customers.filter((c) => c.customerId !== excludeId);
  return {
    byNid: nid ? others.find((c) => c.nid === nid.trim()) : undefined,
    byMobile: mobile ? others.find((c) => c.mobile === mobile.trim()) : undefined,
  };
}

export function createCustomer(s: BankState, user: User, values: CustomerFormValues): Result<Customer> {
  const d = denied(user, 'customer.create');
  if (d) return d;
  const v = trimAll(values);
  const err = firstError(validateCustomer(v));
  if (err) return fail(err.error, err.field);
  const branch = v.branch as BranchCode;
  if (!canAccessBranch(user, branch)) return fail(`You can only create customers for ${branchName(user.branch)}`, 'branch');
  const dup = findDuplicateCustomer(s, v.nid, v.mobile);
  if (dup.byNid) return fail(`Duplicate customer: a customer with this NID already exists (${dup.byNid.customerId})`, 'nid');
  if (dup.byMobile) return fail(`Duplicate customer: this mobile number is already registered (${dup.byMobile.customerId})`, 'mobile');
  s.counters.customer[branch]++;
  const customer: Customer = {
    customerId: makeCustomerId(branch, s.counters.customer[branch]),
    customerType: v.customerType as Customer['customerType'],
    fullName: v.fullName,
    fatherName: v.fatherName,
    motherName: v.motherName,
    dob: v.dob,
    gender: v.gender as Customer['gender'],
    mobile: v.mobile,
    email: v.email.toLowerCase(),
    nid: v.nid,
    presentAddress: v.presentAddress,
    division: v.division,
    district: v.district,
    permanentAddress: v.permanentAddress,
    occupation: v.occupation,
    monthlyIncome: Number(v.monthlyIncome),
    smsAlerts: !!v.smsAlerts,
    eStatement: !!v.eStatement,
    documents: v.documents ?? [],
    businessName: v.customerType === 'Business' ? v.businessName : undefined,
    tradeLicense: v.customerType === 'Business' ? v.tradeLicense : undefined,
    branch,
    status: v.status as Customer['status'],
    kycStatus: 'Pending',
    createdAt: nowISO(),
    createdBy: user.username,
  };
  s.customers.unshift(customer);
  addAudit(s, user, 'CUSTOMER_CREATED', 'Customer', customer.customerId, `Customer ${customer.fullName} created`);
  return ok(customer, `Customer ${customer.customerId} created successfully`);
}

export function updateCustomer(s: BankState, user: User, customerId: string, values: CustomerFormValues): Result<Customer> {
  const d = denied(user, 'customer.edit');
  if (d) return d;
  const c = s.customers.find((x) => x.customerId === customerId);
  if (!c) return fail('Customer not found');
  const sc = outOfScope(user, c.branch, 'customer');
  if (sc) return sc;
  const v = trimAll({ ...values, branch: c.branch, status: c.status });
  const err = firstError(validateCustomer(v));
  if (err) return fail(err.error, err.field);
  const dup = findDuplicateCustomer(s, v.nid, v.mobile, customerId);
  if (dup.byNid) return fail(`Duplicate customer: a customer with this NID already exists (${dup.byNid.customerId})`, 'nid');
  if (dup.byMobile) return fail(`Duplicate customer: this mobile number is already registered (${dup.byMobile.customerId})`, 'mobile');
  const nidChanged = v.nid !== c.nid;
  const nameChanged = v.fullName !== c.fullName;
  Object.assign(c, {
    customerType: v.customerType,
    fullName: v.fullName,
    fatherName: v.fatherName,
    motherName: v.motherName,
    dob: v.dob,
    gender: v.gender,
    mobile: v.mobile,
    email: v.email.toLowerCase(),
    nid: v.nid,
    presentAddress: v.presentAddress,
    division: v.division,
    district: v.district,
    permanentAddress: v.permanentAddress,
    occupation: v.occupation,
    monthlyIncome: Number(v.monthlyIncome),
    smsAlerts: !!v.smsAlerts,
    eStatement: !!v.eStatement,
    documents: v.documents ?? [],
    businessName: v.customerType === 'Business' ? v.businessName : undefined,
    tradeLicense: v.customerType === 'Business' ? v.tradeLicense : undefined,
    updatedAt: nowISO(),
    updatedBy: user.username,
  });
  let msg = `Customer ${customerId} updated successfully`;
  if (nidChanged && c.kycStatus === 'Verified') {
    c.kycStatus = 'Pending';
    c.kycVerifiedBy = undefined;
    msg += '. KYC reset to Pending because the NID changed';
  }
  if (nameChanged) {
    s.deposits.filter((a) => a.customerId === customerId).forEach((a) => (a.customerName = c.fullName));
    s.loans.filter((l) => l.customerId === customerId).forEach((l) => (l.customerName = c.fullName));
  }
  addAudit(s, user, 'CUSTOMER_UPDATED', 'Customer', customerId, nidChanged ? 'Customer updated (NID changed)' : 'Customer updated');
  return ok(c, msg);
}

export function setCustomerStatus(s: BankState, user: User, customerId: string, status: 'Active' | 'Inactive'): Result<Customer> {
  const d = denied(user, 'customer.status');
  if (d) return d;
  const c = s.customers.find((x) => x.customerId === customerId);
  if (!c) return fail('Customer not found');
  const sc = outOfScope(user, c.branch, 'customer');
  if (sc) return sc;
  if (c.status === status) return fail(`Customer is already ${status}`);
  if (status === 'Inactive') {
    const openLoan = s.loans.find((l) => l.customerId === customerId && ['Applied', 'Approved', 'Active'].includes(l.status));
    if (openLoan) return fail(`Cannot deactivate customer: loan account ${openLoan.loanAccountNo} is ${openLoan.status}`);
  }
  c.status = status;
  c.updatedAt = nowISO();
  c.updatedBy = user.username;
  addAudit(s, user, status === 'Active' ? 'CUSTOMER_ACTIVATED' : 'CUSTOMER_DEACTIVATED', 'Customer', customerId, `Status set to ${status}`);
  return ok(c, `Customer ${customerId} ${status === 'Active' ? 'activated' : 'deactivated'} successfully`);
}

export function decideKyc(s: BankState, user: User, customerId: string, decision: 'Verified' | 'Rejected', remarks = ''): Result<Customer> {
  const d = denied(user, 'kyc.verify');
  if (d) return d;
  const c = s.customers.find((x) => x.customerId === customerId);
  if (!c) return fail('Customer not found');
  const sc = outOfScope(user, c.branch, 'customer');
  if (sc) return sc;
  if (c.kycStatus === 'Verified') return fail('KYC is already Verified');
  if (c.createdBy === user.username) return fail('Maker-checker violation: you created this customer and cannot verify their KYC');
  if (decision === 'Rejected' && remarks.trim().length < 5) return fail('Remarks are required when rejecting (min 5 characters)', 'remarks');
  c.kycStatus = decision;
  c.kycRemarks = remarks.trim() || undefined;
  c.kycVerifiedBy = decision === 'Verified' ? user.username : undefined;
  addAudit(s, user, decision === 'Verified' ? 'KYC_VERIFIED' : 'KYC_REJECTED', 'Customer', customerId, remarks || `KYC ${decision}`);
  return ok(c, `KYC for ${customerId} ${decision === 'Verified' ? 'verified' : 'rejected'} successfully`);
}

// ------------------------------------------------------------------ deposits
function depositTerms(product: DepositProduct, amount: number, openingDate: string, tenure?: number) {
  const cfg = DEPOSIT_PRODUCTS[product];
  const rate = cfg.rateFor(tenure);
  if (!cfg.term || !tenure) return { rate };
  const maturityDate = addMonths(openingDate, tenure);
  const maturityAmount =
    product === 'FDR' ? fdrMaturityAmount(amount, rate, tenure) : product === 'DPS' ? dpsMaturityAmount(amount, rate, tenure) : amount;
  return { rate, maturityDate, maturityAmount };
}

export function previewDepositTerms(product: string, amount: string, openingDate: string, tenure: string) {
  const cfg = DEPOSIT_PRODUCTS[product as DepositProduct];
  if (!cfg) return null;
  const amt = AMOUNT_REGEX.test(amount) ? Number(amount) : 0;
  const t = tenure ? Number(tenure) : undefined;
  return depositTerms(cfg.code, amt, openingDate || today(), t);
}

export function createDeposit(s: BankState, user: User, values: DepositFormValues): Result<DepositAccount> {
  const d = denied(user, 'deposit.create');
  if (d) return d;
  const v = trimAll(values);
  const err = firstError(validateDeposit(v));
  if (err) return fail(err.error, err.field);
  const cust = s.customers.find((c) => c.customerId === v.customerId.toUpperCase());
  if (!cust) return fail(`Customer ID ${v.customerId} not found`, 'customerId');
  if (!canAccessBranch(user, cust.branch)) return fail(`Customer ${cust.customerId} belongs to ${branchName(cust.branch)}. You can only open accounts for ${branchName(user.branch)}.`, 'customerId');
  if (cust.status !== 'Active') return fail(`Cannot open an account for an inactive customer (${cust.customerId})`, 'customerId');
  if (cust.kycStatus === 'Rejected') return fail(`Cannot open an account: KYC of ${cust.customerId} is Rejected`, 'customerId');
  const product = v.product as DepositProduct;
  const cfg = DEPOSIT_PRODUCTS[product];
  if (product === 'SAVINGS') {
    const existing = s.deposits.find((a) => a.customerId === cust.customerId && a.product === 'SAVINGS' && !['Closed', 'Rejected'].includes(a.status));
    if (existing) return fail(`Customer already has a Savings Account (${existing.accountNo}). Only one Savings Account is allowed per customer.`, 'product');
  }
  let linkedAccountNo: string | undefined;
  if (cfg.requiresLinkedAccount) {
    const linked = s.deposits.find((a) => a.accountNo === v.linkedAccountNo);
    if (!linked || linked.customerId !== cust.customerId || !['SAVINGS', 'CURRENT'].includes(linked.product) || linked.status !== 'Active')
      return fail('Linked Account must be an Active Savings or Current account of the same customer', 'linkedAccountNo');
    linkedAccountNo = linked.accountNo;
  }
  const amount = Number(v.amount);
  const tenure = cfg.term ? Number(v.tenureMonths) : undefined;
  const terms = depositTerms(product, amount, v.openingDate, tenure);
  s.counters.deposit[cust.branch]++;
  const acct: DepositAccount = {
    accountNo: makeDepositNo(cust.branch, cfg.shortCode, s.counters.deposit[cust.branch]),
    customerId: cust.customerId,
    customerName: cust.fullName,
    product,
    openingDate: v.openingDate,
    initialDeposit: amount,
    interestRate: terms.rate,
    tenureMonths: tenure,
    maturityDate: terms.maturityDate,
    maturityAmount: terms.maturityAmount,
    nomineeName: cfg.requiresNominee ? v.nomineeName : undefined,
    nomineeRelation: cfg.requiresNominee ? v.nomineeRelation : undefined,
    nomineeShare: cfg.requiresNominee ? Number(v.nomineeShare) : undefined,
    linkedAccountNo,
    notes: [],
    balance: 0,
    branch: cust.branch,
    status: 'Pending Approval',
    createdAt: nowISO(),
    createdBy: user.username,
  };
  s.deposits.unshift(acct);
  addAudit(s, user, 'DEPOSIT_ACCOUNT_CREATED', 'Deposit', acct.accountNo, `${cfg.name} for ${cust.customerId}, amount ${money(amount)}`);
  return ok(acct, `Deposit account ${acct.accountNo} created successfully and sent for approval`);
}

function findDeposit(s: BankState, user: User, accountNo: string) {
  const a = s.deposits.find((x) => x.accountNo === accountNo.trim().toUpperCase());
  if (!a) return fail(`Deposit account ${accountNo} not found`, 'accountNo');
  const sc = outOfScope(user, a.branch, 'account');
  if (sc) return { ...sc, field: 'accountNo' };
  return a;
}

export function approveDeposit(s: BankState, user: User, accountNo: string): Result<DepositAccount> {
  const d = denied(user, 'deposit.approve');
  if (d) return d;
  const a = findDeposit(s, user, accountNo);
  if ('ok' in a) return a;
  if (a.status !== 'Pending Approval') return fail(`Only accounts in Pending Approval status can be approved (current: ${a.status})`);
  if (a.createdBy === user.username) return fail('Maker-checker violation: you created this account and cannot approve it');
  const cust = s.customers.find((c) => c.customerId === a.customerId)!;
  if (cust.kycStatus !== 'Verified') return fail(`Customer KYC must be Verified before account activation (current: ${cust.kycStatus})`);
  if (cust.status !== 'Active') return fail('Customer is inactive. Activate the customer first.');
  a.status = 'Active';
  a.approvedBy = user.username;
  a.approvedAt = nowISO();
  a.balance = a.initialDeposit;
  postTxn(s, user, {
    accountNo: a.accountNo,
    accountKind: 'DEPOSIT',
    customerId: a.customerId,
    branch: a.branch,
    type: 'Opening Deposit',
    description: a.product === 'DPS' ? 'DPS installment #1 (opening)' : 'Account opening deposit (cash)',
    credit: a.initialDeposit,
    balanceAfter: a.balance,
    date: a.openingDate,
  });
  addAudit(s, user, 'DEPOSIT_ACCOUNT_APPROVED', 'Deposit', a.accountNo, `Activated with opening deposit ${money(a.initialDeposit)}`);
  return ok(a, `Deposit account ${a.accountNo} approved and activated`);
}

export function rejectDeposit(s: BankState, user: User, accountNo: string, remarks: string): Result<DepositAccount> {
  const d = denied(user, 'deposit.approve');
  if (d) return d;
  const a = findDeposit(s, user, accountNo);
  if ('ok' in a) return a;
  if (a.status !== 'Pending Approval') return fail(`Only accounts in Pending Approval status can be rejected (current: ${a.status})`);
  if (a.createdBy === user.username) return fail('Maker-checker violation: you created this account and cannot reject it');
  if (remarks.trim().length < 5) return fail('Remarks are required when rejecting (min 5 characters)', 'remarks');
  a.status = 'Rejected';
  a.remarks = remarks.trim();
  addAudit(s, user, 'DEPOSIT_ACCOUNT_REJECTED', 'Deposit', a.accountNo, remarks);
  return ok(a, `Deposit account ${a.accountNo} rejected`);
}

export function setDepositFreeze(s: BankState, user: User, accountNo: string, freeze: boolean, reason = ''): Result<DepositAccount> {
  const d = denied(user, 'deposit.freeze');
  if (d) return d;
  const a = findDeposit(s, user, accountNo);
  if ('ok' in a) return a;
  if (freeze) {
    if (a.status !== 'Active') return fail(`Only Active accounts can be frozen (current: ${a.status})`);
    if (reason.trim().length < 5) return fail('Freeze reason is required (min 5 characters)', 'remarks');
    a.status = 'Frozen';
    a.freezeReason = reason.trim();
  } else {
    if (a.status !== 'Frozen') return fail('Account is not frozen');
    a.status = 'Active';
    a.freezeReason = undefined;
  }
  addAudit(s, user, freeze ? 'ACCOUNT_FROZEN' : 'ACCOUNT_UNFROZEN', 'Deposit', a.accountNo, reason || 'Unfrozen');
  return ok(a, `Account ${a.accountNo} ${freeze ? 'frozen' : 'unfrozen'} successfully`);
}

export function closeDeposit(s: BankState, user: User, accountNo: string): Result<DepositAccount> {
  const d = denied(user, 'deposit.close');
  if (d) return d;
  const a = findDeposit(s, user, accountNo);
  if ('ok' in a) return a;
  if (a.status === 'Frozen') return fail('A frozen account cannot be closed. Unfreeze it first.');
  if (DEPOSIT_PRODUCTS[a.product].term && a.status === 'Active') return fail('A term deposit cannot be closed before maturity. Process maturity first.');
  if (!['Active', 'Matured'].includes(a.status)) return fail(`Account cannot be closed in ${a.status} status`);
  if (a.balance !== 0) return fail(`Account balance must be zero before closing. Current balance: ${money(a.balance)}`);
  const dependant = s.deposits.find((x) => x.linkedAccountNo === a.accountNo && x.status === 'Active');
  if (dependant) return fail(`Account is linked to active ${dependant.accountNo} for profit payout and cannot be closed`);
  a.status = 'Closed';
  a.closedAt = nowISO();
  addAudit(s, user, 'DEPOSIT_ACCOUNT_CLOSED', 'Deposit', a.accountNo, 'Account closed');
  return ok(a, `Account ${a.accountNo} closed successfully`);
}

export function postSavingsInterest(s: BankState, user: User, accountNo: string): Result<Transaction> {
  const d = denied(user, 'deposit.interest');
  if (d) return d;
  const a = findDeposit(s, user, accountNo);
  if ('ok' in a) return a;
  if (a.product !== 'SAVINGS') return fail('Monthly interest posting is only available for Savings accounts');
  if (!['Active', 'Frozen'].includes(a.status)) return fail(`Interest cannot be posted on a ${a.status} account`);
  const month = today().slice(0, 7);
  if (s.transactions.some((t) => t.accountNo === a.accountNo && t.type === 'Interest Credit' && t.description.startsWith('Monthly interest') && t.date.startsWith(month)))
    return fail('Interest has already been posted for this month');
  const interest = monthlySavingsInterest(a.balance, a.interestRate);
  if (interest <= 0) return fail('No interest is payable on the current balance');
  a.balance = round2(a.balance + interest);
  const txn = postTxn(s, user, {
    accountNo: a.accountNo,
    accountKind: 'DEPOSIT',
    customerId: a.customerId,
    branch: a.branch,
    type: 'Interest Credit',
    description: `Monthly interest credit @${a.interestRate.toFixed(2)}%`,
    credit: interest,
    balanceAfter: a.balance,
  });
  addAudit(s, user, 'INTEREST_POSTED', 'Deposit', a.accountNo, `Interest ${money(interest)} (${txn.txnId})`);
  return ok(txn, `Interest of ${money(interest)} posted to ${a.accountNo} (${txn.txnId})`);
}

export function processMaturity(s: BankState, user: User, accountNo: string, mode: 'LINKED' | 'RENEW' | 'CASH', targetAccountNo = ''): Result<DepositAccount> {
  const d = denied(user, 'deposit.maturity');
  if (d) return d;
  const a = findDeposit(s, user, accountNo);
  if ('ok' in a) return a;
  if (!DEPOSIT_PRODUCTS[a.product].term) return fail('Maturity processing applies only to FDR, DPS and MBS accounts');
  if (a.status !== 'Active') return fail(`Maturity can only be processed for Active accounts (current: ${a.status})`);
  if (!a.maturityDate || a.maturityDate > today()) return fail(`Account has not matured yet. Maturity date: ${a.maturityDate}`);
  if (mode === 'RENEW' && a.product !== 'FDR') return fail('Only FDR accounts can be renewed');
  let target: DepositAccount | undefined;
  if (mode === 'LINKED') {
    target = s.deposits.find((x) => x.accountNo === targetAccountNo.trim().toUpperCase());
    if (!target || target.customerId !== a.customerId || !['SAVINGS', 'CURRENT'].includes(target.product) || target.status !== 'Active')
      return fail('Payout account must be an Active Savings or Current account of the same customer', 'targetAccountNo');
  }
  // 1. credit maturity interest
  let interest = 0;
  if (a.product === 'FDR') interest = round2((a.maturityAmount ?? a.balance) - a.balance);
  if (a.product === 'DPS' && a.tenureMonths) {
    const full = a.initialDeposit * a.tenureMonths;
    const fullInterest = (a.maturityAmount ?? full) - full;
    interest = round2(Math.max(0, fullInterest * (a.balance / full)));
  }
  if (interest > 0) {
    a.balance = round2(a.balance + interest);
    postTxn(s, user, {
      accountNo: a.accountNo,
      accountKind: 'DEPOSIT',
      customerId: a.customerId,
      branch: a.branch,
      type: 'Interest Credit',
      description: `Maturity interest @${a.interestRate.toFixed(2)}%`,
      credit: interest,
      balanceAfter: a.balance,
    });
  }
  // 2. renew or pay out
  if (mode === 'RENEW') {
    const tenure = a.tenureMonths ?? 12;
    a.initialDeposit = a.balance;
    a.openingDate = today();
    a.maturityDate = addMonths(a.openingDate, tenure);
    a.maturityAmount = fdrMaturityAmount(a.balance, a.interestRate, tenure);
    addAudit(s, user, 'DEPOSIT_RENEWED', 'Deposit', a.accountNo, `Renewed for ${tenure} months with principal ${money(a.balance)}`);
    return ok(a, `FDR ${a.accountNo} renewed with principal ${money(a.balance)} until ${a.maturityDate}`);
  }
  const payout = a.balance;
  a.balance = 0;
  a.status = 'Matured';
  postTxn(s, user, {
    accountNo: a.accountNo,
    accountKind: 'DEPOSIT',
    customerId: a.customerId,
    branch: a.branch,
    type: 'Maturity Payout',
    description: target ? `Maturity proceeds transferred to ${target.accountNo}` : 'Maturity proceeds paid in cash',
    debit: payout,
    balanceAfter: 0,
  });
  if (target) {
    target.balance = round2(target.balance + payout);
    postTxn(s, user, {
      accountNo: target.accountNo,
      accountKind: 'DEPOSIT',
      customerId: target.customerId,
      branch: target.branch,
      type: 'Transfer In',
      description: `Maturity proceeds from ${a.accountNo}`,
      credit: payout,
      balanceAfter: target.balance,
    });
  }
  addAudit(s, user, 'DEPOSIT_MATURED', 'Deposit', a.accountNo, `Payout ${money(payout)} via ${mode}`);
  return ok(a, `Maturity processed for ${a.accountNo}. Payout ${money(payout)}${target ? ` credited to ${target.accountNo}` : ' paid in cash'}`);
}

// ------------------------------------------------------------------ loans
export function previewLoan(product: string, amount: string, rate: string, tenure: string, frequency: string, startDate: string) {
  const amt = AMOUNT_REGEX.test(amount) ? Number(amount) : 0;
  const r = Number(rate) || 0;
  const t = /^\d+$/.test(tenure) ? Number(tenure) : 0;
  const f = (frequency || 'Monthly') as RepaymentFrequency;
  if (!LOAN_PRODUCTS[product as LoanProduct] || !amt || !t) return null;
  const n = numberOfInstallments(t, f);
  if (n < 1) return null;
  const installment = calculateInstallment(amt, r, t, f);
  const maturityDate = startDate ? addMonths(startDate, n * FREQUENCY_MONTHS[f]) : '';
  return { installment, numberOfInstallments: n, maturityDate, totalRepayment: round2(installment * n) };
}

export function createLoan(s: BankState, user: User, values: LoanFormValues): Result<LoanAccount> {
  const d = denied(user, 'loan.create');
  if (d) return d;
  const v = trimAll(values);
  const err = firstError(validateLoan(v));
  if (err) return fail(err.error, err.field);
  const cust = s.customers.find((c) => c.customerId === v.customerId.toUpperCase());
  if (!cust) return fail(`Customer ID ${v.customerId} not found`, 'customerId');
  if (!canAccessBranch(user, cust.branch)) return fail(`Customer ${cust.customerId} belongs to ${branchName(cust.branch)}. You can only create loans for ${branchName(user.branch)}.`, 'customerId');
  if (cust.status !== 'Active') return fail(`Cannot create a loan for an inactive customer (${cust.customerId})`, 'customerId');
  if (cust.kycStatus === 'Rejected') return fail(`Cannot create a loan: KYC of ${cust.customerId} is Rejected`, 'customerId');
  const product = v.product as LoanProduct;
  const cfg = LOAN_PRODUCTS[product];
  if (cfg.businessOnly && cust.customerType !== 'Business') return fail(`${cfg.name} is available for Business customers only`, 'product');
  const open = s.loans.filter((l) => l.customerId === cust.customerId && ['Applied', 'Approved', 'Active'].includes(l.status));
  if (open.length >= 2) return fail(`Customer already has ${open.length} open loans (${open.map((l) => l.loanAccountNo).join(', ')}). Maximum 2 allowed.`, 'customerId');
  const amount = Number(v.amount);
  const rate = Number(v.interestRate);
  const tenure = Number(v.tenureMonths);
  const freq = v.frequency as RepaymentFrequency;
  const installment = calculateInstallment(amount, rate, tenure, freq);
  if (cfg.dbrCheck) {
    const monthlyEq = round2(installment / FREQUENCY_MONTHS[freq]);
    const limit = round2(cust.monthlyIncome * 0.5);
    if (monthlyEq > limit)
      return fail(`Debt burden check failed: monthly installment ${money(monthlyEq)} exceeds 50% of the customer's monthly income (limit ${money(limit)})`, 'amount');
  }
  const n = numberOfInstallments(tenure, freq);
  s.counters.loan[cust.branch]++;
  const loan: LoanAccount = {
    loanAccountNo: makeLoanNo(cust.branch, cfg.shortCode, s.counters.loan[cust.branch]),
    customerId: cust.customerId,
    customerName: cust.fullName,
    product,
    amount,
    interestRate: rate,
    tenureMonths: tenure,
    startDate: v.startDate,
    frequency: freq,
    numberOfInstallments: n,
    installmentAmount: installment,
    maturityDate: addMonths(v.startDate, n * FREQUENCY_MONTHS[freq]),
    purpose: v.purpose,
    collateral: v.collateral ?? [],
    insurance: !!v.insurance,
    documents: v.documents ?? [],
    branch: cust.branch,
    status: 'Applied',
    outstandingPrincipal: 0,
    schedule: [],
    createdAt: nowISO(),
    createdBy: user.username,
  };
  s.loans.unshift(loan);
  addAudit(s, user, 'LOAN_CREATED', 'Loan', loan.loanAccountNo, `${cfg.name} ${money(amount)} for ${cust.customerId}`);
  return ok(loan, `Loan account ${loan.loanAccountNo} created successfully and sent for approval`);
}

function findLoan(s: BankState, user: User, loanNo: string) {
  const l = s.loans.find((x) => x.loanAccountNo === loanNo.trim().toUpperCase());
  if (!l) return fail(`Loan account ${loanNo} not found`, 'accountNo');
  const sc = outOfScope(user, l.branch, 'loan account');
  if (sc) return { ...sc, field: 'accountNo' };
  return l;
}

export function approveLoan(s: BankState, user: User, loanNo: string): Result<LoanAccount> {
  const d = denied(user, 'loan.approve');
  if (d) return d;
  const l = findLoan(s, user, loanNo);
  if ('ok' in l) return l;
  if (l.status !== 'Applied') return fail(`Only loans in Applied status can be approved (current: ${l.status})`);
  if (l.createdBy === user.username) return fail('Maker-checker violation: you created this loan and cannot approve it');
  const cust = s.customers.find((c) => c.customerId === l.customerId)!;
  if (cust.kycStatus !== 'Verified') return fail(`Customer KYC must be Verified before loan approval (current: ${cust.kycStatus})`);
  if (cust.status !== 'Active') return fail('Customer is inactive');
  l.status = 'Approved';
  l.approvedBy = user.username;
  l.approvedAt = nowISO();
  addAudit(s, user, 'LOAN_APPROVED', 'Loan', l.loanAccountNo, 'Loan approved');
  return ok(l, `Loan ${l.loanAccountNo} approved successfully`);
}

export function rejectLoan(s: BankState, user: User, loanNo: string, remarks: string): Result<LoanAccount> {
  const d = denied(user, 'loan.approve');
  if (d) return d;
  const l = findLoan(s, user, loanNo);
  if ('ok' in l) return l;
  if (!['Applied', 'Approved'].includes(l.status)) return fail(`Only Applied or Approved loans can be rejected (current: ${l.status})`);
  if (l.createdBy === user.username) return fail('Maker-checker violation: you created this loan and cannot reject it');
  if (remarks.trim().length < 5) return fail('Remarks are required when rejecting (min 5 characters)', 'remarks');
  l.status = 'Rejected';
  l.remarks = remarks.trim();
  l.schedule = [];
  addAudit(s, user, 'LOAN_REJECTED', 'Loan', l.loanAccountNo, remarks);
  return ok(l, `Loan ${l.loanAccountNo} rejected`);
}

export function generateLoanSchedule(s: BankState, user: User, loanNo: string): Result<LoanAccount> {
  const d = denied(user, 'schedule.generate');
  if (d) return d;
  const l = findLoan(s, user, loanNo);
  if ('ok' in l) return l;
  if (['Rejected', 'Closed', 'Written Off'].includes(l.status)) return fail(`Cannot generate a schedule for a ${l.status} loan`);
  if (l.schedule.length > 0) return fail('Repayment schedule has already been generated for this loan');
  l.schedule = generateSchedule(l.amount, l.interestRate, l.tenureMonths, l.frequency, l.startDate);
  addAudit(s, user, 'SCHEDULE_GENERATED', 'Loan', l.loanAccountNo, `${l.schedule.length} installments`);
  return ok(l, `Repayment schedule generated for ${l.loanAccountNo} (${l.schedule.length} installments)`);
}

export function disburseLoan(s: BankState, user: User, loanNo: string): Result<LoanAccount> {
  const d = denied(user, 'loan.disburse');
  if (d) return d;
  const l = findLoan(s, user, loanNo);
  if ('ok' in l) return l;
  if (l.status !== 'Approved') return fail(`Only Approved loans can be disbursed (current: ${l.status})`);
  if (l.schedule.length === 0) l.schedule = generateSchedule(l.amount, l.interestRate, l.tenureMonths, l.frequency, l.startDate);
  l.status = 'Active';
  l.disbursedAt = nowISO();
  l.outstandingPrincipal = l.amount;
  const txn = postTxn(s, user, {
    accountNo: l.loanAccountNo,
    accountKind: 'LOAN',
    customerId: l.customerId,
    branch: l.branch,
    type: 'Loan Disbursement',
    description: `${LOAN_PRODUCTS[l.product].name} disbursement`,
    debit: l.amount,
    balanceAfter: l.amount,
  });
  addAudit(s, user, 'LOAN_DISBURSED', 'Loan', l.loanAccountNo, `Disbursed ${money(l.amount)} (${txn.txnId})`);
  return ok(l, `Loan ${l.loanAccountNo} disbursed. Amount ${money(l.amount)} (${txn.txnId})`);
}

export function payInstallment(s: BankState, user: User, loanNo: string, installmentNo: number): Result<Transaction> {
  const d = denied(user, 'schedule.pay');
  if (d) return d;
  const l = findLoan(s, user, loanNo);
  if ('ok' in l) return l;
  if (l.status !== 'Active') return fail(`Installments can only be paid on Active loans (current: ${l.status})`);
  const inst = l.schedule.find((i) => i.installmentNo === installmentNo);
  if (!inst) return fail(`Installment #${installmentNo} not found`);
  if (inst.paid) return fail(`Installment #${installmentNo} is already paid`);
  const firstUnpaid = l.schedule.find((i) => !i.paid)!;
  if (firstUnpaid.installmentNo !== installmentNo)
    return fail(`Installment #${firstUnpaid.installmentNo} must be paid first. Installments must be paid in order.`);
  const afterInterest = round2(l.outstandingPrincipal + inst.interest);
  postTxn(s, user, {
    accountNo: l.loanAccountNo,
    accountKind: 'LOAN',
    customerId: l.customerId,
    branch: l.branch,
    type: 'Interest Charge',
    description: `Interest for installment #${inst.installmentNo}`,
    debit: inst.interest,
    balanceAfter: afterInterest,
  });
  l.outstandingPrincipal = round2(afterInterest - inst.installmentAmount);
  const txn = postTxn(s, user, {
    accountNo: l.loanAccountNo,
    accountKind: 'LOAN',
    customerId: l.customerId,
    branch: l.branch,
    type: 'Installment Payment',
    description: `Installment #${inst.installmentNo} payment`,
    credit: inst.installmentAmount,
    balanceAfter: l.outstandingPrincipal,
  });
  inst.paid = true;
  inst.paidDate = today();
  inst.paymentTxnId = txn.txnId;
  let msg = `Installment #${installmentNo} of ${money(inst.installmentAmount)} paid for ${l.loanAccountNo} (${txn.txnId}). Outstanding: ${money(l.outstandingPrincipal)}`;
  if (l.schedule.every((i) => i.paid)) {
    l.status = 'Closed';
    l.closedAt = nowISO();
    l.outstandingPrincipal = 0;
    msg += '. Loan fully repaid and closed';
    addAudit(s, user, 'LOAN_CLOSED', 'Loan', l.loanAccountNo, 'All installments paid');
  }
  addAudit(s, user, 'INSTALLMENT_PAID', 'Loan', l.loanAccountNo, `Installment #${installmentNo} ${money(inst.installmentAmount)} (${txn.txnId})`);
  return ok(txn, msg);
}

export function writeOffLoan(s: BankState, user: User, loanNo: string, remarks: string): Result<LoanAccount> {
  const d = denied(user, 'loan.writeoff');
  if (d) return d;
  const l = findLoan(s, user, loanNo);
  if ('ok' in l) return l;
  if (l.status !== 'Active') return fail(`Only Active loans can be written off (current: ${l.status})`);
  const overdue = l.schedule.filter((i) => installmentStatus(i) === 'Overdue').length;
  if (overdue < 3) return fail(`Only loans with at least 3 overdue installments can be written off (this loan has ${overdue})`);
  if (remarks.trim().length < 5) return fail('Remarks are required for write-off (min 5 characters)', 'remarks');
  l.status = 'Written Off';
  l.remarks = remarks.trim();
  addAudit(s, user, 'LOAN_WRITTEN_OFF', 'Loan', l.loanAccountNo, `${remarks} | Outstanding ${money(l.outstandingPrincipal)}`);
  return ok(l, `Loan ${l.loanAccountNo} written off. Outstanding ${money(l.outstandingPrincipal)}`);
}

// ------------------------------------------------------------------ teller transactions
function checkCreditable(a: DepositAccount, amount: number) {
  const cfg = DEPOSIT_PRODUCTS[a.product];
  if (!['Active', 'Frozen'].includes(a.status)) return fail(`Transactions are not allowed on a ${a.status} account`, 'accountNo');
  if (!cfg.allowDeposit) return fail(`Deposits are not allowed on ${cfg.name} after opening`, 'accountNo');
  if (a.product === 'DPS' && amount !== a.initialDeposit) return fail(`DPS deposit must equal the monthly installment of ${money(a.initialDeposit)}`, 'amount');
  return null;
}

function checkDebitable(a: DepositAccount, amount: number) {
  const cfg = DEPOSIT_PRODUCTS[a.product];
  if (a.status === 'Frozen') return fail(`Account ${a.accountNo} is frozen. Debit transactions are not allowed.`, 'accountNo');
  if (a.status !== 'Active') return fail(`Transactions are not allowed on a ${a.status} account`, 'accountNo');
  if (!cfg.allowWithdrawal) return fail(`Withdrawals are not allowed on ${cfg.name} before maturity`, 'accountNo');
  const available = round2(a.balance - cfg.minBalance);
  if (amount > available)
    return fail(
      `Insufficient funds. Available balance: ${money(Math.max(0, available))}${cfg.minBalance ? ` (minimum balance ${money(cfg.minBalance)} must be maintained)` : ''}`,
      'amount',
    );
  return null;
}

export function cashDeposit(s: BankState, user: User, accountNo: string, amountStr: string, narration = ''): Result<Transaction> {
  const d = denied(user, 'txn.post');
  if (d) return d;
  const a = findDeposit(s, user, accountNo);
  if ('ok' in a) return a;
  const amount = parseAmount(amountStr);
  if (typeof amount !== 'number') return amount;
  const c = checkCreditable(a, amount);
  if (c) return c;
  a.balance = round2(a.balance + amount);
  const txn = postTxn(s, user, {
    accountNo: a.accountNo,
    accountKind: 'DEPOSIT',
    customerId: a.customerId,
    branch: a.branch,
    type: 'Deposit',
    description: narration.trim() || (a.product === 'DPS' ? 'DPS monthly installment' : 'Cash deposit'),
    credit: amount,
    balanceAfter: a.balance,
  });
  addAudit(s, user, 'CASH_DEPOSIT', 'Transaction', txn.txnId, `${money(amount)} to ${a.accountNo}`);
  return ok(txn, `Deposit of ${money(amount)} to ${a.accountNo} successful (${txn.txnId}). New balance: ${money(a.balance)}`);
}

export function cashWithdrawal(s: BankState, user: User, accountNo: string, amountStr: string, narration = ''): Result<Transaction> {
  const d = denied(user, 'txn.post');
  if (d) return d;
  const a = findDeposit(s, user, accountNo);
  if ('ok' in a) return a;
  const amount = parseAmount(amountStr);
  if (typeof amount !== 'number') return amount;
  const c = checkDebitable(a, amount);
  if (c) return c;
  if (amount > LARGE_WITHDRAWAL_LIMIT) {
    const txn = postTxn(s, user, {
      accountNo: a.accountNo,
      accountKind: 'DEPOSIT',
      customerId: a.customerId,
      branch: a.branch,
      type: 'Withdrawal',
      description: narration.trim() || 'Cash withdrawal (large)',
      debit: amount,
      balanceAfter: a.balance,
      status: 'Pending Approval',
    });
    addAudit(s, user, 'WITHDRAWAL_PENDING', 'Transaction', txn.txnId, `${money(amount)} from ${a.accountNo} awaiting approval`);
    return ok(txn, `Withdrawal of ${money(amount)} exceeds ${money(LARGE_WITHDRAWAL_LIMIT)} and has been sent for approval (${txn.txnId})`);
  }
  a.balance = round2(a.balance - amount);
  const txn = postTxn(s, user, {
    accountNo: a.accountNo,
    accountKind: 'DEPOSIT',
    customerId: a.customerId,
    branch: a.branch,
    type: 'Withdrawal',
    description: narration.trim() || 'Cash withdrawal',
    debit: amount,
    balanceAfter: a.balance,
  });
  addAudit(s, user, 'CASH_WITHDRAWAL', 'Transaction', txn.txnId, `${money(amount)} from ${a.accountNo}`);
  return ok(txn, `Withdrawal of ${money(amount)} from ${a.accountNo} successful (${txn.txnId}). New balance: ${money(a.balance)}`);
}

export function fundTransfer(s: BankState, user: User, fromNo: string, toNo: string, amountStr: string, narration = ''): Result<Transaction> {
  const d = denied(user, 'txn.post');
  if (d) return d;
  const from = findDeposit(s, user, fromNo);
  if ('ok' in from) return from;
  const to = s.deposits.find((x) => x.accountNo === toNo.trim().toUpperCase());
  if (!to) return fail(`Beneficiary account ${toNo} not found`, 'toAccountNo');
  if (from.accountNo === to.accountNo) return fail('Source and beneficiary accounts must be different', 'toAccountNo');
  const amount = parseAmount(amountStr);
  if (typeof amount !== 'number') return amount;
  const debitErr = checkDebitable(from, amount);
  if (debitErr) return debitErr;
  const creditErr = checkCreditable(to, amount);
  if (creditErr) return { ...creditErr, field: 'toAccountNo' };
  from.balance = round2(from.balance - amount);
  to.balance = round2(to.balance + amount);
  const out = postTxn(s, user, {
    accountNo: from.accountNo,
    accountKind: 'DEPOSIT',
    customerId: from.customerId,
    branch: from.branch,
    type: 'Transfer Out',
    description: narration.trim() || `Transfer to ${to.accountNo}`,
    debit: amount,
    balanceAfter: from.balance,
  });
  postTxn(s, user, {
    accountNo: to.accountNo,
    accountKind: 'DEPOSIT',
    customerId: to.customerId,
    branch: to.branch,
    type: 'Transfer In',
    description: narration.trim() || `Transfer from ${from.accountNo}`,
    credit: amount,
    balanceAfter: to.balance,
  });
  addAudit(s, user, 'FUND_TRANSFER', 'Transaction', out.txnId, `${money(amount)} ${from.accountNo} -> ${to.accountNo}`);
  return ok(out, `Transfer of ${money(amount)} from ${from.accountNo} to ${to.accountNo} successful (${out.txnId})`);
}

export function approveTxn(s: BankState, user: User, txnId: string): Result<Transaction> {
  const d = denied(user, 'txn.approve');
  if (d) return d;
  const t = s.transactions.find((x) => x.txnId === txnId);
  if (!t) return fail('Transaction not found');
  const sc = outOfScope(user, t.branch, 'transaction');
  if (sc) return sc;
  if (t.status !== 'Pending Approval') return fail(`Only Pending Approval transactions can be approved (current: ${t.status})`);
  if (t.createdBy === user.username) return fail('Maker-checker violation: you posted this transaction and cannot approve it');
  const a = s.deposits.find((x) => x.accountNo === t.accountNo)!;
  const c = checkDebitable(a, t.debit);
  if (c) return fail(`Cannot approve: ${c.error}`);
  a.balance = round2(a.balance - t.debit);
  t.balanceAfter = a.balance;
  t.status = 'Posted';
  t.approvedBy = user.username;
  t.timestamp = nowISO();
  t.date = today();
  addAudit(s, user, 'TXN_APPROVED', 'Transaction', t.txnId, `${money(t.debit)} withdrawal approved`);
  return ok(t, `Transaction ${t.txnId} approved and posted. New balance: ${money(a.balance)}`);
}

export function rejectTxn(s: BankState, user: User, txnId: string, remarks: string): Result<Transaction> {
  const d = denied(user, 'txn.approve');
  if (d) return d;
  const t = s.transactions.find((x) => x.txnId === txnId);
  if (!t) return fail('Transaction not found');
  const sc = outOfScope(user, t.branch, 'transaction');
  if (sc) return sc;
  if (t.status !== 'Pending Approval') return fail(`Only Pending Approval transactions can be rejected (current: ${t.status})`);
  if (t.createdBy === user.username) return fail('Maker-checker violation: you posted this transaction and cannot reject it');
  if (remarks.trim().length < 5) return fail('Remarks are required when rejecting (min 5 characters)', 'remarks');
  t.status = 'Rejected';
  t.description = `${t.description} [Rejected: ${remarks.trim()}]`;
  t.approvedBy = user.username;
  addAudit(s, user, 'TXN_REJECTED', 'Transaction', t.txnId, remarks);
  return ok(t, `Transaction ${t.txnId} rejected`);
}

export function reverseTxn(s: BankState, user: User, txnId: string, reason: string): Result<Transaction> {
  const d = denied(user, 'txn.reverse');
  if (d) return d;
  const t = s.transactions.find((x) => x.txnId === txnId.trim().toUpperCase());
  if (!t) return fail('Transaction not found');
  const sc = outOfScope(user, t.branch, 'transaction');
  if (sc) return sc;
  if (t.status === 'Reversed') return fail(`Transaction ${t.txnId} has already been reversed (${t.reversedBy})`);
  if (t.status !== 'Posted') return fail(`Only Posted transactions can be reversed (current: ${t.status})`);
  if (t.accountKind !== 'DEPOSIT' || !['Deposit', 'Withdrawal'].includes(t.type)) return fail('Only cash Deposit and Withdrawal transactions can be reversed');
  if (t.date !== today()) return fail('Only transactions posted today can be reversed');
  if (t.createdBy === user.username) return fail('Maker-checker violation: you posted this transaction and cannot reverse it');
  if (reason.trim().length < 5) return fail('Reversal reason is required (min 5 characters)', 'remarks');
  const a = s.deposits.find((x) => x.accountNo === t.accountNo)!;
  if (t.type === 'Deposit' && a.balance < t.credit) return fail(`Cannot reverse: insufficient balance (${money(a.balance)}) to reverse a deposit of ${money(t.credit)}`);
  a.balance = round2(a.balance - t.credit + t.debit);
  const rev = postTxn(s, user, {
    accountNo: a.accountNo,
    accountKind: 'DEPOSIT',
    customerId: a.customerId,
    branch: a.branch,
    type: 'Reversal',
    description: `Reversal of ${t.txnId}: ${reason.trim()}`,
    debit: t.credit,
    credit: t.debit,
    balanceAfter: a.balance,
    reversalOf: t.txnId,
  });
  t.status = 'Reversed';
  t.reversedBy = rev.txnId;
  addAudit(s, user, 'TXN_REVERSED', 'Transaction', t.txnId, `Reversed by ${rev.txnId}: ${reason}`);
  return ok(rev, `Transaction ${t.txnId} reversed successfully (${rev.txnId})`);
}

// ------------------------------------------------------------------ inline edits, notes, bulk actions
export function updateCustomerEmail(s: BankState, user: User, customerId: string, email: string): Result<Customer> {
  const d = denied(user, 'customer.edit');
  if (d) return d;
  const c = s.customers.find((x) => x.customerId === customerId);
  if (!c) return fail('Customer not found');
  const sc = outOfScope(user, c.branch, 'customer');
  if (sc) return sc;
  const v = email.trim().toLowerCase();
  if (!v) return fail('Email Address is required', 'email');
  if (!EMAIL_REGEX.test(v)) return fail('Email Address must be a valid email (e.g. name@example.com)', 'email');
  if (v === c.email) return fail('Email is unchanged', 'email');
  c.email = v;
  c.updatedAt = nowISO();
  c.updatedBy = user.username;
  addAudit(s, user, 'CUSTOMER_UPDATED', 'Customer', customerId, `Email changed to ${v} (inline edit)`);
  return ok(c, `Email of ${customerId} updated to ${v}`);
}

export function updateUserDetails(s: BankState, actor: User, username: string, changes: { fullName?: string; email?: string }): Result<User> {
  const d = denied(actor, 'user.manage');
  if (d) return d;
  const u = s.users.find((x) => x.username === username);
  if (!u) return fail('User not found');
  if (changes.fullName !== undefined) {
    const n = changes.fullName.trim();
    if (n.length < 3 || n.length > 60 || !/^[A-Za-z][A-Za-z .'-]*$/.test(n)) return fail('Full Name must be 3-60 letters, spaces, dots, apostrophes or hyphens', 'fullName');
    u.fullName = n;
  }
  if (changes.email !== undefined) {
    const e = changes.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(e)) return fail('Email must be a valid email address', 'email');
    u.email = e;
  }
  addAudit(s, actor, 'USER_UPDATED', 'User', username, `Updated ${Object.keys(changes).join(', ')} (inline edit)`);
  return ok(u, `User ${username} updated`);
}

export function addDepositNote(s: BankState, user: User, accountNo: string, text: string): Result<DepositAccount> {
  const d = denied(user, 'account.note');
  if (d) return d;
  const a = findDeposit(s, user, accountNo);
  if ('ok' in a) return a;
  const t = text.trim();
  if (t.length < 3) return fail('Note must be at least 3 characters');
  if (t.length > 200) return fail('Note cannot exceed 200 characters');
  a.notes = [...(a.notes ?? []), { text: t, by: user.username, at: nowISO() }];
  addAudit(s, user, 'NOTE_ADDED', 'Deposit', a.accountNo, t);
  return ok(a, `Note added to ${a.accountNo}`);
}

/** Applies a service to many records; succeeds if at least one record succeeds. */
function bulk(ids: string[], label: string, fn: (id: string) => Result<unknown>): Result<{ done: string[]; failed: { id: string; error: string }[] }> {
  if (ids.length === 0) return fail('No records selected');
  const done: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const id of ids) {
    const r = fn(id);
    if (r.ok) done.push(id);
    else failed.push({ id, error: r.error });
  }
  if (done.length === 0) return fail(`No records were ${label}. ${failed.map((f) => `${f.id}: ${f.error}`).join(' | ')}`);
  const tail = failed.length ? `; ${failed.length} failed (${failed.map((f) => f.id).join(', ')})` : '';
  return ok({ done, failed }, `${done.length} record(s) ${label}${tail}`);
}

export const bulkSetCustomerStatus = (s: BankState, u: User, ids: string[], status: 'Active' | 'Inactive') =>
  bulk(ids, status === 'Active' ? 'activated' : 'deactivated', (id) => setCustomerStatus(s, u, id, status));

export const bulkVerifyKyc = (s: BankState, u: User, ids: string[]) => bulk(ids, 'KYC verified', (id) => decideKyc(s, u, id, 'Verified'));

export const bulkApproveDeposits = (s: BankState, u: User, ids: string[]) => bulk(ids, 'approved', (id) => approveDeposit(s, u, id));

// ------------------------------------------------------------------ data
export function recordReset(s: BankState, user: User | null) {
  addAudit(s, user, 'DATA_RESET', 'System', 'SEED', 'Demo data restored to the original seed');
}

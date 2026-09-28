export type BranchCode = 'DHK' | 'CTG' | 'SYL';
export type BranchScope = BranchCode | 'ALL';

export interface Branch {
  code: BranchCode;
  name: string;
  address: string;
  routingNo: string;
}

export type Role = 'ADMIN' | 'BRANCH_MANAGER' | 'CSO' | 'LOAN_OFFICER' | 'TELLER' | 'AUDITOR';

export interface User {
  username: string;
  password: string;
  fullName: string;
  role: Role;
  branch: BranchScope;
  email: string;
  status: 'Active' | 'Locked';
  failedAttempts: number;
  lastLogin?: string;
  createdAt: string;
}

export type CustomerType = 'Individual' | 'Business';
export type CustomerStatus = 'Active' | 'Inactive';
export type KycStatus = 'Pending' | 'Verified' | 'Rejected';
export type Gender = 'Male' | 'Female' | 'Other';

/** Metadata of an uploaded document (file contents are not stored). */
export interface DocMeta {
  name: string;
  size: number;
  type: string;
}

export interface AccountNote {
  text: string;
  by: string;
  at: string;
}

export interface Customer {
  customerId: string;
  customerType: CustomerType;
  fullName: string;
  fatherName: string;
  motherName: string;
  dob: string;
  gender: Gender;
  mobile: string;
  email: string;
  nid: string;
  presentAddress: string;
  division: string;
  district: string;
  permanentAddress: string;
  occupation: string;
  monthlyIncome: number;
  smsAlerts: boolean;
  eStatement: boolean;
  documents: DocMeta[];
  businessName?: string;
  tradeLicense?: string;
  branch: BranchCode;
  status: CustomerStatus;
  kycStatus: KycStatus;
  kycRemarks?: string;
  kycVerifiedBy?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type DepositProduct = 'SAVINGS' | 'CURRENT' | 'FDR' | 'DPS' | 'MBS';
export type DepositStatus = 'Pending Approval' | 'Active' | 'Frozen' | 'Matured' | 'Closed' | 'Rejected';

export interface DepositAccount {
  accountNo: string;
  customerId: string;
  customerName: string;
  product: DepositProduct;
  openingDate: string;
  initialDeposit: number;
  interestRate: number;
  tenureMonths?: number;
  maturityDate?: string;
  maturityAmount?: number;
  nomineeName?: string;
  nomineeRelation?: string;
  nomineeShare?: number;
  linkedAccountNo?: string;
  notes: AccountNote[];
  balance: number;
  branch: BranchCode;
  status: DepositStatus;
  freezeReason?: string;
  remarks?: string;
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  closedAt?: string;
}

export type LoanProduct = 'PERSONAL' | 'BUSINESS' | 'HOME' | 'SME' | 'CONSUMER';
export type RepaymentFrequency = 'Monthly' | 'Quarterly' | 'Half-Yearly';
export type LoanStatus = 'Applied' | 'Approved' | 'Rejected' | 'Active' | 'Closed' | 'Written Off';
export type InstallmentStatus = 'Pending' | 'Paid' | 'Overdue';

export interface Installment {
  installmentNo: number;
  dueDate: string;
  openingPrincipal: number;
  installmentAmount: number;
  principal: number;
  interest: number;
  closingPrincipal: number;
  paid: boolean;
  paidDate?: string;
  paymentTxnId?: string;
}

export interface LoanAccount {
  loanAccountNo: string;
  customerId: string;
  customerName: string;
  product: LoanProduct;
  amount: number;
  interestRate: number;
  tenureMonths: number;
  startDate: string;
  frequency: RepaymentFrequency;
  numberOfInstallments: number;
  installmentAmount: number;
  maturityDate: string;
  purpose: string;
  collateral: string[];
  insurance: boolean;
  documents: DocMeta[];
  branch: BranchCode;
  status: LoanStatus;
  outstandingPrincipal: number;
  schedule: Installment[];
  remarks?: string;
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  disbursedAt?: string;
  closedAt?: string;
}

export type AccountKind = 'DEPOSIT' | 'LOAN';
export type TxnStatus = 'Posted' | 'Reversed' | 'Pending Approval' | 'Rejected';
export type TxnType =
  | 'Opening Deposit'
  | 'Deposit'
  | 'Withdrawal'
  | 'Transfer In'
  | 'Transfer Out'
  | 'Interest Credit'
  | 'Profit Payout'
  | 'Maturity Payout'
  | 'Reversal'
  | 'Loan Disbursement'
  | 'Interest Charge'
  | 'Installment Payment';

export interface Transaction {
  txnId: string;
  seq: number;
  date: string;
  timestamp: string;
  accountNo: string;
  accountKind: AccountKind;
  customerId: string;
  branch: BranchCode;
  type: TxnType;
  description: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  status: TxnStatus;
  reversalOf?: string;
  reversedBy?: string;
  createdBy: string;
  approvedBy?: string;
}

export type AuditEntity = 'Customer' | 'Deposit' | 'Loan' | 'Transaction' | 'User' | 'System' | 'Auth';

export interface AuditLog {
  id: string;
  timestamp: string;
  username: string;
  role: Role | 'SYSTEM';
  branch: BranchScope;
  action: string;
  entityType: AuditEntity;
  entityId: string;
  details: string;
}

export interface Counters {
  customer: Record<BranchCode, number>;
  deposit: Record<BranchCode, number>;
  loan: Record<BranchCode, number>;
  txn: number;
  audit: number;
}

export interface BankState {
  version: number;
  users: User[];
  customers: Customer[];
  deposits: DepositAccount[];
  loans: LoanAccount[];
  transactions: Transaction[];
  auditLogs: AuditLog[];
  counters: Counters;
}

export type Result<T = undefined> =
  | { ok: true; data: T; message: string }
  | { ok: false; error: string; field?: string };

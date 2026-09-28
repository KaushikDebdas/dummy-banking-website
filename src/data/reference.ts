import type { Branch, BranchCode, DepositProduct, LoanProduct, RepaymentFrequency, Role } from '../types';

export const BRANCHES: Branch[] = [
  { code: 'DHK', name: 'Dhaka Branch', address: '12 Motijheel C/A, Dhaka-1000', routingNo: '090270001' },
  { code: 'CTG', name: 'Chattogram Branch', address: '45 Agrabad C/A, Chattogram-4100', routingNo: '090150002' },
  { code: 'SYL', name: 'Sylhet Branch', address: '7 Zindabazar, Sylhet-3100', routingNo: '090910003' },
];

export const BRANCH_CODES: BranchCode[] = ['DHK', 'CTG', 'SYL'];

export function branchName(code: string): string {
  if (code === 'ALL') return 'All Branches';
  return BRANCHES.find((b) => b.code === code)?.name ?? code;
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Admin',
  BRANCH_MANAGER: 'Branch Manager',
  CSO: 'Customer Service Officer',
  LOAN_OFFICER: 'Loan Officer',
  TELLER: 'Teller',
  AUDITOR: 'Auditor',
};

/** Division -> districts (used by the cascading address dropdowns). */
export const DIVISIONS: Record<string, string[]> = {
  Dhaka: ['Dhaka', 'Gazipur', 'Narayanganj', 'Narsingdi', 'Manikganj', 'Munshiganj', 'Tangail', 'Faridpur'],
  Chattogram: ['Chattogram', "Cox's Bazar", 'Cumilla', 'Feni', 'Noakhali', 'Rangamati', 'Brahmanbaria'],
  Sylhet: ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'],
  Rajshahi: ['Rajshahi', 'Bogura', 'Pabna', 'Natore', 'Naogaon'],
  Khulna: ['Khulna', 'Jashore', 'Kushtia', 'Satkhira', 'Bagerhat'],
  Barishal: ['Barishal', 'Patuakhali', 'Bhola', 'Pirojpur'],
  Rangpur: ['Rangpur', 'Dinajpur', 'Kurigram', 'Gaibandha'],
  Mymensingh: ['Mymensingh', 'Jamalpur', 'Netrokona', 'Sherpur'],
};
export const DIVISION_NAMES = Object.keys(DIVISIONS);

export const COLLATERAL_TYPES = [
  'Property Mortgage',
  'FDR Lien',
  'Vehicle Hypothecation',
  'Gold Pledge',
  'Share Certificate',
  'Personal Guarantee',
  'Corporate Guarantee',
  'Machinery Hypothecation',
  'Stock Hypothecation',
];

/** Upload rules for KYC and loan documents. */
export const DOCUMENT_RULES = {
  accept: ['image/jpeg', 'image/png', 'application/pdf'],
  extensions: ['.jpg', '.jpeg', '.png', '.pdf'],
  maxSizeMB: 2,
  maxFiles: 3,
};

export const OCCUPATIONS = [
  'Service Holder',
  'Business',
  'Government Employee',
  'Doctor',
  'Engineer',
  'Teacher',
  'Farmer',
  'Student',
  'Housewife',
  'Retired',
  'Self Employed',
  'Other',
];

export interface DepositProductConfig {
  code: DepositProduct;
  shortCode: string;
  name: string;
  term: boolean;
  /** Minimum opening amount (for DPS: minimum monthly installment). */
  minAmount: number;
  maxAmount: number;
  amountLabel: string;
  /** Allowed tenures in months (term products only). */
  tenures: number[];
  /** Interest rate per tenure (term) or flat rate. */
  rateFor: (tenureMonths?: number) => number;
  minBalance: number;
  allowDeposit: boolean;
  allowWithdrawal: boolean;
  requiresNominee: boolean;
  requiresLinkedAccount: boolean;
  description: string;
}

export const DEPOSIT_PRODUCTS: Record<DepositProduct, DepositProductConfig> = {
  SAVINGS: {
    code: 'SAVINGS',
    shortCode: 'SAV',
    name: 'Savings Account',
    term: false,
    minAmount: 500,
    maxAmount: 10000000,
    amountLabel: 'Initial Deposit Amount',
    tenures: [],
    rateFor: () => 3.5,
    minBalance: 500,
    allowDeposit: true,
    allowWithdrawal: true,
    requiresNominee: false,
    requiresLinkedAccount: false,
    description: 'Min opening 500 BDT, 3.50% p.a., minimum balance 500 BDT. One savings account per customer.',
  },
  CURRENT: {
    code: 'CURRENT',
    shortCode: 'CUR',
    name: 'Current Account',
    term: false,
    minAmount: 5000,
    maxAmount: 50000000,
    amountLabel: 'Initial Deposit Amount',
    tenures: [],
    rateFor: () => 0,
    minBalance: 0,
    allowDeposit: true,
    allowWithdrawal: true,
    requiresNominee: false,
    requiresLinkedAccount: false,
    description: 'Min opening 5,000 BDT, no interest, no minimum balance.',
  },
  FDR: {
    code: 'FDR',
    shortCode: 'FDR',
    name: 'Fixed Deposit Receipt (FDR)',
    term: true,
    minAmount: 10000,
    maxAmount: 100000000,
    amountLabel: 'Deposit Amount',
    tenures: [3, 6, 12, 24, 36],
    rateFor: (t) => ({ 3: 6.0, 6: 6.5, 12: 7.0, 24: 7.25, 36: 7.5 } as Record<number, number>)[t ?? 0] ?? 0,
    minBalance: 0,
    allowDeposit: false,
    allowWithdrawal: false,
    requiresNominee: true,
    requiresLinkedAccount: false,
    description: 'Min 10,000 BDT. Tenure 3-36 months. No deposit or withdrawal before maturity.',
  },
  DPS: {
    code: 'DPS',
    shortCode: 'DPS',
    name: 'Monthly Deposit Scheme (DPS)',
    term: true,
    minAmount: 500,
    maxAmount: 50000,
    amountLabel: 'Monthly Installment',
    tenures: [36, 60, 120],
    rateFor: (t) => ({ 36: 7.0, 60: 7.5, 120: 8.0 } as Record<number, number>)[t ?? 0] ?? 0,
    minBalance: 0,
    allowDeposit: true,
    allowWithdrawal: false,
    requiresNominee: true,
    requiresLinkedAccount: false,
    description: 'Monthly installment 500-50,000 BDT in multiples of 500. Tenure 3/5/10 years. Deposits must equal the installment.',
  },
  MBS: {
    code: 'MBS',
    shortCode: 'MBS',
    name: 'Money Builder Scheme (MBS)',
    term: true,
    minAmount: 50000,
    maxAmount: 50000000,
    amountLabel: 'Deposit Amount',
    tenures: [36, 60],
    rateFor: (t) => ({ 36: 8.0, 60: 8.5 } as Record<number, number>)[t ?? 0] ?? 0,
    minBalance: 0,
    allowDeposit: false,
    allowWithdrawal: false,
    requiresNominee: true,
    requiresLinkedAccount: true,
    description: 'Min 50,000 BDT lump sum. Monthly profit paid to a linked Savings/Current account. Tenure 3/5 years.',
  },
};

export const DEPOSIT_PRODUCT_LIST = Object.values(DEPOSIT_PRODUCTS);

export interface LoanProductConfig {
  code: LoanProduct;
  shortCode: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  minRate: number;
  maxRate: number;
  defaultRate: number;
  minTenure: number;
  maxTenure: number;
  businessOnly: boolean;
  requiresCollateral: boolean;
  /** Debt burden ratio check (monthly installment <= 50% of monthly income). */
  dbrCheck: boolean;
  description: string;
}

export const LOAN_PRODUCTS: Record<LoanProduct, LoanProductConfig> = {
  PERSONAL: {
    code: 'PERSONAL',
    shortCode: 'PER',
    name: 'Personal Loan',
    minAmount: 50000,
    maxAmount: 2000000,
    minRate: 9,
    maxRate: 14,
    defaultRate: 11,
    minTenure: 12,
    maxTenure: 60,
    businessOnly: false,
    requiresCollateral: false,
    dbrCheck: true,
    description: '50,000 - 2,000,000 BDT, 9-14% p.a., 12-60 months. Installment must not exceed 50% of monthly income.',
  },
  BUSINESS: {
    code: 'BUSINESS',
    shortCode: 'BUS',
    name: 'Business Loan',
    minAmount: 500000,
    maxAmount: 20000000,
    minRate: 10,
    maxRate: 15,
    defaultRate: 12,
    minTenure: 12,
    maxTenure: 84,
    businessOnly: true,
    requiresCollateral: true,
    dbrCheck: false,
    description: '500,000 - 20,000,000 BDT, 10-15% p.a., 12-84 months. Business customers only.',
  },
  HOME: {
    code: 'HOME',
    shortCode: 'HOM',
    name: 'Home Loan',
    minAmount: 1000000,
    maxAmount: 30000000,
    minRate: 7.5,
    maxRate: 10,
    defaultRate: 8.5,
    minTenure: 60,
    maxTenure: 300,
    businessOnly: false,
    requiresCollateral: true,
    dbrCheck: true,
    description: '1,000,000 - 30,000,000 BDT, 7.5-10% p.a., 60-300 months.',
  },
  SME: {
    code: 'SME',
    shortCode: 'SME',
    name: 'SME Loan',
    minAmount: 200000,
    maxAmount: 10000000,
    minRate: 9,
    maxRate: 13,
    defaultRate: 10.5,
    minTenure: 12,
    maxTenure: 60,
    businessOnly: true,
    requiresCollateral: true,
    dbrCheck: false,
    description: '200,000 - 10,000,000 BDT, 9-13% p.a., 12-60 months. Business customers only.',
  },
  CONSUMER: {
    code: 'CONSUMER',
    shortCode: 'CON',
    name: 'Consumer Loan',
    minAmount: 20000,
    maxAmount: 500000,
    minRate: 12,
    maxRate: 16,
    defaultRate: 13,
    minTenure: 6,
    maxTenure: 36,
    businessOnly: false,
    requiresCollateral: false,
    dbrCheck: true,
    description: '20,000 - 500,000 BDT, 12-16% p.a., 6-36 months. Installment must not exceed 50% of monthly income.',
  },
};

export const LOAN_PRODUCT_LIST = Object.values(LOAN_PRODUCTS);

export const REPAYMENT_FREQUENCIES: RepaymentFrequency[] = ['Monthly', 'Quarterly', 'Half-Yearly'];

export const LOAN_PURPOSES = [
  'Personal Expenses',
  'Education',
  'Medical',
  'Wedding',
  'Home Purchase',
  'Home Renovation',
  'Working Capital',
  'Machinery Purchase',
  'Business Expansion',
  'Vehicle Purchase',
  'Electronics Purchase',
  'Other',
];

/** Withdrawals above this amount need a checker's approval. */
export const LARGE_WITHDRAWAL_LIMIT = 500000;
/** How many days back an account opening date may be back-valued. */
export const MAX_BACK_VALUE_DAYS = 30;
export const MAX_FAILED_LOGINS = 3;

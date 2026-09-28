/**
 * Deterministic seed data. Every value below is generated from fixed dates and a
 * fixed-seed PRNG, so a fresh install / "Reset Demo Data" always produces exactly
 * the same customers, accounts, transactions and IDs.
 */
import type {
  AuditLog,
  BankState,
  BranchCode,
  Customer,
  CustomerType,
  DepositAccount,
  DepositProduct,
  DepositStatus,
  Gender,
  LoanAccount,
  LoanProduct,
  LoanStatus,
  RepaymentFrequency,
  Transaction,
  TxnType,
  User,
} from '../types';
import { addDays, addMonths } from '../lib/dates';
import { dpsMaturityAmount, fdrMaturityAmount, mbsMonthlyProfit } from '../lib/depositCalc';
import { round2 } from '../lib/format';
import { makeAuditId, makeCustomerId, makeDepositNo, makeLoanNo, makeTxnId, padNum } from '../lib/ids';
import { calculateInstallment, generateSchedule, numberOfInstallments } from '../lib/loanCalc';
import { BRANCH_CODES, DEPOSIT_PRODUCTS, LOAN_PRODUCTS } from './reference';

export const STATE_VERSION = 2;
/** Seed transactions are generated up to this date. */
export const SEED_CUTOFF = '2026-06-30';

// ---------------------------------------------------------------- users
const USERS: Omit<User, 'failedAttempts' | 'createdAt'>[] = [
  { username: 'admin', password: 'Admin@123', fullName: 'Rahim Uddin', role: 'ADMIN', branch: 'ALL', email: 'admin@kddemobank.test', status: 'Active' },
  { username: 'manager.dhaka', password: 'Manager@123', fullName: 'Farhana Islam', role: 'BRANCH_MANAGER', branch: 'DHK', email: 'manager.dhaka@kddemobank.test', status: 'Active' },
  { username: 'manager.ctg', password: 'Manager@123', fullName: 'Tanvir Hossain', role: 'BRANCH_MANAGER', branch: 'CTG', email: 'manager.ctg@kddemobank.test', status: 'Active' },
  { username: 'manager.sylhet', password: 'Manager@123', fullName: 'Nusrat Jahan', role: 'BRANCH_MANAGER', branch: 'SYL', email: 'manager.sylhet@kddemobank.test', status: 'Active' },
  { username: 'cso.dhaka', password: 'Cso@123', fullName: 'Sabbir Ahmed', role: 'CSO', branch: 'DHK', email: 'cso.dhaka@kddemobank.test', status: 'Active' },
  { username: 'cso.ctg', password: 'Cso@123', fullName: 'Mitu Akter', role: 'CSO', branch: 'CTG', email: 'cso.ctg@kddemobank.test', status: 'Active' },
  { username: 'loan.dhaka', password: 'Loan@123', fullName: 'Imran Kabir', role: 'LOAN_OFFICER', branch: 'DHK', email: 'loan.dhaka@kddemobank.test', status: 'Active' },
  { username: 'loan.ctg', password: 'Loan@123', fullName: 'Arif Chowdhury', role: 'LOAN_OFFICER', branch: 'CTG', email: 'loan.ctg@kddemobank.test', status: 'Active' },
  { username: 'teller.dhaka', password: 'Teller@123', fullName: 'Shirin Sultana', role: 'TELLER', branch: 'DHK', email: 'teller.dhaka@kddemobank.test', status: 'Active' },
  { username: 'teller.sylhet', password: 'Teller@123', fullName: 'Kamal Uddin', role: 'TELLER', branch: 'SYL', email: 'teller.sylhet@kddemobank.test', status: 'Active' },
  { username: 'auditor', password: 'Audit@123', fullName: 'Mahbub Alam', role: 'AUDITOR', branch: 'ALL', email: 'auditor@kddemobank.test', status: 'Active' },
  { username: 'locked.user', password: 'Locked@123', fullName: 'Rashed Karim', role: 'CSO', branch: 'SYL', email: 'locked.user@kddemobank.test', status: 'Locked' },
];

const MAKER: Record<BranchCode, { cso: string; loan: string; teller: string; manager: string }> = {
  DHK: { cso: 'cso.dhaka', loan: 'loan.dhaka', teller: 'teller.dhaka', manager: 'manager.dhaka' },
  CTG: { cso: 'cso.ctg', loan: 'loan.ctg', teller: 'cso.ctg', manager: 'manager.ctg' },
  SYL: { cso: 'manager.sylhet', loan: 'manager.sylhet', teller: 'teller.sylhet', manager: 'admin' },
};

// ---------------------------------------------------------------- prng
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- customers
type CustSeed = [string, string, string, Gender, string, string, number, CustomerType, string?];

const CUSTOMER_SEED: Record<BranchCode, CustSeed[]> = {
  DHK: [
    ['Abdul Karim', 'Abdul Jabbar', 'Rokeya Begum', 'Male', '1975-04-12', 'Business', 450000, 'Business', 'Karim Traders'],
    ['Nasrin Akter', 'Mohammad Ali', 'Salma Khatun', 'Female', '1988-09-23', 'Doctor', 180000, 'Individual'],
    ['Mizanur Rahman', 'Habibur Rahman', 'Jahanara Begum', 'Male', '1990-01-15', 'Engineer', 150000, 'Individual'],
    ['Sharmin Sultana', 'Abul Kashem', 'Hosne Ara', 'Female', '1985-06-30', 'Service Holder', 95000, 'Individual'],
    ['Rafiqul Islam', 'Nurul Islam', 'Amena Khatun', 'Male', '1992-11-02', 'Government Employee', 70000, 'Individual'],
    ['Taslima Nasrin', 'Golam Mostafa', 'Rahima Begum', 'Female', '1979-03-18', 'Teacher', 60000, 'Individual'],
    ['Jahid Hasan', 'Anwar Hossain', 'Momtaz Begum', 'Male', '1983-08-08', 'Self Employed', 120000, 'Individual'],
    ['Farzana Haque', 'Enamul Haque', 'Shahana Parvin', 'Female', '1987-12-25', 'Service Holder', 250000, 'Individual'],
    ['Saiful Alam', 'Shamsul Alam', 'Nurjahan Begum', 'Male', '1995-05-05', 'Student', 15000, 'Individual'],
    ['Kulsum Begum', 'Abdul Motin', 'Fatema Begum', 'Female', '1960-02-14', 'Retired', 30000, 'Individual'],
  ],
  CTG: [
    ['Jashim Uddin', 'Nazim Uddin', 'Hasina Begum', 'Male', '1972-07-20', 'Business', 380000, 'Business', 'Port City Enterprise'],
    ['Rehana Parvin', 'Abdur Rob', 'Kohinoor Begum', 'Female', '1986-10-11', 'Teacher', 55000, 'Individual'],
    ['Mohammad Selim', 'Abdus Sattar', 'Rashida Begum', 'Male', '1981-04-04', 'Engineer', 140000, 'Individual'],
    ['Shanta Das', 'Ratan Das', 'Anjali Das', 'Female', '1991-01-29', 'Doctor', 160000, 'Individual'],
    ['Kamrul Hasan', 'Mokbul Hossain', 'Rizia Begum', 'Male', '1989-09-09', 'Service Holder', 65000, 'Individual'],
    ['Nazma Akter', 'Delwar Hossain', 'Morium Begum', 'Female', '1984-06-16', 'Housewife', 40000, 'Individual'],
    ['Ashraful Alam', 'Faruk Alam', 'Laila Begum', 'Male', '1978-02-27', 'Business', 200000, 'Individual'],
    ['Sumaiya Rahman', 'Lutfur Rahman', 'Shamima Akter', 'Female', '1993-03-03', 'Service Holder', 110000, 'Individual'],
    ['Babul Mia', 'Kalu Mia', 'Jamila Khatun', 'Male', '1970-12-12', 'Farmer', 25000, 'Individual'],
    ['Priya Barua', 'Sunil Barua', 'Mala Barua', 'Female', '1996-08-19', 'Student', 12000, 'Individual'],
  ],
  SYL: [
    ['Hafizur Rahman', 'Mujibur Rahman', 'Anowara Begum', 'Male', '1974-05-22', 'Business', 300000, 'Business', 'Surma Tea Supplies'],
    ['Lipi Akter', 'Abdul Hai', 'Sufia Begum', 'Female', '1990-07-07', 'Service Holder', 75000, 'Individual'],
    ['Emdadul Haque', 'Ziaul Haque', 'Monowara Begum', 'Male', '1982-10-30', 'Engineer', 130000, 'Individual'],
    ['Sadia Islam', 'Rafiq Islam', 'Nargis Akter', 'Female', '1994-04-14', 'Doctor', 170000, 'Individual'],
    ['Belal Ahmed', 'Jalal Ahmed', 'Rabeya Khatun', 'Male', '1988-01-01', 'Self Employed', 80000, 'Individual'],
    ['Rumana Chowdhury', 'Harun Chowdhury', 'Parvin Chowdhury', 'Female', '1980-11-21', 'Teacher', 58000, 'Individual'],
    ['Shafiqul Islam', 'Abdul Latif', 'Kulsum Akter', 'Male', '1976-09-15', 'Government Employee', 90000, 'Individual'],
    ['Mahmuda Khanam', 'Aziz Khan', 'Sultana Razia', 'Female', '1985-03-10', 'Service Holder', 140000, 'Individual'],
    ['Tariqul Islam', 'Moinul Islam', 'Ayesha Siddika', 'Male', '1997-06-06', 'Student', 10000, 'Individual'],
    ['Rokhsana Begum', 'Abdul Awal', 'Halima Khatun', 'Female', '1968-08-28', 'Housewife', 35000, 'Individual'],
  ],
};

const BRANCH_DIVISION: Record<BranchCode, { division: string; districts: string[] }> = {
  DHK: { division: 'Dhaka', districts: ['Dhaka', 'Gazipur', 'Narayanganj'] },
  CTG: { division: 'Chattogram', districts: ['Chattogram', 'Cumilla', 'Feni'] },
  SYL: { division: 'Sylhet', districts: ['Sylhet', 'Moulvibazar', 'Habiganj'] },
};

const LOAN_COLLATERAL: Partial<Record<LoanProduct, string[]>> = {
  HOME: ['Property Mortgage'],
  BUSINESS: ['Stock Hypothecation', 'Corporate Guarantee'],
  SME: ['Machinery Hypothecation', 'Personal Guarantee'],
};

const ADDRESSES: Record<BranchCode, string[]> = {
  DHK: ['House 12, Road 5, Dhanmondi, Dhaka-1205', 'Flat 3B, 22 Mirpur Road, Dhaka-1207', 'House 45, Sector 7, Uttara, Dhaka-1230', '88 Green Road, Farmgate, Dhaka-1215', 'House 9, Road 11, Banani, Dhaka-1213'],
  CTG: ['House 5, Road 2, Nasirabad H/S, Chattogram-4209', '17 CDA Avenue, GEC, Chattogram-4000', 'Flat 6A, Khulshi Hill, Chattogram-4225', '33 Anderkilla, Kotwali, Chattogram-4000', 'Village Patiya, Chattogram-4370'],
  SYL: ['House 21, Uposhohor, Sylhet-3100', '14 Amberkhana, Sylhet-3100', 'Flat 2C, Shibganj Road, Sylhet-3100', 'Village Golapganj, Sylhet-3160', '9 Mirabazar, Sylhet-3100'],
};

// Customer specials, by branch and 0-based index.
const KYC_OVERRIDE: Partial<Record<BranchCode, Record<number, 'Pending' | 'Rejected'>>> = {
  DHK: { 8: 'Pending' },
  CTG: { 8: 'Pending', 9: 'Rejected' },
  SYL: { 8: 'Pending' },
};
const INACTIVE: Partial<Record<BranchCode, number[]>> = { DHK: [9] };

// ---------------------------------------------------------------- account plans
interface DepPlan {
  c: number;
  product: DepositProduct;
  open: string;
  amount: number;
  tenure?: number;
  status?: DepositStatus;
  freezeReason?: string;
  closeOn?: string;
}

const DEPOSIT_PLANS: Record<BranchCode, DepPlan[]> = {
  DHK: [
    { c: 0, product: 'CURRENT', open: '2024-02-10', amount: 250000 },
    { c: 0, product: 'FDR', open: '2025-07-01', amount: 1000000, tenure: 12 },
    { c: 1, product: 'SAVINGS', open: '2024-03-05', amount: 20000 },
    { c: 1, product: 'FDR', open: '2025-10-15', amount: 500000, tenure: 24 },
    { c: 2, product: 'SAVINGS', open: '2024-04-18', amount: 15000 },
    { c: 2, product: 'DPS', open: '2024-05-01', amount: 5000, tenure: 60 },
    { c: 3, product: 'SAVINGS', open: '2024-06-22', amount: 10000 },
    { c: 4, product: 'SAVINGS', open: '2024-08-09', amount: 5000 },
    { c: 5, product: 'SAVINGS', open: '2024-09-14', amount: 8000 },
    { c: 5, product: 'FDR', open: '2026-03-15', amount: 200000, tenure: 3 },
    { c: 6, product: 'SAVINGS', open: '2024-10-03', amount: 30000 },
    { c: 6, product: 'MBS', open: '2025-01-05', amount: 300000, tenure: 60 },
    { c: 7, product: 'SAVINGS', open: '2024-11-11', amount: 50000 },
    { c: 7, product: 'DPS', open: '2025-02-01', amount: 10000, tenure: 36 },
    { c: 9, product: 'SAVINGS', open: '2024-01-20', amount: 3000, status: 'Closed', closeOn: '2025-12-15' },
  ],
  CTG: [
    { c: 0, product: 'CURRENT', open: '2024-01-15', amount: 300000 },
    { c: 0, product: 'FDR', open: '2025-04-10', amount: 750000, tenure: 36 },
    { c: 1, product: 'SAVINGS', open: '2024-02-28', amount: 6000 },
    { c: 1, product: 'DPS', open: '2024-06-01', amount: 2000, tenure: 36 },
    { c: 2, product: 'SAVINGS', open: '2024-03-19', amount: 25000 },
    { c: 3, product: 'SAVINGS', open: '2024-05-07', amount: 40000 },
    { c: 3, product: 'FDR', open: '2025-11-20', amount: 300000, tenure: 12 },
    { c: 4, product: 'SAVINGS', open: '2024-07-25', amount: 7000 },
    { c: 5, product: 'SAVINGS', open: '2024-08-30', amount: 4000, status: 'Frozen', freezeReason: 'Court order - pending litigation' },
    { c: 6, product: 'CURRENT', open: '2024-09-09', amount: 80000 },
    { c: 7, product: 'SAVINGS', open: '2024-12-01', amount: 12000 },
  ],
  SYL: [
    { c: 0, product: 'CURRENT', open: '2024-03-01', amount: 200000 },
    { c: 1, product: 'SAVINGS', open: '2024-04-04', amount: 9000 },
    { c: 1, product: 'DPS', open: '2024-07-01', amount: 3000, tenure: 60 },
    { c: 2, product: 'SAVINGS', open: '2024-05-15', amount: 18000 },
    { c: 2, product: 'FDR', open: '2025-12-01', amount: 400000, tenure: 6 },
    { c: 3, product: 'SAVINGS', open: '2024-06-06', amount: 22000 },
    { c: 4, product: 'SAVINGS', open: '2024-07-17', amount: 6000 },
    { c: 5, product: 'SAVINGS', open: '2024-09-02', amount: 5000 },
    { c: 6, product: 'SAVINGS', open: '2024-10-20', amount: 14000 },
    { c: 7, product: 'SAVINGS', open: '2024-12-12', amount: 35000 },
    { c: 8, product: 'SAVINGS', open: '2026-06-25', amount: 2000, status: 'Pending Approval' },
  ],
};

interface LoanPlan {
  c: number;
  product: LoanProduct;
  amount: number;
  rate: number;
  tenure: number;
  freq: RepaymentFrequency;
  start: string;
  status: LoanStatus;
  purpose: string;
  /** Number of most-recent due installments left unpaid (creates overdue data). */
  unpaid?: number;
  remarks?: string;
}

const LOAN_PLANS: Record<BranchCode, LoanPlan[]> = {
  DHK: [
    { c: 0, product: 'BUSINESS', amount: 2500000, rate: 12, tenure: 36, freq: 'Monthly', start: '2025-03-10', status: 'Active', purpose: 'Working Capital' },
    { c: 3, product: 'PERSONAL', amount: 300000, rate: 11, tenure: 24, freq: 'Monthly', start: '2025-06-05', status: 'Active', purpose: 'Medical' },
    { c: 4, product: 'CONSUMER', amount: 80000, rate: 13, tenure: 12, freq: 'Monthly', start: '2026-07-01', status: 'Applied', purpose: 'Electronics Purchase' },
    { c: 7, product: 'HOME', amount: 5000000, rate: 8.5, tenure: 120, freq: 'Monthly', start: '2025-01-20', status: 'Active', purpose: 'Home Purchase' },
  ],
  CTG: [
    { c: 0, product: 'SME', amount: 1500000, rate: 10.5, tenure: 36, freq: 'Quarterly', start: '2025-02-15', status: 'Active', purpose: 'Machinery Purchase' },
    { c: 3, product: 'PERSONAL', amount: 500000, rate: 10, tenure: 36, freq: 'Monthly', start: '2026-07-10', status: 'Approved', purpose: 'Education' },
    { c: 4, product: 'CONSUMER', amount: 150000, rate: 14, tenure: 24, freq: 'Monthly', start: '2026-06-01', status: 'Rejected', purpose: 'Vehicle Purchase', remarks: 'Debt burden ratio above policy limit' },
    { c: 7, product: 'PERSONAL', amount: 400000, rate: 11.5, tenure: 36, freq: 'Monthly', start: '2025-05-01', status: 'Active', purpose: 'Wedding' },
  ],
  SYL: [
    { c: 0, product: 'SME', amount: 800000, rate: 11, tenure: 24, freq: 'Monthly', start: '2025-04-01', status: 'Active', purpose: 'Business Expansion', unpaid: 3 },
    { c: 3, product: 'PERSONAL', amount: 250000, rate: 12, tenure: 24, freq: 'Monthly', start: '2025-08-15', status: 'Active', purpose: 'Home Renovation' },
    { c: 4, product: 'CONSUMER', amount: 60000, rate: 13, tenure: 12, freq: 'Monthly', start: '2025-01-10', status: 'Closed', purpose: 'Electronics Purchase' },
    { c: 7, product: 'PERSONAL', amount: 600000, rate: 10.5, tenure: 48, freq: 'Half-Yearly', start: '2025-03-01', status: 'Active', purpose: 'Personal Expenses' },
  ],
};

// ---------------------------------------------------------------- builder
interface Event {
  date: string;
  type: TxnType;
  description: string;
  amount: number;
  /** 'CR' increases a deposit balance; for loans 'DR' increases outstanding. */
  side: 'CR' | 'DR';
  createdBy: string;
  onId?: (txnId: string) => void;
}

export function buildSeedState(): BankState {
  const rand = mulberry32(20260101);
  const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

  const users: User[] = USERS.map((u) => ({ ...u, failedAttempts: 0, createdAt: '2024-01-01T09:00:00.000Z' }));
  const customers: Customer[] = [];
  const deposits: DepositAccount[] = [];
  const loans: LoanAccount[] = [];
  const auditDraft: Omit<AuditLog, 'id'>[] = [];
  const counters: BankState['counters'] = {
    customer: { DHK: 0, CTG: 0, SYL: 0 },
    deposit: { DHK: 0, CTG: 0, SYL: 0 },
    loan: { DHK: 0, CTG: 0, SYL: 0 },
    txn: 0,
    audit: 0,
  };
  const depositEvents = new Map<string, Event[]>();
  const loanEvents = new Map<string, Event[]>();
  const audit = (timestamp: string, username: string, branch: BranchCode, action: string, entityType: AuditLog['entityType'], entityId: string, details: string) => {
    const user = users.find((u) => u.username === username);
    auditDraft.push({ timestamp, username, role: user?.role ?? 'SYSTEM', branch, action, entityType, entityId, details });
  };
  const ts = (date: string, hh = 10) => `${date}T${padNum(hh, 2)}:00:00.000Z`;

  BRANCH_CODES.forEach((branch, b) => {
    const makers = MAKER[branch];
    // customers
    CUSTOMER_SEED[branch].forEach((s, i) => {
      counters.customer[branch]++;
      const id = makeCustomerId(branch, counters.customer[branch]);
      const [fullName, fatherName, motherName, gender, dob, occupation, monthlyIncome, customerType, businessName] = s;
      const created = addDays('2024-01-05', b * 3 + i * 7);
      const addr = ADDRESSES[branch][i % 5];
      const nid = i % 3 === 0 ? `19${padNum(80000000 + b * 1000000 + i * 104729, 15)}` : `${b + 2}${padNum(100000000 + i * 7919 + b * 13, 9)}`;
      const kyc = KYC_OVERRIDE[branch]?.[i] ?? 'Verified';
      customers.push({
        customerId: id,
        customerType,
        fullName,
        fatherName,
        motherName,
        dob,
        gender,
        mobile: `01${['7', '8', '9'][b]}${padNum(20000000 + i * 1117 + b * 300001, 8)}`,
        email: `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}${b}${i}@example.com`,
        nid,
        presentAddress: addr,
        division: BRANCH_DIVISION[branch].division,
        district: BRANCH_DIVISION[branch].districts[i % 3],
        permanentAddress: i % 2 === 0 ? addr : ADDRESSES[branch][(i + 2) % 5],
        occupation,
        monthlyIncome,
        smsAlerts: i % 3 !== 2,
        eStatement: i % 2 === 0,
        documents:
          kyc === 'Verified'
            ? [
                { name: `nid_${id.toLowerCase()}.pdf`, size: 245760 + i * 1024, type: 'application/pdf' },
                { name: `photo_${id.toLowerCase()}.jpg`, size: 98304 + i * 512, type: 'image/jpeg' },
              ]
            : [],
        businessName,
        tradeLicense: customerType === 'Business' ? `TL-${padNum(2020000 + b * 111 + i, 7)}` : undefined,
        branch,
        status: INACTIVE[branch]?.includes(i) ? 'Inactive' : 'Active',
        kycStatus: kyc,
        kycRemarks: kyc === 'Rejected' ? 'NID photo does not match the applicant' : undefined,
        kycVerifiedBy: kyc === 'Verified' ? makers.manager : undefined,
        createdAt: ts(created, 9),
        createdBy: makers.cso,
      });
      audit(ts(created, 9), makers.cso, branch, 'CUSTOMER_CREATED', 'Customer', id, `Customer ${fullName} onboarded`);
    });
    const branchCustomers = customers.filter((c) => c.branch === branch);

    // deposits
    DEPOSIT_PLANS[branch].forEach((p) => {
      const cfg = DEPOSIT_PRODUCTS[p.product];
      const cust = branchCustomers[p.c];
      counters.deposit[branch]++;
      const accountNo = makeDepositNo(branch, cfg.shortCode, counters.deposit[branch]);
      const rate = cfg.rateFor(p.tenure);
      const status = p.status ?? 'Active';
      let maturityDate: string | undefined;
      let maturityAmount: number | undefined;
      if (p.tenure) {
        maturityDate = addMonths(p.open, p.tenure);
        if (p.product === 'FDR') maturityAmount = fdrMaturityAmount(p.amount, rate, p.tenure);
        if (p.product === 'DPS') maturityAmount = dpsMaturityAmount(p.amount, rate, p.tenure);
        if (p.product === 'MBS') maturityAmount = p.amount;
      }
      const linked = cfg.requiresLinkedAccount
        ? deposits.find((d) => d.customerId === cust.customerId && (d.product === 'SAVINGS' || d.product === 'CURRENT'))
        : undefined;
      const acct: DepositAccount = {
        accountNo,
        customerId: cust.customerId,
        customerName: cust.fullName,
        product: p.product,
        openingDate: p.open,
        initialDeposit: p.amount,
        interestRate: rate,
        tenureMonths: p.tenure,
        maturityDate,
        maturityAmount,
        nomineeName: cfg.requiresNominee ? cust.motherName : undefined,
        nomineeRelation: cfg.requiresNominee ? 'Mother' : undefined,
        nomineeShare: cfg.requiresNominee ? 100 : undefined,
        linkedAccountNo: linked?.accountNo,
        notes: [],
        balance: 0,
        branch,
        status,
        freezeReason: p.freezeReason,
        createdAt: ts(p.open, 11),
        createdBy: makers.cso,
        approvedBy: status === 'Pending Approval' ? undefined : makers.manager,
        approvedAt: status === 'Pending Approval' ? undefined : ts(p.open, 12),
        closedAt: p.closeOn ? ts(p.closeOn, 15) : undefined,
      };
      deposits.push(acct);
      audit(ts(p.open, 11), makers.cso, branch, 'DEPOSIT_ACCOUNT_CREATED', 'Deposit', accountNo, `${cfg.name} opened for ${cust.customerId}`);
      if (status === 'Pending Approval') return;
      audit(ts(p.open, 12), makers.manager, branch, 'DEPOSIT_ACCOUNT_APPROVED', 'Deposit', accountNo, 'Account approved and activated');

      const ev: Event[] = [{ date: p.open, type: 'Opening Deposit', description: 'Account opening deposit (cash)', amount: p.amount, side: 'CR', createdBy: makers.teller }];
      const end = p.closeOn ?? SEED_CUTOFF;
      if (p.product === 'SAVINGS' || p.product === 'CURRENT') {
        const scale = p.product === 'CURRENT' ? 10 : 1;
        for (let k = 1; ; k++) {
          const d = addDays(addMonths(p.open, k), randInt(0, 9));
          if (d > end) break;
          const roll = rand();
          if (roll < 0.55) ev.push({ date: d, type: 'Deposit', description: 'Cash deposit', amount: randInt(2, 40) * 500 * scale, side: 'CR', createdBy: makers.teller });
          else if (roll < 0.9) ev.push({ date: d, type: 'Withdrawal', description: 'Cash withdrawal', amount: randInt(1, 16) * 500 * scale, side: 'DR', createdBy: makers.teller });
        }
        if (p.product === 'SAVINGS') {
          for (const d of ['2024-06-30', '2024-12-31', '2025-06-30', '2025-12-31', '2026-06-30']) {
            if (d > p.open && d <= end) ev.push({ date: d, type: 'Interest Credit', description: 'Half-yearly interest credit @3.50%', amount: -1, side: 'CR', createdBy: 'SYSTEM' });
          }
        }
      }
      if (p.product === 'DPS') {
        for (let k = 1; ; k++) {
          const d = addMonths(p.open, k);
          if (d > end || k >= (p.tenure ?? 0)) break;
          ev.push({ date: d, type: 'Deposit', description: `DPS installment #${k + 1}`, amount: p.amount, side: 'CR', createdBy: makers.teller });
        }
      }
      if (p.product === 'MBS' && linked) {
        const profit = mbsMonthlyProfit(p.amount, rate);
        const linkedEv = depositEvents.get(linked.accountNo)!;
        for (let k = 1; ; k++) {
          const d = addMonths(p.open, k);
          if (d > end) break;
          linkedEv.push({ date: d, type: 'Profit Payout', description: `MBS monthly profit from ${accountNo}`, amount: profit, side: 'CR', createdBy: 'SYSTEM' });
        }
      }
      if (p.closeOn) ev.push({ date: p.closeOn, type: 'Withdrawal', description: 'Account closure - full balance withdrawal', amount: -2, side: 'DR', createdBy: makers.teller });
      depositEvents.set(accountNo, ev);
    });

    // loans
    LOAN_PLANS[branch].forEach((p) => {
      const cfg = LOAN_PRODUCTS[p.product];
      const cust = branchCustomers[p.c];
      counters.loan[branch]++;
      const loanAccountNo = makeLoanNo(branch, cfg.shortCode, counters.loan[branch]);
      const created = addDays(p.start, -7);
      const schedule = generateSchedule(p.amount, p.rate, p.tenure, p.freq, p.start);
      const loan: LoanAccount = {
        loanAccountNo,
        customerId: cust.customerId,
        customerName: cust.fullName,
        product: p.product,
        amount: p.amount,
        interestRate: p.rate,
        tenureMonths: p.tenure,
        startDate: p.start,
        frequency: p.freq,
        numberOfInstallments: numberOfInstallments(p.tenure, p.freq),
        installmentAmount: calculateInstallment(p.amount, p.rate, p.tenure, p.freq),
        maturityDate: schedule[schedule.length - 1].dueDate,
        purpose: p.purpose,
        collateral: LOAN_COLLATERAL[p.product] ?? [],
        insurance: p.product === 'HOME' || p.product === 'PERSONAL',
        documents: [],
        branch,
        status: p.status,
        outstandingPrincipal: 0,
        schedule: [],
        remarks: p.remarks,
        createdAt: ts(created, 13),
        createdBy: makers.loan,
      };
      loans.push(loan);
      audit(ts(created, 13), makers.loan, branch, 'LOAN_CREATED', 'Loan', loanAccountNo, `${cfg.name} application for ${cust.customerId}`);
      if (p.status === 'Rejected') {
        audit(ts(addDays(created, 2), 14), makers.manager, branch, 'LOAN_REJECTED', 'Loan', loanAccountNo, p.remarks ?? '');
        return;
      }
      if (p.status === 'Applied') return;
      loan.approvedBy = makers.manager === makers.loan ? 'admin' : makers.manager;
      loan.approvedAt = ts(addDays(created, 2), 14);
      audit(loan.approvedAt, loan.approvedBy, branch, 'LOAN_APPROVED', 'Loan', loanAccountNo, 'Loan approved');
      if (p.status === 'Approved') return;

      loan.schedule = schedule;
      loan.disbursedAt = ts(p.start, 11);
      audit(loan.disbursedAt, loan.approvedBy, branch, 'LOAN_DISBURSED', 'Loan', loanAccountNo, `Disbursed ${p.amount}`);
      const ev: Event[] = [{ date: p.start, type: 'Loan Disbursement', description: `${cfg.name} disbursement`, amount: p.amount, side: 'DR', createdBy: loan.approvedBy }];
      const due = schedule.filter((s) => p.status === 'Closed' || s.dueDate <= SEED_CUTOFF);
      const payable = due.slice(0, due.length - (p.unpaid ?? 0));
      for (const inst of payable) {
        inst.paid = true;
        inst.paidDate = inst.dueDate;
        ev.push({ date: inst.dueDate, type: 'Interest Charge', description: `Interest for installment #${inst.installmentNo}`, amount: inst.interest, side: 'DR', createdBy: 'SYSTEM' });
        ev.push({
          date: inst.dueDate,
          type: 'Installment Payment',
          description: `Installment #${inst.installmentNo} payment`,
          amount: inst.installmentAmount,
          side: 'CR',
          createdBy: makers.teller,
          onId: (id) => (inst.paymentTxnId = id),
        });
      }
      if (p.status === 'Closed') loan.closedAt = ts(schedule[schedule.length - 1].dueDate, 16);
      loanEvents.set(loanAccountNo, ev);
    });
  });

  // ---- turn events into transactions with running balances
  interface Draft {
    txn: Omit<Transaction, 'txnId' | 'seq'>;
    onId?: (id: string) => void;
  }
  const drafts: Draft[] = [];
  for (const acct of deposits) {
    const ev = depositEvents.get(acct.accountNo);
    if (!ev) continue;
    ev.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const minBal = DEPOSIT_PRODUCTS[acct.product].minBalance;
    let bal = 0;
    for (const e of ev) {
      let amount = e.amount;
      if (amount === -1) amount = round2((bal * acct.interestRate) / 200); // half-yearly interest
      if (amount === -2) amount = bal; // closure
      if (amount <= 0) continue;
      if (e.side === 'DR' && e.amount !== -2 && bal - amount < minBal) continue;
      bal = round2(e.side === 'CR' ? bal + amount : bal - amount);
      drafts.push({
        txn: {
          date: e.date,
          timestamp: ts(e.date, 12),
          accountNo: acct.accountNo,
          accountKind: 'DEPOSIT',
          customerId: acct.customerId,
          branch: acct.branch,
          type: e.type,
          description: e.description,
          debit: e.side === 'DR' ? amount : 0,
          credit: e.side === 'CR' ? amount : 0,
          balanceAfter: bal,
          status: 'Posted',
          createdBy: e.createdBy,
        },
      });
    }
    acct.balance = bal;
  }
  for (const loan of loans) {
    const ev = loanEvents.get(loan.loanAccountNo);
    if (!ev) continue;
    let bal = 0;
    for (const e of ev) {
      bal = round2(e.side === 'DR' ? bal + e.amount : bal - e.amount);
      drafts.push({
        txn: {
          date: e.date,
          timestamp: ts(e.date, e.type === 'Installment Payment' ? 12 : 11),
          accountNo: loan.loanAccountNo,
          accountKind: 'LOAN',
          customerId: loan.customerId,
          branch: loan.branch,
          type: e.type,
          description: e.description,
          debit: e.side === 'DR' ? e.amount : 0,
          credit: e.side === 'CR' ? e.amount : 0,
          balanceAfter: bal,
          status: 'Posted',
          createdBy: e.createdBy,
        },
        onId: e.onId,
      });
    }
    loan.outstandingPrincipal = Math.max(0, bal);
  }
  // stable sort by date keeps per-account order intact
  const ordered = drafts.map((d, i) => ({ d, i })).sort((a, b) => (a.d.txn.date < b.d.txn.date ? -1 : a.d.txn.date > b.d.txn.date ? 1 : a.i - b.i));
  const transactions: Transaction[] = ordered.map(({ d }) => {
    counters.txn++;
    const txnId = makeTxnId(d.txn.date, counters.txn);
    d.onId?.(txnId);
    return { ...d.txn, txnId, seq: counters.txn };
  });

  auditDraft.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
  const auditLogs: AuditLog[] = auditDraft.map((a) => {
    counters.audit++;
    return { ...a, id: makeAuditId(counters.audit) };
  });

  return {
    version: STATE_VERSION,
    users,
    customers: customers.sort(byCreatedDesc),
    deposits: deposits.sort(byCreatedDesc),
    loans: loans.sort(byCreatedDesc),
    transactions,
    auditLogs,
    counters,
  };
}

function byCreatedDesc(a: { createdAt: string }, b: { createdAt: string }) {
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

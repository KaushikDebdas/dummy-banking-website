import type { BranchCode, Role, User } from '../types';

export type Permission =
  | 'dashboard.view'
  | 'customer.view'
  | 'customer.create'
  | 'customer.edit'
  | 'customer.status'
  | 'kyc.verify'
  | 'deposit.view'
  | 'deposit.create'
  | 'deposit.approve'
  | 'deposit.freeze'
  | 'deposit.close'
  | 'deposit.maturity'
  | 'deposit.interest'
  | 'account.note'
  | 'loan.view'
  | 'loan.create'
  | 'loan.approve'
  | 'loan.disburse'
  | 'loan.writeoff'
  | 'schedule.view'
  | 'schedule.generate'
  | 'schedule.pay'
  | 'statement.view'
  | 'txn.view'
  | 'txn.post'
  | 'txn.approve'
  | 'txn.reverse'
  | 'report.view'
  | 'audit.view'
  | 'user.manage';

const VIEW_ALL: Permission[] = [
  'dashboard.view',
  'customer.view',
  'deposit.view',
  'loan.view',
  'schedule.view',
  'statement.view',
  'txn.view',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    ...VIEW_ALL,
    'customer.create',
    'customer.edit',
    'customer.status',
    'kyc.verify',
    'deposit.create',
    'deposit.approve',
    'deposit.freeze',
    'deposit.close',
    'deposit.maturity',
    'deposit.interest',
    'account.note',
    'loan.create',
    'loan.approve',
    'loan.disburse',
    'loan.writeoff',
    'schedule.generate',
    'schedule.pay',
    'txn.post',
    'txn.approve',
    'txn.reverse',
    'report.view',
    'audit.view',
    'user.manage',
  ],
  BRANCH_MANAGER: [
    ...VIEW_ALL,
    'customer.create',
    'customer.edit',
    'customer.status',
    'kyc.verify',
    'deposit.create',
    'deposit.approve',
    'deposit.freeze',
    'deposit.close',
    'deposit.maturity',
    'deposit.interest',
    'account.note',
    'loan.create',
    'loan.approve',
    'loan.disburse',
    'loan.writeoff',
    'schedule.generate',
    'txn.approve',
    'txn.reverse',
    'report.view',
    'audit.view',
  ],
  CSO: [...VIEW_ALL, 'customer.create', 'customer.edit', 'deposit.create', 'account.note'],
  LOAN_OFFICER: [...VIEW_ALL, 'loan.create', 'schedule.generate', 'schedule.pay', 'account.note'],
  TELLER: [...VIEW_ALL, 'txn.post', 'schedule.pay', 'account.note'],
  AUDITOR: [...VIEW_ALL, 'report.view', 'audit.view'],
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard.view': 'view the dashboard',
  'customer.view': 'view customers',
  'customer.create': 'create customers',
  'customer.edit': 'edit customers',
  'customer.status': 'activate or deactivate customers',
  'kyc.verify': 'verify customer KYC',
  'deposit.view': 'view deposit accounts',
  'deposit.create': 'open deposit accounts',
  'deposit.approve': 'approve deposit accounts',
  'deposit.freeze': 'freeze or unfreeze accounts',
  'deposit.close': 'close deposit accounts',
  'deposit.maturity': 'process deposit maturity',
  'deposit.interest': 'post interest',
  'account.note': 'add account notes',
  'loan.view': 'view loan accounts',
  'loan.create': 'create loan accounts',
  'loan.approve': 'approve loan accounts',
  'loan.disburse': 'disburse loans',
  'loan.writeoff': 'write off loans',
  'schedule.view': 'view repayment schedules',
  'schedule.generate': 'generate repayment schedules',
  'schedule.pay': 'collect loan installments',
  'statement.view': 'view account statements',
  'txn.view': 'view transactions',
  'txn.post': 'post teller transactions',
  'txn.approve': 'approve transactions',
  'txn.reverse': 'reverse transactions',
  'report.view': 'view reports',
  'audit.view': 'view audit logs',
  'user.manage': 'manage users',
};

export function can(user: User | null | undefined, perm: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(perm);
}

export function canAccessBranch(user: User | null | undefined, branch: BranchCode): boolean {
  if (!user) return false;
  return user.branch === 'ALL' || user.branch === branch;
}

export function permissionError(perm: Permission): string {
  return `Access denied: you do not have permission to ${PERMISSION_LABELS[perm]}.`;
}

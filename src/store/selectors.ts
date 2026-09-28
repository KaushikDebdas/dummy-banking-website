/** Branch-scoped read helpers. Every list in the UI goes through these. */
import { canAccessBranch } from '../auth/permissions';
import { round2 } from '../lib/format';
import type { BankState, Transaction, User } from '../types';

export const visibleCustomers = (s: BankState, u: User) => s.customers.filter((c) => canAccessBranch(u, c.branch));
export const visibleDeposits = (s: BankState, u: User) => s.deposits.filter((a) => canAccessBranch(u, a.branch));
export const visibleLoans = (s: BankState, u: User) => s.loans.filter((l) => canAccessBranch(u, l.branch));
export const visibleTransactions = (s: BankState, u: User) => s.transactions.filter((t) => canAccessBranch(u, t.branch));
export const visibleAudit = (s: BankState, u: User) =>
  u.branch === 'ALL' ? s.auditLogs : s.auditLogs.filter((a) => a.branch === u.branch || a.branch === 'ALL' && a.username === u.username);

const txnOrder = (a: Transaction, b: Transaction) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : a.seq - b.seq);

/** Posted + reversed transactions of one account in posting order. */
export function accountTransactions(s: BankState, accountNo: string): Transaction[] {
  return s.transactions.filter((t) => t.accountNo === accountNo && (t.status === 'Posted' || t.status === 'Reversed')).sort(txnOrder);
}

export interface Statement {
  rows: Transaction[];
  openingBalance: number;
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
}

export function buildStatement(s: BankState, accountNo: string, from: string, to: string): Statement {
  const all = accountTransactions(s, accountNo);
  let openingBalance = 0;
  let closingBalance = 0;
  const rows: Transaction[] = [];
  for (const t of all) {
    if (from && t.date < from) {
      openingBalance = t.balanceAfter;
      closingBalance = t.balanceAfter;
      continue;
    }
    if (to && t.date > to) continue;
    rows.push(t);
    closingBalance = t.balanceAfter;
  }
  return {
    rows,
    openingBalance,
    closingBalance,
    totalDebit: round2(rows.reduce((a, t) => a + t.debit, 0)),
    totalCredit: round2(rows.reduce((a, t) => a + t.credit, 0)),
  };
}

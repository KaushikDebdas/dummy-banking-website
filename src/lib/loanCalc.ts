import type { Installment, InstallmentStatus, RepaymentFrequency } from '../types';
import { addMonths, today } from './dates';
import { round2 } from './format';

export const FREQUENCY_MONTHS: Record<RepaymentFrequency, number> = {
  Monthly: 1,
  Quarterly: 3,
  'Half-Yearly': 6,
};

export function periodsPerYear(freq: RepaymentFrequency): number {
  return 12 / FREQUENCY_MONTHS[freq];
}

export function numberOfInstallments(tenureMonths: number, freq: RepaymentFrequency): number {
  return Math.floor(tenureMonths / FREQUENCY_MONTHS[freq]);
}

/**
 * Reducing-balance (annuity) installment:
 *   EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
 * where r = annual rate / 100 / periods-per-year and n = number of installments.
 * Rounded to 2 decimals.
 */
export function calculateInstallment(principal: number, annualRate: number, tenureMonths: number, freq: RepaymentFrequency): number {
  const n = numberOfInstallments(tenureMonths, freq);
  if (!(principal > 0) || !(n > 0)) return 0;
  const r = annualRate / 100 / periodsPerYear(freq);
  if (r === 0) return round2(principal / n);
  const f = Math.pow(1 + r, n);
  return round2((principal * r * f) / (f - 1));
}

/**
 * Builds the full amortisation schedule. Interest for each period is
 * round2(opening balance * r); principal = installment - interest.
 * The last installment absorbs rounding so the closing balance is exactly 0.
 */
export function generateSchedule(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  freq: RepaymentFrequency,
  startDate: string,
): Installment[] {
  const n = numberOfInstallments(tenureMonths, freq);
  const r = annualRate / 100 / periodsPerYear(freq);
  const emi = calculateInstallment(principal, annualRate, tenureMonths, freq);
  const step = FREQUENCY_MONTHS[freq];
  const rows: Installment[] = [];
  let opening = round2(principal);
  for (let i = 1; i <= n; i++) {
    const interest = round2(opening * r);
    let principalPart = round2(emi - interest);
    let amount = emi;
    if (i === n) {
      principalPart = opening;
      amount = round2(principalPart + interest);
    }
    const closing = round2(opening - principalPart);
    rows.push({
      installmentNo: i,
      dueDate: addMonths(startDate, i * step),
      openingPrincipal: opening,
      installmentAmount: amount,
      principal: principalPart,
      interest,
      closingPrincipal: closing,
      paid: false,
    });
    opening = closing;
  }
  return rows;
}

export function installmentStatus(inst: Installment, asOf: string = today()): InstallmentStatus {
  if (inst.paid) return 'Paid';
  return inst.dueDate < asOf ? 'Overdue' : 'Pending';
}

export function scheduleTotals(schedule: Installment[]) {
  const totalInterest = round2(schedule.reduce((s, i) => s + i.interest, 0));
  const totalRepayment = round2(schedule.reduce((s, i) => s + i.installmentAmount, 0));
  const paid = schedule.filter((i) => i.paid);
  const overdue = schedule.filter((i) => installmentStatus(i) === 'Overdue');
  return {
    totalInstallments: schedule.length,
    totalInterest,
    totalRepayment,
    paidCount: paid.length,
    paidAmount: round2(paid.reduce((s, i) => s + i.installmentAmount, 0)),
    overdueCount: overdue.length,
    overdueAmount: round2(overdue.reduce((s, i) => s + i.installmentAmount, 0)),
    nextDue: schedule.find((i) => !i.paid),
  };
}

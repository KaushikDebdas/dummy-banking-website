import { round2 } from './format';

/** FDR: simple interest for the tenure. maturity = P + P * rate * months / 1200 */
export function fdrMaturityAmount(principal: number, rate: number, months: number): number {
  return round2(principal + (principal * rate * months) / 1200);
}

/** DPS: recurring monthly deposit, simple interest on each installment for the months it stays deposited. */
export function dpsMaturityAmount(installment: number, rate: number, months: number): number {
  const principal = installment * months;
  const interest = (installment * rate * ((months * (months + 1)) / 2)) / 1200;
  return round2(principal + interest);
}

/** MBS: profit is paid monthly to the linked account; principal is returned at maturity. */
export function mbsMonthlyProfit(principal: number, rate: number): number {
  return round2((principal * rate) / 1200);
}

export function monthlySavingsInterest(balance: number, rate: number): number {
  return round2((balance * rate) / 1200);
}

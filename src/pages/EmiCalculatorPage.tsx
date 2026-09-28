import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, Field, PageHeader, SelectInput } from '../components/ui';
import { Accordion, InfoTip, RadioGroup, RangeField } from '../components/ui/advanced';
import { LOAN_PRODUCTS, LOAN_PRODUCT_LIST, REPAYMENT_FREQUENCIES } from '../data/reference';
import { today } from '../lib/dates';
import { money, round2 } from '../lib/format';
import { calculateInstallment, generateSchedule, numberOfInstallments } from '../lib/loanCalc';
import type { LoanProduct, RepaymentFrequency } from '../types';

/** Loan EMI calculator with synchronised sliders — no data is saved. */
export function EmiCalculatorPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<LoanProduct>('PERSONAL');
  const cfg = LOAN_PRODUCTS[product];
  const [amount, setAmount] = useState('500000');
  const [rate, setRate] = useState(String(cfg.defaultRate));
  const [tenure, setTenure] = useState('36');
  const [frequency, setFrequency] = useState<RepaymentFrequency>('Monthly');

  const amt = Number(amount) || 0;
  const r = Number(rate) || 0;
  const t = Number(tenure) || 0;
  const n = numberOfInstallments(t, frequency);
  const valid = amt > 0 && n > 0;
  const emi = valid ? calculateInstallment(amt, r, t, frequency) : 0;
  const schedule = valid ? generateSchedule(amt, r, t, frequency, today()) : [];
  const totalInterest = round2(schedule.reduce((s, i) => s + i.interest, 0));
  const totalPayable = round2(amt + totalInterest);
  const interestPct = totalPayable ? Math.round((totalInterest / totalPayable) * 100) : 0;
  const withinLimits = amt >= cfg.minAmount && amt <= cfg.maxAmount && r >= cfg.minRate && r <= cfg.maxRate && t >= cfg.minTenure && t <= cfg.maxTenure;

  const changeProduct = (p: LoanProduct) => {
    const c = LOAN_PRODUCTS[p];
    setProduct(p);
    setRate(String(c.defaultRate));
    setAmount(String(Math.min(Math.max(Number(amount) || c.minAmount, c.minAmount), c.maxAmount)));
    setTenure(String(Math.min(Math.max(Number(tenure) || c.minTenure, c.minTenure), c.maxTenure)));
  };

  return (
    <div data-testid="emi-calculator-page">
      <PageHeader title="Loan EMI Calculator" subtitle="Move the sliders or type values. The result updates instantly using the reducing-balance method." />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Loan Details" testId="emi-inputs-card">
          <div className="flex flex-col gap-5">
            <Field id="emi-product" label="Loan Product" hint={cfg.description}>
              <SelectInput id="emi-product" value={product} onChange={(e) => changeProduct(e.target.value as LoanProduct)} options={LOAN_PRODUCT_LIST.map((p) => ({ value: p.code, label: p.name }))} />
            </Field>
            <Field id="emi-amount" label="Loan Amount (BDT)">
              <RangeField id="emi-amount" value={amount} onChange={setAmount} min={cfg.minAmount} max={cfg.maxAmount} step={cfg.minAmount >= 100000 ? 50000 : 5000} />
            </Field>
            <Field id="emi-rate" label="Interest Rate (% p.a.)" labelExtra={<InfoTip id="emi-rate" text={`Allowed for ${cfg.name}: ${cfg.minRate}% - ${cfg.maxRate}%`} />}>
              <RangeField id="emi-rate" value={rate} onChange={setRate} min={cfg.minRate} max={cfg.maxRate} step={0.25} suffix="%" />
            </Field>
            <Field id="emi-tenure" label="Tenure (months)">
              <RangeField id="emi-tenure" value={tenure} onChange={setTenure} min={cfg.minTenure} max={cfg.maxTenure} step={1} suffix="months" />
            </Field>
            <RadioGroup id="emi-frequency" label="Repayment Frequency" value={frequency} onChange={(v) => setFrequency(v as RepaymentFrequency)} options={REPAYMENT_FREQUENCIES.map((f) => ({ value: f, label: f }))} />
          </div>
        </Card>

        <Card title="Result" testId="emi-result-card">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div className="col-span-2 rounded-lg bg-teal-50 p-4">
              <dt className="text-xs uppercase text-teal-800">{frequency} Installment</dt>
              <dd className="mt-1 text-3xl font-semibold text-teal-900" data-testid="emi-result-installment" data-value={emi}>
                {money(emi)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Number of Installments</dt>
              <dd className="font-semibold" data-testid="emi-result-count" data-value={n}>
                {n}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Last Payment</dt>
              <dd className="font-semibold" data-testid="emi-result-maturity">
                {schedule.at(-1)?.dueDate ?? '-'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Total Interest</dt>
              <dd className="font-semibold" data-testid="emi-result-interest" data-value={totalInterest}>
                {money(totalInterest)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Total Payable</dt>
              <dd className="font-semibold" data-testid="emi-result-total" data-value={totalPayable}>
                {money(totalPayable)}
              </dd>
            </div>
          </dl>
          <div className="mt-4" aria-label="Principal vs interest">
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-200" data-testid="emi-breakdown-bar" data-interest-percent={interestPct}>
              <div className="bg-teal-600" style={{ width: `${100 - interestPct}%` }} />
              <div className="bg-amber-400" style={{ width: `${interestPct}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-slate-600">
              <span>■ Principal {100 - interestPct}%</span>
              <span>■ Interest {interestPct}%</span>
            </div>
          </div>
          {!withinLimits && (
            <p className="mt-3 text-xs font-medium text-amber-700" data-testid="emi-limits-warning">
              Some values are outside the limits of {cfg.name}. The loan form will reject them.
            </p>
          )}
          {can('loan.create') && (
            <Button
              className="mt-4 w-full"
              testId="emi-apply-btn"
              disabled={!valid}
              onClick={() => navigate(`/loans/new?product=${product}&amount=${amt}&rate=${r}&tenure=${t}&frequency=${encodeURIComponent(frequency)}`)}
            >
              Apply for this Loan
            </Button>
          )}
        </Card>
      </div>

      <div className="mt-5">
        <Accordion
          id="emi-details"
          items={[
            {
              id: 'schedule',
              title: `Amortization schedule (${schedule.length} installments)`,
              content: (
                <div className="max-h-96 overflow-auto">
                  <table className="min-w-full text-sm" data-testid="emi-schedule-table">
                    <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-2 py-1 text-left">No</th>
                        <th className="px-2 py-1 text-left">Due Date</th>
                        <th className="px-2 py-1 text-right">Installment</th>
                        <th className="px-2 py-1 text-right">Principal</th>
                        <th className="px-2 py-1 text-right">Interest</th>
                        <th className="px-2 py-1 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedule.map((i) => (
                        <tr key={i.installmentNo} data-testid={`emi-row-${i.installmentNo}`} data-row-id={i.installmentNo}>
                          <td className="px-2 py-1">{i.installmentNo}</td>
                          <td className="px-2 py-1">{i.dueDate}</td>
                          <td className="px-2 py-1 text-right">{money(i.installmentAmount)}</td>
                          <td className="px-2 py-1 text-right">{money(i.principal)}</td>
                          <td className="px-2 py-1 text-right">{money(i.interest)}</td>
                          <td className="px-2 py-1 text-right">{money(i.closingPrincipal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ),
            },
            {
              id: 'formula',
              title: 'How is the installment calculated?',
              content: (
                <p>
                  EMI = P × r × (1 + r)<sup>n</sup> ÷ ((1 + r)<sup>n</sup> − 1), where P is the loan amount, r is the annual rate ÷ 100 ÷ installments per year, and n is the number of installments. Each
                  installment's interest is the opening balance × r; the rest reduces the principal.
                </p>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

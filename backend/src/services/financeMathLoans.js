import { getAccountBalance, isLiabilityAccount, tokyoTodayISO, yen } from './financeMath.js';

export function scenarioYen(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') {
    throw new RangeError('Enter a whole-yen amount.');
  }
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 999_999_999_999) {
    throw new RangeError('Enter a nonnegative whole-yen amount within the account limit.');
  }
  return yen(amount);
}

function aprValue(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 && result <= 1000 ? result : null;
}

export function getLiabilities(accounts, transactions, today = tokyoTodayISO()) {
  return accounts.filter(isLiabilityAccount).map((account) => {
    const details = account.ui_details ?? {};
    const payment = details.monthly_payment;
    return {
      id: account.id,
      name: account.name,
      kind: account.kind,
      balance: Math.max(0, getAccountBalance(account, transactions, today, accounts)),
      apr: aprValue(details.apr ?? details.annual_interest_rate ?? details.interest_rate),
      monthlyPayment: payment != null && String(payment).trim() && Number.isSafeInteger(Number(payment)) && Number(payment) >= 0
        ? Number(payment) : null,
    };
  });
}

function simulate(sorted, budget) {
  const debts = sorted.map((debt) => ({ ...debt }));
  const payoffOrder = [];
  let totalInterest = 0;
  for (let month = 1; month <= 1200; month += 1) {
    let remaining = budget;
    for (const debt of debts) {
      const interest = Math.round(debt.balance * debt.apr / 1200);
      totalInterest += interest;
      debt.balance += interest;
      const minimum = Math.min(debt.balance, debt.monthlyPayment);
      debt.balance -= minimum;
      remaining -= minimum;
      if (minimum > 0 && debt.balance === 0) payoffOrder.push(debt.name);
    }
    for (const debt of debts) {
      const extra = Math.min(debt.balance, remaining);
      debt.balance -= extra;
      remaining -= extra;
      if (extra > 0 && debt.balance === 0) payoffOrder.push(debt.name);
    }
    if (debts.every((debt) => debt.balance === 0)) return { months: month, totalInterest, payoffOrder };
    if (!Number.isSafeInteger(totalInterest)) break;
  }
  return { months: null, totalInterest: null, payoffOrder };
}

export function comparePayoff(liabilities, monthlyBudget, terms = {}) {
  const budget = scenarioYen(monthlyBudget);
  const debts = liabilities.filter(({ balance }) => balance > 0).map((debt) => {
    const assumed = terms[debt.id] ?? {};
    const apr = assumed.apr === undefined ? debt.apr : aprValue(assumed.apr);
    const monthlyPayment = assumed.monthlyPayment === undefined ? debt.monthlyPayment : scenarioYen(assumed.monthlyPayment);
    return { ...debt, apr, monthlyPayment };
  });
  if (!debts.length) throw new RangeError('There are no outstanding liability balances.');
  if (debts.some(({ apr, monthlyPayment }) => apr === null || monthlyPayment === null)) {
    throw new RangeError('Enter the APR and required monthly payment for each outstanding debt. Enter zero only if it applies.');
  }
  if (!budget || debts.reduce((sum, debt) => sum + debt.monthlyPayment, 0) > budget) {
    throw new RangeError('Enter a positive monthly payoff amount that covers all required payments.');
  }
  const avalanche = debts.toSorted((a, b) => b.apr - a.apr || a.balance - b.balance);
  const snowball = debts.toSorted((a, b) => a.balance - b.balance || b.apr - a.apr);
  return {
    avalanche: { priority: avalanche.map(({ name }) => name), ...simulate(avalanche, budget) },
    snowball: { priority: snowball.map(({ name }) => name), ...simulate(snowball, budget) },
  };
}

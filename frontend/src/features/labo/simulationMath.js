/**
 * ProMoney LA-BO Simulation Math Engine
 * Author / Lead: Suman
 */

export function simulatePayoff(debtList, strategy, extraMonthly) {
  if (!debtList || !debtList.length) {
    return { 
      months: 0, 
      totalPrincipal: 0,
      totalInterest: 0, 
      totalPaid: 0, 
      baselineInterest: 0, 
      baselineMonths: 0, 
      savedInterest: 0, 
      savedMonths: 0 
    };
  }

  // 1. Run Baseline (minimum payments only)
  const baseDebts = debtList.map((d) => ({
    ...d,
    balance: Number(d.balance),
    apr: Number(d.apr),
    minPayment: Number(d.minPayment)
  }));
  let baseMonths = 0;
  let baseInterest = 0;
  const maxIterations = 360;

  while (baseDebts.some((d) => d.balance > 1) && baseMonths < maxIterations) {
    baseMonths++;
    baseDebts.forEach((d) => {
      if (d.balance > 0) {
        const monthlyRate = (d.apr / 100) / 12;
        const interest = d.balance * monthlyRate;
        baseInterest += interest;
        d.balance += interest;
        const payment = Math.min(d.balance, Math.max(d.minPayment, interest + 1));
        d.balance = Math.max(0, d.balance - payment);
      }
    });
  }

  // 2. Accelerated Strategy (Snowball / Avalanche / Hardship + Extra Payment)
  const workingDebts = debtList.map((d) => ({
    ...d,
    balance: Number(d.balance),
    apr: strategy === 'hardship' ? Math.max(1, Number(d.apr) - 5) : Number(d.apr),
    minPayment: Number(d.minPayment)
  }));

  let stratMonths = 0;
  let stratInterest = 0;
  const initialTotalMin = debtList.reduce((acc, d) => acc + Number(d.minPayment), 0);
  const totalMonthlyBudget = initialTotalMin + Number(extraMonthly || 0);

  while (workingDebts.some((d) => d.balance > 1) && stratMonths < maxIterations) {
    stratMonths++;

    // Accrue interest
    workingDebts.forEach((d) => {
      if (d.balance > 0) {
        const monthlyRate = (d.apr / 100) / 12;
        const interest = d.balance * monthlyRate;
        stratInterest += interest;
        d.balance += interest;
      }
    });

    // Pay minimums
    let unallocatedCash = totalMonthlyBudget;
    workingDebts.forEach((d) => {
      if (d.balance > 0) {
        const payMin = Math.min(d.balance, d.minPayment);
        d.balance -= payMin;
        unallocatedCash -= payMin;
      }
    });

    // Strategy ordering
    const sorted = [...workingDebts].filter((d) => d.balance > 0.01);
    if (strategy === 'avalanche' || strategy === 'hardship') {
      sorted.sort((a, b) => b.apr - a.apr);
    } else {
      sorted.sort((a, b) => a.balance - b.balance);
    }

    // Direct surplus cash
    for (const target of sorted) {
      if (unallocatedCash <= 0) break;
      const ref = workingDebts.find((d) => d.id === target.id);
      if (ref && ref.balance > 0) {
        const extraToApply = Math.min(ref.balance, unallocatedCash);
        ref.balance -= extraToApply;
        unallocatedCash -= extraToApply;
      }
    }
  }

  const totalPrincipal = debtList.reduce((acc, d) => acc + Number(d.balance), 0);
  const savedInterest = Math.max(0, baseInterest - stratInterest);
  const savedMonths = Math.max(0, baseMonths - stratMonths);

  return {
    totalPrincipal,
    months: stratMonths,
    totalInterest: Math.round(stratInterest),
    totalPaid: Math.round(totalPrincipal + stratInterest),
    baselineMonths: baseMonths,
    baselineInterest: Math.round(baseInterest),
    savedInterest: Math.round(savedInterest),
    savedMonths
  };
}

export function calculateInvestment(monthly, annualRate, years) {
  const pmt = Number(monthly);
  const r = (Number(annualRate) / 100) / 12;
  const n = Number(years) * 12;
  if (pmt <= 0 || n <= 0) return { totalContributed: 0, futureValue: 0, interestEarned: 0 };

  const futureValue = r > 0 ? pmt * ((Math.pow(1 + r, n) - 1) / r) : pmt * n;
  const totalContributed = pmt * n;
  const interestEarned = Math.max(0, futureValue - totalContributed);
  return {
    totalContributed: Math.round(totalContributed),
    futureValue: Math.round(futureValue),
    interestEarned: Math.round(interestEarned)
  };
}

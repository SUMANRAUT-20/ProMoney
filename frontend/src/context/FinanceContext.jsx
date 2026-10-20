import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  initialAccounts,
  initialBills,
  initialBudgets,
  initialGoals,
  initialTransactions
} from '../data/initialData';

const FinanceContext = createContext(null);

function loadTheme() {
  try {
    const stored = localStorage.getItem('pm_theme_v2');
    const parsed = stored ? JSON.parse(stored) : 'light';
    return parsed === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Clean Shared State Provider
 *
 * Preserves theme mode (light/dark) and provides empty baseline state
 * collections without seeding or loading fabricated local demo records.
 */
export function FinanceProvider({ children }) {
  const [goals, setGoals] = useState(initialGoals);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [budgets, setBudgets] = useState(initialBudgets);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [bills, setBills] = useState(initialBills);
  const [theme, setTheme] = useState(loadTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('pm_theme_v2', JSON.stringify(theme));
    } catch {
      // Ignore storage quota errors
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      goals,
      setGoals,
      transactions,
      setTransactions,
      budgets,
      setBudgets,
      accounts,
      setAccounts,
      bills,
      setBills,
      theme,
      setTheme
    }),
    [goals, transactions, budgets, accounts, bills, theme]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const value = useContext(FinanceContext);
  if (!value) throw new Error('useFinance must be used inside FinanceProvider');
  return value;
}

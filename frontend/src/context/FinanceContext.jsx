import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { categories as defaultCategories, createDemoData } from "../data/initialData";

const FinanceContext = createContext(null);

const STORAGE_KEYS = {
  transactions: "pm_transactions_v1",
  accounts: "pm_accounts_v1",
  budgets: "pm_budgets_v1",
  bills: "pm_bills_v1",
  goals: "pm_goals_v1",
};

const CATEGORIES_KEY = "pm_categories_v1";

function isStorageEmpty() {
  try {
    return Object.values(STORAGE_KEYS).every((key) => localStorage.getItem(key) === null);
  } catch {
    return false;
  }
}

function loadCollection(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveCollection(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function loadTheme() {
  try {
    const stored = localStorage.getItem("pm_theme_v2");
    const parsed = stored ? JSON.parse(stored) : "light";
    return parsed === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function FinanceProvider({ children }) {
  const [seed] = useState(() => (isStorageEmpty() ? createDemoData() : null));

  const [goals, setGoals] = useState(() =>
    loadCollection(STORAGE_KEYS.goals, seed ? seed.goals : []),
  );
  const [transactions, setTransactions] = useState(() =>
    loadCollection(STORAGE_KEYS.transactions, seed ? seed.transactions : []),
  );
  const [budgets, setBudgets] = useState(() =>
    loadCollection(STORAGE_KEYS.budgets, seed ? seed.budgets : []),
  );
  const [accounts, setAccounts] = useState(() =>
    loadCollection(STORAGE_KEYS.accounts, seed ? seed.accounts : []),
  );
  const [bills, setBills] = useState(() =>
    loadCollection(STORAGE_KEYS.bills, seed ? seed.bills : []),
  );
  const [categories] = useState(() => {
    const loaded = loadCollection(CATEGORIES_KEY, defaultCategories);
    return loaded.length > 0 ? loaded : defaultCategories;
  });
  const [theme, setTheme] = useState(loadTheme);

  useEffect(() => saveCollection(STORAGE_KEYS.transactions, transactions), [transactions]);
  useEffect(() => saveCollection(STORAGE_KEYS.accounts, accounts), [accounts]);
  useEffect(() => saveCollection(STORAGE_KEYS.budgets, budgets), [budgets]);
  useEffect(() => saveCollection(STORAGE_KEYS.bills, bills), [bills]);
  useEffect(() => saveCollection(STORAGE_KEYS.goals, goals), [goals]);
  useEffect(() => saveCollection(CATEGORIES_KEY, categories), [categories]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("pm_theme_v2", JSON.stringify(theme));
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
      categories,
      theme,
      setTheme,
    }),
    [goals, transactions, budgets, accounts, bills, categories, theme],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const value = useContext(FinanceContext);
  if (!value) throw new Error("useFinance must be used inside FinanceProvider");
  return value;
}

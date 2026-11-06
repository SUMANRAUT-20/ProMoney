import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { categories as defaultCategories } from "../data/initialData";

const FinanceContext = createContext(null);

const STORAGE_KEYS = {
  transactions: "pm_transactions_v1",
  accounts: "pm_accounts_v1",
  budgets: "pm_budgets_v1",
  bills: "pm_bills_v1",
  goals: "pm_goals_v1",
};

const CATEGORIES_KEY = "pm_categories_v1";

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

export const DEFAULT_PREFERENCES = { currency: "JPY", date_format: "YYYY-MM-DD" };

function loadPreferences() {
  try {
    const stored = localStorage.getItem("pm_preferences_v1");
    const parsed = stored ? JSON.parse(stored) : {};
    return { ...DEFAULT_PREFERENCES, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function FinanceProvider({ children }) {
  // No demo seeding (removed 2026-11-06 at Arpan's request): a fresh
  // workspace starts EMPTY — ¥0 everywhere — instead of createDemoData's
  // invented balances/transactions. Collections still persist in
  // localStorage exactly as before. NOTE for reviewers: this is a
  // deliberate behavior change vs. main's demo seed.
  const [goals, setGoals] = useState(() => loadCollection(STORAGE_KEYS.goals, []));
  const [transactions, setTransactions] = useState(() =>
    loadCollection(STORAGE_KEYS.transactions, []),
  );
  const [budgets, setBudgets] = useState(() => loadCollection(STORAGE_KEYS.budgets, []));
  const [accounts, setAccounts] = useState(() => loadCollection(STORAGE_KEYS.accounts, []));
  const [bills, setBills] = useState(() => loadCollection(STORAGE_KEYS.bills, []));
  const [categories] = useState(() => {
    const loaded = loadCollection(CATEGORIES_KEY, defaultCategories);
    return loaded.length > 0 ? loaded : defaultCategories;
  });
  const [theme, setTheme] = useState(loadTheme);
  // Workspace preferences (currency + date format) for Settings — the
  // backend (/api/settings) is the per-user source of truth; this state
  // is the applied copy, cached locally so the UI is right on reload.
  const [preferences, setPreferencesState] = useState(loadPreferences);

  const setPreferences = (partial) => {
    setPreferencesState((prev) => {
      const next = { ...prev, ...partial };
      saveCollection("pm_preferences_v1", next);
      return next;
    });
  };

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
      preferences,
      setPreferences,
    }),
    [goals, transactions, budgets, accounts, bills, categories, theme, preferences],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const value = useContext(FinanceContext);
  if (!value) throw new Error("useFinance must be used inside FinanceProvider");
  return value;
}

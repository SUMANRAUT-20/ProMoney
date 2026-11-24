import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { categories as defaultCategories } from '../data/initialData';
import { apiClient } from '../services/api';
import { useAuth } from './AuthContext';

/**
 * FinanceProvider — Unified Backend API Data Layer (including Real Demo Account)
 *
 * - Every authenticated user (including the seeded Demo Account `demo@promoney.local`)
 *   reads and writes exclusively through the backend API (`/api/categories`,
 *   `/api/accounts`, `/api/transactions`, `/api/budgets`, `/api/bills`,
 *   `/api/goals`, `/api/settings`).
 * - The local-only demo data path is retired; `isDemo` remains true for the
 *   Demo Account so the "Sample data" banner and server-backed "Reset sample data"
 *   action (`POST /api/auth/demo-reset`) stay visible on every screen.
 */

const FinanceContext = createContext(null);

const LEGACY_KEYS = [
  'pm_transactions_v1',
  'pm_accounts_v1',
  'pm_budgets_v1',
  'pm_bills_v1',
  'pm_goals_v1',
  'pm_categories_v1',
  'pm_demo_accounts_v2',
  'pm_demo_transactions_v2',
  'pm_demo_budgets_v2',
  'pm_demo_bills_v2',
  'pm_demo_goals_v2',
];

function clearLegacyLocalStorage() {
  try {
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch {
    // Ignore storage errors
  }
}

function loadTheme() {
  try {
    const stored = localStorage.getItem('pm_theme_v2');
    const parsed = stored ? JSON.parse(stored) : 'light';
    return parsed === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

const DEFAULT_PREFERENCES = {
  currency: 'JPY',
  date_format: 'YYYY-MM-DD',
  budget_warning_percent: 20,
  minimum_buffer: 0,
  bill_reminder_days: 3,
  payday_day: 25,
  expected_monthly_income: null,
  card_schedules: {},
  warning_switches: { budget: true, pace: true, bills: true, goals: true },
};

function loadPreferences() {
  try {
    const stored = localStorage.getItem('pm_preferences_v1');
    const parsed = stored ? JSON.parse(stored) : {};
    return { ...DEFAULT_PREFERENCES, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function FinanceProvider({ children }) {
  const { user } = useAuth();
  const demoEmail = String(import.meta.env.DEMO_EMAIL || 'demo@promoney.local')
    .trim()
    .toLowerCase();
  const isDemo = Boolean(
    user?.is_demo || (user?.email && String(user.email).trim().toLowerCase() === demoEmail)
  );

  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [bills, setBills] = useState([]);
  const [goals, setGoals] = useState([]);
  const [categories, setCategories] = useState(defaultCategories);
  const [isLoadingData, setIsLoadingData] = useState(false);

  const [theme, setTheme] = useState(loadTheme);
  const [preferences, setPreferencesState] = useState(loadPreferences);

  const setPreferences = useCallback((partial) => {
    setPreferencesState((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem('pm_preferences_v1', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const refreshFinanceData = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      setTransactions([]);
      setBudgets([]);
      setBills([]);
      setGoals([]);
      setCategories(defaultCategories);
      return;
    }

    clearLegacyLocalStorage();
    setIsLoadingData(true);
    try {
      const [catsRes, accRes, txRes, budRes, billRes, goalRes] = await Promise.all([
        apiClient.getCategories(),
        apiClient.getAccounts(),
        apiClient.getTransactions(),
        apiClient.getBudgets(),
        apiClient.getBills(),
        apiClient.getGoals(),
      ]);
      setCategories(catsRes?.data?.length ? catsRes.data : defaultCategories);
      setAccounts(accRes?.data || []);
      setTransactions(txRes?.data || []);
      setBudgets(budRes?.data || []);
      setBills(billRes?.data || []);
      setGoals(goalRes?.data || []);
    } catch {
      // Keep current state if offline; views surface errors on write actions
    } finally {
      setIsLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    refreshFinanceData();
  }, [refreshFinanceData]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('pm_theme_v2', JSON.stringify(theme));
    } catch {
      // Ignore storage quota errors
    }
  }, [theme]);

  /** Constitution O2: Resets ONLY the Demo Account's data in TiDB back to canonical sample records. */
  const resetDemoData = useCallback(async () => {
    if (!isDemo) return;
    await apiClient.resetDemoData();
    await refreshFinanceData();
  }, [isDemo, refreshFinanceData]);

  // --- Accounts actions ---
  const addAccount = useCallback(async (values, uiDetails) => {
    const parentAccountId = values?.parent_account_id ?? uiDetails?.parent_account_id ?? null;
    const res = await apiClient.createAccount({
      ...values,
      parent_account_id: parentAccountId,
      ui_details: uiDetails,
    });
    setAccounts((cur) => [...cur, res.data]);
    return res.data;
  }, []);

  const editAccount = useCallback(async (id, values, uiDetails) => {
    const parentAccountId = values?.parent_account_id ?? uiDetails?.parent_account_id ?? null;
    const res = await apiClient.updateAccount(id, {
      ...values,
      parent_account_id: parentAccountId,
      ui_details: uiDetails,
    });
    setAccounts((cur) => cur.map((acc) => (String(acc.id) === String(id) ? res.data : acc)));
    return res.data;
  }, []);

  const removeAccount = useCallback(async (id) => {
    await apiClient.deleteAccount(id);
    setAccounts((cur) => cur.filter((a) => String(a.id) !== String(id)));
    return true;
  }, []);

  const saveCategory = useCallback(async ({ name, kind }, id = null) => {
    if (id === null) {
      const { data } = await apiClient.createCategory({ name, kind });
      setCategories((rows) => rows.some((row) => row.id === data.id) ? rows : [...rows, data]);
      return data;
    }

    const { data } = await apiClient.renameCategory(id, name);
    const hasCategory = (row) => String(row.category_id) === String(id);
    setCategories((rows) => rows.map((row) => row.id === data.id ? data : row));
    setTransactions((rows) => rows.map((row) => hasCategory(row) ? { ...row, category_name: data.name } : row));
    setBudgets((rows) => rows.map((row) => hasCategory(row) ? { ...row, category_name: data.name } : row));
    return data;
  }, []);

  const removeCategory = useCallback(async (id) => {
    await apiClient.deleteCategory(id);
    const hasCategory = (row) => String(row.category_id) === String(id);
    setCategories((rows) => rows.filter((row) => String(row.id) !== String(id)));
    setTransactions((rows) => rows.map((row) => hasCategory(row) ? { ...row, category_id: null, category_name: null } : row));
    setBudgets((rows) => rows.filter((row) => !hasCategory(row)));
  }, []);

  // --- Transactions actions ---
  const addTransaction = useCallback(async (payload) => {
    const res = await apiClient.createTransaction(payload);
    setTransactions((cur) => [res.data, ...cur]);
    return res.data;
  }, []);

  const editTransaction = useCallback(async (id, payload) => {
    const res = await apiClient.updateTransaction(id, payload);
    setTransactions((cur) => cur.map((t) => (String(t.id) === String(id) ? res.data : t)));
    return res.data;
  }, []);

  const removeTransaction = useCallback(async (id) => {
    await apiClient.deleteTransaction(id);
    setTransactions((cur) => cur.filter((t) => String(t.id) !== String(id)));
    return true;
  }, []);

  // --- Budgets actions ---
  const saveBudget = useCallback(async (payload, editingId = null) => {
    const res = editingId
      ? await apiClient.updateBudget(editingId, payload)
      : await apiClient.upsertBudget(payload);
    const saved = res.data;
    setBudgets((cur) => {
      const exists = cur.some((b) => String(b.id) === String(saved.id));
      return exists
        ? cur.map((b) => (String(b.id) === String(saved.id) ? saved : b))
        : [...cur, saved];
    });
    return saved;
  }, []);

  const removeBudget = useCallback(async (id) => {
    await apiClient.deleteBudget(id);
    setBudgets((cur) => cur.filter((b) => String(b.id) !== String(id)));
    return true;
  }, []);

  // --- Bills actions ---
  const addBill = useCallback(async (payload) => {
    const res = await apiClient.createBill(payload);
    setBills((cur) => [...cur, res.data]);
    return res.data;
  }, []);

  const editBill = useCallback(async (id, payload) => {
    const res = await apiClient.updateBill(id, payload);
    setBills((cur) => cur.map((b) => (String(b.id) === String(id) ? res.data : b)));
    return res.data;
  }, []);

  const toggleBillPaid = useCallback(async (id) => {
    const res = await apiClient.toggleBillPaid(id);
    setBills((cur) => cur.map((b) => (String(b.id) === String(id) ? res.data : b)));
  }, []);

  const advanceBillCycle = useCallback(async (bill) => {
    const res = await apiClient.advanceBillCycle(bill.id);
    setBills((cur) => cur.map((b) => (String(b.id) === String(bill.id) ? res.data : b)));
  }, []);

  const removeBill = useCallback(async (id) => {
    await apiClient.deleteBill(id);
    setBills((cur) => cur.filter((b) => String(b.id) !== String(id)));
    return true;
  }, []);

  // --- Goals actions ---
  const addGoal = useCallback(async (payload) => {
    const res = await apiClient.createGoal(payload);
    setGoals((cur) => [res.data, ...cur]);
    return res.data;
  }, []);

  const editGoal = useCallback(async (id, payload) => {
    const res = await apiClient.updateGoal(id, payload);
    setGoals((cur) => cur.map((g) => (String(g.id) === String(id) ? res.data : g)));
    return res.data;
  }, []);

  const contributeGoal = useCallback(async (id, amount) => {
    const res = await apiClient.contributeToGoal(id, { amount });
    setGoals((cur) => cur.map((g) => (String(g.id) === String(id) ? res.data : g)));
  }, []);

  const removeGoal = useCallback(async (id) => {
    await apiClient.deleteGoal(id);
    setGoals((cur) => cur.filter((g) => String(g.id) !== String(id)));
    return true;
  }, []);

  const value = useMemo(
    () => ({
      isDemo,
      isLoadingData,
      refreshFinanceData,
      resetDemoData,
      goals,
      setGoals,
      addGoal,
      editGoal,
      contributeGoal,
      removeGoal,
      transactions,
      setTransactions,
      addTransaction,
      editTransaction,
      removeTransaction,
      budgets,
      setBudgets,
      saveBudget,
      removeBudget,
      accounts,
      setAccounts,
      addAccount,
      editAccount,
      removeAccount,
      bills,
      setBills,
      addBill,
      editBill,
      toggleBillPaid,
      advanceBillCycle,
      removeBill,
      categories,
      saveCategory,
      removeCategory,
      theme,
      setTheme,
      preferences,
      setPreferences,
    }),
    [
      isDemo,
      isLoadingData,
      refreshFinanceData,
      resetDemoData,
      goals,
      addGoal,
      editGoal,
      contributeGoal,
      removeGoal,
      transactions,
      addTransaction,
      editTransaction,
      removeTransaction,
      budgets,
      saveBudget,
      removeBudget,
      accounts,
      addAccount,
      editAccount,
      removeAccount,
      bills,
      addBill,
      editBill,
      toggleBillPaid,
      advanceBillCycle,
      removeBill,
      categories,
      saveCategory,
      removeCategory,
      theme,
      preferences,
      setPreferences,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const value = useContext(FinanceContext);
  if (!value) throw new Error('useFinance must be used inside FinanceProvider');
  return value;
}

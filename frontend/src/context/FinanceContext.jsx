import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { categories as defaultCategories, createDemoData } from '../data/initialData';
import { apiClient } from '../services/api';
import { addMonthsISO, makeId } from '../utils/formatters';
import { useAuth } from './AuthContext';

/**
 * FinanceProvider — Phase 2 Layer 1 Engine (Step 2b & Constitution O1/O2)
 *
 * - Real authenticated users read and write exclusively through the backend
 *   API (/api/categories, /api/accounts, /api/transactions, /api/budgets,
 *   /api/bills, /api/goals). Money data is NEVER kept in localStorage for
 *   real users.
 * - Demo/seed data (createDemoData) is available ONLY when signed into the
 *   labelled Demo Account (isDemo === true), stored in isolated demo keys
 *   and resettable via resetDemoData() (Constitution O1 & O2).
 */

const FinanceContext = createContext(null);

const LEGACY_KEYS = [
  'pm_transactions_v1',
  'pm_accounts_v1',
  'pm_budgets_v1',
  'pm_bills_v1',
  'pm_goals_v1',
  'pm_categories_v1',
];

const DEMO_KEYS = {
  accounts: 'pm_demo_accounts_v2',
  transactions: 'pm_demo_transactions_v2',
  budgets: 'pm_demo_budgets_v2',
  bills: 'pm_demo_bills_v2',
  goals: 'pm_demo_goals_v2',
};

function clearLegacyLocalStorage() {
  try {
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch {
    // Ignore storage errors
  }
}

function loadDemoCollection(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveDemoCollection(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
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
  const isDemo = Boolean(
    user?.is_demo || (user?.email && String(user.email).toLowerCase().startsWith('demo@'))
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

    if (isDemo) {
      const seed = createDemoData();
      const loadedAccounts = loadDemoCollection(DEMO_KEYS.accounts, seed.accounts);
      const loadedTx = loadDemoCollection(DEMO_KEYS.transactions, seed.transactions);
      const loadedBudgets = loadDemoCollection(DEMO_KEYS.budgets, seed.budgets);
      const loadedBills = loadDemoCollection(DEMO_KEYS.bills, seed.bills);
      const loadedGoals = loadDemoCollection(DEMO_KEYS.goals, seed.goals);
      setAccounts(loadedAccounts);
      setTransactions(loadedTx);
      setBudgets(loadedBudgets);
      setBills(loadedBills);
      setGoals(loadedGoals);
      setCategories(defaultCategories);
      return;
    }

    // Real authenticated user: clean up legacy localStorage and load from API
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
  }, [user, isDemo]);

  useEffect(() => {
    refreshFinanceData();
  }, [refreshFinanceData]);

  // Persist demo changes only when in Demo Mode (Constitution O2)
  useEffect(() => {
    if (isDemo) saveDemoCollection(DEMO_KEYS.accounts, accounts);
  }, [isDemo, accounts]);
  useEffect(() => {
    if (isDemo) saveDemoCollection(DEMO_KEYS.transactions, transactions);
  }, [isDemo, transactions]);
  useEffect(() => {
    if (isDemo) saveDemoCollection(DEMO_KEYS.budgets, budgets);
  }, [isDemo, budgets]);
  useEffect(() => {
    if (isDemo) saveDemoCollection(DEMO_KEYS.bills, bills);
  }, [isDemo, bills]);
  useEffect(() => {
    if (isDemo) saveDemoCollection(DEMO_KEYS.goals, goals);
  }, [isDemo, goals]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('pm_theme_v2', JSON.stringify(theme));
    } catch {
      // Ignore storage quota errors
    }
  }, [theme]);

  /** Constitution O2: Resets ONLY demo data back to fresh sample records. */
  const resetDemoData = useCallback(() => {
    if (!isDemo) return;
    const seed = createDemoData();
    saveDemoCollection(DEMO_KEYS.accounts, seed.accounts);
    saveDemoCollection(DEMO_KEYS.transactions, seed.transactions);
    saveDemoCollection(DEMO_KEYS.budgets, seed.budgets);
    saveDemoCollection(DEMO_KEYS.bills, seed.bills);
    saveDemoCollection(DEMO_KEYS.goals, seed.goals);
    setAccounts(seed.accounts);
    setTransactions(seed.transactions);
    setBudgets(seed.budgets);
    setBills(seed.bills);
    setGoals(seed.goals);
  }, [isDemo]);

  // --- Accounts actions ---
  const addAccount = useCallback(
    async (values, uiDetails) => {
      if (isDemo) {
        const created = { ...values, id: makeId('acc'), currency: 'JPY', ui_details: uiDetails };
        setAccounts((cur) => [...cur, created]);
        return created;
      }
      const res = await apiClient.createAccount({ ...values, ui_details: uiDetails });
      setAccounts((cur) => [...cur, res.data]);
      return res.data;
    },
    [isDemo]
  );

  const editAccount = useCallback(
    async (id, values, uiDetails) => {
      if (isDemo) {
        let updated = null;
        setAccounts((cur) =>
          cur.map((acc) => {
            if (acc.id === id) {
              updated = { ...acc, ...values, ui_details: uiDetails };
              return updated;
            }
            return acc;
          })
        );
        return updated;
      }
      const res = await apiClient.updateAccount(id, { ...values, ui_details: uiDetails });
      setAccounts((cur) => cur.map((acc) => (String(acc.id) === String(id) ? res.data : acc)));
      return res.data;
    },
    [isDemo]
  );

  const removeAccount = useCallback(
    async (id) => {
      if (isDemo) {
        const hasTx = transactions.some(
          (tx) => String(tx.account_id) === String(id) || String(tx.to_account_id) === String(id)
        );
        if (hasTx) {
          throw new Error('Cannot delete an account that has linked transactions (Constitution L3)');
        }
        setAccounts((cur) => cur.filter((a) => a.id !== id));
        return true;
      }
      await apiClient.deleteAccount(id);
      setAccounts((cur) => cur.filter((a) => String(a.id) !== String(id)));
      return true;
    },
    [isDemo, transactions]
  );

  // --- Transactions actions ---
  const addTransaction = useCallback(
    async (payload) => {
      if (isDemo) {
        const created = { ...payload, id: payload.id ?? makeId('tx') };
        setTransactions((cur) => [created, ...cur]);
        return created;
      }
      const res = await apiClient.createTransaction(payload);
      setTransactions((cur) => [res.data, ...cur]);
      return res.data;
    },
    [isDemo]
  );

  const editTransaction = useCallback(
    async (id, payload) => {
      if (isDemo) {
        const next = { ...payload, id };
        setTransactions((cur) => cur.map((t) => (t.id === id ? next : t)));
        return next;
      }
      const res = await apiClient.updateTransaction(id, payload);
      setTransactions((cur) => cur.map((t) => (String(t.id) === String(id) ? res.data : t)));
      return res.data;
    },
    [isDemo]
  );

  const removeTransaction = useCallback(
    async (id) => {
      if (isDemo) {
        setTransactions((cur) => cur.filter((t) => t.id !== id));
        return true;
      }
      await apiClient.deleteTransaction(id);
      setTransactions((cur) => cur.filter((t) => String(t.id) !== String(id)));
      return true;
    },
    [isDemo]
  );

  // --- Budgets actions ---
  const saveBudget = useCallback(
    async (payload, editingId = null) => {
      if (isDemo) {
        const next = { ...payload, id: editingId ?? makeId('budget') };
        setBudgets((cur) =>
          editingId ? cur.map((b) => (b.id === editingId ? next : b)) : [...cur, next]
        );
        return next;
      }
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
    },
    [isDemo]
  );

  const removeBudget = useCallback(
    async (id) => {
      if (isDemo) {
        setBudgets((cur) => cur.filter((b) => b.id !== id));
        return true;
      }
      await apiClient.deleteBudget(id);
      setBudgets((cur) => cur.filter((b) => String(b.id) !== String(id)));
      return true;
    },
    [isDemo]
  );

  // --- Bills actions ---
  const addBill = useCallback(
    async (payload) => {
      if (isDemo) {
        const created = { ...payload, id: makeId('bill') };
        setBills((cur) => [...cur, created]);
        return created;
      }
      const res = await apiClient.createBill(payload);
      setBills((cur) => [...cur, res.data]);
      return res.data;
    },
    [isDemo]
  );

  const editBill = useCallback(
    async (id, payload) => {
      if (isDemo) {
        const next = { ...payload, id };
        setBills((cur) => cur.map((b) => (b.id === id ? next : b)));
        return next;
      }
      const res = await apiClient.updateBill(id, payload);
      setBills((cur) => cur.map((b) => (String(b.id) === String(id) ? res.data : b)));
      return res.data;
    },
    [isDemo]
  );

  const toggleBillPaid = useCallback(
    async (id) => {
      if (isDemo) {
        setBills((cur) => cur.map((b) => (b.id === id ? { ...b, is_paid: !b.is_paid } : b)));
        return;
      }
      const res = await apiClient.toggleBillPaid(id);
      setBills((cur) => cur.map((b) => (String(b.id) === String(id) ? res.data : b)));
    },
    [isDemo]
  );

  const advanceBillCycle = useCallback(
    async (bill) => {
      if (isDemo) {
        const months = bill.frequency === 'yearly' ? 12 : 1;
        setBills((cur) =>
          cur.map((b) =>
            b.id === bill.id ? { ...b, due_date: addMonthsISO(b.due_date, months), is_paid: false } : b
          )
        );
        return;
      }
      const res = await apiClient.advanceBillCycle(bill.id);
      setBills((cur) => cur.map((b) => (String(b.id) === String(bill.id) ? res.data : b)));
    },
    [isDemo]
  );

  const removeBill = useCallback(
    async (id) => {
      if (isDemo) {
        setBills((cur) => cur.filter((b) => b.id !== id));
        return true;
      }
      await apiClient.deleteBill(id);
      setBills((cur) => cur.filter((b) => String(b.id) !== String(id)));
      return true;
    },
    [isDemo]
  );

  // --- Goals actions ---
  const addGoal = useCallback(
    async (payload) => {
      if (isDemo) {
        const created = { ...payload, id: makeId('goal') };
        setGoals((cur) => [...cur, created]);
        return created;
      }
      const res = await apiClient.createGoal(payload);
      setGoals((cur) => [res.data, ...cur]);
      return res.data;
    },
    [isDemo]
  );

  const editGoal = useCallback(
    async (id, payload) => {
      if (isDemo) {
        const next = { ...payload, id };
        setGoals((cur) => cur.map((g) => (g.id === id ? next : g)));
        return next;
      }
      const res = await apiClient.updateGoal(id, payload);
      setGoals((cur) => cur.map((g) => (String(g.id) === String(id) ? res.data : g)));
      return res.data;
    },
    [isDemo]
  );

  const contributeGoal = useCallback(
    async (id, amount) => {
      if (isDemo) {
        setGoals((cur) =>
          cur.map((g) =>
            g.id === id ? { ...g, saved_amount: Math.min(g.target_amount, g.saved_amount + amount) } : g
          )
        );
        return;
      }
      const res = await apiClient.contributeToGoal(id, { amount });
      setGoals((cur) => cur.map((g) => (String(g.id) === String(id) ? res.data : g)));
    },
    [isDemo]
  );

  const removeGoal = useCallback(
    async (id) => {
      if (isDemo) {
        setGoals((cur) => cur.filter((g) => g.id !== id));
        return true;
      }
      await apiClient.deleteGoal(id);
      setGoals((cur) => cur.filter((g) => String(g.id) !== String(id)));
      return true;
    },
    [isDemo]
  );

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

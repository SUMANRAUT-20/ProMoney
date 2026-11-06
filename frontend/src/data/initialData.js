import { addDaysISO, addMonthsISO, prevMonthISO, todayISO } from "../utils/formatters.js";

export const initialGoals = [];
export const initialTransactions = [];
export const initialBudgets = [];
export const initialAccounts = [];
export const initialBills = [];
export const monthlyHistory = [];

export const categories = [
  { id: "part-time-salary", name: "Part-time Salary", kind: "income" },
  { id: "salary", name: "Salary", kind: "income" },
  { id: "freelance", name: "Freelance", kind: "income" },
  { id: "allowance", name: "Allowance", kind: "income" },
  { id: "other-income", name: "Other Income", kind: "income" },
  { id: "housing", name: "Housing", kind: "expense" },
  { id: "groceries", name: "Groceries", kind: "expense" },
  { id: "food-dining", name: "Food & Dining", kind: "expense" },
  { id: "transportation", name: "Transportation", kind: "expense" },
  { id: "utilities", name: "Utilities", kind: "expense" },
  { id: "phone-internet", name: "Phone & Internet", kind: "expense" },
  { id: "education", name: "Education", kind: "expense" },
  { id: "shopping", name: "Shopping", kind: "expense" },
  { id: "healthcare", name: "Healthcare", kind: "expense" },
  { id: "entertainment", name: "Entertainment", kind: "expense" },
  { id: "other-expense", name: "Other Expense", kind: "expense" },
];

export const expenseCategories = categories
  .filter((category) => category.kind === "expense")
  .map((category) => category.name);

export const incomeCategories = categories
  .filter((category) => category.kind === "income")
  .map((category) => category.name);

const padDay = (month, day) => `${month}-${String(day).padStart(2, "0")}`;

/**
 * Generates clearly-fake JPY sample data for first load when localStorage is empty.
 */
export function createDemoData(now = new Date()) {
  const today = todayISO(now);
  const m0 = today.slice(0, 7);
  const m1 = prevMonthISO(m0, -1);
  const m2 = prevMonthISO(m0, -2);
  const curDay = Number(today.slice(8, 10));
  const safeDay = (d) => padDay(m0, Math.max(1, Math.min(curDay, d)));

  const accounts = [
    {
      id: "demo-acc-bank",
      name: "Sample Student Bank",
      kind: "bank",
      manual_balance: 180000,
      currency: "JPY",
      ui_details: { group: "bank", provider: "Japan Post Bank", note: "Sample main bank account" },
    },
    {
      id: "demo-acc-cash",
      name: "Sample Wallet & IC",
      kind: "cash",
      manual_balance: 15000,
      currency: "JPY",
      ui_details: { group: "cash", provider: "", note: "Sample daily cash" },
    },
  ];

  const transactions = [
    { id: "demo-tx-1", kind: "income", amount: 115000, category_id: "part-time-salary", category_name: "Part-time Salary", account_id: "demo-acc-bank", transaction_date: padDay(m2, 25), note: "Sample konbini part-time pay" },
    { id: "demo-tx-2", kind: "expense", amount: 48000, category_id: "housing", category_name: "Housing", account_id: "demo-acc-bank", transaction_date: padDay(m2, 27), note: "Sample student apartment rent" },
    { id: "demo-tx-3", kind: "expense", amount: 22000, category_id: "groceries", category_name: "Groceries", account_id: "demo-acc-cash", transaction_date: padDay(m2, 28), note: "Sample supermarket groceries" },
    { id: "demo-tx-4", kind: "expense", amount: 6500, category_id: "transportation", category_name: "Transportation", account_id: "demo-acc-cash", transaction_date: padDay(m2, 28), note: "Sample commuter train pass" },
    { id: "demo-tx-5", kind: "income", amount: 122000, category_id: "part-time-salary", category_name: "Part-time Salary", account_id: "demo-acc-bank", transaction_date: padDay(m1, 25), note: "Sample cafe part-time pay" },
    { id: "demo-tx-6", kind: "expense", amount: 48000, category_id: "housing", category_name: "Housing", account_id: "demo-acc-bank", transaction_date: padDay(m1, 26), note: "Sample student apartment rent" },
    { id: "demo-tx-7", kind: "expense", amount: 24500, category_id: "groceries", category_name: "Groceries", account_id: "demo-acc-cash", transaction_date: padDay(m1, 27), note: "Sample monthly groceries" },
    { id: "demo-tx-8", kind: "expense", amount: 5800, category_id: "transportation", category_name: "Transportation", account_id: "demo-acc-cash", transaction_date: padDay(m1, 28), note: "Sample train IC recharge" },
    { id: "demo-tx-9", kind: "income", amount: 128000, category_id: "part-time-salary", category_name: "Part-time Salary", account_id: "demo-acc-bank", transaction_date: safeDay(1), note: "Sample part-time salary" },
    { id: "demo-tx-10", kind: "expense", amount: 48000, category_id: "housing", category_name: "Housing", account_id: "demo-acc-bank", transaction_date: safeDay(2), note: "Sample student apartment rent" },
    { id: "demo-tx-11", kind: "expense", amount: 8400, category_id: "groceries", category_name: "Groceries", account_id: "demo-acc-cash", transaction_date: safeDay(3), note: "Sample supermarket food" },
    { id: "demo-tx-12", kind: "expense", amount: 1850, category_id: "food-dining", category_name: "Food & Dining", account_id: "demo-acc-cash", transaction_date: safeDay(4), note: "Sample campus cafeteria lunch" },
    { id: "demo-tx-13", kind: "expense", amount: 3200, category_id: "transportation", category_name: "Transportation", account_id: "demo-acc-cash", transaction_date: safeDay(5), note: "Sample train IC top-up" },
  ];

  const bills = [
    { id: "demo-bill-1", name: "Sample Electricity & Gas", amount: 7200, due_date: addDaysISO(today, 3), frequency: "monthly", category: "Utilities", notes: "Sample utility bill", is_paid: false },
    { id: "demo-bill-2", name: "Sample Mobile & Fiber", amount: 3980, due_date: addDaysISO(today, 12), frequency: "monthly", category: "Phone & Internet", notes: "Sample student carrier plan", is_paid: false },
    { id: "demo-bill-3", name: "Sample Music Student Plan", amount: 580, due_date: safeDay(2), frequency: "monthly", category: "Entertainment", notes: "Sample monthly subscription", is_paid: true },
  ];

  const budgets = [
    { id: "demo-budget-1", category_id: "groceries", category_name: "Groceries", budget_month: m0, amount_limit: 25000 },
  ];

  const goals = [
    { id: "demo-goal-1", title: "Sample Graduation Laptop Fund", target_amount: 180000, saved_amount: 65000, monthly_plan: 20000, target_date: addMonthsISO(today, 6) },
  ];

  return { accounts, transactions, bills, budgets, goals };
}

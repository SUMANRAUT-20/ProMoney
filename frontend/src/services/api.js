/**
 * ProMoney Frontend API Service Layer
 * Joint Owners: Arpan Khatiwada & Suman Raut
 *
 * Centralized HTTP client for communicating with the Express backend (/api/*).
 * All request and response JSON bodies use snake_case field names.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('pm_auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && token !== 'demo-session' ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const apiClient = {
  async getHealth() {
    try {
      return await request('/health', { method: 'GET' });
    } catch {
      return { status: 'offline', message: 'Backend unreachable' };
    }
  },

  // Authentication
  async register(body) {
    return request('/auth/register', { method: 'POST', body: JSON.stringify(body) });
  },

  async login(body) {
    return request('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },

  async getMe() {
    return request('/auth/me', { method: 'GET' });
  },

  async googleAuth(body) {
    return request('/auth/google', { method: 'POST', body: JSON.stringify(body) });
  },

  // ProMoney LA-BO
  async laboChat(body) {
    return request('/labo/chat', { method: 'POST', body: JSON.stringify(body) });
  },

  async laboParse(body) {
    return request('/labo/parse', { method: 'POST', body: JSON.stringify(body) });
  },

  // Settings & Preferences (SQL-persisted)
  async getSettings() {
    return request('/settings', { method: 'GET' });
  },

  async updatePreferences(body) {
    return request('/settings/preferences', { method: 'PUT', body: JSON.stringify(body) });
  },

  async updateProfile(body) {
    return request('/settings/profile', { method: 'PUT', body: JSON.stringify(body) });
  },

  async changePassword(body) {
    return request('/settings/password', { method: 'PUT', body: JSON.stringify(body) });
  },

  async updateAvatar(body) {
    return request('/settings/avatar', { method: 'PUT', body: JSON.stringify(body) });
  },

  // Categories
  async getCategories() {
    return request('/categories', { method: 'GET' });
  },

  async createCategory(body) {
    return request('/categories', { method: 'POST', body: JSON.stringify(body) });
  },

  // Accounts
  async getAccounts() {
    return request('/accounts', { method: 'GET' });
  },

  async createAccount(body) {
    return request('/accounts', { method: 'POST', body: JSON.stringify(body) });
  },

  async updateAccount(id, body) {
    return request(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },

  async deleteAccount(id) {
    return request(`/accounts/${id}`, { method: 'DELETE' });
  },

  // Transactions
  async getTransactions(queryString = '') {
    return request(`/transactions${queryString ? `?${queryString}` : ''}`, { method: 'GET' });
  },

  async createTransaction(body) {
    return request('/transactions', { method: 'POST', body: JSON.stringify(body) });
  },

  async updateTransaction(id, body) {
    return request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },

  async deleteTransaction(id) {
    return request(`/transactions/${id}`, { method: 'DELETE' });
  },

  // Budgets
  async getBudgets(month = '') {
    return request(`/budgets${month ? `?month=${encodeURIComponent(month)}` : ''}`, { method: 'GET' });
  },

  async upsertBudget(body) {
    return request('/budgets', { method: 'POST', body: JSON.stringify(body) });
  },

  async updateBudget(id, body) {
    return request(`/budgets/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },

  async deleteBudget(id) {
    return request(`/budgets/${id}`, { method: 'DELETE' });
  },

  // Goals
  async getGoals() {
    return request('/goals', { method: 'GET' });
  },

  async createGoal(body) {
    return request('/goals', { method: 'POST', body: JSON.stringify(body) });
  },

  async updateGoal(id, body) {
    return request(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },

  async contributeToGoal(id, body) {
    return request(`/goals/${id}/contribute`, { method: 'PATCH', body: JSON.stringify(body) });
  },

  async withdrawFromGoal(id, body) {
    return request(`/goals/${id}/withdraw`, { method: 'PATCH', body: JSON.stringify(body) });
  },

  async deleteGoal(id) {
    return request(`/goals/${id}`, { method: 'DELETE' });
  },

  // Bills
  async getBills() {
    return request('/bills', { method: 'GET' });
  },

  async createBill(body) {
    return request('/bills', { method: 'POST', body: JSON.stringify(body) });
  },

  async updateBill(id, body) {
    return request(`/bills/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  },

  async toggleBillPaid(id) {
    return request(`/bills/${id}/toggle-paid`, { method: 'PATCH' });
  },

  async advanceBillCycle(id) {
    return request(`/bills/${id}/advance-cycle`, { method: 'PATCH' });
  },

  async deleteBill(id) {
    return request(`/bills/${id}`, { method: 'DELETE' });
  },
};

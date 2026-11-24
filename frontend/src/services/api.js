/**
 * ProMoney Frontend API Service Layer
 * Joint Owners: Arpan Khatiwada & Suman Raut (Phase 3 Security Hardening)
 *
 * Centralized HTTP client for communicating with the Express backend (/api/*).
 * Session authentication uses the `pm_session` httpOnly cookie via
 * `credentials: 'include'` — the frontend never stores a token in localStorage.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}, responseType = 'json') {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (response.ok && responseType === 'blob') return response.blob();
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

  // Authentication (httpOnly cookie session + revocation)
  async register(body) {
    return request('/auth/register', { method: 'POST', body: JSON.stringify(body) });
  },

  async login(body) {
    return request('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },

  async logout() {
    return request('/auth/logout', { method: 'POST' });
  },

  async logoutAll() {
    return request('/auth/logout-all', { method: 'POST' });
  },

  async resetDemoData() {
    return request('/auth/demo-reset', { method: 'POST' });
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

  async previewLaboAction(text) {
    return request('/labo/actions/preview', { method: 'POST', body: JSON.stringify({ text }) });
  },
  async previewNidhiMemory(question, answer) {
    return request('/labo/memory/preview', { method: 'POST', body: JSON.stringify({ question, answer }) });
  },
  async laboReportExport(body) {
    return request('/labo/report/export', { method: 'POST', body: JSON.stringify(body) }, 'blob');
  },
  async laboWhatIf(body) {
    return request('/labo/what-if', { method: 'POST', body: JSON.stringify(body) });
  },
  async getLoans() {
    return request('/labo/loans');
  },
  async calculateLoanPayoff(body) {
    return request('/labo/loans', { method: 'POST', body: JSON.stringify(body) });
  },

  async laboParse(body) {
    return request('/labo/parse', { method: 'POST', body: JSON.stringify(body) });
  },

  async laboScan(body) {
    return request('/labo/scan', { method: 'POST', body: JSON.stringify(body) });
  },
  async laboImport(file, format) {
    return request('/labo/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Statement-Format': format },
      body: file,
      signal: AbortSignal.timeout(120_000),
    });
  },

  // Settings & Preferences (SQL-persisted)
  async getSettings() {
    return request('/settings', { method: 'GET' });
  },

  async getNidhiMemory() {
    return request('/settings/memory');
  },

  async saveNidhiMemory(patch) {
    return request('/settings/memory', { method: 'PATCH', body: JSON.stringify({ patch }) });
  },

  async forgetNidhiMemory(entry = null) {
    const suffix = entry ? `/${encodeURIComponent(entry.section)}/${encodeURIComponent(entry.key)}` : '';
    return request(`/settings/memory${suffix}`, { method: 'DELETE' });
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

  async renameCategory(id, name) {
    return request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
  },

  async deleteCategory(id) {
    return request(`/categories/${id}`, { method: 'DELETE' });
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

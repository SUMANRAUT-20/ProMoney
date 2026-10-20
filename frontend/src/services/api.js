/**
 * ProMoney Frontend API Service Layer
 * Joint Owners: Arpan Khatiwada & Suman Raut
 *
 * Centralized HTTP client for communicating with the Express backend (/api/*).
 * All request and response JSON bodies use snake_case field names per
 * docs/INTEGRATION_CONTRACT.md.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('pm_auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
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

  // Phase 1: Authentication (Renuka + Arpan/Suman)
  async register(body) {
    return request('/auth/register', { method: 'POST', body: JSON.stringify(body) });
  },

  async login(body) {
    return request('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },

  // Phase 2: Transactions & Accounts (Rajesh + Arpan/Suman)
  async getTransactions(queryString = '') {
    return request(`/transactions${queryString ? `?${queryString}` : ''}`, { method: 'GET' });
  },

  async createTransaction(body) {
    return request('/transactions', { method: 'POST', body: JSON.stringify(body) });
  },

  async deleteTransaction(id) {
    return request(`/transactions/${id}`, { method: 'DELETE' });
  },

  async getAccounts() {
    return request('/accounts', { method: 'GET' });
  },

  // Phase 3: Budgets, Bills & Goals (Roshan + Arpan/Suman)
  async getBudgets(month = '') {
    return request(`/budgets${month ? `?month=${encodeURIComponent(month)}` : ''}`, { method: 'GET' });
  },

  async getGoals() {
    return request('/goals', { method: 'GET' });
  }
};

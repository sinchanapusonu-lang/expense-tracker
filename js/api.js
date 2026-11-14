/**
 * ClearLedger API Client
 * Centralized fetch() communication with Node.js Express backend.
 */

// If opened via file:// protocol in browser, fallback to default backend port 3000
const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr) {
    throw new Error(`Unable to connect to the backend server. Please ensure the server is running on port 3000. (${netErr.message})`);
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Server responded with HTTP ${response.status}`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  async getHealth() {
    return request('/api/health');
  },

  async getTransactions() {
    const res = await request('/api/transactions');
    return res.data || [];
  },

  async getTransaction(id) {
    const res = await request(`/api/transactions/${id}`);
    return res.data;
  },

  async createTransaction(payload) {
    const res = await request('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async updateTransaction(id, payload) {
    const res = await request(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async deleteTransaction(id) {
    const res = await request(`/api/transactions/${id}`, {
      method: 'DELETE',
    });
    return res.data;
  },

  async getBudget(year, month) {
    try {
      const res = await request(`/api/budgets/${year}/${month}`);
      return res.data;
    } catch (err) {
      if (err.status === 404) {
        return null;
      }
      throw err;
    }
  },

  async createBudget(payload) {
    const res = await request('/api/budgets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async updateBudget(id, payload) {
    const res = await request(`/api/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async saveBudgetForMonth(year, month, amount) {
    const existing = await this.getBudget(year, month);
    if (existing && existing.id) {
      return this.updateBudget(existing.id, { year, month, amount });
    } else {
      return this.createBudget({ year, month, amount });
    }
  },

  async getGoals() {
    const res = await request('/api/goals');
    return res.data || [];
  },

  async getGoal(id) {
    const res = await request(`/api/goals/${id}`);
    return res.data;
  },

  async createGoal(payload) {
    const res = await request('/api/goals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async updateGoal(id, payload) {
    const res = await request(`/api/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.data;
  },

  async contributeToGoal(id, amount) {
    const res = await request(`/api/goals/${id}/contribute`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
    return res;
  },

  async deleteGoal(id) {
    const res = await request(`/api/goals/${id}`, {
      method: 'DELETE',
    });
    return res.data;
  },
};

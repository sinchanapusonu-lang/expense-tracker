/**
 * Centralized Data Access Layer (LocalStorage)
 * Designed as an isolated repository interface so future REST API calls
 * (Node.js / Express / SQL) can replace LocalStorage without UI changes.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'clearledger_transactions_v1',
  BUDGET: 'clearledger_budget_v1',
  INITIALIZED: 'clearledger_initialized_v1',
};

const DEFAULT_BUDGET = {
  monthlyLimit: 3500,
  updatedAt: new Date().toISOString(),
};

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function shiftMonthDate(baseDate, monthsOffset, dayOfMonth) {
  const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthsOffset, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(dayOfMonth, maxDay);
  return `${target.getFullYear()}-${pad2(target.getMonth() + 1)}-${pad2(safeDay)}`;
}

function buildSampleTransactions() {
  const now = new Date();
  const todayDay = Math.min(now.getDate(), 28);

  return [
    {
      id: generateId(),
      title: 'Monthly Salary Deposit',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: shiftMonthDate(now, 0, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: shiftMonthDate(now, 0, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Grocery Shopping',
      amount: 184.5,
      category: 'Food',
      type: 'expense',
      date: shiftMonthDate(now, 0, Math.max(3, todayDay - 3)),
      description: 'Weekly produce and pantry essentials',
    },
    {
      id: generateId(),
      title: 'Electric & Internet Bill',
      amount: 142.8,
      category: 'Utilities',
      type: 'expense',
      date: shiftMonthDate(now, 0, Math.max(4, todayDay - 2)),
      description: 'Monthly power and fiber internet',
    },
    {
      id: generateId(),
      title: 'UI Design Retainer',
      amount: 850,
      category: 'Freelance',
      type: 'income',
      date: shiftMonthDate(now, 0, Math.max(5, todayDay - 1)),
      description: 'Client sprint milestone payment',
    },
    {
      id: generateId(),
      title: 'Metro Pass & Fuel',
      amount: 96.4,
      category: 'Transport',
      type: 'expense',
      date: shiftMonthDate(now, 0, todayDay),
      description: 'Commuter transit pass and gas',
    },
    {
      id: generateId(),
      title: 'Pharmacy & Dental Checkup',
      amount: 115,
      category: 'Healthcare',
      type: 'expense',
      date: shiftMonthDate(now, 0, Math.max(3, todayDay - 4)),
      description: 'Routine checkup copay',
    },
    {
      id: generateId(),
      title: 'Restaurant Dinner',
      amount: 74.25,
      category: 'Food',
      type: 'expense',
      date: shiftMonthDate(now, 0, Math.max(2, todayDay - 5)),
      description: 'Dinner with colleagues',
    },
    // Previous Month (-1)
    {
      id: generateId(),
      title: 'Monthly Salary Deposit',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: shiftMonthDate(now, -1, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: shiftMonthDate(now, -1, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Supermarket & Produce',
      amount: 412.6,
      category: 'Food',
      type: 'expense',
      date: shiftMonthDate(now, -1, 14),
      description: 'Household groceries for the month',
    },
    {
      id: generateId(),
      title: 'Utilities & Water',
      amount: 138.2,
      category: 'Utilities',
      type: 'expense',
      date: shiftMonthDate(now, -1, 18),
      description: 'Monthly utility statement',
    },
    {
      id: generateId(),
      title: 'Winter Jacket & Essentials',
      amount: 215,
      category: 'Shopping',
      type: 'expense',
      date: shiftMonthDate(now, -1, 22),
      description: 'Seasonal apparel',
    },
    {
      id: generateId(),
      title: 'Concert & Streaming',
      amount: 92,
      category: 'Entertainment',
      type: 'expense',
      date: shiftMonthDate(now, -1, 25),
      description: 'Live show tickets and subscriptions',
    },
    // Two Months Ago (-2)
    {
      id: generateId(),
      title: 'Monthly Salary Deposit',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: shiftMonthDate(now, -2, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: shiftMonthDate(now, -2, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Quarterly Dividend Payout',
      amount: 320,
      category: 'Investments',
      type: 'income',
      date: shiftMonthDate(now, -2, 15),
      description: 'Index fund distribution',
    },
    {
      id: generateId(),
      title: 'Groceries & Coffee',
      amount: 368.9,
      category: 'Food',
      type: 'expense',
      date: shiftMonthDate(now, -2, 19),
      description: 'Monthly food spending',
    },
    {
      id: generateId(),
      title: 'Train Tickets & Rideshare',
      amount: 145,
      category: 'Transport',
      type: 'expense',
      date: shiftMonthDate(now, -2, 24),
      description: 'Weekend regional travel',
    },
    // Three Months Ago (-3)
    {
      id: generateId(),
      title: 'Monthly Salary Deposit',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: shiftMonthDate(now, -3, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: shiftMonthDate(now, -3, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Household Groceries',
      amount: 345,
      category: 'Food',
      type: 'expense',
      date: shiftMonthDate(now, -3, 16),
      description: 'Monthly groceries',
    },
    {
      id: generateId(),
      title: 'Annual Tech Course',
      amount: 199,
      category: 'Education',
      type: 'expense',
      date: shiftMonthDate(now, -3, 21),
      description: 'Professional development workshop',
    },
  ];
}

function normalizeTransaction(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const type = raw.type === 'income' ? 'income' : 'expense';
  const title = String(raw.title || '').trim();
  const category = String(raw.category || 'Other').trim() || 'Other';
  const date = String(raw.date || '').trim();
  const description = String(raw.description || '').trim();

  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  return {
    id: String(raw.id || generateId()),
    title,
    amount: Math.round(amount * 100) / 100,
    category,
    type,
    date,
    description,
  };
}

export function initStorage() {
  try {
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!initialized) {
      const sample = buildSampleTransactions();
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(sample));
      localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(DEFAULT_BUDGET));
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    } else if (!localStorage.getItem(STORAGE_KEYS.BUDGET)) {
      localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(DEFAULT_BUDGET));
    }
  } catch (err) {
    console.error('Failed to initialize LocalStorage:', err);
  }
}

export function getTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTransaction).filter(Boolean);
  } catch (err) {
    console.error('Failed to read transactions from LocalStorage:', err);
    return [];
  }
}

export function saveTransactions(transactions) {
  try {
    const sanitized = Array.isArray(transactions)
      ? transactions.map(normalizeTransaction).filter(Boolean)
      : [];
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(sanitized));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    return sanitized;
  } catch (err) {
    console.error('Failed to save transactions to LocalStorage:', err);
    return [];
  }
}

export function addTransaction(txInput) {
  const newTx = normalizeTransaction({
    ...txInput,
    id: generateId(),
  });
  if (!newTx) {
    throw new Error('Invalid transaction payload.');
  }
  const current = getTransactions();
  current.unshift(newTx);
  saveTransactions(current);
  return newTx;
}

export function updateTransaction(id, updates) {
  const current = getTransactions();
  const index = current.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const updated = normalizeTransaction({
    ...current[index],
    ...updates,
    id,
  });
  if (!updated) {
    throw new Error('Invalid transaction update payload.');
  }

  current[index] = updated;
  saveTransactions(current);
  return updated;
}

export function deleteTransaction(id) {
  const current = getTransactions();
  const next = current.filter((item) => item.id !== id);
  if (next.length === current.length) return false;
  saveTransactions(next);
  return true;
}

export function clearAllTransactions() {
  saveTransactions([]);
  return [];
}

export function restoreSampleData() {
  const sample = buildSampleTransactions();
  saveTransactions(sample);
  saveBudget(DEFAULT_BUDGET);
  return sample;
}

export function getBudget() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGET);
    if (!raw) return { ...DEFAULT_BUDGET };
    const parsed = JSON.parse(raw);
    const limit = Number(parsed?.monthlyLimit);
    if (!Number.isFinite(limit) || limit < 0) {
      return { ...DEFAULT_BUDGET };
    }
    return {
      monthlyLimit: Math.round(limit * 100) / 100,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch (err) {
    console.error('Failed to read budget from LocalStorage:', err);
    return { ...DEFAULT_BUDGET };
  }
}

export function saveBudget(budgetInput) {
  const limit = Number(budgetInput?.monthlyLimit);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error('Monthly budget must be a positive number.');
  }
  const record = {
    monthlyLimit: Math.round(limit * 100) / 100,
    updatedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(record));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  } catch (err) {
    console.error('Failed to save budget to LocalStorage:', err);
  }
  return record;
}

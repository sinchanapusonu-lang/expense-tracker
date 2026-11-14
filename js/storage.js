/**
 * Centralized Data Access Layer
 * Connects the frontend to the Node.js + Express + SQLite REST API.
 * Preserves the original LocalStorage data as backup and handles one-time migration.
 */

import { api } from './api.js';

const STORAGE_KEYS = {
  TRANSACTIONS: 'clearledger_transactions_v1',
  BUDGET: 'clearledger_budget_v1',
  INITIALIZED: 'clearledger_initialized_v1',
  MIGRATED: 'clearledger_migrated_v1',
};

const DEFAULT_BUDGET = {
  monthlyLimit: 3500,
  updatedAt: new Date().toISOString(),
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function shiftMonthDate(baseDate, monthsOffset, dayOfMonth) {
  const target = new Date(baseDate.getFullYear(), baseDate.getMonth() + monthsOffset, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(dayOfMonth, maxDay);
  return `${target.getFullYear()}-${pad2(target.getMonth() + 1)}-${pad2(safeDay)}`;
}

export function buildSampleTransactions() {
  const now = new Date();
  const todayDay = Math.min(now.getDate(), 28);

  return [
    {
      title: 'Monthly Salary Deposit',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: shiftMonthDate(now, 0, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: shiftMonthDate(now, 0, 2),
      description: 'Monthly lease payment',
    },
    {
      title: 'Grocery Shopping',
      amount: 184.5,
      category: 'Food',
      type: 'expense',
      date: shiftMonthDate(now, 0, Math.max(3, todayDay - 3)),
      description: 'Weekly produce and pantry essentials',
    },
    {
      title: 'Electric & Internet Bill',
      amount: 142.8,
      category: 'Utilities',
      type: 'expense',
      date: shiftMonthDate(now, 0, Math.max(4, todayDay - 2)),
      description: 'Monthly power and fiber internet',
    },
    {
      title: 'UI Design Retainer',
      amount: 850,
      category: 'Freelance',
      type: 'income',
      date: shiftMonthDate(now, 0, Math.max(5, todayDay - 1)),
      description: 'Client sprint milestone payment',
    },
    {
      title: 'Metro Pass & Fuel',
      amount: 96.4,
      category: 'Transport',
      type: 'expense',
      date: shiftMonthDate(now, 0, todayDay),
      description: 'Commuter transit pass and gas',
    },
    {
      title: 'Pharmacy & Dental Checkup',
      amount: 115,
      category: 'Healthcare',
      type: 'expense',
      date: shiftMonthDate(now, 0, Math.max(3, todayDay - 4)),
      description: 'Routine checkup copay',
    },
    {
      title: 'Restaurant Dinner',
      amount: 74.25,
      category: 'Food',
      type: 'expense',
      date: shiftMonthDate(now, 0, Math.max(2, todayDay - 5)),
      description: 'Dinner with colleagues',
    },
    // Previous Month (-1)
    {
      title: 'Monthly Salary Deposit',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: shiftMonthDate(now, -1, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: shiftMonthDate(now, -1, 2),
      description: 'Monthly lease payment',
    },
    {
      title: 'Supermarket & Produce',
      amount: 412.6,
      category: 'Food',
      type: 'expense',
      date: shiftMonthDate(now, -1, 14),
      description: 'Household groceries for the month',
    },
    {
      title: 'Utilities & Water',
      amount: 138.2,
      category: 'Utilities',
      type: 'expense',
      date: shiftMonthDate(now, -1, 18),
      description: 'Monthly utility statement',
    },
    {
      title: 'Winter Jacket & Essentials',
      amount: 215,
      category: 'Shopping',
      type: 'expense',
      date: shiftMonthDate(now, -1, 22),
      description: 'Seasonal apparel',
    },
    {
      title: 'Concert & Streaming',
      amount: 92,
      category: 'Entertainment',
      type: 'expense',
      date: shiftMonthDate(now, -1, 25),
      description: 'Live show tickets and subscriptions',
    },
    // Two Months Ago (-2)
    {
      title: 'Monthly Salary Deposit',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: shiftMonthDate(now, -2, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: shiftMonthDate(now, -2, 2),
      description: 'Monthly lease payment',
    },
    {
      title: 'Quarterly Dividend Payout',
      amount: 320,
      category: 'Investments',
      type: 'income',
      date: shiftMonthDate(now, -2, 15),
      description: 'Index fund distribution',
    },
    {
      title: 'Groceries & Coffee',
      amount: 368.9,
      category: 'Food',
      type: 'expense',
      date: shiftMonthDate(now, -2, 19),
      description: 'Monthly food spending',
    },
    {
      title: 'Train Tickets & Rideshare',
      amount: 145,
      category: 'Transport',
      type: 'expense',
      date: shiftMonthDate(now, -2, 24),
      description: 'Weekend regional travel',
    },
    // Three Months Ago (-3)
    {
      title: 'Monthly Salary Deposit',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: shiftMonthDate(now, -3, 1),
      description: 'Primary payroll direct deposit',
    },
    {
      title: 'Apartment Rent',
      amount: 1650,
      category: 'Housing',
      type: 'expense',
      date: shiftMonthDate(now, -3, 2),
      description: 'Monthly lease payment',
    },
    {
      title: 'Household Groceries',
      amount: 345,
      category: 'Food',
      type: 'expense',
      date: shiftMonthDate(now, -3, 16),
      description: 'Monthly groceries',
    },
    {
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
    id: raw.id,
    title,
    amount: Math.round(amount * 100) / 100,
    category,
    type,
    date,
    description,
    created_at: raw.created_at || null,
  };
}

/**
 * Perform one-time migration of LocalStorage data to the SQLite database
 */
export async function initStorage() {
  try {
    const isMigrated = localStorage.getItem(STORAGE_KEYS.MIGRATED);
    if (!isMigrated) {
      let importedTxCount = 0;
      let importedBudgetCount = 0;

      // Check existing transactions in LocalStorage
      const localTxsRaw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (localTxsRaw) {
        try {
          const localTxs = JSON.parse(localTxsRaw);
          if (Array.isArray(localTxs) && localTxs.length > 0) {
            for (const tx of localTxs) {
              const normalized = normalizeTransaction(tx);
              if (normalized) {
                await api.createTransaction({
                  title: normalized.title,
                  amount: normalized.amount,
                  category: normalized.category,
                  type: normalized.type,
                  date: normalized.date,
                  description: normalized.description,
                });
                importedTxCount++;
              }
            }
          }
        } catch (e) {
          console.warn('Could not parse legacy LocalStorage transactions for migration:', e);
        }
      }

      // Check existing budget in LocalStorage
      const localBudgetRaw = localStorage.getItem(STORAGE_KEYS.BUDGET);
      if (localBudgetRaw) {
        try {
          const localBudget = JSON.parse(localBudgetRaw);
          const limit = Number(localBudget?.monthlyLimit);
          if (Number.isFinite(limit) && limit > 0) {
            const now = new Date();
            await api.saveBudgetForMonth(now.getFullYear(), now.getMonth() + 1, limit);
            importedBudgetCount++;
          }
        } catch (e) {
          console.warn('Could not parse legacy LocalStorage budget for migration:', e);
        }
      }

      // If database is completely empty and no local storage data existed, seed initial sample data
      const existingDbTxs = await api.getTransactions();
      if (existingDbTxs.length === 0 && importedTxCount === 0) {
        const samples = buildSampleTransactions();
        for (const s of samples) {
          await api.createTransaction(s);
          importedTxCount++;
        }
        const now = new Date();
        await api.saveBudgetForMonth(now.getFullYear(), now.getMonth() + 1, DEFAULT_BUDGET.monthlyLimit);
        importedBudgetCount++;
      }

      // Mark migration complete in LocalStorage without deleting original backup data
      localStorage.setItem(STORAGE_KEYS.MIGRATED, 'true');
      console.log(`Migration complete. Imported ${importedTxCount} transactions and ${importedBudgetCount} budget records.`);
      window.__clearledgerMigration = {
        transactionsImported: importedTxCount,
        budgetsImported: importedBudgetCount,
      };
    }
  } catch (err) {
    console.error('Initialization / Migration error:', err);
    throw err;
  }
}

export async function getTransactions() {
  const rows = await api.getTransactions();
  return rows.map(normalizeTransaction).filter(Boolean);
}

export async function addTransaction(txInput) {
  const normalized = normalizeTransaction(txInput);
  if (!normalized) {
    throw new Error('Invalid transaction payload.');
  }
  const created = await api.createTransaction({
    title: normalized.title,
    amount: normalized.amount,
    category: normalized.category,
    type: normalized.type,
    date: normalized.date,
    description: normalized.description,
  });
  return normalizeTransaction(created);
}

export async function updateTransaction(id, updates) {
  const updated = await api.updateTransaction(id, updates);
  return normalizeTransaction(updated);
}

export async function deleteTransaction(id) {
  await api.deleteTransaction(id);
  return true;
}

export async function clearAllTransactions() {
  const current = await api.getTransactions();
  for (const item of current) {
    await api.deleteTransaction(item.id);
  }
  return [];
}

export async function restoreSampleData(activeMonthKey) {
  // Clear existing items first
  const current = await api.getTransactions();
  for (const item of current) {
    await api.deleteTransaction(item.id);
  }

  // Insert sample entries
  const samples = buildSampleTransactions();
  for (const s of samples) {
    await api.createTransaction(s);
  }

  // Save budget for current month
  let y = new Date().getFullYear();
  let m = new Date().getMonth() + 1;
  if (activeMonthKey && /^\d{4}-\d{2}$/.test(activeMonthKey)) {
    const parts = activeMonthKey.split('-').map(Number);
    y = parts[0];
    m = parts[1];
  }

  await api.saveBudgetForMonth(y, m, DEFAULT_BUDGET.monthlyLimit);
  return samples;
}

export async function getBudget(year, month) {
  let targetYear = year;
  let targetMonth = month;

  if (!targetYear || !targetMonth) {
    const now = new Date();
    targetYear = now.getFullYear();
    targetMonth = now.getMonth() + 1;
  }

  const record = await api.getBudget(targetYear, targetMonth);
  if (!record) {
    return {
      id: null,
      monthlyLimit: 0,
      updatedAt: null,
      year: targetYear,
      month: targetMonth,
    };
  }

  return {
    id: record.id,
    monthlyLimit: record.amount,
    updatedAt: record.created_at,
    year: record.year,
    month: record.month,
  };
}

export async function saveBudget(budgetInput, activeMonthKey) {
  const limit = Number(budgetInput?.monthlyLimit);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error('Monthly budget must be a positive number.');
  }

  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;

  if (activeMonthKey && /^\d{4}-\d{2}$/.test(activeMonthKey)) {
    const parts = activeMonthKey.split('-').map(Number);
    year = parts[0];
    month = parts[1];
  }

  const saved = await api.saveBudgetForMonth(year, month, limit);
  return {
    id: saved.id,
    monthlyLimit: saved.amount,
    updatedAt: saved.created_at,
    year: saved.year,
    month: saved.month,
  };
}

export async function getGoals() {
  return await api.getGoals();
}

export async function addGoal(goalInput) {
  return await api.createGoal(goalInput);
}

export async function updateGoal(id, updates) {
  return await api.updateGoal(id, updates);
}

export async function contributeGoal(id, amount) {
  return await api.contributeToGoal(id, amount);
}

export async function deleteGoal(id) {
  return await api.deleteGoal(id);
}


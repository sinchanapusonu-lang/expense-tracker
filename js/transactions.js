/**
 * Transactions Domain Logic, Validation, Calculations & History View
 * Pure calculation and filtering functions are decoupled from storage.js
 * so they remain identical when migrating to a backend REST API.
 */

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Utilities',
  'Healthcare',
  'Shopping',
  'Entertainment',
  'Education',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Gift',
  'Refund',
  'Other',
];

export const CATEGORY_COLORS = {
  Food: '#0f766e',
  Housing: '#1e40af',
  Transport: '#0369a1',
  Utilities: '#d97706',
  Healthcare: '#be123c',
  Shopping: '#7c3aed',
  Entertainment: '#0d9488',
  Education: '#4f46e5',
  Salary: '#15803d',
  Freelance: '#0f766e',
  Investments: '#1d4ed8',
  Gift: '#b45309',
  Refund: '#0369a1',
  Other: '#64748b',
};

export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || '#64748b';
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatCurrency(amount, { showSign = false } = {}) {
  const num = Number(amount) || 0;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));

  if (num < 0) return `-${formatted}`;
  if (showSign && num > 0) return `+${formatted}`;
  return formatted;
}

export function formatDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(dateObj);
}

export function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
  const [y, m] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, 1));
}

export function getMonthKeyFromDate(dateStr) {
  if (!dateStr || dateStr.length < 7) return '';
  return dateStr.slice(0, 7);
}

export function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentMonthKey() {
  return getTodayDateString().slice(0, 7);
}

/**
 * Pure dynamic summary calculation from transaction records.
 * Total Balance = Total Income - Total Expenses
 */
export function calculateFinancialSummary(transactions, activeMonthKey) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let monthlyIncome = 0;
  let monthlySpending = 0;

  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    const isMonthMatch = activeMonthKey && getMonthKeyFromDate(tx.date) === activeMonthKey;

    if (tx.type === 'income') {
      totalIncome += amt;
      if (isMonthMatch) monthlyIncome += amt;
    } else if (tx.type === 'expense') {
      totalExpenses += amt;
      if (isMonthMatch) monthlySpending += amt;
    }
  }

  const totalBalance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    totalBalance: Math.round(totalBalance * 100) / 100,
    monthlyIncome: Math.round(monthlyIncome * 100) / 100,
    monthlySpending: Math.round(monthlySpending * 100) / 100,
    savingsRate: Math.round(savingsRate * 10) / 10,
    transactionCount: transactions.length,
  };
}

/**
 * Validate transaction form fields before persistence.
 */
export function validateTransactionInput(data) {
  const errors = {};
  const title = String(data.title || '').trim();
  const amount = Number(data.amount);
  const type = data.type;
  const category = String(data.category || '').trim();
  const date = String(data.date || '').trim();
  const description = String(data.description || '').trim();

  if (!title) {
    errors.title = 'Please enter a transaction title.';
  } else if (title.length > 80) {
    errors.title = 'Title must be 80 characters or fewer.';
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter a valid amount greater than 0.';
  } else if (amount > 100000000) {
    errors.amount = 'Amount exceeds maximum supported limit.';
  }

  if (type !== 'income' && type !== 'expense') {
    errors.type = 'Select either Income or Expense.';
  }

  if (!category) {
    errors.category = 'Please select a category.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Please select a valid date.';
  } else {
    const [y, m, d] = date.split('-').map(Number);
    const parsed = new Date(y, m - 1, d);
    if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) {
      errors.date = 'Please enter a valid calendar date.';
    }
  }

  if (description.length > 240) {
    errors.description = 'Description must be 240 characters or fewer.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Pure filtering and sorting for Transaction History.
 */
export function filterAndSortTransactions(transactions, filters) {
  const search = String(filters.search || '').trim().toLowerCase();
  const category = filters.category || 'all';
  const type = filters.type || 'all';
  const sortBy = filters.sortBy || 'date-desc';

  const filtered = transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) return false;
    if (category !== 'all' && tx.category !== category) return false;
    if (search) {
      const haystack = `${tx.title} ${tx.category} ${tx.description || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (sortBy === 'date-asc') {
      return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
    }
    if (sortBy === 'amount-desc') {
      return b.amount - a.amount || b.date.localeCompare(a.date);
    }
    if (sortBy === 'amount-asc') {
      return a.amount - b.amount || b.date.localeCompare(a.date);
    }
    // Default: date-desc
    return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
  });
}

/**
 * Render Transaction History view into the DOM.
 */
export function renderTransactionsView(transactions, filterState, callbacks) {
  const categorySelect = document.getElementById('tx-category-filter');
  const tableBody = document.getElementById('tx-table-body');
  const tableWrap = document.getElementById('tx-table-wrap');
  const emptyState = document.getElementById('tx-empty-state');
  const emptyTitle = document.getElementById('tx-empty-title');
  const emptyDesc = document.getElementById('tx-empty-desc');
  const emptyResetBtn = document.getElementById('tx-empty-reset-btn');
  const summaryEl = document.getElementById('tx-filtered-summary');

  if (!categorySelect || !tableBody || !tableWrap || !emptyState || !summaryEl) return;

  // Sync category filter options dynamically from existing + standard categories
  const availableCategories = Array.from(
    new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...transactions.map((t) => t.category)])
  ).sort((a, b) => a.localeCompare(b));

  const previousCategory = filterState.category || 'all';
  categorySelect.innerHTML = [
    '<option value="all">All Categories</option>',
    ...availableCategories.map(
      (cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
    ),
  ].join('');
  categorySelect.value = availableCategories.includes(previousCategory) ? previousCategory : 'all';

  const filtered = filterAndSortTransactions(transactions, filterState);

  // Filtered summary totals
  let filteredIncome = 0;
  let filteredExpense = 0;
  for (const tx of filtered) {
    if (tx.type === 'income') filteredIncome += tx.amount;
    else filteredExpense += tx.amount;
  }

  summaryEl.innerHTML = `
    <span>Showing <strong class="mono-val">${filtered.length}</strong> of <strong class="mono-val">${transactions.length}</strong> transactions</span>
    <span class="summary-sep" aria-hidden="true">|</span>
    <span>Income: <strong class="mono-val amount-income">${formatCurrency(filteredIncome, { showSign: true })}</strong></span>
    <span class="summary-sep" aria-hidden="true">|</span>
    <span>Expenses: <strong class="mono-val">${formatCurrency(filteredExpense)}</strong></span>
  `;

  if (filtered.length === 0) {
    tableWrap.hidden = true;
    emptyState.hidden = false;

    const hasActiveFilters =
      Boolean(filterState.search) || filterState.category !== 'all' || filterState.type !== 'all';

    if (transactions.length === 0) {
      emptyTitle.textContent = 'No transactions recorded yet';
      emptyDesc.textContent = 'Add your first income or expense entry to build your financial ledger.';
      emptyResetBtn.hidden = true;
    } else if (hasActiveFilters) {
      emptyTitle.textContent = 'No matching transactions';
      emptyDesc.textContent = 'Adjust your search query, category, or type filter to view entries.';
      emptyResetBtn.hidden = false;
    }
    return;
  }

  tableWrap.hidden = false;
  emptyState.hidden = true;

  tableBody.innerHTML = filtered
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const amountDisplay = isIncome
        ? formatCurrency(tx.amount, { showSign: true })
        : `-${formatCurrency(tx.amount)}`;

      return `
        <tr data-tx-id="${escapeHtml(tx.id)}">
          <td class="mono-val">${escapeHtml(formatDate(tx.date))}</td>
          <td>
            <div class="tx-cell-title">${escapeHtml(tx.title)}</div>
            ${tx.description ? `<div class="tx-cell-desc" title="${escapeHtml(tx.description)}">${escapeHtml(tx.description)}</div>` : ''}
          </td>
          <td>${escapeHtml(tx.category)}</td>
          <td>
            <span class="tx-type-indicator ${isIncome ? 'is-income' : 'is-expense'}">
              <i data-lucide="${isIncome ? 'arrow-down-left' : 'arrow-up-right'}"></i>
              <span>${isIncome ? 'Income' : 'Expense'}</span>
            </span>
          </td>
          <td class="text-right mono-val ${isIncome ? 'amount-income' : 'amount-expense'}">
            ${escapeHtml(amountDisplay)}
          </td>
          <td class="text-right">
            <div class="row-actions">
              <button
                type="button"
                class="icon-btn"
                data-action="edit-tx"
                data-id="${escapeHtml(tx.id)}"
                aria-label="Edit ${escapeHtml(tx.title)}"
                title="Edit transaction"
              >
                <i data-lucide="pencil"></i>
              </button>
              <button
                type="button"
                class="icon-btn icon-btn-danger"
                data-action="delete-tx"
                data-id="${escapeHtml(tx.id)}"
                aria-label="Delete ${escapeHtml(tx.title)}"
                title="Delete transaction"
              >
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  // Bind delegated row actions once on tbody
  if (!tableBody.dataset.bound) {
    tableBody.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'edit-tx' && callbacks?.onEdit) {
        callbacks.onEdit(id);
      } else if (action === 'delete-tx' && callbacks?.onDelete) {
        callbacks.onDelete(id);
      }
    });
    tableBody.dataset.bound = 'true';
  }
}

export function exportTransactionsToCSV(transactions) {
  const headers = ['ID', 'Date', 'Title', 'Type', 'Category', 'Amount', 'Description'];
  const escapeCsvCell = (val) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const sorted = filterAndSortTransactions(transactions, { sortBy: 'date-desc' });
  const rows = sorted.map((tx) =>
    [tx.id, tx.date, tx.title, tx.type, tx.category, tx.amount.toFixed(2), tx.description]
      .map(escapeCsvCell)
      .join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clearledger-transactions-${getTodayDateString()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

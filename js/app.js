/**
 * ClearLedger Application Controller
 * Coordinates navigation, modals, event listeners, and reactive view rendering.
 */

import { renderAnalyticsView } from './analytics.js';
import { renderBudgetView } from './budget.js';
import { renderDashboardView } from './dashboard.js';
import {
  addTransaction,
  clearAllTransactions,
  deleteTransaction,
  getBudget,
  getTransactions,
  initStorage,
  restoreSampleData,
  saveBudget,
  updateTransaction,
} from './storage.js';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  escapeHtml,
  exportTransactionsToCSV,
  getCurrentMonthKey,
  getTodayDateString,
  renderTransactionsView,
  validateTransactionInput,
} from './transactions.js';

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  transactions: 'Transaction History',
  analytics: 'Expense Analytics',
  budget: 'Budget Management',
};

const appState = {
  activeView: 'dashboard',
  activeMonthKey: getCurrentMonthKey(),
  analyticsRange: 'all',
  filters: {
    search: '',
    type: 'all',
    category: 'all',
    sortBy: 'date-desc',
  },
  pendingDeleteId: null,
};

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function showToast(message, variant = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${variant === 'error' ? 'is-error' : 'is-success'}`;
  const iconName = variant === 'error' ? 'alert-circle' : 'check-circle-2';
  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  refreshIcons();

  window.setTimeout(() => {
    toast.remove();
  }, 3000);
}

function renderActiveView() {
  const transactions = getTransactions();
  const budgetConfig = getBudget();

  if (appState.activeView === 'dashboard') {
    renderDashboardView(transactions, budgetConfig, appState.activeMonthKey, {
      onNavigateBudget: () => switchView('budget'),
    });
  } else if (appState.activeView === 'transactions') {
    renderTransactionsView(transactions, appState.filters, {
      onEdit: (id) => openTransactionModal(id),
      onDelete: (id) => openDeleteModal(id),
    });
  } else if (appState.activeView === 'analytics') {
    renderAnalyticsView(transactions, appState.analyticsRange, appState.activeMonthKey);
  } else if (appState.activeView === 'budget') {
    renderBudgetView(transactions, budgetConfig, appState.activeMonthKey);
  }

  refreshIcons();
}

function switchView(viewName) {
  if (!VIEW_TITLES[viewName]) return;
  appState.activeView = viewName;

  document.querySelectorAll('.view-section').forEach((section) => {
    section.hidden = section.id !== `view-${viewName}`;
  });

  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    const isActive = btn.dataset.view === viewName;
    btn.classList.toggle('active', isActive);
    if (isActive) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  const titleEl = document.getElementById('topbar-title');
  if (titleEl) {
    titleEl.textContent = VIEW_TITLES[viewName];
  }

  closeMobileSidebar();
  renderActiveView();
}

function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.add('is-open');
  if (backdrop) backdrop.hidden = false;
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('is-open');
  if (backdrop) backdrop.hidden = true;
}

/* ---------- Transaction Modal (Add & Edit) ---------- */
function populateFormCategoryOptions(type, selectedCategory = '') {
  const select = document.getElementById('tx-category-input');
  if (!select) return;

  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  select.innerHTML = list
    .map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
    .join('');

  if (selectedCategory && list.includes(selectedCategory)) {
    select.value = selectedCategory;
  } else {
    select.value = list[0];
  }
}

function setFormTransactionType(type, selectedCategory = '') {
  const normalized = type === 'income' ? 'income' : 'expense';
  const typeInput = document.getElementById('tx-type-input');
  if (typeInput) typeInput.value = normalized;

  document.querySelectorAll('[data-form-type]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.formType === normalized);
  });

  populateFormCategoryOptions(normalized, selectedCategory);
}

function clearFormErrors() {
  const fields = ['title', 'amount', 'category', 'date', 'description'];
  for (const field of fields) {
    const input = document.getElementById(`tx-${field}-input`);
    const errEl = document.getElementById(`tx-${field}-error`);
    if (input) input.classList.remove('has-error');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
  }
}

function displayFormErrors(errors) {
  let firstInvalid = null;
  for (const [field, message] of Object.entries(errors)) {
    const input = document.getElementById(`tx-${field}-input`);
    const errEl = document.getElementById(`tx-${field}-error`);
    if (input) {
      input.classList.add('has-error');
      if (!firstInvalid) firstInvalid = input;
    }
    if (errEl) {
      errEl.textContent = message;
      errEl.hidden = false;
    }
  }
  if (firstInvalid) firstInvalid.focus();
}

function openTransactionModal(editId = null) {
  const modal = document.getElementById('transaction-modal');
  const modalTitle = document.getElementById('tx-modal-title');
  const submitBtn = document.getElementById('tx-modal-submit-btn');
  const idInput = document.getElementById('tx-id-input');
  const titleInput = document.getElementById('tx-title-input');
  const amountInput = document.getElementById('tx-amount-input');
  const dateInput = document.getElementById('tx-date-input');
  const descInput = document.getElementById('tx-description-input');

  if (!modal) return;
  clearFormErrors();

  if (editId) {
    const tx = getTransactions().find((item) => item.id === editId);
    if (!tx) {
      showToast('Transaction could not be found.', 'error');
      return;
    }
    modalTitle.textContent = 'Edit Transaction';
    submitBtn.textContent = 'Update Transaction';
    idInput.value = tx.id;
    setFormTransactionType(tx.type, tx.category);
    titleInput.value = tx.title;
    amountInput.value = tx.amount.toFixed(2);
    dateInput.value = tx.date;
    descInput.value = tx.description || '';
  } else {
    modalTitle.textContent = 'Add Transaction';
    submitBtn.textContent = 'Save Transaction';
    idInput.value = '';
    setFormTransactionType('expense', 'Food');
    titleInput.value = '';
    amountInput.value = '';
    dateInput.value = getTodayDateString();
    descInput.value = '';
  }

  modal.hidden = false;
  refreshIcons();
  window.setTimeout(() => titleInput?.focus(), 20);
}

function closeTransactionModal() {
  const modal = document.getElementById('transaction-modal');
  if (modal) modal.hidden = true;
}

function handleTransactionFormSubmit(event) {
  event.preventDefault();
  clearFormErrors();

  const id = document.getElementById('tx-id-input')?.value.trim() || '';
  const payload = {
    type: document.getElementById('tx-type-input')?.value || 'expense',
    title: document.getElementById('tx-title-input')?.value.trim() || '',
    amount: document.getElementById('tx-amount-input')?.value || '',
    category: document.getElementById('tx-category-input')?.value || '',
    date: document.getElementById('tx-date-input')?.value || '',
    description: document.getElementById('tx-description-input')?.value.trim() || '',
  };

  const validation = validateTransactionInput(payload);
  if (!validation.valid) {
    displayFormErrors(validation.errors);
    return;
  }

  try {
    if (id) {
      updateTransaction(id, payload);
      showToast('Transaction updated.');
    } else {
      addTransaction(payload);
      showToast('Transaction added.');
    }
    closeTransactionModal();
    renderActiveView();
  } catch (err) {
    showToast(err.message || 'Unable to save transaction.', 'error');
  }
}

/* ---------- Delete Confirmation Modal ---------- */
function openDeleteModal(id) {
  const tx = getTransactions().find((item) => item.id === id);
  if (!tx) return;

  appState.pendingDeleteId = id;
  const nameEl = document.getElementById('delete-tx-name');
  if (nameEl) nameEl.textContent = `"${tx.title}"`;

  const modal = document.getElementById('delete-modal');
  if (modal) modal.hidden = false;
  refreshIcons();
}

function closeDeleteModal() {
  appState.pendingDeleteId = null;
  const modal = document.getElementById('delete-modal');
  if (modal) modal.hidden = true;
}

function confirmDeleteTransaction() {
  if (!appState.pendingDeleteId) return;
  const deleted = deleteTransaction(appState.pendingDeleteId);
  closeDeleteModal();
  if (deleted) {
    showToast('Transaction deleted.');
    renderActiveView();
  } else {
    showToast('Transaction not found.', 'error');
  }
}

/* ---------- Manage Data Modal ---------- */
function openDataModal() {
  const modal = document.getElementById('data-modal');
  if (modal) modal.hidden = false;
  refreshIcons();
}

function closeDataModal() {
  const modal = document.getElementById('data-modal');
  if (modal) modal.hidden = true;
}

/* ---------- Budget Form ---------- */
function handleBudgetFormSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('budget-limit-input');
  const errEl = document.getElementById('budget-limit-error');
  if (!input || !errEl) return;

  input.classList.remove('has-error');
  errEl.hidden = true;
  errEl.textContent = '';

  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0) {
    input.classList.add('has-error');
    errEl.textContent = 'Please enter a monthly budget greater than $0.00.';
    errEl.hidden = false;
    input.focus();
    return;
  }

  saveBudget({ monthlyLimit: value });
  showToast('Monthly budget updated.');
  renderActiveView();
}

/* ---------- Event Wiring ---------- */
function bindEvents() {
  // Sidebar navigation
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.querySelector('[data-nav-link="dashboard"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('dashboard');
  });

  document.getElementById('view-all-transactions-btn')?.addEventListener('click', () => {
    switchView('transactions');
  });

  // Mobile sidebar drawer
  document.getElementById('sidebar-open-btn')?.addEventListener('click', openMobileSidebar);
  document.getElementById('sidebar-close-btn')?.addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

  // Active month picker
  const monthInput = document.getElementById('active-month-input');
  if (monthInput) {
    monthInput.value = appState.activeMonthKey;
    monthInput.addEventListener('change', (e) => {
      if (/^\d{4}-\d{2}$/.test(e.target.value)) {
        appState.activeMonthKey = e.target.value;
        renderActiveView();
      }
    });
  }

  // Transaction Modal
  document.getElementById('open-add-modal-btn')?.addEventListener('click', () => openTransactionModal());
  document.getElementById('tx-empty-add-btn')?.addEventListener('click', () => openTransactionModal());
  document.getElementById('tx-modal-close-btn')?.addEventListener('click', closeTransactionModal);
  document.getElementById('tx-modal-cancel-btn')?.addEventListener('click', closeTransactionModal);
  document.getElementById('transaction-form')?.addEventListener('submit', handleTransactionFormSubmit);

  document.querySelectorAll('[data-form-type]').forEach((btn) => {
    btn.addEventListener('click', () => setFormTransactionType(btn.dataset.formType));
  });

  document.getElementById('transaction-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'transaction-modal') closeTransactionModal();
  });

  // Delete Modal
  document.getElementById('delete-modal-close-btn')?.addEventListener('click', closeDeleteModal);
  document.getElementById('delete-cancel-btn')?.addEventListener('click', closeDeleteModal);
  document.getElementById('delete-confirm-btn')?.addEventListener('click', confirmDeleteTransaction);
  document.getElementById('delete-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'delete-modal') closeDeleteModal();
  });

  // Data Management Modal & CSV Export
  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    const txs = getTransactions();
    if (txs.length === 0) {
      showToast('No transactions available to export.', 'error');
      return;
    }
    exportTransactionsToCSV(txs);
    showToast('Transactions exported as CSV.');
  });

  document.getElementById('manage-data-btn')?.addEventListener('click', openDataModal);
  document.getElementById('data-modal-close-btn')?.addEventListener('click', closeDataModal);
  document.getElementById('data-modal-done-btn')?.addEventListener('click', closeDataModal);
  document.getElementById('data-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'data-modal') closeDataModal();
  });

  document.getElementById('restore-demo-btn')?.addEventListener('click', () => {
    restoreSampleData();
    closeDataModal();
    showToast('Sample ledger data restored.');
    renderActiveView();
  });

  document.getElementById('clear-all-btn')?.addEventListener('click', () => {
    clearAllTransactions();
    closeDataModal();
    showToast('All transactions cleared.');
    renderActiveView();
  });

  // Transactions View Filters
  document.getElementById('tx-search-input')?.addEventListener('input', (e) => {
    appState.filters.search = e.target.value;
    if (appState.activeView === 'transactions') renderActiveView();
  });

  document.querySelectorAll('[data-type-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.filters.type = btn.dataset.typeFilter || 'all';
      document.querySelectorAll('[data-type-filter]').forEach((el) => {
        el.classList.toggle('active', el === btn);
      });
      if (appState.activeView === 'transactions') renderActiveView();
    });
  });

  document.getElementById('tx-category-filter')?.addEventListener('change', (e) => {
    appState.filters.category = e.target.value || 'all';
    if (appState.activeView === 'transactions') renderActiveView();
  });

  document.getElementById('tx-sort-select')?.addEventListener('change', (e) => {
    appState.filters.sortBy = e.target.value || 'date-desc';
    if (appState.activeView === 'transactions') renderActiveView();
  });

  document.getElementById('tx-empty-reset-btn')?.addEventListener('click', () => {
    appState.filters.search = '';
    appState.filters.type = 'all';
    appState.filters.category = 'all';
    const searchInput = document.getElementById('tx-search-input');
    const catSelect = document.getElementById('tx-category-filter');
    if (searchInput) searchInput.value = '';
    if (catSelect) catSelect.value = 'all';
    document.querySelectorAll('[data-type-filter]').forEach((el) => {
      el.classList.toggle('active', el.dataset.typeFilter === 'all');
    });
    renderActiveView();
  });

  // Analytics Range Switcher
  document.querySelectorAll('[data-analytics-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.analyticsRange = btn.dataset.analyticsRange || 'all';
      document.querySelectorAll('[data-analytics-range]').forEach((el) => {
        el.classList.toggle('active', el === btn);
      });
      if (appState.activeView === 'analytics') renderActiveView();
    });
  });

  // Budget Form
  document.getElementById('budget-form')?.addEventListener('submit', handleBudgetFormSubmit);

  // Global Escape Key for Modals and Mobile Drawer
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeTransactionModal();
    closeDeleteModal();
    closeDataModal();
    closeMobileSidebar();
  });
}

function bootstrap() {
  initStorage();
  bindEvents();
  switchView('dashboard');
}

document.addEventListener('DOMContentLoaded', bootstrap);

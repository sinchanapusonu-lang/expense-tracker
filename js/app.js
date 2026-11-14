/**
 * ClearLedger Application Controller
 * Coordinates navigation, modals, event listeners, and reactive view rendering
 * using the Node.js Express SQLite backend API.
 */

import { renderAnalyticsView } from './analytics.js';
import { renderBudgetView } from './budget.js';
import { renderDashboardView } from './dashboard.js';
import { GOAL_CATEGORIES, renderGoalsView } from './goals.js';
import {
  addGoal,
  addTransaction,
  clearAllTransactions,
  contributeGoal,
  deleteGoal,
  deleteTransaction,
  getBudget,
  getGoals,
  getTransactions,
  initStorage,
  restoreSampleData,
  saveBudget,
  updateGoal,
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
  goals: 'Smart Savings Goals',
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
  pendingDeleteGoalId: null,
  transactions: [],
  goals: [],
  budgetConfig: null,
  isLoading: false,
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

function setBackendErrorState(errorMessage) {
  const banner = document.getElementById('backend-status-banner');
  const msgEl = document.getElementById('backend-status-message');
  if (banner) {
    if (errorMessage) {
      if (msgEl) msgEl.textContent = errorMessage;
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
    refreshIcons();
  }
}

function setLoadingState(loading) {
  appState.isLoading = loading;
  const loader = document.getElementById('backend-loading-indicator');
  if (loader) {
    loader.hidden = !loading;
    refreshIcons();
  }
}

async function renderActiveView() {
  setLoadingState(true);
  setBackendErrorState(null);

  const [y, m] = appState.activeMonthKey.split('-').map(Number);

  try {
    if (appState.activeView === 'goals') {
      const goals = await getGoals();
      appState.goals = goals;
      renderGoalsView(goals, {
        onContribute: (id) => openContributeModal(id),
        onEdit: (id) => openGoalModal(id),
        onDelete: (id) => openDeleteGoalModal(id),
      });
    } else {
      const [transactions, budgetConfig] = await Promise.all([
        getTransactions(),
        getBudget(y, m),
      ]);

      appState.transactions = transactions;
      appState.budgetConfig = budgetConfig;

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
    }
  } catch (err) {
    console.error('Failed to load data for active view:', err);
    setBackendErrorState(`Backend Error: ${err.message}`);
    showToast('Failed to communicate with backend server.', 'error');
  } finally {
    setLoadingState(false);
    refreshIcons();
  }
}

async function switchView(viewName) {
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
  await renderActiveView();
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
    const tx = appState.transactions.find((item) => String(item.id) === String(editId));
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

async function handleTransactionFormSubmit(event) {
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

  const submitBtn = document.getElementById('tx-modal-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    if (id) {
      await updateTransaction(id, payload);
      showToast('Transaction updated.');
    } else {
      await addTransaction(payload);
      showToast('Transaction added.');
    }
    closeTransactionModal();
    await renderActiveView();
  } catch (err) {
    showToast(err.message || 'Unable to save transaction.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/* ---------- Delete Confirmation Modal ---------- */
function openDeleteModal(id) {
  const tx = appState.transactions.find((item) => String(item.id) === String(id));
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

async function confirmDeleteTransaction() {
  if (!appState.pendingDeleteId) return;
  const deleteBtn = document.getElementById('delete-confirm-btn');
  if (deleteBtn) deleteBtn.disabled = true;

  try {
    const deleted = await deleteTransaction(appState.pendingDeleteId);
    closeDeleteModal();
    if (deleted) {
      showToast('Transaction deleted.');
      await renderActiveView();
    } else {
      showToast('Transaction not found.', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Failed to delete transaction.', 'error');
  } finally {
    if (deleteBtn) deleteBtn.disabled = false;
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
async function handleBudgetFormSubmit(event) {
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

  const submitBtn = event.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    await saveBudget({ monthlyLimit: value }, appState.activeMonthKey);
    showToast('Monthly budget updated.');
    await renderActiveView();
  } catch (err) {
    showToast(err.message || 'Failed to save monthly budget.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/* ---------- Smart Savings Goals Modals & Actions ---------- */
function populateGoalCategorySelect(selected = '') {
  const select = document.getElementById('goal-category-input');
  if (!select) return;
  select.innerHTML = GOAL_CATEGORIES.map(
    (c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
  ).join('');

  if (selected && GOAL_CATEGORIES.includes(selected)) {
    select.value = selected;
  } else {
    select.value = GOAL_CATEGORIES[0];
  }
}

function clearGoalFormErrors() {
  ['title', 'target', 'current', 'category', 'date'].forEach((f) => {
    const input = document.getElementById(`goal-${f}-input`);
    const err = document.getElementById(`goal-${f}-error`);
    if (input) input.classList.remove('has-error');
    if (err) {
      err.hidden = true;
      err.textContent = '';
    }
  });
}

function openGoalModal(editId = null) {
  const modal = document.getElementById('goal-modal');
  const titleEl = document.getElementById('goal-modal-title');
  const submitBtn = document.getElementById('goal-modal-submit-btn');
  const idInput = document.getElementById('goal-id-input');
  const titleInput = document.getElementById('goal-title-input');
  const targetInput = document.getElementById('goal-target-input');
  const currentInput = document.getElementById('goal-current-input');
  const dateInput = document.getElementById('goal-date-input');

  if (!modal) return;
  clearGoalFormErrors();

  if (editId) {
    const goal = appState.goals.find((g) => String(g.id) === String(editId));
    if (!goal) {
      showToast('Goal could not be found.', 'error');
      return;
    }
    titleEl.textContent = 'Edit Savings Goal';
    submitBtn.textContent = 'Update Goal';
    idInput.value = goal.id;
    titleInput.value = goal.title;
    targetInput.value = Number(goal.target_amount).toFixed(2);
    currentInput.value = Number(goal.current_amount || 0).toFixed(2);
    dateInput.value = goal.target_date || '';
    populateGoalCategorySelect(goal.category);
  } else {
    titleEl.textContent = 'Create Savings Goal';
    submitBtn.textContent = 'Save Goal';
    idInput.value = '';
    titleInput.value = '';
    targetInput.value = '';
    currentInput.value = '0.00';
    dateInput.value = '';
    populateGoalCategorySelect('General');
  }

  modal.hidden = false;
  refreshIcons();
  window.setTimeout(() => titleInput?.focus(), 20);
}

function closeGoalModal() {
  const modal = document.getElementById('goal-modal');
  if (modal) modal.hidden = true;
}

async function handleGoalFormSubmit(event) {
  event.preventDefault();
  clearGoalFormErrors();

  const id = document.getElementById('goal-id-input')?.value.trim();
  const title = document.getElementById('goal-title-input')?.value.trim();
  const targetAmount = Number(document.getElementById('goal-target-input')?.value);
  const currentAmount = Number(document.getElementById('goal-current-input')?.value || 0);
  const category = document.getElementById('goal-category-input')?.value || 'General';
  const targetDate = document.getElementById('goal-date-input')?.value || null;

  let hasError = false;
  if (!title) {
    const err = document.getElementById('goal-title-error');
    const input = document.getElementById('goal-title-input');
    if (err) {
      err.textContent = 'Please enter a goal title.';
      err.hidden = false;
    }
    input?.classList.add('has-error');
    hasError = true;
  }

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    const err = document.getElementById('goal-target-error');
    const input = document.getElementById('goal-target-input');
    if (err) {
      err.textContent = 'Target amount must be greater than $0.00.';
      err.hidden = false;
    }
    input?.classList.add('has-error');
    hasError = true;
  }

  if (Number.isFinite(currentAmount) && currentAmount < 0) {
    const err = document.getElementById('goal-current-error');
    const input = document.getElementById('goal-current-input');
    if (err) {
      err.textContent = 'Current amount cannot be negative.';
      err.hidden = false;
    }
    input?.classList.add('has-error');
    hasError = true;
  }

  if (hasError) return;

  const payload = {
    title,
    target_amount: targetAmount,
    current_amount: currentAmount,
    category,
    target_date: targetDate,
  };

  const submitBtn = document.getElementById('goal-modal-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    if (id) {
      await updateGoal(id, payload);
      showToast('Savings goal updated.');
    } else {
      await addGoal(payload);
      showToast('Savings goal created.');
    }
    closeGoalModal();
    await renderActiveView();
  } catch (err) {
    showToast(err.message || 'Failed to save savings goal.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/* ---------- Contribute Funds Modal ---------- */
function openContributeModal(goalId) {
  const goal = appState.goals.find((g) => String(g.id) === String(goalId));
  if (!goal) return;

  const modal = document.getElementById('contribute-modal');
  const idInput = document.getElementById('contribute-goal-id-input');
  const nameEl = document.getElementById('contribute-goal-name');
  const amountInput = document.getElementById('contribute-amount-input');
  const errEl = document.getElementById('contribute-amount-error');

  if (!modal) return;

  idInput.value = goal.id;
  if (nameEl) nameEl.textContent = `"${goal.title}"`;
  if (amountInput) {
    amountInput.value = '';
    amountInput.classList.remove('has-error');
  }
  if (errEl) {
    errEl.hidden = true;
    errEl.textContent = '';
  }

  modal.hidden = false;
  refreshIcons();
  window.setTimeout(() => amountInput?.focus(), 20);
}

function closeContributeModal() {
  const modal = document.getElementById('contribute-modal');
  if (modal) modal.hidden = true;
}

async function handleContributeFormSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('contribute-goal-id-input')?.value;
  const input = document.getElementById('contribute-amount-input');
  const errEl = document.getElementById('contribute-amount-error');
  if (!id || !input) return;

  const amount = Number(input.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    input.classList.add('has-error');
    if (errEl) {
      errEl.textContent = 'Please enter a contribution amount greater than $0.00.';
      errEl.hidden = false;
    }
    input.focus();
    return;
  }

  const submitBtn = document.getElementById('contribute-submit-btn');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await contributeGoal(id, amount);
    showToast(res.message || 'Contribution added.');
    closeContributeModal();
    await renderActiveView();
  } catch (err) {
    showToast(err.message || 'Failed to record contribution.', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/* ---------- Delete Goal Modal ---------- */
function openDeleteGoalModal(id) {
  const goal = appState.goals.find((g) => String(g.id) === String(id));
  if (!goal) return;

  appState.pendingDeleteGoalId = id;
  const nameEl = document.getElementById('delete-goal-name');
  if (nameEl) nameEl.textContent = `"${goal.title}"`;

  const modal = document.getElementById('delete-goal-modal');
  if (modal) modal.hidden = false;
  refreshIcons();
}

function closeDeleteGoalModal() {
  appState.pendingDeleteGoalId = null;
  const modal = document.getElementById('delete-goal-modal');
  if (modal) modal.hidden = true;
}

async function confirmDeleteGoal() {
  if (!appState.pendingDeleteGoalId) return;
  const deleteBtn = document.getElementById('delete-goal-confirm-btn');
  if (deleteBtn) deleteBtn.disabled = true;

  try {
    await deleteGoal(appState.pendingDeleteGoalId);
    closeDeleteGoalModal();
    showToast('Savings goal deleted.');
    await renderActiveView();
  } catch (err) {
    showToast(err.message || 'Failed to delete goal.', 'error');
  } finally {
    if (deleteBtn) deleteBtn.disabled = false;
  }
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
    monthInput.addEventListener('change', async (e) => {
      if (/^\d{4}-\d{2}$/.test(e.target.value)) {
        appState.activeMonthKey = e.target.value;
        await renderActiveView();
      }
    });
  }

  // Backend error retry button
  document.getElementById('backend-retry-btn')?.addEventListener('click', async () => {
    await renderActiveView();
  });

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

  // Goals Modals & Events
  document.getElementById('open-add-goal-btn')?.addEventListener('click', () => openGoalModal());
  document.getElementById('goals-empty-add-btn')?.addEventListener('click', () => openGoalModal());
  document.getElementById('goal-modal-close-btn')?.addEventListener('click', closeGoalModal);
  document.getElementById('goal-modal-cancel-btn')?.addEventListener('click', closeGoalModal);
  document.getElementById('goal-form')?.addEventListener('submit', handleGoalFormSubmit);
  document.getElementById('goal-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'goal-modal') closeGoalModal();
  });

  // Contribute Modal
  document.getElementById('contribute-modal-close-btn')?.addEventListener('click', closeContributeModal);
  document.getElementById('contribute-cancel-btn')?.addEventListener('click', closeContributeModal);
  document.getElementById('contribute-form')?.addEventListener('submit', handleContributeFormSubmit);
  document.getElementById('contribute-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'contribute-modal') closeContributeModal();
  });

  // Quick preset deposit buttons
  document.querySelectorAll('.preset-btn[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const amountInput = document.getElementById('contribute-amount-input');
      if (amountInput) {
        amountInput.value = btn.dataset.preset;
        amountInput.focus();
      }
    });
  });

  // Delete Goal Modal
  document.getElementById('delete-goal-modal-close-btn')?.addEventListener('click', closeDeleteGoalModal);
  document.getElementById('delete-goal-cancel-btn')?.addEventListener('click', closeDeleteGoalModal);
  document.getElementById('delete-goal-confirm-btn')?.addEventListener('click', confirmDeleteGoal);
  document.getElementById('delete-goal-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'delete-goal-modal') closeDeleteGoalModal();
  });

  // Data Management Modal & CSV Export
  document.getElementById('export-csv-btn')?.addEventListener('click', async () => {
    try {
      const txs = await getTransactions();
      if (txs.length === 0) {
        showToast('No transactions available to export.', 'error');
        return;
      }
      exportTransactionsToCSV(txs);
      showToast('Transactions exported as CSV.');
    } catch (err) {
      showToast('Failed to export transactions.', 'error');
    }
  });

  document.getElementById('manage-data-btn')?.addEventListener('click', openDataModal);
  document.getElementById('data-modal-close-btn')?.addEventListener('click', closeDataModal);
  document.getElementById('data-modal-done-btn')?.addEventListener('click', closeDataModal);
  document.getElementById('data-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'data-modal') closeDataModal();
  });

  document.getElementById('restore-demo-btn')?.addEventListener('click', async () => {
    try {
      await restoreSampleData(appState.activeMonthKey);
      closeDataModal();
      showToast('Sample ledger data restored.');
      await renderActiveView();
    } catch (err) {
      showToast('Failed to restore sample data.', 'error');
    }
  });

  document.getElementById('clear-all-btn')?.addEventListener('click', async () => {
    try {
      await clearAllTransactions();
      closeDataModal();
      showToast('All transactions cleared.');
      await renderActiveView();
    } catch (err) {
      showToast('Failed to clear transactions.', 'error');
    }
  });

  // Transactions View Filters
  document.getElementById('tx-search-input')?.addEventListener('input', (e) => {
    appState.filters.search = e.target.value;
    if (appState.activeView === 'transactions') {
      renderTransactionsView(appState.transactions, appState.filters, {
        onEdit: (id) => openTransactionModal(id),
        onDelete: (id) => openDeleteModal(id),
      });
      refreshIcons();
    }
  });

  document.querySelectorAll('[data-type-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.filters.type = btn.dataset.typeFilter || 'all';
      document.querySelectorAll('[data-type-filter]').forEach((el) => {
        el.classList.toggle('active', el === btn);
      });
      if (appState.activeView === 'transactions') {
        renderTransactionsView(appState.transactions, appState.filters, {
          onEdit: (id) => openTransactionModal(id),
          onDelete: (id) => openDeleteModal(id),
        });
        refreshIcons();
      }
    });
  });

  document.getElementById('tx-category-filter')?.addEventListener('change', (e) => {
    appState.filters.category = e.target.value || 'all';
    if (appState.activeView === 'transactions') {
      renderTransactionsView(appState.transactions, appState.filters, {
        onEdit: (id) => openTransactionModal(id),
        onDelete: (id) => openDeleteModal(id),
      });
      refreshIcons();
    }
  });

  document.getElementById('tx-sort-select')?.addEventListener('change', (e) => {
    appState.filters.sortBy = e.target.value || 'date-desc';
    if (appState.activeView === 'transactions') {
      renderTransactionsView(appState.transactions, appState.filters, {
        onEdit: (id) => openTransactionModal(id),
        onDelete: (id) => openDeleteModal(id),
      });
      refreshIcons();
    }
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
    if (appState.activeView === 'transactions') {
      renderTransactionsView(appState.transactions, appState.filters, {
        onEdit: (id) => openTransactionModal(id),
        onDelete: (id) => openDeleteModal(id),
      });
      refreshIcons();
    }
  });

  // Analytics Range Switcher
  document.querySelectorAll('[data-analytics-range]').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.analyticsRange = btn.dataset.analyticsRange || 'all';
      document.querySelectorAll('[data-analytics-range]').forEach((el) => {
        el.classList.toggle('active', el === btn);
      });
      if (appState.activeView === 'analytics') {
        renderAnalyticsView(appState.transactions, appState.analyticsRange, appState.activeMonthKey);
        refreshIcons();
      }
    });
  });

  // Budget Form
  document.getElementById('budget-form')?.addEventListener('submit', handleBudgetFormSubmit);

  // Global Escape Key for Modals and Mobile Drawer
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeTransactionModal();
    closeDeleteModal();
    closeGoalModal();
    closeContributeModal();
    closeDeleteGoalModal();
    closeDataModal();
    closeMobileSidebar();
  });
}

async function bootstrap() {
  bindEvents();
  try {
    await initStorage();
  } catch (err) {
    console.warn('Initial storage setup encountered error:', err);
  }
  await switchView('dashboard');
}

document.addEventListener('DOMContentLoaded', bootstrap);

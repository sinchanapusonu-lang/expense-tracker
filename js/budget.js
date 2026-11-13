/**
 * Budget Management Logic & View Renderer (Feature 5)
 * Calculations are independent of LocalStorage for easy backend migration.
 */

import {
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  getCategoryColor,
  getMonthKeyFromDate,
} from './transactions.js';

/**
 * Pure calculation for monthly budget utilization and threshold status.
 */
export function calculateBudgetStatus(transactions, budgetConfig, activeMonthKey) {
  const monthlyLimit = Math.max(0, Number(budgetConfig?.monthlyLimit) || 0);

  let monthlyExpenses = 0;
  const categoryTotals = new Map();

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (activeMonthKey && getMonthKeyFromDate(tx.date) !== activeMonthKey) continue;

    const amt = Number(tx.amount) || 0;
    monthlyExpenses += amt;
    categoryTotals.set(tx.category, (categoryTotals.get(tx.category) || 0) + amt);
  }

  monthlyExpenses = Math.round(monthlyExpenses * 100) / 100;
  const remaining = Math.round((monthlyLimit - monthlyExpenses) * 100) / 100;
  const utilization = monthlyLimit > 0 ? (monthlyExpenses / monthlyLimit) * 100 : 0;
  const utilizationRounded = Math.round(utilization * 10) / 10;

  let status = 'nominal';
  if (monthlyLimit <= 0) {
    status = 'unset';
  } else if (utilization > 100) {
    status = 'exceeded';
  } else if (utilization >= 80) {
    status = 'warning';
  }

  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      shareOfBudget: monthlyLimit > 0 ? Math.round((amount / monthlyLimit) * 1000) / 10 : 0,
      shareOfSpending: monthlyExpenses > 0 ? Math.round((amount / monthlyExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    monthlyLimit,
    monthlyExpenses,
    remaining,
    overage: remaining < 0 ? Math.abs(remaining) : 0,
    utilizationPercent: utilizationRounded,
    warningThresholdAmount: Math.round(monthlyLimit * 0.8 * 100) / 100,
    status,
    categoryBreakdown,
  };
}

/**
 * Shared alert banner renderer for 80% warning and >100% budget exceeded alerts.
 */
export function renderBudgetAlertBanner(containerEl, budgetStatus, activeMonthKey, { onReviewBudget } = {}) {
  if (!containerEl) return;

  if (budgetStatus.status === 'warning') {
    containerEl.hidden = false;
    containerEl.className = 'alert-banner is-warning';
    containerEl.innerHTML = `
      <div class="alert-banner-content">
        <i data-lucide="alert-triangle"></i>
        <span>
          <strong>80% Budget Warning (${escapeHtml(formatMonthLabel(activeMonthKey))}):</strong>
          You have spent <strong class="mono-val">${formatCurrency(budgetStatus.monthlyExpenses)}</strong>
          (<strong class="mono-val">${budgetStatus.utilizationPercent.toFixed(1)}%</strong>) of your
          <strong class="mono-val">${formatCurrency(budgetStatus.monthlyLimit)}</strong> monthly budget.
          ${formatCurrency(budgetStatus.remaining)} remaining.
        </span>
      </div>
      ${
        onReviewBudget
          ? '<button type="button" class="btn btn-secondary btn-sm" data-action="go-budget">Review Budget</button>'
          : ''
      }
    `;
  } else if (budgetStatus.status === 'exceeded') {
    containerEl.hidden = false;
    containerEl.className = 'alert-banner is-danger';
    containerEl.innerHTML = `
      <div class="alert-banner-content">
        <i data-lucide="alert-octagon"></i>
        <span>
          <strong>Budget Exceeded (${escapeHtml(formatMonthLabel(activeMonthKey))}):</strong>
          Monthly spending is <strong class="mono-val">${formatCurrency(budgetStatus.overage)}</strong>
          over your <strong class="mono-val">${formatCurrency(budgetStatus.monthlyLimit)}</strong> budget
          (<strong class="mono-val">${budgetStatus.utilizationPercent.toFixed(1)}%</strong> utilized).
        </span>
      </div>
      ${
        onReviewBudget
          ? '<button type="button" class="btn btn-secondary btn-sm" data-action="go-budget">Manage Budget</button>'
          : ''
      }
    `;
  } else {
    containerEl.hidden = true;
    containerEl.innerHTML = '';
  }

  if (onReviewBudget) {
    const btn = containerEl.querySelector('[data-action="go-budget"]');
    if (btn) {
      btn.addEventListener('click', onReviewBudget);
    }
  }
}

/**
 * Render the Budget Management view.
 */
export function renderBudgetView(transactions, budgetConfig, activeMonthKey) {
  const statusBanner = document.getElementById('budget-status-banner');
  const monthLabel = document.getElementById('budget-month-label');
  const limitInput = document.getElementById('budget-limit-input');
  const warningAmountEl = document.getElementById('budget-warning-amount');
  const maxAmountEl = document.getElementById('budget-max-amount');
  const statusTextEl = document.getElementById('budget-status-text');
  const kpisEl = document.getElementById('budget-kpis');
  const percentLabelEl = document.getElementById('budget-percent-label');
  const progressWrapEl = document.getElementById('budget-progress-bar-wrap');
  const progressFillEl = document.getElementById('budget-progress-fill');
  const categoryBreakdownEl = document.getElementById('budget-category-breakdown');

  const budgetStatus = calculateBudgetStatus(transactions, budgetConfig, activeMonthKey);

  if (monthLabel) {
    monthLabel.textContent = formatMonthLabel(activeMonthKey);
  }

  if (limitInput && document.activeElement !== limitInput) {
    limitInput.value = budgetStatus.monthlyLimit > 0 ? budgetStatus.monthlyLimit.toFixed(2) : '';
  }

  if (warningAmountEl) {
    warningAmountEl.textContent = formatCurrency(budgetStatus.warningThresholdAmount);
  }
  if (maxAmountEl) {
    maxAmountEl.textContent = formatCurrency(budgetStatus.monthlyLimit);
  }

  renderBudgetAlertBanner(statusBanner, budgetStatus, activeMonthKey);

  if (statusTextEl) {
    if (budgetStatus.status === 'exceeded') {
      statusTextEl.textContent = 'Budget Exceeded';
      statusTextEl.className = 'status-label status-exceeded';
    } else if (budgetStatus.status === 'warning') {
      statusTextEl.textContent = 'Warning (80%+ Used)';
      statusTextEl.className = 'status-label status-warning';
    } else if (budgetStatus.status === 'unset') {
      statusTextEl.textContent = 'Not Configured';
      statusTextEl.className = 'status-label';
    } else {
      statusTextEl.textContent = 'On Track';
      statusTextEl.className = 'status-label status-nominal';
    }
  }

  if (kpisEl) {
    const isOver = budgetStatus.remaining < 0;
    kpisEl.innerHTML = `
      <div class="budget-metric">
        <span class="budget-metric-label">Monthly Limit</span>
        <span class="budget-metric-value">${formatCurrency(budgetStatus.monthlyLimit)}</span>
      </div>
      <div class="budget-metric">
        <span class="budget-metric-label">Monthly Expenses</span>
        <span class="budget-metric-value">${formatCurrency(budgetStatus.monthlyExpenses)}</span>
      </div>
      <div class="budget-metric">
        <span class="budget-metric-label">${isOver ? 'Over Budget By' : 'Remaining Budget'}</span>
        <span class="budget-metric-value ${isOver ? 'is-danger' : 'is-income'}">
          ${formatCurrency(isOver ? budgetStatus.overage : budgetStatus.remaining)}
        </span>
      </div>
    `;
  }

  const clampedWidth = Math.min(100, Math.max(0, budgetStatus.utilizationPercent));
  if (percentLabelEl) {
    percentLabelEl.textContent = `${budgetStatus.utilizationPercent.toFixed(1)}%`;
  }
  if (progressWrapEl) {
    progressWrapEl.setAttribute('aria-valuenow', String(Math.round(clampedWidth)));
  }
  if (progressFillEl) {
    progressFillEl.style.width = `${clampedWidth}%`;
    progressFillEl.className = 'progress-fill';
    if (budgetStatus.status === 'exceeded') {
      progressFillEl.classList.add('is-danger');
    } else if (budgetStatus.status === 'warning') {
      progressFillEl.classList.add('is-warning');
    }
  }

  if (categoryBreakdownEl) {
    if (budgetStatus.categoryBreakdown.length === 0) {
      categoryBreakdownEl.innerHTML = `
        <div class="empty-state-compact">
          <i data-lucide="wallet"></i>
          <p>No expenses recorded for ${escapeHtml(formatMonthLabel(activeMonthKey))} yet.</p>
        </div>
      `;
    } else {
      categoryBreakdownEl.innerHTML = `
        <div class="breakdown-list">
          ${budgetStatus.categoryBreakdown
            .map((item) => {
              const color = getCategoryColor(item.category);
              const barPct = Math.min(100, item.shareOfBudget || item.shareOfSpending);
              const pctLabel =
                budgetStatus.monthlyLimit > 0
                  ? `${item.shareOfBudget.toFixed(1)}% of budget`
                  : `${item.shareOfSpending.toFixed(1)}% of spend`;
              return `
                <div class="breakdown-row">
                  <div class="breakdown-row-top">
                    <div>
                      <span class="breakdown-cat">${escapeHtml(item.category)}</span>
                      <span class="breakdown-meta">${escapeHtml(pctLabel)}</span>
                    </div>
                    <div class="breakdown-figures">
                      <span>${formatCurrency(item.amount)}</span>
                    </div>
                  </div>
                  <div class="breakdown-bar-track">
                    <div class="breakdown-bar-fill" style="width: ${barPct}%; background-color: ${color};"></div>
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
    }
  }
}

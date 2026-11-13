/**
 * Dashboard View Calculations & Chart Renderers (Feature 1)
 */

import { calculateBudgetStatus, renderBudgetAlertBanner } from './budget.js';
import {
  calculateFinancialSummary,
  escapeHtml,
  filterAndSortTransactions,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  getCategoryColor,
  getMonthKeyFromDate,
} from './transactions.js';

let monthlyChartInstance = null;
let categoryChartInstance = null;

function buildMonthWindow(activeMonthKey, count = 6) {
  const [y, m] = activeMonthKey.split('-').map(Number);
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const shortLabel = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(d);
    months.push({ key, shortLabel });
  }
  return months;
}

export function computeMonthlySpendingSeries(transactions, activeMonthKey, count = 6) {
  const windowMonths = buildMonthWindow(activeMonthKey, count);
  const totalsByMonth = new Map(windowMonths.map((m) => [m.key, 0]));

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    const mk = getMonthKeyFromDate(tx.date);
    if (totalsByMonth.has(mk)) {
      totalsByMonth.set(mk, totalsByMonth.get(mk) + (Number(tx.amount) || 0));
    }
  }

  return windowMonths.map((m) => ({
    key: m.key,
    label: m.shortLabel,
    amount: Math.round((totalsByMonth.get(m.key) || 0) * 100) / 100,
    isActive: m.key === activeMonthKey,
  }));
}

export function computeMonthCategoryBreakdown(transactions, activeMonthKey) {
  const map = new Map();
  let total = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (activeMonthKey && getMonthKeyFromDate(tx.date) !== activeMonthKey) continue;
    const amt = Number(tx.amount) || 0;
    total += amt;
    map.set(tx.category, (map.get(tx.category) || 0) + amt);
  }

  const items = Array.from(map.entries())
    .map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percent: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
      color: getCategoryColor(category),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    total: Math.round(total * 100) / 100,
    items,
  };
}

function renderMonthlyOverviewChart(series) {
  const canvas = document.getElementById('dashboard-monthly-chart');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (monthlyChartInstance) {
    monthlyChartInstance.destroy();
  }

  monthlyChartInstance = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.map((s) => s.label),
      datasets: [
        {
          label: 'Monthly Spending',
          data: series.map((s) => s.amount),
          backgroundColor: series.map((s) => (s.isActive ? '#0f766e' : '#cbd5e1')),
          hoverBackgroundColor: series.map((s) => (s.isActive ? '#0d5e57' : '#94a3b8')),
          borderRadius: 6,
          maxBarThickness: 42,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: (ctx) => `Spending: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            color: '#64748b',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#f1f5f9' },
          ticks: {
            color: '#64748b',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (val) => `$${Number(val).toLocaleString()}`,
          },
        },
      },
    },
  });
}

function renderCategoryBreakdownChart(breakdown) {
  const wrapEl = document.getElementById('dashboard-category-wrap');
  const emptyEl = document.getElementById('dashboard-category-empty');
  const canvas = document.getElementById('dashboard-category-chart');
  const legendEl = document.getElementById('dashboard-category-legend');

  if (!wrapEl || !emptyEl || !canvas || !legendEl) return;

  if (breakdown.items.length === 0) {
    wrapEl.hidden = true;
    emptyEl.hidden = false;
    if (categoryChartInstance) {
      categoryChartInstance.destroy();
      categoryChartInstance = null;
    }
    return;
  }

  wrapEl.hidden = false;
  emptyEl.hidden = true;

  if (typeof window.Chart !== 'undefined') {
    if (categoryChartInstance) {
      categoryChartInstance.destroy();
    }

    categoryChartInstance = new window.Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: breakdown.items.map((item) => item.category),
        datasets: [
          {
            data: breakdown.items.map((item) => item.amount),
            backgroundColor: breakdown.items.map((item) => item.color),
            borderColor: '#ffffff',
            borderWidth: 2,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed || 0;
                const pct = breakdown.total > 0 ? ((val / breakdown.total) * 100).toFixed(1) : '0.0';
                return `${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  legendEl.innerHTML = breakdown.items
    .slice(0, 6)
    .map(
      (item) => `
      <li class="legend-item">
        <span class="legend-left">
          <span class="legend-swatch" style="background-color: ${item.color};"></span>
          <span class="legend-name">${escapeHtml(item.category)}</span>
        </span>
        <span class="legend-right">
          <span>${formatCurrency(item.amount)}</span>
          <span>${item.percent.toFixed(1)}%</span>
        </span>
      </li>
    `
    )
    .join('');
}

export function renderDashboardView(transactions, budgetConfig, activeMonthKey, callbacks) {
  const kpiContainer = document.getElementById('dashboard-kpis');
  const alertEl = document.getElementById('dashboard-budget-alert');
  const recentContainer = document.getElementById('dashboard-recent-list');
  const spendingSubtitle = document.getElementById('dashboard-spending-subtitle');
  const categorySubtitle = document.getElementById('dashboard-category-subtitle');

  const summary = calculateFinancialSummary(transactions, activeMonthKey);
  const budgetStatus = calculateBudgetStatus(transactions, budgetConfig, activeMonthKey);
  const activeMonthLabel = formatMonthLabel(activeMonthKey);

  if (spendingSubtitle) {
    spendingSubtitle.textContent = `6-month expense trend ending ${activeMonthLabel}`;
  }
  if (categorySubtitle) {
    categorySubtitle.textContent = `${activeMonthLabel} expense distribution`;
  }

  renderBudgetAlertBanner(alertEl, budgetStatus, activeMonthKey, {
    onReviewBudget: callbacks?.onNavigateBudget,
  });

  if (kpiContainer) {
    const balanceClass = summary.totalBalance < 0 ? 'is-expense' : '';
    const budgetMeta =
      budgetStatus.monthlyLimit > 0
        ? `${budgetStatus.utilizationPercent.toFixed(1)}% of ${formatCurrency(budgetStatus.monthlyLimit)} budget`
        : 'No monthly budget set';

    kpiContainer.innerHTML = `
      <article class="kpi-card">
        <span class="kpi-label">Total Balance</span>
        <span class="kpi-value ${balanceClass}">${formatCurrency(summary.totalBalance)}</span>
        <span class="kpi-meta">${summary.savingsRate >= 0 ? `${summary.savingsRate.toFixed(1)}% overall savings rate` : 'Expenses exceed income'}</span>
      </article>
      <article class="kpi-card">
        <span class="kpi-label">Total Income</span>
        <span class="kpi-value is-income">${formatCurrency(summary.totalIncome)}</span>
        <span class="kpi-meta">${formatCurrency(summary.monthlyIncome)} in ${escapeHtml(activeMonthLabel)}</span>
      </article>
      <article class="kpi-card">
        <span class="kpi-label">Total Expenses</span>
        <span class="kpi-value">${formatCurrency(summary.totalExpenses)}</span>
        <span class="kpi-meta">Across ${summary.transactionCount} total entries</span>
      </article>
      <article class="kpi-card">
        <span class="kpi-label">Monthly Spending</span>
        <span class="kpi-value ${budgetStatus.status === 'exceeded' ? 'is-expense' : ''}">${formatCurrency(summary.monthlySpending)}</span>
        <span class="kpi-meta">${escapeHtml(budgetMeta)}</span>
      </article>
    `;
  }

  const monthlySeries = computeMonthlySpendingSeries(transactions, activeMonthKey, 6);
  renderMonthlyOverviewChart(monthlySeries);

  const monthBreakdown = computeMonthCategoryBreakdown(transactions, activeMonthKey);
  renderCategoryBreakdownChart(monthBreakdown);

  if (recentContainer) {
    const recent = filterAndSortTransactions(transactions, { sortBy: 'date-desc' }).slice(0, 6);
    if (recent.length === 0) {
      recentContainer.innerHTML = `
        <div class="empty-state-compact">
          <i data-lucide="receipt"></i>
          <p>No transactions yet. Add an entry to populate your recent activity.</p>
        </div>
      `;
    } else {
      recentContainer.innerHTML = `
        <div class="recent-list">
          ${recent
            .map((tx) => {
              const isIncome = tx.type === 'income';
              const formattedAmt = isIncome
                ? formatCurrency(tx.amount, { showSign: true })
                : `-${formatCurrency(tx.amount)}`;
              return `
                <div class="recent-row">
                  <div class="recent-main">
                    <span class="recent-title">${escapeHtml(tx.title)}</span>
                    <span class="recent-meta">${escapeHtml(tx.category)} · ${escapeHtml(formatDate(tx.date))}</span>
                  </div>
                  <span class="recent-amount ${isIncome ? 'amount-income' : 'amount-expense'}">
                    ${escapeHtml(formattedAmt)}
                  </span>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
    }
  }
}

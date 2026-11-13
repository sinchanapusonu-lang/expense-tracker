/**
 * Expense Analytics Calculations & Dynamic Charts (Feature 4)
 */

import {
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  getCategoryColor,
  getMonthKeyFromDate,
} from './transactions.js';

let incomeExpenseChart = null;
let distributionChart = null;
let categoryBarChart = null;

function shiftMonthKey(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function filterTransactionsByRange(transactions, range, activeMonthKey) {
  if (range === 'all') return transactions;
  if (range === 'month') {
    return transactions.filter((tx) => getMonthKeyFromDate(tx.date) === activeMonthKey);
  }
  const monthsBack = range === '3m' ? 2 : 5;
  const startMonthKey = shiftMonthKey(activeMonthKey, -monthsBack);
  return transactions.filter((tx) => {
    const mk = getMonthKeyFromDate(tx.date);
    return mk >= startMonthKey && mk <= activeMonthKey;
  });
}

export function computeAnalyticsData(transactions, range, activeMonthKey) {
  const scoped = filterTransactionsByRange(transactions, range, activeMonthKey);

  let totalIncome = 0;
  let totalExpenses = 0;
  const categoryMap = new Map();
  const monthlyMap = new Map();

  for (const tx of scoped) {
    const amt = Number(tx.amount) || 0;
    const mk = getMonthKeyFromDate(tx.date);
    if (mk && !monthlyMap.has(mk)) {
      monthlyMap.set(mk, { monthKey: mk, income: 0, expenses: 0 });
    }

    if (tx.type === 'income') {
      totalIncome += amt;
      if (mk) monthlyMap.get(mk).income += amt;
    } else if (tx.type === 'expense') {
      totalExpenses += amt;
      if (mk) monthlyMap.get(mk).expenses += amt;

      const prev = categoryMap.get(tx.category) || { amount: 0, count: 0 };
      categoryMap.set(tx.category, {
        amount: prev.amount + amt,
        count: prev.count + 1,
      });
    }
  }

  const totalSavings = Math.round((totalIncome - totalExpenses) * 100) / 100;
  const savingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 1000) / 10 : 0;

  const categories = Array.from(categoryMap.entries())
    .map(([category, stats]) => ({
      category,
      amount: Math.round(stats.amount * 100) / 100,
      count: stats.count,
      percent: totalExpenses > 0 ? Math.round((stats.amount / totalExpenses) * 1000) / 10 : 0,
      color: getCategoryColor(category),
    }))
    .sort((a, b) => b.amount - a.amount);

  const highestCategory = categories[0] || null;

  const monthlySeries = Array.from(monthlyMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((m) => {
      const [y, mon] = m.monthKey.split('-').map(Number);
      const label = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' }).format(
        new Date(y, mon - 1, 1)
      );
      return {
        monthKey: m.monthKey,
        label,
        income: Math.round(m.income * 100) / 100,
        expenses: Math.round(m.expenses * 100) / 100,
      };
    });

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    totalSavings,
    savingsRate,
    highestCategory,
    categories,
    monthlySeries,
    scopedCount: scoped.length,
  };
}

function renderIncomeVsExpensesChart(monthlySeries) {
  const canvas = document.getElementById('analytics-income-expense-chart');
  if (!canvas || typeof window.Chart === 'undefined') return;

  if (incomeExpenseChart) {
    incomeExpenseChart.destroy();
  }

  const labels = monthlySeries.length > 0 ? monthlySeries.map((m) => m.label) : ['No Data'];
  const incomeData = monthlySeries.length > 0 ? monthlySeries.map((m) => m.income) : [0];
  const expenseData = monthlySeries.length > 0 ? monthlySeries.map((m) => m.expenses) : [0];

  incomeExpenseChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: '#15803d',
          borderRadius: 5,
          maxBarThickness: 28,
        },
        {
          label: 'Expenses',
          data: expenseData,
          backgroundColor: '#64748b',
          borderRadius: 5,
          maxBarThickness: 28,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: false,
            color: '#475569',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          backgroundColor: '#0f172a',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
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

function renderDistributionChart(categories, totalExpenses) {
  const wrap = document.getElementById('analytics-distribution-wrap');
  const empty = document.getElementById('analytics-distribution-empty');
  const canvas = document.getElementById('analytics-distribution-chart');

  if (!wrap || !empty || !canvas) return;

  if (categories.length === 0) {
    wrap.hidden = true;
    empty.hidden = false;
    if (distributionChart) {
      distributionChart.destroy();
      distributionChart = null;
    }
    return;
  }

  wrap.hidden = false;
  empty.hidden = true;

  if (typeof window.Chart === 'undefined') return;

  if (distributionChart) {
    distributionChart.destroy();
  }

  distributionChart = new window.Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: categories.map((c) => c.category),
      datasets: [
        {
          data: categories.map((c) => c.amount),
          backgroundColor: categories.map((c) => c.color),
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: '#334155',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          backgroundColor: '#0f172a',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed || 0;
              const pct = totalExpenses > 0 ? ((val / totalExpenses) * 100).toFixed(1) : '0.0';
              return `${ctx.label}: ${formatCurrency(val)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

function renderCategoryBarChart(categories) {
  const wrap = document.getElementById('analytics-category-bar-wrap');
  const empty = document.getElementById('analytics-category-bar-empty');
  const canvas = document.getElementById('analytics-category-bar-chart');

  if (!wrap || !empty || !canvas) return;

  if (categories.length === 0) {
    wrap.hidden = true;
    empty.hidden = false;
    if (categoryBarChart) {
      categoryBarChart.destroy();
      categoryBarChart = null;
    }
    return;
  }

  wrap.hidden = false;
  empty.hidden = true;

  if (typeof window.Chart === 'undefined') return;

  if (categoryBarChart) {
    categoryBarChart.destroy();
  }

  categoryBarChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: categories.map((c) => c.category),
      datasets: [
        {
          label: 'Total Spent',
          data: categories.map((c) => c.amount),
          backgroundColor: categories.map((c) => c.color),
          borderRadius: 5,
          maxBarThickness: 26,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: (ctx) => `Spent: ${formatCurrency(ctx.parsed.x)}`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#f1f5f9' },
          ticks: {
            color: '#64748b',
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (val) => `$${Number(val).toLocaleString()}`,
          },
        },
        y: {
          border: { display: false },
          grid: { display: false },
          ticks: {
            color: '#334155',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          },
        },
      },
    },
  });
}

export function renderAnalyticsView(transactions, range, activeMonthKey) {
  const kpiEl = document.getElementById('analytics-kpis');
  const tableEl = document.getElementById('analytics-breakdown-table');

  const data = computeAnalyticsData(transactions, range, activeMonthKey);
  const rangeLabel =
    range === 'month'
      ? formatMonthLabel(activeMonthKey)
      : range === '3m'
        ? 'Last 3 months'
        : range === '6m'
          ? 'Last 6 months'
          : 'All recorded history';

  if (kpiEl) {
    const savingsClass = data.totalSavings < 0 ? 'is-expense' : 'is-income';
    const topCategoryName = data.highestCategory ? data.highestCategory.category : 'None';
    const topCategoryMeta = data.highestCategory
      ? `${formatCurrency(data.highestCategory.amount)} (${data.highestCategory.percent.toFixed(1)}% of expenses)`
      : 'No expenses in range';

    kpiEl.innerHTML = `
      <article class="kpi-card">
        <span class="kpi-label">Total Savings</span>
        <span class="kpi-value ${savingsClass}">${formatCurrency(data.totalSavings)}</span>
        <span class="kpi-meta">${data.savingsRate.toFixed(1)}% net savings rate · ${escapeHtml(rangeLabel)}</span>
      </article>
      <article class="kpi-card">
        <span class="kpi-label">Highest Spending Category</span>
        <span class="kpi-value">${escapeHtml(topCategoryName)}</span>
        <span class="kpi-meta">${escapeHtml(topCategoryMeta)}</span>
      </article>
      <article class="kpi-card">
        <span class="kpi-label">Period Income</span>
        <span class="kpi-value is-income">${formatCurrency(data.totalIncome)}</span>
        <span class="kpi-meta">${data.scopedCount} total entries analyzed</span>
      </article>
      <article class="kpi-card">
        <span class="kpi-label">Period Expenses</span>
        <span class="kpi-value">${formatCurrency(data.totalExpenses)}</span>
        <span class="kpi-meta">${data.categories.length} active expense categories</span>
      </article>
    `;
  }

  renderIncomeVsExpensesChart(data.monthlySeries);
  renderDistributionChart(data.categories, data.totalExpenses);
  renderCategoryBarChart(data.categories);

  if (tableEl) {
    if (data.categories.length === 0) {
      tableEl.innerHTML = `
        <div class="empty-state-compact">
          <i data-lucide="layers"></i>
          <p>No expense categories to display for this timeframe.</p>
        </div>
      `;
    } else {
      tableEl.innerHTML = `
        <div class="breakdown-list">
          ${data.categories
            .map(
              (item) => `
              <div class="breakdown-row">
                <div class="breakdown-row-top">
                  <div>
                    <span class="breakdown-cat">${escapeHtml(item.category)}</span>
                    <span class="breakdown-meta">${item.count} ${item.count === 1 ? 'entry' : 'entries'}</span>
                  </div>
                  <div class="breakdown-figures">
                    <span>${formatCurrency(item.amount)}</span>
                    <span class="breakdown-pct">${item.percent.toFixed(1)}%</span>
                  </div>
                </div>
                <div class="breakdown-bar-track">
                  <div class="breakdown-bar-fill" style="width: ${item.percent}%; background-color: ${item.color};"></div>
                </div>
              </div>
            `
            )
            .join('')}
        </div>
      `;
    }
  }
}

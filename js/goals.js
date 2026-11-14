/**
 * Smart Savings Goals Logic & View Renderer
 * Manages savings goal targets, deposits, progress tracking, and smart monthly pacing recommendations.
 */

import { escapeHtml, formatCurrency, formatDate } from './transactions.js';

export const GOAL_CATEGORIES = [
  'Emergency Fund',
  'Home & Housing',
  'Vehicle',
  'Travel & Vacation',
  'Education',
  'Electronics & Gadgets',
  'Retirement & Investments',
  'General',
];

/**
 * Calculate aggregate summary figures across all goals
 */
export function calculateGoalsSummary(goals) {
  let totalTarget = 0;
  let totalSaved = 0;
  let completedCount = 0;
  let activeCount = 0;

  for (const g of goals) {
    const target = Number(g.target_amount) || 0;
    const current = Number(g.current_amount) || 0;
    totalTarget += target;
    totalSaved += current;

    if (g.is_completed || g.status === 'completed' || current >= target) {
      completedCount++;
    } else {
      activeCount++;
    }
  }

  const overallProgress = totalTarget > 0
    ? Math.min(100, Math.round((totalSaved / totalTarget) * 1000) / 10)
    : 0;

  return {
    totalTarget: Math.round(totalTarget * 100) / 100,
    totalSaved: Math.round(totalSaved * 100) / 100,
    overallProgress,
    completedCount,
    activeCount,
    totalGoals: goals.length,
  };
}

/**
 * Render the Smart Savings Goals view
 */
export function renderGoalsView(goals, callbacks) {
  const kpiContainer = document.getElementById('goals-kpis');
  const gridContainer = document.getElementById('goals-grid');
  const emptyState = document.getElementById('goals-empty-state');

  if (!kpiContainer || !gridContainer || !emptyState) return;

  const summary = calculateGoalsSummary(goals);

  // Render KPI Summary Cards
  kpiContainer.innerHTML = `
    <article class="kpi-card">
      <span class="kpi-label">Total Saved</span>
      <span class="kpi-value is-income">${formatCurrency(summary.totalSaved)}</span>
      <span class="kpi-meta">${summary.overallProgress.toFixed(1)}% of total goal targets</span>
    </article>
    <article class="kpi-card">
      <span class="kpi-label">Total Target</span>
      <span class="kpi-value">${formatCurrency(summary.totalTarget)}</span>
      <span class="kpi-meta">Across ${summary.totalGoals} planned ${summary.totalGoals === 1 ? 'goal' : 'goals'}</span>
    </article>
    <article class="kpi-card">
      <span class="kpi-label">Active Goals</span>
      <span class="kpi-value">${summary.activeCount}</span>
      <span class="kpi-meta">${summary.completedCount} reached and completed</span>
    </article>
    <article class="kpi-card">
      <span class="kpi-label">Overall Progress</span>
      <span class="kpi-value is-income">${summary.overallProgress.toFixed(1)}%</span>
      <span class="kpi-meta">${formatCurrency(Math.max(0, summary.totalTarget - summary.totalSaved))} remaining</span>
    </article>
  `;

  // Render Goal Cards or Empty State
  if (goals.length === 0) {
    gridContainer.hidden = true;
    emptyState.hidden = false;
    return;
  }

  gridContainer.hidden = false;
  emptyState.hidden = true;

  gridContainer.innerHTML = goals
    .map((goal) => {
      const isCompleted = goal.is_completed || goal.status === 'completed' || goal.current_amount >= goal.target_amount;
      const progress = Math.min(100, Math.max(0, goal.progress_percent || 0));
      const smart = goal.smart_recommendation;

      let insightHtml = '';
      if (isCompleted) {
        insightHtml = `
          <div class="goal-insight is-complete">
            <i data-lucide="check-circle-2"></i>
            <span><strong>Target Reached:</strong> Congratulations on achieving this goal!</span>
          </div>
        `;
      } else if (smart && smart.message) {
        const iconName = smart.type === 'on_track' ? 'sparkles' : smart.type === 'due_soon' ? 'alert-triangle' : 'info';
        const isWarning = smart.type === 'due_soon';
        insightHtml = `
          <div class="goal-insight ${isWarning ? 'is-warning' : 'is-smart'}">
            <i data-lucide="${iconName}"></i>
            <span>${escapeHtml(smart.message)}</span>
          </div>
        `;
      }

      return `
        <article class="goal-card panel" data-goal-id="${escapeHtml(goal.id)}">
          <div class="goal-card-header">
            <div class="goal-title-group">
              <span class="goal-category-badge">${escapeHtml(goal.category || 'General')}</span>
              <h3 class="goal-title">${escapeHtml(goal.title)}</h3>
            </div>
            <div class="goal-header-badges">
              <span class="status-label ${isCompleted ? 'status-nominal' : 'status-warning'}">
                ${isCompleted ? 'Completed' : 'In Progress'}
              </span>
            </div>
          </div>

          <div class="goal-amounts-row">
            <div class="goal-amount-item">
              <span class="goal-amount-label">Saved</span>
              <span class="goal-amount-val amount-income mono-val">${formatCurrency(goal.current_amount)}</span>
            </div>
            <div class="goal-amount-item text-right">
              <span class="goal-amount-label">Target</span>
              <span class="goal-amount-val mono-val">${formatCurrency(goal.target_amount)}</span>
            </div>
          </div>

          <div class="progress-block" style="margin-top: 10px;">
            <div class="progress-meta">
              <span>Progress</span>
              <span class="mono-val">${progress.toFixed(1)}%</span>
            </div>
            <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}">
              <div class="progress-fill ${isCompleted ? 'is-complete' : ''}" style="width: ${progress}%;"></div>
            </div>
            <div class="goal-remaining-meta">
              <span>${isCompleted ? 'Fully funded' : `${formatCurrency(goal.remaining_amount)} remaining`}</span>
              ${goal.target_date ? `<span>Target: ${escapeHtml(formatDate(goal.target_date))}</span>` : ''}
            </div>
          </div>

          ${insightHtml}

          <div class="goal-card-actions">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              data-action="contribute-goal"
              data-id="${escapeHtml(goal.id)}"
            >
              <i data-lucide="plus-circle"></i>
              <span>${isCompleted ? 'Add More Funds' : 'Contribute Funds'}</span>
            </button>

            <div class="goal-card-subactions">
              <button
                type="button"
                class="icon-btn"
                data-action="edit-goal"
                data-id="${escapeHtml(goal.id)}"
                aria-label="Edit goal"
                title="Edit goal"
              >
                <i data-lucide="pencil"></i>
              </button>
              <button
                type="button"
                class="icon-btn icon-btn-danger"
                data-action="delete-goal"
                data-id="${escapeHtml(goal.id)}"
                aria-label="Delete goal"
                title="Delete goal"
              >
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  // Event delegation on grid container
  if (!gridContainer.dataset.bound) {
    gridContainer.addEventListener('click', (event) => {
      const btn = event.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      if (action === 'contribute-goal' && callbacks?.onContribute) {
        callbacks.onContribute(id);
      } else if (action === 'edit-goal' && callbacks?.onEdit) {
        callbacks.onEdit(id);
      } else if (action === 'delete-goal' && callbacks?.onDelete) {
        callbacks.onDelete(id);
      }
    });
    gridContainer.dataset.bound = 'true';
  }
}

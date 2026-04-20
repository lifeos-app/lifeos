/**
 * GoalsFilterBar — Category + time filter bars and financial summary.
 *
 * Extracted from Goals.tsx.
 */

import { CheckSquare, Clock, Wallet, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { GoalNode, GoalTask } from './types';

interface GoalsFilterBarProps {
  goals: GoalNode[];
  allTasks: GoalTask[];
  filteredGoals: GoalNode[];
  filteredTasks: GoalTask[];
  displayGoals: GoalNode[];
  catFilter: string;
  setCatFilter: (f: string) => void;
  timeFilter: string;
  setTimeFilter: (f: string) => void;
  timeRange: { start: string; end: string } | null;
  timeFilteredFinancials: { totalBudget: number; taskExpenses: number; taskIncome: number; net: number };
}

export function GoalsFilterBar({
  goals,
  allTasks,
  filteredGoals,
  filteredTasks,
  displayGoals,
  catFilter,
  setCatFilter,
  timeFilter,
  setTimeFilter,
  timeRange,
  timeFilteredFinancials,
}: GoalsFilterBarProps) {
  return (
    <>
      <div className="goals-filter-bar">
        {[
          { key: 'all', label: 'All', icon: null, count: (timeRange ? filteredGoals.length + filteredTasks.length : goals.length + allTasks.length) },
          { key: 'objective', label: 'Objectives', icon: 'target', count: displayGoals.filter((g: GoalNode) => g.category === 'objective').length },
          { key: 'epic', label: 'Epics', icon: 'zap', count: displayGoals.filter((g: GoalNode) => g.category === 'epic').length },
          { key: 'goal', label: 'Goals', icon: 'flag', count: displayGoals.filter((g: GoalNode) => !g.category || g.category === 'goal').length },
          { key: 'task', label: 'Tasks', icon: <CheckSquare size={12} />, count: (timeRange ? filteredTasks : allTasks).length },
        ].map(f => (
          <button key={f.key} className={`goals-filter-btn ${catFilter === f.key ? 'active' : ''} cat-${f.key}`} onClick={() => setCatFilter(f.key)}>
            {f.icon && <span className="goals-filter-icon">{f.icon}</span>}
            {f.label}
            <span className="goals-filter-count">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="goals-filter-bar" style={{ marginTop: 4, gap: 6 }}>
        {[
          { key: 'all', label: 'All Time', icon: <Clock size={12} /> },
          { key: 'thisMonth', label: 'This Month' },
          { key: 'thisQuarter', label: 'This Quarter' },
          { key: 'nextQuarter', label: 'Next Quarter' },
          { key: 'thisYear', label: 'This Year' },
        ].map(f => (
          <button key={f.key} className={`goals-filter-btn time-filter ${timeFilter === f.key ? 'active' : ''}`} onClick={() => setTimeFilter(f.key)}
            style={{ fontSize: 11, padding: '4px 10px' }}>
            {'icon' in f && f.icon}{f.label}
          </button>
        ))}
      </div>

      {timeFilter !== 'all' && (
        <div className="goals-financial-bar">
          <span className="gfb-item"><Wallet size={12} style={{ marginRight: 4 }} />Budget: <strong>${timeFilteredFinancials.totalBudget.toLocaleString()}</strong></span>
          <span className="gfb-item" style={{ color: '#39FF14' }}><TrendingUp size={12} style={{ marginRight: 4 }} />Income: <strong>${timeFilteredFinancials.taskIncome.toLocaleString()}</strong></span>
          <span className="gfb-item" style={{ color: '#F43F5E' }}><TrendingDown size={12} style={{ marginRight: 4 }} />Cost: <strong>${timeFilteredFinancials.taskExpenses.toLocaleString()}</strong></span>
          <span className="gfb-item" style={{ color: timeFilteredFinancials.net >= 0 ? '#39FF14' : '#F43F5E' }}>
            {timeFilteredFinancials.net >= 0 ? <CheckCircle2 size={12} style={{ marginRight: 4 }} /> : <AlertTriangle size={12} style={{ marginRight: 4 }} />} Net: <strong>${timeFilteredFinancials.net.toLocaleString()}</strong>
          </span>
        </div>
      )}
    </>
  );
}
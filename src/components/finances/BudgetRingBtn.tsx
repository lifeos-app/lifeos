import React from 'react';
import { useLongPress } from '../../hooks/useLongPress';
import type { ExpenseCategory } from './types';

interface BudgetRingBtnProps {
  cat: ExpenseCategory;
  spent: number;
  budget: number;
  pct: number;
  onNavigate: () => void;
  onEditBudget: () => void;
}

export const BudgetRingBtn = React.memo(function BudgetRingBtn({
  cat, spent, budget, pct, onNavigate, onEditBudget,
}: BudgetRingBtnProps) {
  const lp = useLongPress(onEditBudget, 450);
  return (
    <button
      {...lp}
      className="fin-ring-item"
      onClick={onNavigate}
      title={`${cat.name}: $${spent.toFixed(2)} / $${budget.toFixed(2)} — hold to edit budget`}
    >
      <div className="fin-ring-svg-wrap">
        <svg width={72} height={72}>
          <circle cx={36} cy={36} r={30} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={7} />
          <circle
            cx={36} cy={36} r={30} fill="none"
            stroke={pct >= 90 ? '#F43F5E' : pct >= 75 ? '#FACC15' : '#39FF14'}
            strokeWidth={7}
            strokeDasharray={`${2 * Math.PI * 30}`}
            strokeDashoffset={2 * Math.PI * 30 * (1 - Math.min(pct, 100) / 100)}
            strokeLinecap="round"
            transform="rotate(-90 36 36)"
          />
          <text x={36} y={36} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="rgba(255,255,255,0.7)">{cat.icon || '📦'}</text>
          <text x={36} y={49} textAnchor="middle" fontSize={8} fill={pct >= 90 ? '#F43F5E' : pct >= 75 ? '#FACC15' : '#39FF14'}>{Math.round(pct)}%</text>
        </svg>
      </div>
      <div className="fin-ring-name">{cat.name}</div>
      <div className="fin-ring-sub">${spent.toFixed(0)}</div>
    </button>
  );
});

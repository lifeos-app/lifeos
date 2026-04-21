/**
 * FinanceTabActions — Contextual add buttons based on active tab.
 */

import { Plus } from 'lucide-react';
import type { Tab, FormMode } from './types';

interface FinanceTabActionsProps {
  tab: Tab;
  setFormMode: (m: FormMode) => void;
}

export function FinanceTabActions({ tab, setFormMode }: FinanceTabActionsProps) {
  return (
    <div className="fin-header-actions" style={{ marginBottom: 12 }}>
      {tab === 'work' && (
        <>
          <button className="fin-add-btn secondary" onClick={() => setFormMode('business')}><Plus size={16} /> Business</button>
          <button className="fin-add-btn secondary" onClick={() => setFormMode('client')}><Plus size={16} /> Client</button>
          <button className="fin-add-btn" onClick={() => setFormMode('income')}><Plus size={16} /> Income</button>
        </>
      )}
      {(tab === 'overview' || tab === 'expenses') && (
        <button className="fin-add-btn" onClick={() => setFormMode('expense')}><Plus size={16} /> Add Expense</button>
      )}
      {tab === 'income' && (
        <button className="fin-add-btn" onClick={() => setFormMode('income')}><Plus size={16} /> Add Income</button>
      )}
      {tab === 'bills' && (
        <button className="fin-add-btn" onClick={() => setFormMode('bill')}><Plus size={16} /> Add Bill</button>
      )}
    </div>
  );
}
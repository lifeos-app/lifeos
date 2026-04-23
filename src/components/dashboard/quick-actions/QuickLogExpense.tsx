/**
 * QuickLogExpense — Amount, category, optional note. One-tap save.
 * Mirrors QuickLogIncome UX pattern but for expenses.
 */

import { useState, useRef, useEffect } from 'react';
import { Receipt, Send } from 'lucide-react';
import { BottomSheet } from '../../BottomSheet';
import { useFinanceStore } from '../../../stores/useFinanceStore';
import { useUserStore } from '../../../stores/useUserStore';
import { localDateStr } from '../../../utils/date';
import { showToast } from '../../Toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function QuickLogExpense({ open, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const user = useUserStore(s => s.user);
  const categories = useFinanceStore(s => s.categories);
  const invalidate = useFinanceStore(s => s.invalidate);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 350);
    } else {
      setAmount('');
      setCategoryId('');
      setNote('');
    }
  }, [open]);

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0 || !user?.id || saving) return;

    setSaving(true);

    try {
      const result = await useFinanceStore.getState().addExpense({
        amount: numAmount,
        date: localDateStr(),
        description: note.trim() || 'Quick expense',
        category_id: categoryId || undefined,
        is_deductible: false,
      });

      if (result) {
        const cat = categories.find(c => c.id === categoryId);
        const catLabel = cat ? `${cat.icon} ${cat.name}` : 'Expense';
        showToast(`-$${numAmount.toFixed(2)} ${catLabel}`, '', '#F97316');
        invalidate();
        setAmount('');
        setCategoryId('');
        setNote('');
        onClose();
      } else {
        showToast('Failed to save expense', '', '#F43F5E');
      }
    } catch {
      showToast('Failed to save expense', '', '#F43F5E');
    }
    setSaving(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Log Expense" icon={<Receipt size={18} />}>
      <div className="bs-field">
        <label className="bs-label">Amount ($AUD)</label>
        <input
          ref={inputRef}
          className="bs-input"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}
        />
      </div>

      <div className="bs-field">
        <label className="bs-label">Category</label>
        {categories.length > 0 ? (
          <select className="bs-select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">Select category...</option>
            {categories
              .filter(c => !c.name.toLowerCase().includes('income'))
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
          </select>
        ) : (
          <input
            className="bs-input"
            placeholder="e.g. Fuel, Supplies, Food..."
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        )}
      </div>

      <div className="bs-field">
        <label className="bs-label">Note (optional)</label>
        <input
          className="bs-input"
          placeholder="Quick description..."
          value={note}
          onChange={e => setNote(e.target.value)}
        />
      </div>

      <button
        className="bs-submit"
        onClick={handleSubmit}
        disabled={!amount || parseFloat(amount) <= 0 || saving}
        style={{ background: 'rgba(249,115,22,0.15)', borderColor: 'rgba(249,115,22,0.3)', color: '#F97316' }}
      >
        <Send size={16} />
        {saving ? 'Saving...' : `Log -$${parseFloat(amount || '0').toFixed(2)}`}
      </button>
    </BottomSheet>
  );
}
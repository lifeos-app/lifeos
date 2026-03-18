/**
 * QuickLogIncome — Amount, source, optional note. One-tap save.
 */

import { useState, useRef, useEffect } from 'react';
import { DollarSign, Send } from 'lucide-react';
import { BottomSheet } from '../../BottomSheet';
import { useFinanceStore } from '../../../stores/useFinanceStore';
import { useUserStore } from '../../../stores/useUserStore';
import { localDateStr } from '../../../utils/date';
import { showToast } from '../../Toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function QuickLogIncome({ open, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const user = useUserStore(s => s.user);
  const businesses = useFinanceStore(s => s.businesses);
  const clients = useFinanceStore(s => s.clients);
  const invalidate = useFinanceStore(s => s.invalidate);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 350);
    } else {
      setAmount('');
      setSource('');
      setNote('');
    }
  }, [open]);

  // Build source options from businesses and clients
  const sourceOptions = [
    ...businesses.filter(b => !b.is_deleted && b.status !== 'inactive').map(b => ({ id: b.id, label: `${b.icon || '🏢'} ${b.name}`, type: 'business' })),
    ...clients.filter(c => c.is_active && !c.is_deleted).map(c => ({ id: c.id, label: `👤 ${c.name}`, type: 'client' })),
  ];

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0 || !user?.id || saving) return;
    
    setSaving(true);
    
    const selectedSource = sourceOptions.find(s => s.id === source);
    
    // Use store method instead of direct Supabase
    const result = await useFinanceStore.getState().addIncome({
      amount: numAmount,
      date: localDateStr(),
      description: note.trim() || (selectedSource ? selectedSource.label.replace(/^[^\s]+ /, '') : 'Quick income'),
      source: selectedSource ? selectedSource.label.replace(/^[^\s]+ /, '') : (source || 'Other'),
      client_id: selectedSource?.type === 'client' ? selectedSource.id : null,
    });
    
    if (result) {
      showToast(`+$${numAmount.toFixed(2)} logged! 💰`, '💵', '#39FF14');
      invalidate();
      setAmount('');
      setSource('');
      setNote('');
      onClose();
    } else {
      showToast('Failed to save income', '❌', '#F43F5E');
    }
    setSaving(false);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Log Income" icon={<DollarSign size={18} />}>
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
        <label className="bs-label">Source</label>
        {sourceOptions.length > 0 ? (
          <select className="bs-select" value={source} onChange={e => setSource(e.target.value)}>
            <option value="">Select source...</option>
            {sourceOptions.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
            <option value="__other">Other</option>
          </select>
        ) : (
          <input
            className="bs-input"
            placeholder="e.g. TCS Cleaning, Security shift..."
            value={source}
            onChange={e => setSource(e.target.value)}
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
      >
        <Send size={16} />
        {saving ? 'Saving...' : `Log $${parseFloat(amount || '0').toFixed(2)}`}
      </button>
    </BottomSheet>
  );
}

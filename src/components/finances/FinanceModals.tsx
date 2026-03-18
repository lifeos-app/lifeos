/**
 * FinanceModals — All finance form modals extracted from Finances.tsx orchestrator.
 * Manages local form state internally, calls context CRUD via callbacks.
 */

import { useState } from 'react';
import {
  X, Loader2, Plus, Save, RefreshCw, ScrollText, Car,
  ArrowUpCircle, ArrowDownCircle, Edit2, Sparkles,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useUserStore } from '../../stores/useUserStore';
import { logUnifiedEvent } from '../../lib/events';
import { useGamificationContext } from '../../lib/gamification/context';
import { EmojiIcon } from '../../lib/emoji-icon';
import { genId, todayStr, thisMonth, fmtCurrency } from '../../utils/date';
import { ConfirmDialog } from '../ConfirmDialog';
import { useFinances } from './FinancesContext';
import type { FormMode, ExpenseCategory, FinanceGoal } from './types';

function today() { return todayStr(); }

/* ═══════════════════════════════════════════════════════════════
   Income Form Modal
   ═══════════════════════════════════════════════════════════════ */

export function IncomeFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const user = useUserStore(s => s.user);
  const { awardXP } = useGamificationContext();
  const { businesses, clients } = useFinances();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [incAmount, setIncAmount] = useState('');
  const [incDate, setIncDate] = useState(today());
  const [incDesc, setIncDesc] = useState('');
  const [incSource, setIncSource] = useState('');
  const [incBusiness, setIncBusiness] = useState('');
  const [incClient, setIncClient] = useState('');
  const [incRecurring, setIncRecurring] = useState(false);
  const [incRecurrence, setIncRecurrence] = useState('monthly');
  const [incDeductible, setIncDeductible] = useState(false);
  const [incInvoice, setIncInvoice] = useState('');
  const [incPaymentMethod, setIncPaymentMethod] = useState('Bank Transfer');
  const [incGSTIncluded, setIncGSTIncluded] = useState(false);

  const addIncome = async () => {
    if (!incAmount || parseFloat(incAmount) <= 0) { setError('Enter a valid amount'); return; }
    setSaving(true); setError('');
    const amt = parseFloat(incAmount);
    const gstAmount = incGSTIncluded ? amt / 11 : 0;
    const metadata = { invoice: incInvoice.trim() || null, payment_method: incPaymentMethod, gst_included: incGSTIncluded, gst_amount: incGSTIncluded ? gstAmount : null, recurrence: incRecurring ? incRecurrence : null };
    const resolvedSource = incSource.trim() || (incBusiness ? (businesses.find(b => b.id === incBusiness)?.name || 'Business') : 'Other');
    const incId = genId(); const txId = genId();
    const enrichedDesc = [incDesc.trim(), incInvoice.trim() ? `[Invoice: ${incInvoice.trim()}]` : '', incPaymentMethod ? `[${incPaymentMethod}]` : '', incGSTIncluded ? `[GST: ${fmtCurrency(gstAmount)}]` : ''].filter(Boolean).join(' ');
    const [incErr, txErr] = await Promise.all([
      supabase.from('income').insert({ id: incId, user_id: user?.id, amount: amt, date: incDate, description: enrichedDesc, source: resolvedSource, client_id: incClient || null, is_recurring: incRecurring }).then(r => r.error),
      supabase.from('transactions').insert({ id: txId, user_id: user?.id, type: 'income', amount: amt, title: incDesc.trim() || resolvedSource || 'Income', date: incDate, business_id: incBusiness || null, client_id: incClient || null, recurring: incRecurring, notes: JSON.stringify(metadata) }).then(r => r.error),
    ]);
    if (incErr || txErr) { setError((incErr || txErr)!.message); setSaving(false); return; }
    if (user?.id) {
      logUnifiedEvent({
        user_id: user.id, timestamp: `${incDate}T12:00:00`, type: 'income',
        title: `${resolvedSource}: $${amt.toFixed(2)}`,
        details: { amount: amt, source: resolvedSource, description: incDesc.trim(), income_id: incId },
        module_source: 'finance',
      });
      awardXP('financial_entry', { description: `Income: $${amt}` });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fin-modal" onClick={onClose}>
      <div className="fin-form-modal" onClick={e => e.stopPropagation()}>
        <div className="fin-form-header"><h3>Add Income</h3><button onClick={onClose} aria-label="Close form"><X size={18} /></button></div>
        {error && <div className="fin-form-error">{error}</div>}
        <div className="fin-form-grid">
          <div className="fin-form-group"><label>Amount ($)</label><input type="number" step="0.01" min="0" placeholder="0.00" value={incAmount} onChange={e => setIncAmount(e.target.value)} autoFocus /></div>
          <div className="fin-form-group"><label>Date</label><input type="date" value={incDate} onChange={e => setIncDate(e.target.value)} /></div>
          <div className="fin-form-group"><label>Business (optional)</label><select value={incBusiness} onChange={e => { setIncBusiness(e.target.value); setIncClient(''); }}><option value="">None</option>{businesses.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}</select></div>
          <div className="fin-form-group"><label>Client (optional)</label><select value={incClient} onChange={e => setIncClient(e.target.value)} disabled={!incBusiness && clients.every(c => c.business_id)}><option value="">None</option>{(incBusiness ? clients.filter(c => c.business_id === incBusiness) : clients).filter(c => c.is_active).map(c => (<option key={c.id} value={c.id}>{c.name}{c.rate ? ` ($${c.rate})` : ''}</option>))}</select></div>
        </div>
        <div className="fin-form-group"><label>Description / Source</label><input type="text" placeholder="What was this income for?" value={incDesc} onChange={e => setIncDesc(e.target.value)} /></div>
        <div className="fin-form-grid">
          <div className="fin-form-group"><label>Invoice/Reference # (optional)</label><input type="text" placeholder="INV-001" value={incInvoice} onChange={e => setIncInvoice(e.target.value)} /></div>
          <div className="fin-form-group"><label>Payment Method</label><select value={incPaymentMethod} onChange={e => setIncPaymentMethod(e.target.value)}><option value="Bank Transfer">Bank Transfer</option><option value="Cash">Cash</option><option value="Card">Card</option><option value="Other">Other</option></select></div>
        </div>
        <div className="fin-form-group"><label>Source / Category</label><input type="text" placeholder="e.g. Cleaning, Security, Freelance..." value={incSource} onChange={e => setIncSource(e.target.value)} /></div>
        <div className="fin-form-checks">
          <label className="fin-check-label"><input type="checkbox" checked={incGSTIncluded} onChange={e => setIncGSTIncluded(e.target.checked)} />GST Included{incGSTIncluded && incAmount && <span className="fin-gst-hint">GST: {fmtCurrency(parseFloat(incAmount) / 11)}</span>}</label>
          <label className="fin-check-label"><input type="checkbox" checked={incRecurring} onChange={e => setIncRecurring(e.target.checked)} /><RefreshCw size={12} className="fin-check-icon" />Recurring{incRecurring && (<select value={incRecurrence} onChange={e => setIncRecurrence(e.target.value)} className="fin-recurrence-select"><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select>)}</label>
          <label className="fin-check-label"><input type="checkbox" checked={incDeductible} onChange={e => setIncDeductible(e.target.checked)} /><ScrollText size={12} className="fin-check-icon" />Tax Deductible</label>
        </div>
        <div className="fin-form-actions"><button className="fin-form-cancel" onClick={onClose}>Cancel</button><button className="fin-form-save income" onClick={addIncome} disabled={saving}>{saving ? <><Loader2 size={14} className="spin" /> Saving...</> : 'Add Income'}</button></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Expense Form Modal
   ═══════════════════════════════════════════════════════════════ */

export function ExpenseFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const user = useUserStore(s => s.user);
  const { awardXP } = useGamificationContext();
  const { businesses, categories, goals } = useFinances();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(today());
  const [expDesc, setExpDesc] = useState('');
  const [expCategory, setExpCategory] = useState('');
  const [expBusiness, setExpBusiness] = useState('');
  const [expDeductible, setExpDeductible] = useState(false);
  const [expRecurring, setExpRecurring] = useState(false);
  const [expRecurrence, setExpRecurrence] = useState('monthly');
  const [expKm, setExpKm] = useState('');
  const [expOdometer, setExpOdometer] = useState('');
  const [expIsTravel, setExpIsTravel] = useState(false);
  const [expReceipt, setExpReceipt] = useState('');
  const [expPaymentMethod, setExpPaymentMethod] = useState('Card');
  const [expGSTIncluded, setExpGSTIncluded] = useState(false);
  const [expObjective, setExpObjective] = useState('');
  const [expEpic, setExpEpic] = useState('');
  const [expGoal, setExpGoal] = useState('');

  const addExpense = async () => {
    if (!expAmount || parseFloat(expAmount) <= 0) { setError('Enter a valid amount'); return; }
    setSaving(true); setError('');
    const amt = parseFloat(expAmount);
    const gstAmount = expGSTIncluded ? amt / 11 : 0;
    const expId = genId(); const txId = genId();
    const travelMeta = expIsTravel ? JSON.stringify({ km: expKm ? parseFloat(expKm) : null, odometer: expOdometer ? parseFloat(expOdometer) : null }) : null;
    const metadata = { receipt: expReceipt.trim() || null, payment_method: expPaymentMethod, gst_included: expGSTIncluded, gst_amount: expGSTIncluded ? gstAmount : null, goal_id: expGoal || null, travel: travelMeta ? JSON.parse(travelMeta) : null, recurrence: expRecurring ? expRecurrence : null };
    const fullDesc = [expDesc.trim(), expKm ? `(${expKm}km)` : ''].filter(Boolean).join(' ');
    const [expErr, txErr] = await Promise.all([
      supabase.from('expenses').insert({ id: expId, user_id: user?.id, amount: amt, date: expDate, description: fullDesc, category_id: expCategory || null, is_deductible: expDeductible }).then(r => r.error),
      supabase.from('transactions').insert({ id: txId, user_id: user?.id, type: 'expense', amount: amt, title: expDesc.trim() || 'Expense', date: expDate, category_id: expCategory || null, business_id: expBusiness || null, recurring: expRecurring, notes: JSON.stringify(metadata) }).then(r => r.error),
    ]);
    if (expErr || txErr) { setError((expErr || txErr)!.message); setSaving(false); return; }
    if (user?.id) {
      logUnifiedEvent({
        user_id: user.id, timestamp: `${expDate}T12:00:00`, type: 'expense',
        title: `${expDesc.trim() || 'Expense'}: $${amt.toFixed(2)}`,
        details: { amount: amt, description: fullDesc, category_id: expCategory || null, expense_id: expId },
        module_source: 'finance',
      });
      awardXP('financial_entry', { description: `Expense: ${expDesc.trim() || 'Expense'}` });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fin-modal" onClick={onClose}>
      <div className="fin-form-modal" onClick={e => e.stopPropagation()}>
        <div className="fin-form-header"><h3>Add Expense</h3><button onClick={onClose} aria-label="Close form"><X size={18} /></button></div>
        {error && <div className="fin-form-error">{error}</div>}
        <div className="fin-form-grid">
          <div className="fin-form-group"><label>Amount ($)</label><input type="number" step="0.01" min="0" placeholder="0.00" value={expAmount} onChange={e => setExpAmount(e.target.value)} autoFocus /></div>
          <div className="fin-form-group"><label>Date</label><input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} /></div>
          <div className="fin-form-group"><label>Category</label><select value={expCategory} onChange={e => setExpCategory(e.target.value)}><option value="">Select category</option>{categories.filter(c => !expBusiness || c.scope === 'business').map(c => (<option key={c.id} value={c.id}>{c.icon} {c.name}</option>))}</select></div>
          <div className="fin-form-group"><label>Business (optional)</label><select value={expBusiness} onChange={e => setExpBusiness(e.target.value)}><option value="">Personal</option>{businesses.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}</select></div>
        </div>
        <div className="fin-form-group"><label>Description</label><input type="text" placeholder="What was this expense?" value={expDesc} onChange={e => setExpDesc(e.target.value)} /></div>
        <div className="fin-form-grid">
          <div className="fin-form-group"><label>Receipt/Reference # (optional)</label><input type="text" placeholder="RCP-001" value={expReceipt} onChange={e => setExpReceipt(e.target.value)} /></div>
          <div className="fin-form-group"><label>Payment Method</label><select value={expPaymentMethod} onChange={e => setExpPaymentMethod(e.target.value)}><option value="Card">Card</option><option value="Bank Transfer">Bank Transfer</option><option value="Cash">Cash</option><option value="Other">Other</option></select></div>
        </div>
        <div className="fin-form-group"><label className="fin-form-label-sm">Link to Goal (optional)</label>
          <div className="fin-goal-selectors">
            <select value={expObjective} onChange={e => { setExpObjective(e.target.value); setExpEpic(''); setExpGoal(''); }} className="fin-goal-select"><option value="">Any objective</option>{goals.filter(g => (g as Record<string, unknown>).category === 'objective').map(g => (<option key={g.id} value={g.id}>{(g as Record<string, unknown>).icon as string} {g.title}</option>))}</select>
            <select value={expEpic} onChange={e => { setExpEpic(e.target.value); setExpGoal(''); }} disabled={!expObjective} className={`fin-goal-select ${!expObjective ? 'disabled' : ''}`}><option value="">{expObjective ? 'Any epic' : '← Pick objective first'}</option>{goals.filter(g => (g as Record<string, unknown>).category === 'epic' && (!expObjective || g.parent_goal_id === expObjective)).map(g => (<option key={g.id} value={g.id}>{(g as Record<string, unknown>).icon as string} {g.title}</option>))}</select>
            <select value={expGoal} onChange={e => setExpGoal(e.target.value)} disabled={!expEpic && !!expObjective} className={`fin-goal-select ${(!expEpic && !!expObjective) ? 'disabled' : ''}`}><option value="">⊘ No goal</option>{goals.filter(g => (!(g as Record<string, unknown>).category || (g as Record<string, unknown>).category === 'goal') && (!expEpic || g.parent_goal_id === expEpic)).map(g => (<option key={g.id} value={g.id}>{(g as Record<string, unknown>).icon as string} {g.title}</option>))}</select>
          </div>
        </div>
        <div className="fin-form-checks">
          <label className="fin-check-label"><input type="checkbox" checked={expGSTIncluded} onChange={e => setExpGSTIncluded(e.target.checked)} />GST Included{expGSTIncluded && expAmount && <span className="fin-gst-hint">GST: {fmtCurrency(parseFloat(expAmount) / 11)}</span>}</label>
          <label className="fin-check-label"><input type="checkbox" checked={expRecurring} onChange={e => setExpRecurring(e.target.checked)} /><RefreshCw size={12} className="fin-check-icon" />Recurring{expRecurring && (<select value={expRecurrence} onChange={e => setExpRecurrence(e.target.value)} className="fin-recurrence-select"><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select>)}</label>
          <label className="fin-check-label"><input type="checkbox" checked={expDeductible} onChange={e => setExpDeductible(e.target.checked)} /><ScrollText size={12} className="fin-check-icon" />Tax Deductible</label>
          <label className="fin-check-label"><input type="checkbox" checked={expIsTravel} onChange={e => setExpIsTravel(e.target.checked)} /><Car size={12} className="fin-check-icon" />Travel/Mileage</label>
        </div>
        {expIsTravel && (<div className="fin-form-grid"><div className="fin-form-group"><label>Distance (km)</label><input type="number" min="0" step="0.1" placeholder="134" value={expKm} onChange={e => setExpKm(e.target.value)} /></div><div className="fin-form-group"><label>Odometer Reading</label><input type="number" min="0" placeholder="Current reading" value={expOdometer} onChange={e => setExpOdometer(e.target.value)} /></div></div>)}
        <div className="fin-form-actions"><button className="fin-form-cancel" onClick={onClose}>Cancel</button><button className="fin-form-save expense" onClick={addExpense} disabled={saving}>{saving ? <><Loader2 size={14} className="spin" /> Saving...</> : 'Add Expense'}</button></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Bill Form Modal
   ═══════════════════════════════════════════════════════════════ */

export function BillFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const user = useUserStore(s => s.user);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [billTitle, setBillTitle] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDue, setBillDue] = useState(today());
  const [billRecurrence, setBillRecurrence] = useState('monthly');
  const [billRecurring, setBillRecurring] = useState(false);

  const addBill = async () => {
    if (!billTitle.trim() || !billAmount || parseFloat(billAmount) <= 0) { setError('Title and amount required'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('bills').insert({ id: genId(), user_id: user?.id, title: billTitle.trim(), amount: parseFloat(billAmount), due_date: billDue, is_recurring: billRecurring, recurrence_rule: billRecurring ? billRecurrence : null, status: 'pending' });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fin-modal" onClick={onClose}>
      <div className="fin-form-modal" onClick={e => e.stopPropagation()}>
        <div className="fin-form-header"><h3>Add Bill</h3><button onClick={onClose} aria-label="Close form"><X size={18} /></button></div>
        {error && <div className="fin-form-error">{error}</div>}
        <div className="fin-form-grid">
          <div className="fin-form-group"><label>Title</label><input type="text" placeholder="Bill name" value={billTitle} onChange={e => setBillTitle(e.target.value)} autoFocus /></div>
          <div className="fin-form-group"><label>Amount ($)</label><input type="number" step="0.01" min="0" placeholder="0.00" value={billAmount} onChange={e => setBillAmount(e.target.value)} /></div>
          <div className="fin-form-group"><label>Due Date</label><input type="date" value={billDue} onChange={e => setBillDue(e.target.value)} /></div>
        </div>
        <label className="fin-check-label"><input type="checkbox" checked={billRecurring} onChange={e => setBillRecurring(e.target.checked)} />Recurring{billRecurring && (<select value={billRecurrence} onChange={e => setBillRecurrence(e.target.value)} className="fin-recurrence-select"><option value="weekly">Weekly</option><option value="fortnightly">Fortnightly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select>)}</label>
        <div className="fin-form-actions"><button className="fin-form-cancel" onClick={onClose}>Cancel</button><button className="fin-form-save bills" onClick={addBill} disabled={saving}>{saving ? <><Loader2 size={14} className="spin" /> Saving...</> : 'Add Bill'}</button></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Business Form Modal
   ═══════════════════════════════════════════════════════════════ */

export function BusinessFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const user = useUserStore(s => s.user);
  const { goals } = useFinances();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [bizName, setBizName] = useState('');
  const [bizType, setBizType] = useState<'business' | 'employment' | 'freelance' | 'side-hustle'>('business');
  const [bizIcon, setBizIcon] = useState('💼');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [bizColor, setBizColor] = useState('#00D4FF');
  const [bizStatus, setBizStatus] = useState('active');
  const [bizNotes, setBizNotes] = useState('');
  const [bizIndustry, setBizIndustry] = useState('');
  const [bizCustomIndustry, setBizCustomIndustry] = useState('');
  const [bizABN, setBizABN] = useState('');
  const [bizRevenueTarget, setBizRevenueTarget] = useState('');
  const [bizBudget, setBizBudget] = useState('');
  const [bizObjective, setBizObjective] = useState('');
  const [bizStartDate, setBizStartDate] = useState('');
  const [bizWebsite, setBizWebsite] = useState('');

  const addBusiness = async () => {
    if (!bizName.trim()) { setError('Business name required'); return; }
    setSaving(true); setError('');
    const resolvedIndustry = bizIndustry === 'Other' ? (bizCustomIndustry.trim() || 'Other') : (bizIndustry || null);
    const extendedData = { industry: resolvedIndustry, abn: bizABN.trim() || null, revenue_target: bizRevenueTarget ? parseFloat(bizRevenueTarget) : null, budget: bizBudget ? parseFloat(bizBudget) : null, objective_id: bizObjective || null, start_date: bizStartDate || null, website: bizWebsite.trim() || null, description: bizNotes.trim() || null };
    const { error: err } = await supabase.from('businesses').insert({ id: genId(), user_id: user?.id, name: bizName.trim(), type: bizType, icon: bizIcon, color: bizColor, status: bizStatus, notes: JSON.stringify(extendedData) });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fin-modal" onClick={onClose}>
      <div className="fin-form-modal large" onClick={e => e.stopPropagation()}>
        <div className="fin-form-header"><h3>Create New Business</h3><button onClick={onClose} aria-label="Close form"><X size={18} /></button></div>
        {error && <div className="fin-form-error">{error}</div>}
        <div className="fin-form-grid">
          <div className="fin-form-group"><label>Name *</label><input type="text" placeholder="Business name" value={bizName} onChange={e => setBizName(e.target.value)} autoFocus /></div>
          <div className="fin-form-group"><label>Type</label><select value={bizType} onChange={e => setBizType(e.target.value as 'business' | 'employment' | 'freelance' | 'side-hustle')}><option value="business">Business</option><option value="employment">Employment</option><option value="freelance">Freelance</option><option value="side-hustle">Side Hustle</option></select></div>
          <div className="fin-form-group"><label>Icon</label><div className="fin-emoji-picker-wrap"><button type="button" className="fin-emoji-selected" aria-label="Select business icon" onClick={() => setShowEmojiPicker(!showEmojiPicker)}><EmojiIcon emoji={bizIcon} size={16} fallbackAsText /> <Edit2 size={10} /></button><input type="text" placeholder="💼" value={bizIcon} onChange={e => setBizIcon(e.target.value)} maxLength={4} className="fin-emoji-input" />{showEmojiPicker && (<div className="fin-emoji-grid">{['💼','🏢','🧹','🛡️','💻','🏗️','🏠','🏥','📚','🛒','🍽️','🌾','🚚','🎨','⚡','🔧','📱','🎯','🚀','💰','🏆','🎬','🎵','🏋️','✈️','🔬','⚖️','🌍','🧑‍🍳','🛍️','📸','🎓'].map(emoji => (<button key={emoji} type="button" className="fin-emoji-option" onClick={() => { setBizIcon(emoji); setShowEmojiPicker(false); }}>{emoji}</button>))}</div>)}</div></div>
          <div className="fin-form-group"><label>Color</label><input type="color" value={bizColor} onChange={e => setBizColor(e.target.value)} /></div>
        </div>
        <div className="fin-form-grid">
          <div className="fin-form-group"><label>Industry/Sector</label><select value={bizIndustry} onChange={e => { setBizIndustry(e.target.value); if (e.target.value !== 'Other') setBizCustomIndustry(''); }}><option value="">Select...</option>{['Cleaning','Security','Technology','Construction','Real Estate','Healthcare','Education','Retail','Hospitality','Agriculture','Transport','Creative','Consulting','Other'].map(i => <option key={i} value={i}>{i}</option>)}</select>{bizIndustry === 'Other' && <input type="text" placeholder="Enter custom industry..." value={bizCustomIndustry} onChange={e => setBizCustomIndustry(e.target.value)} className="fin-custom-industry" />}</div>
          <div className="fin-form-group"><label>ABN/Registration</label><input type="text" placeholder="Optional" value={bizABN} onChange={e => setBizABN(e.target.value)} /></div>
          <div className="fin-form-group"><label>Revenue Target ($/month)</label><input type="number" step="0.01" min="0" placeholder="What do you aim to earn?" value={bizRevenueTarget} onChange={e => setBizRevenueTarget(e.target.value)} /></div>
          <div className="fin-form-group"><label>Monthly Budget ($)</label><input type="number" step="0.01" min="0" placeholder="Expected spend" value={bizBudget} onChange={e => setBizBudget(e.target.value)} /></div>
        </div>
        <div className="fin-form-grid">
          <div className="fin-form-group"><label>Linked Objective</label><select value={bizObjective} onChange={e => setBizObjective(e.target.value)}><option value="">None</option>{goals.filter(g => (g as Record<string, unknown>).category === 'objective').map(g => <option key={g.id} value={g.id}>{g.title}</option>)}</select></div>
          <div className="fin-form-group"><label>Start Date</label><input type="month" value={bizStartDate} onChange={e => setBizStartDate(e.target.value)} /></div>
          <div className="fin-form-group"><label>Website/Contact</label><input type="text" placeholder="Optional" value={bizWebsite} onChange={e => setBizWebsite(e.target.value)} /></div>
        </div>
        <div className="fin-form-group"><label>Description</label><textarea placeholder="What does this business do?" value={bizNotes} onChange={e => setBizNotes(e.target.value)} rows={3} /></div>
        <div className="fin-form-actions"><button className="fin-form-cancel" onClick={onClose}>Cancel</button><button className="fin-form-save" style={{ background: bizColor }} onClick={addBusiness} disabled={saving}>{saving ? <><Loader2 size={14} className="spin" /> Creating...</> : 'Create Business'}</button></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Client Form Modal
   ═══════════════════════════════════════════════════════════════ */

export function ClientFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const user = useUserStore(s => s.user);
  const { businesses } = useFinances();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [clientName, setClientName] = useState('');
  const [clientBusiness, setClientBusiness] = useState('');
  const [clientRate, setClientRate] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [clientSOP, setClientSOP] = useState('');
  const [clientAccess, setClientAccess] = useState('');
  const [clientActive, setClientActive] = useState(true);

  const addClient = async () => {
    if (!clientName.trim()) { setError('Client name required'); return; }
    if (!clientBusiness) { setError('Select a business'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('clients').insert({ id: genId(), user_id: user?.id, name: clientName.trim(), business_id: clientBusiness, rate: clientRate ? parseFloat(clientRate) : null, rate_type: 'per_clean', phone: clientPhone.trim() || null, email: clientEmail.trim() || null, address: clientAddress.trim() || null, notes: clientNotes.trim() || null, sop: clientSOP.trim() || null, access_codes: clientAccess.trim() || null, is_active: clientActive, is_deleted: false, sync_status: 'synced' });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fin-modal" onClick={onClose}>
      <div className="fin-form-modal large" onClick={e => e.stopPropagation()}>
        <div className="fin-form-header"><h3>Add Client</h3><button onClick={onClose} aria-label="Close form"><X size={18} /></button></div>
        {error && <div className="fin-form-error">{error}</div>}
        <div className="fin-form-grid">
          <div className="fin-form-group"><label>Name *</label><input type="text" placeholder="Client name" value={clientName} onChange={e => setClientName(e.target.value)} autoFocus /></div>
          <div className="fin-form-group"><label>Business *</label><select value={clientBusiness} onChange={e => setClientBusiness(e.target.value)}><option value="">Select business</option>{businesses.map(b => <option key={b.id} value={b.id}>{b.icon} {b.name}</option>)}</select></div>
          <div className="fin-form-group"><label>Rate ($)</label><input type="number" step="0.01" min="0" placeholder="0.00" value={clientRate} onChange={e => setClientRate(e.target.value)} /></div>
          <div className="fin-form-group"><label>Phone</label><input type="tel" placeholder="+61..." value={clientPhone} onChange={e => setClientPhone(e.target.value)} /></div>
          <div className="fin-form-group"><label>Email</label><input type="email" placeholder="client@example.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} /></div>
        </div>
        <div className="fin-form-group"><label>Address</label><input type="text" placeholder="Full address" value={clientAddress} onChange={e => setClientAddress(e.target.value)} /></div>
        <div className="fin-form-group"><label>Notes</label><textarea placeholder="General notes..." value={clientNotes} onChange={e => setClientNotes(e.target.value)} rows={2} /></div>
        <div className="fin-form-group"><label>SOP</label><textarea placeholder="Standard operating procedure..." value={clientSOP} onChange={e => setClientSOP(e.target.value)} rows={2} /></div>
        <div className="fin-form-group"><label>Access Codes</label><textarea placeholder="Gate codes, keys, etc..." value={clientAccess} onChange={e => setClientAccess(e.target.value)} rows={2} /></div>
        <label className="fin-check-label"><input type="checkbox" checked={clientActive} onChange={e => setClientActive(e.target.checked)} />Active client</label>
        <div className="fin-form-actions"><button className="fin-form-cancel" onClick={onClose}>Cancel</button><button className="fin-form-save" onClick={addClient} disabled={saving}>{saving ? <><Loader2 size={14} className="spin" /> Saving...</> : 'Add Client'}</button></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Category Form Modal
   ═══════════════════════════════════════════════════════════════ */

export function CategoryFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const user = useUserStore(s => s.user);
  const { categories } = useFinances();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');
  const [catColor, setCatColor] = useState('#F43F5E');
  const [catScope, setCatScope] = useState<'personal' | 'business'>('personal');
  const [catBudget, setCatBudget] = useState('');

  const addCategory = async () => {
    if (!catName.trim()) { setError('Category name required'); return; }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('expense_categories').insert({ id: genId(), user_id: user?.id, name: catName.trim(), icon: catIcon, color: catColor, scope: catScope, budget_monthly: catBudget ? parseFloat(catBudget) : null, sort_order: categories.length });
    if (err) { setError(err.message); setSaving(false); return; }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fin-modal" onClick={onClose}>
      <div className="fin-form-modal" onClick={e => e.stopPropagation()}>
        <div className="fin-form-header"><h3>Add Category</h3><button onClick={onClose} aria-label="Close form"><X size={18} /></button></div>
        {error && <div className="fin-form-error">{error}</div>}
        <div className="fin-form-grid">
          <div className="fin-form-group"><label>Name</label><input type="text" placeholder="Category name" value={catName} onChange={e => setCatName(e.target.value)} autoFocus /></div>
          <div className="fin-form-group"><label>Icon</label><input type="text" placeholder="📦" value={catIcon} onChange={e => setCatIcon(e.target.value)} maxLength={2} /></div>
          <div className="fin-form-group"><label>Color</label><input type="color" value={catColor} onChange={e => setCatColor(e.target.value)} /></div>
          <div className="fin-form-group"><label>Scope</label><select value={catScope} onChange={e => setCatScope(e.target.value as 'personal' | 'business')}><option value="personal">Personal</option><option value="business">Business</option></select></div>
          <div className="fin-form-group"><label>Monthly Budget ($)</label><input type="number" step="0.01" min="0" placeholder="0.00" value={catBudget} onChange={e => setCatBudget(e.target.value)} /></div>
        </div>
        <div className="fin-form-actions"><button className="fin-form-cancel" onClick={onClose}>Cancel</button><button className="fin-form-save" style={{ background: catColor }} onClick={addCategory} disabled={saving}>{saving ? <><Loader2 size={14} className="spin" /> Saving...</> : 'Add Category'}</button></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Bill Edit Modal (existing bill inline edit)
   ═══════════════════════════════════════════════════════════════ */

export function BillEditModal({ billId, initialTitle, initialAmount, initialDue, onClose, onSaved }: {
  billId: string; initialTitle: string; initialAmount: string; initialDue: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [amount, setAmount] = useState(initialAmount);
  const [due, setDue] = useState(initialDue);

  const save = async () => {
    if (!title.trim() || !amount) return;
    await supabase.from('bills').update({ title: title.trim(), amount: parseFloat(amount), due_date: due }).eq('id', billId);
    onSaved();
  };

  return (
    <div className="fin-modal" onClick={onClose}>
      <div className="fin-form-modal" onClick={e => e.stopPropagation()}>
        <div className="fin-form-header"><h3>Edit Bill</h3><button onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="fin-form-grid">
          <div className="fin-form-group"><label>Title</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); }} autoFocus /></div>
          <div className="fin-form-group"><label>Amount ($)</label><input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div className="fin-form-group"><label>Due Date</label><input type="date" value={due} onChange={e => setDue(e.target.value)} /></div>
        </div>
        <div className="fin-form-actions"><button className="fin-form-cancel" onClick={onClose}>Cancel</button><button className="fin-form-save bills" onClick={save}>Save Changes</button></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Budget Editor Modal
   ═══════════════════════════════════════════════════════════════ */

export function BudgetEditorModal({ category, onClose, onSaved }: {
  category: ExpenseCategory & { spent: number; budget: number };
  onClose: () => void; onSaved: () => void;
}) {
  const { saveBudget } = useFinances();
  const [saving, setSaving] = useState(false);
  const [budgetModalAmount, setBudgetModalAmount] = useState(category.budget.toString());
  const pct = category.budget > 0 ? (category.spent / category.budget) * 100 : 0;

  const save = async () => {
    const amount = parseFloat(budgetModalAmount);
    if (isNaN(amount) || amount < 0) return;
    setSaving(true);
    await saveBudget(category.id, amount);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fin-modal" onClick={onClose}>
      <div className="fin-budget-editor-modal" onClick={e => e.stopPropagation()}>
        <div className="fin-budget-editor-header">
          <div className="fin-budget-editor-title">
            <span className="fin-budget-editor-icon">{category.icon || '📦'}</span>
            <div><h3>{category.name}</h3><span className="fin-budget-editor-subtitle">Monthly Budget</span></div>
          </div>
          <button onClick={onClose} aria-label="Close budget editor"><X size={20} /></button>
        </div>
        <div className="fin-budget-editor-body">
          <div className="fin-budget-current">
            <div className="fin-budget-stat"><span className="fin-budget-stat-label">Spent This Month</span><span className="fin-budget-stat-value spent">{fmtCurrency(category.spent)}</span></div>
            <div className="fin-budget-stat"><span className="fin-budget-stat-label">Current Budget</span><span className="fin-budget-stat-value budget">{fmtCurrency(category.budget)}</span></div>
          </div>
          <div className="fin-budget-progress-wrap">
            <div className="fin-budget-progress-bar">
              <div className={`fin-budget-progress-fill ${pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'ok'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="fin-budget-progress-pct">{Math.round(pct)}% used</span>
          </div>
          <div className="fin-budget-edit-section"><label>Set New Budget</label><div className="fin-budget-input-wrap"><span className="fin-budget-currency">$</span><input type="number" min="0" step="10" value={budgetModalAmount} onChange={e => setBudgetModalAmount(e.target.value)} placeholder="0.00" autoFocus /><span className="fin-budget-per-month">/month</span></div></div>
        </div>
        <div className="fin-budget-editor-footer"><button className="fin-budget-btn-cancel" onClick={onClose}>Cancel</button><button className="fin-budget-btn-save" onClick={save} disabled={saving || !budgetModalAmount || parseFloat(budgetModalAmount) < 0}>{saving ? <><Loader2 size={14} className="spin" /> Saving...</> : <><Save size={14} /> Save Budget</>}</button></div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Quick-Add Modal
   ═══════════════════════════════════════════════════════════════ */

export function QuickAddModal({ initialType = 'expense', onClose, onSaved }: {
  initialType?: 'income' | 'expense'; onClose: () => void; onSaved: () => void;
}) {
  const user = useUserStore(s => s.user);
  const { awardXP } = useGamificationContext();
  const { categories } = useFinances();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [quickType, setQuickType] = useState<'income' | 'expense'>(initialType);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCategory, setQuickCategory] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickDate, setQuickDate] = useState(today());

  const suggestCategory = (desc: string): string | null => {
    const d = desc.toLowerCase();
    if (d.includes('coles') || d.includes('woolworth') || d.includes('iga') || d.includes('food')) {
      return categories.find(c => c.name.toLowerCase().includes('grocer') || c.name.toLowerCase().includes('food'))?.id || null;
    }
    if (d.includes('fuel') || d.includes('petrol') || d.includes('shell') || d.includes('bp')) {
      return categories.find(c => c.name.toLowerCase().includes('transport') || c.name.toLowerCase().includes('fuel'))?.id || null;
    }
    if (d.includes('netflix') || d.includes('spotify') || d.includes('gym')) {
      return categories.find(c => c.name.toLowerCase().includes('sub'))?.id || null;
    }
    return null;
  };

  const handleQuickDescChange = (val: string) => {
    setQuickDesc(val);
    if (!quickCategory && val.length > 2) {
      const suggested = suggestCategory(val);
      if (suggested) setQuickCategory(suggested);
    }
  };

  const saveQuickTransaction = async () => {
    if (!quickAmount || parseFloat(quickAmount) <= 0) { setError('Enter valid amount'); return; }
    setSaving(true); setError('');
    const amt = parseFloat(quickAmount);
    const txId = genId();
    if (quickType === 'income') {
      const incId = genId();
      const [incErr, txErr] = await Promise.all([
        supabase.from('income').insert({ id: incId, user_id: user?.id, amount: amt, date: quickDate, description: quickDesc.trim() || 'Income', source: 'Other', is_recurring: false }).then(r => r.error),
        supabase.from('transactions').insert({ id: txId, user_id: user?.id, type: 'income', amount: amt, title: quickDesc.trim() || 'Income', date: quickDate }).then(r => r.error),
      ]);
      if (incErr || txErr) { setError((incErr || txErr)!.message); setSaving(false); return; }
      if (user?.id) {
        logUnifiedEvent({ user_id: user.id, timestamp: `${quickDate}T12:00:00`, type: 'income', title: `${quickDesc.trim() || 'Income'}: $${amt.toFixed(2)}`, details: { amount: amt, description: quickDesc.trim() }, module_source: 'finance' });
        awardXP('financial_entry', { description: `Income: $${amt}` });
      }
    } else {
      const expId = genId();
      const [expErr, txErr] = await Promise.all([
        supabase.from('expenses').insert({ id: expId, user_id: user?.id, amount: amt, date: quickDate, description: quickDesc.trim() || 'Expense', category_id: quickCategory || null, is_deductible: false }).then(r => r.error),
        supabase.from('transactions').insert({ id: txId, user_id: user?.id, type: 'expense', amount: amt, title: quickDesc.trim() || 'Expense', date: quickDate, category_id: quickCategory || null }).then(r => r.error),
      ]);
      if (expErr || txErr) { setError((expErr || txErr)!.message); setSaving(false); return; }
      if (user?.id) {
        logUnifiedEvent({ user_id: user.id, timestamp: `${quickDate}T12:00:00`, type: 'expense', title: `${quickDesc.trim() || 'Expense'}: $${amt.toFixed(2)}`, details: { amount: amt, description: quickDesc.trim(), category_id: quickCategory }, module_source: 'finance' });
        awardXP('financial_entry', { description: `Expense: ${quickDesc.trim() || 'Expense'}` });
      }
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fin-modal" onClick={onClose}>
      <div className="fin-quick-add-modal" onClick={e => e.stopPropagation()}>
        <div className="fin-quick-add-header"><h3>Quick Add {quickType === 'income' ? 'Income' : 'Expense'}</h3><button onClick={onClose} aria-label="Close quick add"><X size={18} /></button></div>
        {error && <div className="fin-form-error">{error}</div>}
        <div className="fin-quick-add-body">
          <div className="fin-quick-type-toggle">
            <button className={quickType === 'expense' ? 'active' : ''} onClick={() => setQuickType('expense')}><ArrowDownCircle size={16} /> Expense</button>
            <button className={quickType === 'income' ? 'active' : ''} onClick={() => setQuickType('income')}><ArrowUpCircle size={16} /> Income</button>
          </div>
          <div className="fin-quick-input-group"><label>Amount</label><div className="fin-quick-amount-input"><span className="fin-quick-currency">$</span><input type="number" min="0" step="0.01" value={quickAmount} onChange={e => setQuickAmount(e.target.value)} placeholder="0.00" autoFocus /></div></div>
          <div className="fin-quick-input-group"><label>Description</label><input type="text" value={quickDesc} onChange={e => handleQuickDescChange(e.target.value)} placeholder={quickType === 'income' ? 'e.g., Client payment' : 'e.g., Coles groceries'} />{quickDesc && suggestCategory(quickDesc) && <span className="fin-quick-hint"><Sparkles size={12} /> Auto-categorized based on description</span>}</div>
          {quickType === 'expense' && (<div className="fin-quick-input-group"><label>Category</label><select value={quickCategory} onChange={e => setQuickCategory(e.target.value)}><option value="">Uncategorized</option>{categories.filter(c => c.scope === 'personal').map(cat => (<option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>))}</select></div>)}
          <div className="fin-quick-input-group"><label>Date</label><input type="date" value={quickDate} onChange={e => setQuickDate(e.target.value)} /></div>
        </div>
        <div className="fin-quick-add-footer"><button className="fin-quick-btn-cancel" onClick={onClose}>Cancel</button><button className={`fin-quick-btn-save ${quickType}`} onClick={saveQuickTransaction} disabled={saving || !quickAmount || parseFloat(quickAmount) <= 0}>{saving ? <><Loader2 size={14} className="spin" /> Adding...</> : <><Plus size={14} /> Add {quickType === 'income' ? 'Income' : 'Expense'}</>}</button></div>
      </div>
    </div>
  );
}

/**
 * SharedBudgetPanel.tsx — Family budget tracking
 *
 * Shared income/expenses with per-member attribution, budget categories,
 * "Who spent what?" breakdown, savings goals, monthly budget vs actual,
 * and allowance tracking for kids.
 */

import { useState, useMemo } from 'react';
import { useFamilyCircles } from './useFamilyCircles';
import type { BudgetTransaction } from '../../stores/familyStore';

export function SharedBudgetPanel() {
  const {
    activeCircle, addTransaction, addSavingsGoal,
    contributeToSavings, setAllowance, updateMonthlyIncome,
  } = useFamilyCircles();

  const [showAddTx, setShowAddTx] = useState(false);
  const [showAddSavings, setShowAddSavings] = useState(false);
  const [showSetAllowance, setShowSetAllowance] = useState(false);

  // Transaction form
  const [txAmount, setTxAmount] = useState('');
  const [txCategory, setTxCategory] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txMemberId, setTxMemberId] = useState('');
  const [txIsIncome, setTxIsIncome] = useState(false);

  // Savings form
  const [savingsTitle, setSavingsTitle] = useState('');
  const [savingsEmoji, setSavingsEmoji] = useState('🏖️');
  const [savingsTarget, setSavingsTarget] = useState('');
  const [savingsDeadline, setSavingsDeadline] = useState('');

  // Allowance form
  const [allowanceMemberId, setAllowanceMemberId] = useState('');
  const [allowanceAmount, setAllowanceAmount] = useState('');
  const [allowanceFreq, setAllowanceFreq] = useState<'weekly' | 'monthly'>('weekly');

  const circle = activeCircle;
  if (!circle) return null;

  const budget = circle.sharedBudget;

  const totalSpent = useMemo(() => budget.categories.reduce((s, c) => s + c.spent, 0), [budget.categories]);
  const totalLimit = useMemo(() => budget.categories.reduce((s, c) => s + c.limit, 0), [budget.categories]);
  const budgetPercent = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

  // Per-member spending breakdown
  const memberSpending = useMemo(() => {
    const byMember: Record<string, { name: string; avatar: string; totalSpent: number; totalIncome: number; byCategory: Record<string, number> }> = {};
    circle.members.forEach(m => {
      byMember[m.id] = { name: m.name, avatar: m.avatar, totalSpent: 0, totalIncome: 0, byCategory: {} };
    });
    budget.transactions.forEach(tx => {
      if (!byMember[tx.memberId]) return;
      if (tx.isIncome) {
        byMember[tx.memberId].totalIncome += tx.amount;
      } else {
        byMember[tx.memberId].totalSpent += tx.amount;
        byMember[tx.memberId].byCategory[tx.category] =
          (byMember[tx.memberId].byCategory[tx.category] || 0) + tx.amount;
      }
    });
    return Object.entries(byMember)
      .filter(([, data]) => data.totalSpent > 0 || data.totalIncome > 0)
      .sort(([, a], [, b]) => b.totalSpent - a.totalSpent);
  }, [budget.transactions, circle.members]);

  const handleAddTx = () => {
    if (!txAmount || !txCategory || !txMemberId) return;
    addTransaction(circle.id, {
      amount: parseFloat(txAmount),
      category: txCategory,
      description: txDescription || (txIsIncome ? 'Income' : 'Expense'),
      memberId: txMemberId,
      date: new Date().toISOString().split('T')[0],
      isIncome: txIsIncome,
    });
    setTxAmount('');
    setTxDescription('');
    setShowAddTx(false);
  };

  const handleAddSavings = () => {
    if (!savingsTitle || !savingsTarget) return;
    addSavingsGoal(circle.id, {
      title: savingsTitle,
      emoji: savingsEmoji,
      target: parseFloat(savingsTarget),
      deadline: savingsDeadline || undefined,
      contributors: circle.members.map(m => m.id),
    });
    setSavingsTitle('');
    setSavingsTarget('');
    setSavingsDeadline('');
    setShowAddSavings(false);
  };

  const handleSetAllowance = () => {
    if (!allowanceMemberId || !allowanceAmount) return;
    setAllowance(circle.id, allowanceMemberId, parseFloat(allowanceAmount), allowanceFreq);
    setAllowanceAmount('');
    setShowSetAllowance(false);
  };

  const SAVINGS_EMOJIS = ['🏖️', '🚗', '🏥', '🎓', '🏠', '💍', '🎄', '✈️', '🎮'];
  const children = circle.members.filter(m => m.role === 'child');

  return (
    <div className="space-y-4">
      {/* Budget Overview */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-900/20 to-yellow-900/20 border border-amber-500/15">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-amber-100">Monthly Budget</span>
          <span className={`text-lg font-bold ${budgetPercent > 90 ? 'text-red-400' : budgetPercent > 70 ? 'text-amber-300' : 'text-emerald-300'}`}>
            {budgetPercent}%
          </span>
        </div>

        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, budgetPercent)}%`,
              background: budgetPercent > 90
                ? 'linear-gradient(90deg, #EF4444, #F87171)'
                : budgetPercent > 70
                  ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                  : 'linear-gradient(90deg, #10B981, #34D399)',
            }}
          />
        </div>

        <div className="flex justify-between text-xs">
          <span className="text-white/40">${totalSpent.toFixed(0)} spent</span>
          <span className="text-white/40">${totalLimit.toFixed(0)} budget</span>
        </div>

        {budget.monthlyIncome > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10 flex justify-between text-[10px]">
            <span className="text-emerald-300/60">Monthly income: ${budget.monthlyIncome.toFixed(0)}</span>
            <span className="text-white/30">Remaining: ${(budget.monthlyIncome - totalSpent).toFixed(0)}</span>
          </div>
        )}
      </div>

      {/* Income Setting */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/40">Monthly income:</span>
        <input
          type="number"
          value={budget.monthlyIncome || ''}
          onChange={e => updateMonthlyIncome(circle.id, parseFloat(e.target.value) || 0)}
          placeholder="0"
          className="w-24 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 outline-none text-right"
        />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowAddTx(true)}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600/20 to-yellow-600/20 border border-amber-500/15 text-xs font-medium text-amber-200 hover:from-amber-500/30 hover:to-yellow-500/30 transition-all"
        >
          + Expense
        </button>
        <button
          onClick={() => setShowAddSavings(true)}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/15 text-xs font-medium text-emerald-200 hover:from-emerald-500/30 hover:to-teal-500/30 transition-all"
        >
          + Savings Goal
        </button>
        {children.length > 0 && (
          <button
            onClick={() => { setShowSetAllowance(true); if (children[0]) setAllowanceMemberId(children[0].id); }}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-blue-500/15 text-xs font-medium text-blue-200 hover:from-blue-500/30 hover:to-indigo-500/30 transition-all"
          >
            + Allowance
          </button>
        )}
      </div>

      {/* Add Transaction Form */}
      {showAddTx && (
        <div className="p-4 rounded-xl bg-gradient-to-b from-amber-900/20 to-yellow-900/20 border border-amber-500/15 space-y-3">
          <h4 className="text-sm font-semibold text-amber-100">Add Transaction</h4>

          <div className="flex gap-2 mb-1">
            <button
              onClick={() => setTxIsIncome(false)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !txIsIncome ? 'bg-red-600/30 border border-red-400/30 text-white' : 'bg-white/5 border border-white/10 text-white/40'
              }`}
            >
              💸 Expense
            </button>
            <button
              onClick={() => setTxIsIncome(true)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                txIsIncome ? 'bg-emerald-600/30 border border-emerald-400/30 text-white' : 'bg-white/5 border border-white/10 text-white/40'
              }`}
            >
              💰 Income
            </button>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-1 block">Amount</label>
            <input
              type="number"
              value={txAmount}
              onChange={e => setTxAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-amber-500/20 text-white placeholder-white/30 text-sm outline-none focus:border-amber-400/50"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-1 block">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {budget.categories.map(cat => (
                <button
                  key={cat.name}
                  onClick={() => setTxCategory(cat.name)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                    txCategory === cat.name
                      ? 'text-white'
                      : 'bg-white/5 border-white/10 text-white/40'
                  }`}
                  style={txCategory === cat.name ? {
                    backgroundColor: cat.color + '30',
                    borderColor: cat.color + '50',
                  } : {}}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-1 block">Who?</label>
            <div className="flex flex-wrap gap-1.5">
              {circle.members.map(m => (
                <button
                  key={m.id}
                  onClick={() => setTxMemberId(m.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    txMemberId === m.id
                      ? 'bg-amber-600/30 border-amber-400/40 text-white'
                      : 'bg-white/5 border-white/10 text-white/40'
                  }`}
                >
                  <span className="text-sm">{m.avatar}</span> {m.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-1 block">Note</label>
            <input
              type="text"
              value={txDescription}
              onChange={e => setTxDescription(e.target.value)}
              placeholder="What was this for?"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-amber-500/20 text-white placeholder-white/30 text-sm outline-none focus:border-amber-400/50"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddTx}
              disabled={!txAmount || !txCategory || !txMemberId}
              className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-black"
            >
              {txIsIncome ? '💰 Add Income' : '💸 Add Expense'}
            </button>
            <button
              onClick={() => setShowAddTx(false)}
              className="px-4 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-white/60 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Savings Goal Form */}
      {showAddSavings && (
        <div className="p-4 rounded-xl bg-gradient-to-b from-emerald-900/20 to-teal-900/20 border border-emerald-500/15 space-y-3">
          <h4 className="text-sm font-semibold text-emerald-100">New Savings Goal</h4>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-emerald-300/50 mb-1.5 block">Goal</label>
            <input
              type="text"
              value={savingsTitle}
              onChange={e => setSavingsTitle(e.target.value)}
              placeholder="Family vacation, emergency fund..."
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-emerald-500/20 text-white placeholder-white/30 text-sm outline-none focus:border-emerald-400/50"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-emerald-300/50 mb-1.5 block">Emoji</label>
            <div className="flex gap-2">
              {SAVINGS_EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setSavingsEmoji(e)}
                  className={`text-xl w-9 h-9 rounded-lg transition-all ${
                    savingsEmoji === e ? 'bg-emerald-500/30 scale-110 border border-emerald-400/50' : 'bg-white/5 border border-white/10'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-emerald-300/50 mb-1.5 block">Target Amount</label>
            <input
              type="number"
              value={savingsTarget}
              onChange={e => setSavingsTarget(e.target.value)}
              placeholder="5000"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-emerald-500/20 text-white placeholder-white/30 text-sm outline-none focus:border-emerald-400/50"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddSavings}
              disabled={!savingsTitle || !savingsTarget}
              className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-black"
            >
              🎯 Create Goal
            </button>
            <button
              onClick={() => setShowAddSavings(false)}
              className="px-4 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-white/60 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Allowance Form */}
      {showSetAllowance && (
        <div className="p-4 rounded-xl bg-gradient-to-b from-blue-900/20 to-indigo-900/20 border border-blue-500/15 space-y-3">
          <h4 className="text-sm font-semibold text-blue-100">Set Allowance</h4>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-blue-300/50 mb-1.5 block">For</label>
            <div className="flex gap-2">
              {children.map(m => (
                <button
                  key={m.id}
                  onClick={() => setAllowanceMemberId(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    allowanceMemberId === m.id ? 'bg-blue-600/30 border-blue-400/40 text-white' : 'bg-white/5 border-white/10 text-white/40'
                  }`}
                >
                  {m.avatar} {m.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-blue-300/50 mb-1.5 block">Amount</label>
            <input
              type="number"
              value={allowanceAmount}
              onChange={e => setAllowanceAmount(e.target.value)}
              placeholder="20"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-blue-500/20 text-white placeholder-white/30 text-sm outline-none focus:border-blue-400/50"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-blue-300/50 mb-1.5 block">Frequency</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAllowanceFreq('weekly')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  allowanceFreq === 'weekly' ? 'bg-blue-600/30 border border-blue-400/30 text-white' : 'bg-white/5 border border-white/10 text-white/40'
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setAllowanceFreq('monthly')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  allowanceFreq === 'monthly' ? 'bg-blue-600/30 border border-blue-400/30 text-white' : 'bg-white/5 border border-white/10 text-white/40'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSetAllowance}
              disabled={!allowanceMemberId || !allowanceAmount}
              className="flex-1 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white"
            >
              💵 Set Allowance
            </button>
            <button
              onClick={() => setShowSetAllowance(false)}
              className="px-4 py-2.5 rounded-xl text-sm bg-white/5 border border-white/10 text-white/60 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Budget Categories */}
      <div>
        <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">Budget Categories</h3>
        <div className="space-y-2">
          {budget.categories.map(cat => {
            const pct = cat.limit > 0 ? Math.round((cat.spent / cat.limit) * 100) : 0;
            const isOver = pct > 100;
            return (
              <div key={cat.name} className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-xs font-medium text-white/70">{cat.name}</span>
                  </div>
                  <span className={`text-[10px] font-mono ${isOver ? 'text-red-400' : 'text-white/40'}`}>
                    ${cat.spent.toFixed(0)} / ${cat.limit.toFixed(0)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      backgroundColor: isOver ? '#EF4444' : cat.color,
                      opacity: isOver ? 1 : 0.7,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Who Spent What */}
      {memberSpending.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">Who Spent What?</h3>
          <div className="space-y-2">
            {memberSpending.map(([memberId, data]) => (
              <div key={memberId} className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{data.avatar}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white/70">{data.name}</span>
                      <span className="text-xs text-red-300/70">-${data.totalSpent.toFixed(0)}</span>
                    </div>
                    {data.totalIncome > 0 && (
                      <span className="text-[10px] text-emerald-300/50">+${data.totalIncome.toFixed(0)} income</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(data.byCategory).map(([cat, amount]) => {
                    const catData = budget.categories.find(c => c.name === cat);
                    return (
                      <span
                        key={cat}
                        className="px-2 py-0.5 rounded-full text-[9px] border"
                        style={{
                          backgroundColor: (catData?.color || '#666') + '15',
                          borderColor: (catData?.color || '#666') + '30',
                          color: catData?.color || '#999',
                        }}
                      >
                        {cat}: ${amount.toFixed(0)}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Savings Goals */}
      {budget.savingsGoals.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">Savings Goals</h3>
          <div className="space-y-2">
            {budget.savingsGoals.map(goal => {
              const pct = goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0;
              const isComplete = pct >= 100;
              return (
                <div key={goal.id} className={`p-3 rounded-lg border ${isComplete ? 'bg-emerald-900/10 border-emerald-500/15' : 'bg-white/[0.03] border-white/5'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{goal.emoji}</span>
                      <span className="text-xs font-medium text-white/70">{goal.title}</span>
                    </div>
                    <span className={`text-xs ${isComplete ? 'text-emerald-300' : 'text-white/40'}`}>
                      ${goal.current.toFixed(0)} / ${goal.target.toFixed(0)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: isComplete ? 'linear-gradient(90deg, #10B981, #34D399)' : 'linear-gradient(90deg, #F59E0B, #FBBF24)',
                      }}
                    />
                  </div>
                  {!isComplete && (
                    <div className="flex gap-1">
                      {[10, 25, 50, 100].map(amt => (
                        <button
                          key={amt}
                          onClick={() => contributeToSavings(circle.id, goal.id, amt)}
                          className="flex-1 py-1 rounded text-[9px] bg-emerald-600/20 border border-emerald-500/15 text-emerald-200/70 hover:bg-emerald-500/30 transition-all"
                        >
                          +${amt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Allowances */}
      {budget.allowances.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">Allowances</h3>
          <div className="space-y-2">
            {budget.allowances.map(allowance => {
              const member = circle.members.find(m => m.id === allowance.memberId);
              return (
                <div key={allowance.memberId} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{member?.avatar || '👤'}</span>
                    <div>
                      <span className="text-xs font-medium text-white/70">{member?.name || 'Unknown'}</span>
                      <div className="text-[10px] text-white/30">
                        ${allowance.amount}/{allowance.frequency}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-blue-200/70">${allowance.balance.toFixed(2)}</div>
                    <div className="text-[9px] text-white/25">balance</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {budget.transactions.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-widest text-amber-300/50 mb-2">Recent Transactions</h3>
          <div className="space-y-1">
            {budget.transactions.slice(0, 10).map(tx => {
              const member = circle.members.find(m => m.id === tx.memberId);
              return (
                <div key={tx.id} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-sm">{tx.isIncome ? '💰' : '💸'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-white/60 truncate">
                      {tx.description} — {member?.name || 'Unknown'}
                    </p>
                  </div>
                  <span className={`text-xs font-mono ${tx.isIncome ? 'text-emerald-300/70' : 'text-red-300/70'}`}>
                    {tx.isIncome ? '+' : '-'}${tx.amount.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
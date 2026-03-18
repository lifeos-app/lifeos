import React from 'react';
import { useFinances } from './FinancesContext';
import { LongPressRow } from './LongPressRow';
import { fmtCurrency, fmtShort, fmtDate, colorForIndex } from './types';
import { DonutChart, SparkLine } from '../charts';
import { EmojiIcon } from '../../lib/emoji-icon';
import {
  ArrowDownCircle, Calendar, Plus, Edit2, Save, X, Trash2, Check,
  ChevronDown, ChevronRight, ChevronLeft, ScrollText,
} from 'lucide-react';

export const ExpensesTab = React.memo(function ExpensesTab() {
  const ctx = useFinances();
  const {
    expenses, transactions, categories, businesses, budgets, som,
    monthExpenses, expenseByCategory, personalCategories, categoryTrends,
    drillCategory, setDrillCategory,
    expensesDonutSlice, setExpensesDonutSlice,
    txSearch, setTxSearch, txCategoryFilter, setTxCategoryFilter,
    editingId, editAmount, setEditAmount, editDesc, setEditDesc, editDate, setEditDate,
    editSaving, startEditing, saveInlineEdit, cancelEditing,
    expandedTx, setExpandedTx,
    editingBudget, setEditingBudget, budgetValue, setBudgetValue, saveBudget,
    setFormMode, confirmDelete, deleteRow,
  } = ctx;

  const thisMonthExp = expenses.filter(e => e.date >= som);
  const thisMonthExpTx = transactions.filter(t => t.type === 'expense' && t.date >= som);

  // Merge and group
  type MergedExpense = { id: string; date: string; amount: number; title: string; source_table: 'expenses' | 'transactions'; category_id: string | null; description?: string | null; is_deductible?: boolean; business_id?: string | null };
  const allExpenses: MergedExpense[] = [
    ...thisMonthExp.map(e => ({ ...e, source_table: 'expenses' as const, title: e.description || 'Expense' })),
    ...thisMonthExpTx.map(t => ({ ...t, source_table: 'transactions' as const, title: t.title || t.description || 'Expense' })),
  ].filter(item => {
    if (txSearch) {
      const search = txSearch.toLowerCase();
      if (!(item.title?.toLowerCase().includes(search) || String(item.description || '').toLowerCase().includes(search))) return false;
    }
    if (txCategoryFilter && item.category_id !== txCategoryFilter) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const grouped: Record<string, MergedExpense[]> = {};
  allExpenses.forEach(item => {
    if (!grouped[item.date]) grouped[item.date] = [];
    grouped[item.date].push(item);
  });

  return (
    <div className="fin-tab-content">
      {/* Expenses donut */}
      {expenseByCategory.length > 0 && (
        <div className="fin-glass-card fin-exp-donut-card">
          <div className="fin-section-label"><ArrowDownCircle size={11} /> Expenses by Category</div>
          <div className="fin-exp-donut-wrap">
            <DonutChart
              size={180}
              strokeWidth={28}
              segments={expenseByCategory.map(([cat, amt], i) => ({ label: cat, value: amt, color: colorForIndex(i) }))}
              centerLabel="Total"
              centerValue={fmtShort(monthExpenses)}
              selectedIndex={expensesDonutSlice}
              onSegmentTap={(i) => {
                setExpensesDonutSlice(expensesDonutSlice === i ? null : i);
                const catName = expenseByCategory[i]?.[0];
                const cat = categories.find(c => c.name === catName);
                setDrillCategory(expensesDonutSlice === i ? null : (cat?.id || null));
              }}
            />
            <div className="fin-exp-donut-legend">
              {expenseByCategory.map(([cat, amt], i) => (
                <button
                  key={cat}
                  className={`fin-donut-legend-item ${expensesDonutSlice === i ? 'active' : ''}`}
                  onClick={() => {
                    setExpensesDonutSlice(expensesDonutSlice === i ? null : i);
                    const catObj = categories.find(c => c.name === cat);
                    setDrillCategory(expensesDonutSlice === i ? null : (catObj?.id || null));
                  }}
                  style={{ '--legend-color': colorForIndex(i) } as React.CSSProperties}
                >
                  <span className="fin-donut-legend-dot" style={{ background: colorForIndex(i) }} />
                  <div>
                    <div className="fin-donut-legend-label">{cat}</div>
                    <div className="fin-donut-legend-val" style={{ color: colorForIndex(i) }}>{fmtCurrency(amt)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category list with sparklines */}
      <div className="fin-glass-card">
        <div className="fin-section-label">Categories</div>
        {personalCategories.length === 0 ? (
          <div className="fin-empty-small"><p>No categories yet</p><button className="fin-add-btn secondary" onClick={() => setFormMode('category')}><Plus size={14} /> Add Category</button></div>
        ) : (
          <div className="fin-cat-list">
            {personalCategories.filter(({ spent }) => spent > 0).map(({ cat, spent, budget, pct }) => {
              const trend = categoryTrends.find(ct => ct.cat.id === cat.id)?.trend || [];
              const isDrill = drillCategory === cat.id;
              return (
                <div key={cat.id} className={`fin-cat-row ${isDrill ? 'active' : ''}`} onClick={() => setDrillCategory(isDrill ? null : cat.id)} style={{ '--cat-color': cat.color || '#F43F5E' } as React.CSSProperties}>
                  <span className="fin-cat-icon" style={{ background: `${cat.color || '#F43F5E'}20`, color: cat.color || '#F43F5E' }}><EmojiIcon emoji={cat.icon || '📦'} size={14} fallbackAsText /></span>
                  <div className="fin-cat-info">
                    <div className="fin-cat-name">{cat.name}</div>
                    {budget > 0 && (
                      <div className="fin-cat-progress-bar">
                        <div className="fin-cat-progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 90 ? '#F43F5E' : pct >= 75 ? '#FBBF24' : (cat.color || '#F43F5E') }} />
                      </div>
                    )}
                  </div>
                  {trend.some(v => v > 0) && <SparkLine data={trend} color={cat.color || '#F43F5E'} width={60} height={28} filled />}
                  <div className="fin-cat-amounts">
                    <span className="fin-cat-spent" style={{ color: cat.color || '#F43F5E' }}>{fmtCurrency(spent)}</span>
                    {budget > 0 && <span className="fin-cat-budget">/ {fmtCurrency(budget)}</span>}
                  </div>
                  {isDrill ? <ChevronDown size={14} className="fin-cat-chevron" /> : <ChevronRight size={14} className="fin-cat-chevron" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drill-down panel */}
      {drillCategory && (
        <div className="fin-glass-card fin-drill-panel">
          {(() => {
            const cat = categories.find(c => c.id === drillCategory);
            const catTx = expenses.filter(e => e.category_id === drillCategory && e.date >= som);
            const catTxFull = [...catTx, ...transactions.filter(t => t.type === 'expense' && t.category_id === drillCategory && t.date >= som)];
            const total = catTxFull.reduce((s, t) => s + (t.amount || 0), 0);
            return (
              <>
                <div className="fin-drill-header">
                  <button className="fin-drill-back" aria-label="Back to categories" onClick={() => setDrillCategory(null)}><ChevronLeft size={16} /></button>
                  <span className="fin-drill-title">
                    {cat && <EmojiIcon emoji={cat.icon || '📦'} size={16} fallbackAsText />} {cat?.name || 'Category'}
                  </span>
                  <span className="fin-drill-total" style={{ color: cat?.color || '#F43F5E' }}>{fmtCurrency(total)}</span>
                </div>
                {catTxFull.length === 0 ? (
                  <div className="fin-empty-small"><p>No transactions in this category this month</p></div>
                ) : (
                  <div className="fin-tx-list">
                    {catTxFull.sort((a, b) => b.date.localeCompare(a.date)).map(t => (
                      <div key={t.id} className="fin-tx-row expense">
                        <span className="fin-tx-date">{fmtDate(t.date)}</span>
                        <div className="fin-tx-info">
                          <span className="fin-tx-title">{String((t as { description?: string }).description || (t as { title?: string }).title || 'Expense')}</span>
                          {'is_deductible' in t && (t as { is_deductible?: boolean }).is_deductible && <span className="fin-tx-meta">Tax deductible</span>}
                        </div>
                        <strong className="fin-tx-amount expense">-{fmtCurrency(t.amount)}</strong>
                        {'description' in t && (
                          <button className="fin-row-action edit" aria-label="Edit" onClick={() => startEditing({ id: t.id, amount: t.amount, description: (t as { description?: string }).description, title: (t as { title?: string }).title, date: t.date })}><Edit2 size={14} /></button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <button className="fin-add-btn fin-drill-add-btn" onClick={() => { setFormMode('expense'); }}>
                  <Plus size={14} /> Add to {cat?.name || 'Category'}
                </button>
                <div className="fin-category-budget-editor">
                  <span className="fin-category-budget-label">Monthly Budget:</span>
                  {editingBudget === drillCategory ? (
                    <div className="fin-category-budget-edit">
                      <input type="number" step="0.01" min="0" value={budgetValue} onChange={e => setBudgetValue(e.target.value)} autoFocus />
                      <button aria-label="Save budget" onClick={() => { saveBudget(drillCategory, parseFloat(budgetValue) || 0); setBudgetValue(''); }}><Check size={14} /></button>
                      <button aria-label="Cancel" onClick={() => { setEditingBudget(null); setBudgetValue(''); }}><X size={14} /></button>
                    </div>
                  ) : (
                    <button className="fin-category-budget-value" onClick={() => { const b = budgets.find(b => b.category_id === drillCategory)?.amount || cat?.budget_monthly || 0; setEditingBudget(drillCategory); setBudgetValue(b.toString()); }}>
                      {budgets.find(b => b.category_id === drillCategory)?.amount || cat?.budget_monthly ? fmtCurrency(budgets.find(b => b.category_id === drillCategory)?.amount || cat?.budget_monthly || 0) : 'Set budget'}
                      <Edit2 size={12} />
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* All transactions */}
      <div className="fin-glass-card">
        <div className="fin-card-header-row">
          <div className="fin-section-label"><ArrowDownCircle size={11} /> All Expenses This Month</div>
          <button className="fin-add-btn secondary fin-add-btn-sm" onClick={() => setFormMode('expense')}><Plus size={12} /> Add</button>
        </div>

        {(thisMonthExp.length > 0 || thisMonthExpTx.length > 0) && (
          <div className="fin-tx-filters">
            <input type="text" placeholder="Search expenses..." value={txSearch} onChange={e => setTxSearch(e.target.value)} className="fin-tx-search-input" />
            <select value={txCategoryFilter || ''} onChange={e => setTxCategoryFilter(e.target.value || null)} className="fin-tx-category-filter">
              <option value="">All categories</option>
              {categories.filter(c => c.scope === 'personal').map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>
        )}

        {thisMonthExp.length === 0 && thisMonthExpTx.length === 0 ? (
          <div className="fin-empty-small"><p>No expenses this month</p></div>
        ) : (
          <div className="fin-tx-list-enhanced">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date} className="fin-tx-date-group">
                <div className="fin-tx-date-header">
                  <Calendar size={12} />
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  <span className="fin-tx-date-total expense">-{fmtCurrency(items.reduce((s, i) => s + i.amount, 0))}</span>
                </div>
                {items.map(e => {
                  const cat = categories.find(c => c.id === e.category_id);
                  return (
                    <LongPressRow
                      key={e.id}
                      onLongPress={() => e.source_table === 'expenses' ? confirmDelete('Delete Expense?', `Remove "${e.title}" (${fmtCurrency(e.amount)})?`, () => deleteRow('expenses', e.id)) : undefined as never}
                      onClick={() => setExpandedTx(expandedTx === e.id ? null : e.id)}
                      className={`fin-tx-row-enhanced expense ${editingId === e.id ? 'editing' : ''} ${expandedTx === e.id ? 'expanded' : ''}`}
                    >
                      {editingId === e.id ? (
                        <>
                          <input type="date" className="fin-inline-date" value={editDate} onChange={ev => setEditDate(ev.target.value)} />
                          <div className="fin-tx-info"><input type="text" className="fin-inline-input" value={editDesc} onChange={ev => setEditDesc(ev.target.value)} placeholder="Description" /></div>
                          <input type="number" className="fin-inline-amount" step="0.01" min="0" value={editAmount} onChange={ev => setEditAmount(ev.target.value)} />
                          <button className="fin-inline-btn save" aria-label="Save" onClick={(ev) => { ev.stopPropagation(); saveInlineEdit('expenses', e.id); }} disabled={editSaving}><Save size={14} /></button>
                          <button className="fin-inline-btn cancel" aria-label="Cancel" onClick={(ev) => { ev.stopPropagation(); cancelEditing(); }}><X size={14} /></button>
                        </>
                      ) : (
                        <>
                          <div className="fin-tx-icon expense" style={{ background: cat ? `${cat.color || '#F43F5E'}20` : 'rgba(244,63,94,0.1)', color: cat?.color || '#F43F5E' }}>
                            {cat ? <EmojiIcon emoji={cat.icon || '📦'} size={14} fallbackAsText /> : <ArrowDownCircle size={18} />}
                          </div>
                          <div className="fin-tx-main">
                            <span className="fin-tx-title-enhanced">{e.title || 'Expense'}</span>
                            <div className="fin-tx-meta-enhanced">
                              {cat && <span style={{ color: cat.color || '#F43F5E' }}>{cat.name}</span>}
                              {e.is_deductible && <span><ScrollText size={10} /> Deductible</span>}
                              {e.business_id && <span>{businesses.find(b => b.id === e.business_id)?.name}</span>}
                            </div>
                            {expandedTx === e.id && (
                              <div className="fin-tx-details">
                                <div className="fin-tx-detail-row">
                                  <span className="fin-tx-detail-label">Amount:</span>
                                  <span className="fin-tx-detail-value">{fmtCurrency(e.amount)}</span>
                                </div>
                                {cat && (
                                  <div className="fin-tx-detail-row">
                                    <span className="fin-tx-detail-label">Category:</span>
                                    <span className="fin-tx-detail-value" style={{ color: cat.color || '#F43F5E' }}>{cat.icon} {cat.name}</span>
                                  </div>
                                )}
                                {e.is_deductible && (
                                  <div className="fin-tx-detail-row">
                                    <span className="fin-tx-detail-label">Tax:</span>
                                    <span className="fin-tx-detail-value fin-deductible-badge">Deductible</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <strong className="fin-tx-amount-enhanced expense">-{fmtCurrency(e.amount)}</strong>
                          {e.source_table === 'expenses' && (
                            <>
                              <button className="fin-row-action edit" aria-label="Edit" onClick={(ev) => { ev.stopPropagation(); startEditing({ id: e.id, amount: e.amount, description: String(e.description || ''), title: e.title, date: e.date }); }} title="Edit"><Edit2 size={14} /></button>
                              <button className="fin-row-action delete" onClick={(ev) => { ev.stopPropagation(); confirmDelete('Delete Expense?', `Remove "${e.title}" (${fmtCurrency(e.amount)})?`, () => deleteRow('expenses', e.id)); }} title="Delete" aria-label="Delete"><Trash2 size={14} /></button>
                            </>
                          )}
                        </>
                      )}
                    </LongPressRow>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

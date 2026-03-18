import React, { useState, useCallback } from 'react';
import { useFinances } from './FinancesContext';
import { LongPressRow } from './LongPressRow';
import { fmtCurrency, colorForIndex } from './types';
import { BarChart } from '../charts';
import { DataTooltip } from '../ui/DataTooltip';
import type { DataTooltipData } from '../ui/DataTooltip';
import {
  ArrowUpCircle, Calendar, Plus, Edit2, Save, X, Trash2, RefreshCw,
} from 'lucide-react';

export const IncomeTab = React.memo(function IncomeTab() {
  const ctx = useFinances();
  const {
    income, transactions, businesses, som,
    incomeBySource, incomeBySourceMonthly,
    incomeMonthIdx, setIncomeMonthIdx,
    txSearch, setTxSearch,
    editingId, editAmount, setEditAmount, editDesc, setEditDesc, editDate, setEditDate,
    editSaving, startEditing, saveInlineEdit, cancelEditing,
    expandedTx, setExpandedTx,
    setFormMode, confirmDelete, deleteRow,
  } = ctx;

  const thisMonthIncome = income.filter(i => i.date >= som);
  const thisMonthIncomeTx = transactions.filter(t => t.type === 'income' && t.date >= som);

  // Long-press tooltip
  const [tooltipData, setTooltipData] = useState<DataTooltipData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const dismissTooltip = useCallback(() => { setTooltipData(null); setTooltipPos(null); }, []);

  const handleIncomeBarLongPress = useCallback((idx: number, pos: { x: number; y: number }, values: { label: string; value: number; color: string }[]) => {
    if (idx < 0 || idx >= incomeBySourceMonthly.labels.length) return;
    const monthLabel = incomeBySourceMonthly.labels[idx];
    const total = values.reduce((s, v) => s + v.value, 0);
    const prevTotal = idx > 0 ? incomeBySourceMonthly.sources.reduce((s, src) => s + (incomeBySourceMonthly.data[src]?.[idx - 1] ?? 0), 0) : null;
    setTooltipData({
      value: total,
      label: `Income — ${monthLabel}`,
      color: '#39FF14',
      previousValue: prevTotal,
      extras: values.filter(v => v.value > 0).map(v => ({
        label: v.label,
        value: fmtCurrency(v.value),
        color: v.color,
      })),
    });
    setTooltipPos(pos);
  }, [incomeBySourceMonthly]);

  // Merge and group by date
  type MergedIncome = { id: string; date: string; amount: number; title: string; source_table: 'income' | 'transactions'; source?: string | null; is_recurring?: boolean; business_id?: string | null; description?: string | null; client_id?: string | null; type?: string };
  const allIncome: MergedIncome[] = [
    ...thisMonthIncome.map(i => ({ ...i, source_table: 'income' as const, title: i.description || i.source || 'Income' })),
    ...thisMonthIncomeTx.map(t => ({ ...t, source_table: 'transactions' as const, title: t.title || t.description || 'Income' })),
  ].filter(item => {
    if (!txSearch) return true;
    const search = txSearch.toLowerCase();
    return (item.title?.toLowerCase().includes(search) ||
            String(item.description || '').toLowerCase().includes(search) ||
            ('source' in item ? String(item.source || '').toLowerCase().includes(search) : false));
  }).sort((a, b) => b.date.localeCompare(a.date));

  const grouped: Record<string, MergedIncome[]> = {};
  allIncome.forEach(item => {
    if (!grouped[item.date]) grouped[item.date] = [];
    grouped[item.date].push(item);
  });

  return (
    <div className="fin-tab-content">
      {/* Stacked bar — 6-month by source */}
      {incomeBySourceMonthly.sources.length > 0 && (
        <div className="fin-glass-card">
          <div className="fin-section-label">6-Month Income by Source</div>
          <div className="fin-chart-legend">
            {incomeBySourceMonthly.sources.map((src, i) => (
              <span key={src} className="fin-chart-legend-item">
                <span className="fin-chart-legend-dot" style={{ background: colorForIndex(i) }} /> {src}
              </span>
            ))}
          </div>
          <BarChart
            series={incomeBySourceMonthly.sources.map((src, i) => ({
              data: incomeBySourceMonthly.data[src],
              color: colorForIndex(i),
              label: src,
            }))}
            labels={incomeBySourceMonthly.labels}
            height={150}
            stacked
            selectedIndex={incomeMonthIdx}
            onBarTap={(i) => setIncomeMonthIdx(incomeMonthIdx === i ? null : i)}
            onBarLongPress={handleIncomeBarLongPress}
          />
        </div>
      )}

      {/* Current month horizontal bar */}
      {incomeBySource.length > 0 && (
        <div className="fin-glass-card">
          <div className="fin-section-label">This Month — by Source</div>
          <BarChart
            series={[{
              data: incomeBySource.map(([, amt]) => amt),
              color: '#39FF14',
              label: 'Income',
            }]}
            labels={incomeBySource.map(([src]) => src)}
            height={Math.max(80, incomeBySource.length * 30 + 30)}
            horizontal
            showValues
          />
        </div>
      )}

      {/* Transaction list */}
      <div className="fin-glass-card">
        <div className="fin-card-header-row">
          <div className="fin-section-label"><ArrowUpCircle size={11} /> Income This Month</div>
          <button className="fin-add-btn secondary fin-add-btn-sm" onClick={() => setFormMode('income')}><Plus size={12} /> Add</button>
        </div>

        {(thisMonthIncome.length > 0 || thisMonthIncomeTx.length > 0) && (
          <div className="fin-tx-search-bar">
            <input type="text" placeholder="Search income..." value={txSearch} onChange={e => setTxSearch(e.target.value)} className="fin-tx-search-input" />
          </div>
        )}

        {thisMonthIncome.length === 0 && thisMonthIncomeTx.length === 0 ? (
          <div className="fin-empty-small"><p>No income recorded this month</p></div>
        ) : (
          <div className="fin-tx-list-enhanced">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date} className="fin-tx-date-group">
                <div className="fin-tx-date-header">
                  <Calendar size={12} />
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  <span className="fin-tx-date-total">+{fmtCurrency(items.reduce((s, i) => s + i.amount, 0))}</span>
                </div>
                {items.map((i) => (
                  <LongPressRow
                    key={i.id}
                    onLongPress={() => i.source_table === 'income' ? confirmDelete('Delete Income?', `Remove "${i.title}" (${fmtCurrency(i.amount)})?`, () => deleteRow('income', i.id)) : undefined as never}
                    onClick={() => setExpandedTx(expandedTx === i.id ? null : i.id)}
                    className={`fin-tx-row-enhanced income ${editingId === i.id ? 'editing' : ''} ${expandedTx === i.id ? 'expanded' : ''}`}
                  >
                    {editingId === i.id ? (
                      <>
                        <input type="date" className="fin-inline-date" value={editDate} onChange={e => setEditDate(e.target.value)} />
                        <div className="fin-tx-info"><input type="text" className="fin-inline-input" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" /></div>
                        <input type="number" className="fin-inline-amount" step="0.01" min="0" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
                        <button className="fin-inline-btn save" aria-label="Save" onClick={(e) => { e.stopPropagation(); saveInlineEdit('income', i.id); }} disabled={editSaving}><Save size={14} /></button>
                        <button className="fin-inline-btn cancel" aria-label="Cancel" onClick={(e) => { e.stopPropagation(); cancelEditing(); }}><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <div className="fin-tx-icon income"><ArrowUpCircle size={18} /></div>
                        <div className="fin-tx-main">
                          <span className="fin-tx-title-enhanced">{i.title || 'Income'}</span>
                          <div className="fin-tx-meta-enhanced">
                            {i.source ? <span>{i.source}</span> : null}
                            {i.is_recurring ? <span><RefreshCw size={10} /> Recurring</span> : null}
                            {i.business_id ? <span>{businesses.find(b => b.id === String(i.business_id))?.name}</span> : null}
                          </div>
                          {expandedTx === i.id && (
                            <div className="fin-tx-details">
                              <div className="fin-tx-detail-row">
                                <span className="fin-tx-detail-label">Amount:</span>
                                <span className="fin-tx-detail-value">{fmtCurrency(i.amount)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <strong className="fin-tx-amount-enhanced income">+{fmtCurrency(i.amount)}</strong>
                        {i.source_table === 'income' && (
                          <>
                            <button className="fin-row-action edit" aria-label="Edit" onClick={(e) => { e.stopPropagation(); startEditing({ id: i.id, amount: i.amount, description: String(i.description || ''), title: i.title, date: i.date }); }} title="Edit"><Edit2 size={14} /></button>
                            <button className="fin-row-action delete" aria-label="Delete" onClick={(e) => { e.stopPropagation(); confirmDelete('Delete Income?', `Remove "${i.title}" (${fmtCurrency(i.amount)})?`, () => deleteRow('income', i.id)); }} title="Delete"><Trash2 size={14} /></button>
                          </>
                        )}
                      </>
                    )}
                  </LongPressRow>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Tooltip for long-press */}
      <DataTooltip data={tooltipData} position={tooltipPos} onDismiss={dismissTooltip} />
    </div>
  );
});

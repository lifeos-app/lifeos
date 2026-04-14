/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinances } from './FinancesContext';
import { fmtCurrency, fmtDate, normalizeToMonthly } from './types';
import { AreaChart, BarChart } from '../charts';
import { EmojiIcon } from '../../lib/emoji-icon';
import { useInventoryStore } from '../../stores/useInventoryStore';
import {
  Building2, Users, Plus, Edit2, X, ChevronDown, ChevronRight, BarChart3, CreditCard, Package,
  TrendingUp, Banknote, CalendarCheck,
} from 'lucide-react';
import { KMLogger, VehicleLogbook, InvoiceTracker, TCSGrowthOverview } from '../tcs';

export const WorkTab = React.memo(function WorkTab() {
  const ctx = useFinances();
  const {
    income, transactions, som, clients, bills, monthIncome,
    businessFinancials, businessPL,
    expandedBusiness, setExpandedBusiness,
    editingBizId, setEditingBizId,
    editBizName, setEditBizName, editBizIcon, setEditBizIcon, editBizType, setEditBizType,
    saveBizEdit,
    setFormMode, confirmDelete, deleteRow,
  } = ctx;

  const navigate = useNavigate();
  const inventoryStore = useInventoryStore();
  const [equipmentExpanded, setEquipmentExpanded] = useState<Record<string, boolean>>({});

  // ── Projected Monthly Income ──
  const projectedIncome = useMemo(() => {
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);

    // Recurring income normalized to monthly
    const recurringMonthly = income
      .filter(i => i.is_recurring && (i as unknown as { recurrence_rule?: string }).recurrence_rule)
      .reduce((s, i) => s + normalizeToMonthly(i.amount, (i as unknown as { recurrence_rule?: string }).recurrence_rule || 'monthly'), 0);

    // Active clients × their rates (assume ~4 jobs/month per client if rate is per-clean)
    const activeClients = clients.filter(c => c.is_active);
    const clientProjection = activeClients.reduce((s, c) => {
      if (!c.rate) return s;
      // Check if we have actual income from this client this month
      const clientIncThisMonth = income.filter(i => i.date >= som && i.client_id === c.id).reduce((ss, i) => ss + i.amount, 0);
      if (clientIncThisMonth > 0) return s; // Already counted in actual
      return s + (c.rate * 4); // Estimate ~4 jobs/month
    }, 0);

    // Income already earned this month
    const earnedThisMonth = monthIncome;

    // Total projected = max of recurring estimate vs earned extrapolated
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const extrapolated = dayOfMonth > 0 ? earnedThisMonth * (daysInMonth / dayOfMonth) : earnedThisMonth;

    const projected = Math.max(recurringMonthly + clientProjection, extrapolated);
    const progressPct = projected > 0 ? Math.min((earnedThisMonth / projected) * 100, 100) : 0;

    return { earned: earnedThisMonth, projected, progressPct };
  }, [income, clients, monthIncome, som]);

  // Fetch inventory when tab is loaded
  React.useEffect(() => {
    inventoryStore.fetchAll();
  }, []);

  // Filter business equipment
  const businessEquipment = inventoryStore.items.filter(item => item.list_type === 'business');

  return (
    <div className="fin-work">
      {/* ── TCS Operations ── */}
      <KMLogger />
      <VehicleLogbook />
      <InvoiceTracker />
      <TCSGrowthOverview />

      {/* ── Projected Monthly Income ── */}
      {businessFinancials.length > 0 && (
        <div className="fin-glass-card fin-projected-income-card">
          <div className="fin-section-label"><CalendarCheck size={11} /> Monthly Income Progress</div>
          <div className="fin-projected-stats">
            <div className="fin-projected-stat">
              <Banknote size={16} style={{ color: '#39FF14' }} />
              <div>
                <span className="fin-projected-label">Earned So Far</span>
                <span className="fin-projected-value earned">{fmtCurrency(projectedIncome.earned)}</span>
              </div>
            </div>
            <div className="fin-projected-stat">
              <TrendingUp size={16} style={{ color: '#00D4FF' }} />
              <div>
                <span className="fin-projected-label">Projected This Month</span>
                <span className="fin-projected-value projected">{fmtCurrency(projectedIncome.projected)}</span>
              </div>
            </div>
          </div>
          <div className="fin-projected-bar-wrap">
            <div className="fin-projected-bar-track">
              <div
                className="fin-projected-bar-fill"
                style={{ width: `${projectedIncome.progressPct}%` }}
              />
            </div>
            <div className="fin-projected-bar-labels">
              <span>{Math.round(projectedIncome.progressPct)}% earned</span>
              <span>{fmtCurrency(Math.max(0, projectedIncome.projected - projectedIncome.earned))} to go</span>
            </div>
          </div>
        </div>
      )}

      {businessFinancials.length === 0 && (
        <div className="fin-empty">
          <Building2 size={40} strokeWidth={1} />
          <p>No businesses yet</p>
          <button className="fin-add-btn" onClick={() => setFormMode('business')}><Plus size={16} /> Add Your First Business</button>
        </div>
      )}

      {businessFinancials.map(({ biz, clients: bizClients, revenue, expense, net }) => {
        const plData = businessPL.find(b => b.biz.id === biz.id)?.plData || [];
        const clientRevenues = bizClients.map(c => ({
          name: c.name,
          rev: income.filter(i => i.date >= som && i.client_id === c.id).reduce((s, i) => s + i.amount, 0) +
            transactions.filter(t => t.type === 'income' && t.date >= som && t.client_id === c.id).reduce((s, t) => s + t.amount, 0),
        })).filter(c => c.rev > 0);

        return (
          <div key={biz.id} className="fin-business-card" style={{ '--biz-color': biz.color } as React.CSSProperties}>
            <div className="fin-business-header" onClick={() => setExpandedBusiness(expandedBusiness === biz.id ? null : biz.id)}>
              <div className="fin-business-info">
                {editingBizId === biz.id ? (
                  <div className="fin-biz-edit-row" onClick={e => e.stopPropagation()}>
                    <input type="text" value={editBizIcon} onChange={e => setEditBizIcon(e.target.value)} maxLength={4} className="fin-biz-edit-icon-input" />
                    <input type="text" value={editBizName} onChange={e => setEditBizName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveBizEdit(biz.id); if (e.key === 'Escape') setEditingBizId(null); }} className="fin-biz-edit-name-input" autoFocus />
                    <select value={editBizType} onChange={e => setEditBizType(e.target.value)} className="fin-biz-edit-type-select">
                      <option value="business">Business</option>
                      <option value="employment">Employment</option>
                      <option value="freelance">Freelance</option>
                      <option value="side-hustle">Side Hustle</option>
                    </select>
                    <button onClick={() => saveBizEdit(biz.id)} className="fin-biz-edit-save">Save</button>
                    <button onClick={() => setEditingBizId(null)} className="fin-biz-edit-cancel">Cancel</button>
                  </div>
                ) : (
                  <>
                    <span className="fin-business-icon"><EmojiIcon emoji={biz.icon || '💼'} size={18} fallbackAsText /></span>
                    <div>
                      <h3 className="fin-business-name">{biz.name}</h3>
                      <span className="fin-business-type">{biz.type === 'business' ? 'Business' : biz.type}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="fin-business-stats">
                <div className="fin-business-stat">
                  <span className="fin-business-stat-label">Revenue</span>
                  <span className="fin-business-stat-value income">{fmtCurrency(revenue)}</span>
                </div>
                <div className="fin-business-stat">
                  <span className="fin-business-stat-label">Expenses</span>
                  <span className="fin-business-stat-value expense">{fmtCurrency(expense)}</span>
                </div>
                <div className="fin-business-stat">
                  <span className="fin-business-stat-label">Net P&L</span>
                  <span className={`fin-business-stat-value ${net >= 0 ? 'income' : 'expense'}`}>{net >= 0 ? '+' : ''}{fmtCurrency(net)}</span>
                </div>
              </div>
              {expandedBusiness === biz.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </div>

            {expandedBusiness === biz.id && (
              <div className="fin-business-expanded">
                {plData.some(p => p.revenue > 0 || p.expense > 0) && (
                  <div className="fin-business-section">
                    <h4 className="fin-business-section-title"><BarChart3 size={14} /> P&L Trend (6 months)</h4>
                    <div className="fin-pl-chart-legend">
                      <span className="fin-pl-legend-income">Revenue</span>
                      <span className="fin-pl-legend-expense">Expenses</span>
                    </div>
                    <AreaChart
                      series={[
                        { data: plData.map(p => p.revenue), color: '#39FF14', label: 'Revenue', fillOpacity: 0.15 },
                        { data: plData.map(p => p.expense), color: '#F43F5E', label: 'Expenses', fillOpacity: 0.15 },
                      ]}
                      labels={plData.map(p => p.month)}
                      height={100}
                    />
                  </div>
                )}

                {clientRevenues.length > 0 && (
                  <div className="fin-business-section">
                    <h4 className="fin-business-section-title"><Users size={14} /> Client Revenue (This Month)</h4>
                    <BarChart
                      series={[{ data: clientRevenues.map(c => c.rev), color: biz.color || '#39FF14', label: 'Revenue' }]}
                      labels={clientRevenues.map(c => c.name)}
                      height={Math.max(70, clientRevenues.length * 28 + 30)}
                      horizontal
                      showValues
                    />
                  </div>
                )}

                <div className="fin-business-section">
                  <h4 className="fin-business-section-title"><Users size={14} /> Clients ({bizClients.length})</h4>
                  {bizClients.length === 0 ? (
                    <p className="fin-business-section-empty">No clients yet</p>
                  ) : (
                    <div className="fin-client-list">
                      {bizClients.map(c => {
                        const clientRevenue = income.filter(i => i.date >= som && i.client_id === c.id).reduce((s, i) => s + i.amount, 0) +
                          transactions.filter(t => t.type === 'income' && t.date >= som && t.client_id === c.id).reduce((s, t) => s + t.amount, 0);
                        return (
                          <div key={c.id} className="fin-client-row">
                            <div className="fin-client-info">
                              <span className="fin-client-name">{c.name}</span>
                              {c.rate && <span className="fin-client-rate">${c.rate}</span>}
                              {!c.is_active && <span className="fin-client-inactive">Inactive</span>}
                            </div>
                            <span className="fin-client-revenue income">{fmtCurrency(clientRevenue)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="fin-business-section">
                  <h4 className="fin-business-section-title"><CreditCard size={14} /> Business Expenses</h4>
                  {transactions.filter(t => t.type === 'expense' && t.date >= som && (t as Record<string, unknown>).business_id === biz.id).length === 0 ? (
                    <p className="fin-business-section-empty">No expenses this month</p>
                  ) : (
                    <div className="fin-expense-list">
                      {transactions.filter(t => t.type === 'expense' && t.date >= som && (t as Record<string, unknown>).business_id === biz.id).map(t => (
                        <div key={t.id} className="fin-expense-row">
                          <div className="fin-expense-info">
                            <span className="fin-expense-title">{(t as Record<string, unknown>).title as string}</span>
                            <span className="fin-expense-date">{fmtDate(t.date)}</span>
                          </div>
                          <span className="fin-expense-amount expense">{fmtCurrency(t.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="fin-business-section">
                  <div className="fin-business-equipment-header" onClick={() => setEquipmentExpanded({ ...equipmentExpanded, [biz.id]: !equipmentExpanded[biz.id] })}>
                    <h4 className="fin-business-section-title">
                      <Package size={14} /> Equipment & Inventory
                      {equipmentExpanded[biz.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </h4>
                  </div>
                  {equipmentExpanded[biz.id] && (
                    <>
                      {businessEquipment.length === 0 ? (
                        <div className="fin-business-equipment-empty">
                          <p>Track your business equipment for tax and depreciation</p>
                          <button className="fin-business-equipment-add" onClick={() => navigate('/health?tab=equipment&list=business')}>
                            <Plus size={14} /> Add Equipment
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="fin-business-equipment-scroll">
                            {businessEquipment.slice(0, 4).map(item => (
                              <div key={item.id} className="fin-equipment-card">
                                <div className="fin-equipment-name">{item.name}</div>
                                <div className="fin-equipment-details">
                                  <span className={`fin-equipment-condition ${item.condition}`}>{item.condition}</span>
                                  {item.purchase_price && <span className="fin-equipment-value">{fmtCurrency(item.purchase_price)}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="fin-business-equipment-actions">
                            <button className="fin-business-equipment-link" onClick={() => navigate('/health?tab=equipment&list=business')}>
                              View All ({businessEquipment.length})
                            </button>
                            <button className="fin-business-equipment-add" onClick={() => navigate('/health?tab=equipment&list=business')}>
                              <Plus size={14} /> Add Equipment
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="fin-business-actions">
                  <button className="fin-business-action" onClick={() => { setFormMode('income'); }}><Plus size={14} /> Add Income</button>
                  <button className="fin-business-action" onClick={() => { setFormMode('expense'); }}><Plus size={14} /> Add Expense</button>
                  <button className="fin-business-action" onClick={() => { setFormMode('client'); }}><Plus size={14} /> Add Client</button>
                  <button className="fin-business-action" onClick={() => { setEditingBizId(biz.id); setEditBizName(biz.name); setEditBizIcon(biz.icon || '💼'); setEditBizType(biz.type || 'business'); }}><Edit2 size={14} /> Edit Business</button>
                  <button className="fin-business-action danger" onClick={() => confirmDelete(`Delete ${biz.name}?`, 'This will unlink all clients. This action cannot be undone.', () => deleteRow('businesses', biz.id))}><X size={14} /> Delete</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

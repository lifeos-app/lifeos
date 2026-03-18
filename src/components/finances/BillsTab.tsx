import React, { useState } from 'react';
import { useFinances } from './FinancesContext';
import { fmtCurrency, fmtShort, fmtDate, isOverdue } from './types';
import { ProgressRing } from '../charts';
import {
  Receipt, Calendar, Plus, Edit2, Trash2, CheckCircle2, AlertTriangle, Clock, CreditCard, ChevronRight,
} from 'lucide-react';

export const BillsTab = React.memo(function BillsTab() {
  const ctx = useFinances();
  const {
    bills, overdueBills, upcomingBillsTotal,
    setEditingBillId, setEditBillTitle, setEditBillAmount, setEditBillDue,
    setFormMode, confirmDelete, deleteRow, togglePaid,
  } = ctx;

  const unpaidBills = bills.filter(b => b.status !== 'paid' && !isOverdue(b.due_date, b.status));
  const paidBills = bills.filter(b => b.status === 'paid');
  const overdueBillsTotal = overdueBills.reduce((s, b) => s + b.amount, 0);
  const [overdueExpanded, setOverdueExpanded] = useState(false);

  return (
    <div className="fin-tab-content">
      {/* ── Overdue Bills Alert Banner ── */}
      {overdueBills.length > 0 && (
        <div
          className="fin-glass-card fin-overdue-banner"
          onClick={() => setOverdueExpanded(!overdueExpanded)}
        >
          <div className="fin-overdue-banner-header">
            <AlertTriangle size={18} />
            <div className="fin-overdue-banner-text">
              <strong>⚠️ {overdueBills.length} bill{overdueBills.length > 1 ? 's' : ''} overdue — {fmtCurrency(overdueBillsTotal)}</strong>
              <span className="fin-overdue-banner-names">{overdueBills.map(b => b.title).join(', ')}</span>
            </div>
            <ChevronRight size={16} className={`fin-overdue-chevron ${overdueExpanded ? 'expanded' : ''}`} />
          </div>
          {overdueExpanded && (
            <div className="fin-overdue-banner-details">
              {overdueBills.map(b => (
                <div key={b.id} className="fin-overdue-banner-item">
                  <div className="fin-overdue-banner-item-info">
                    <CreditCard size={12} />
                    <span className="fin-overdue-banner-item-title">{b.title}</span>
                    <span className="fin-overdue-banner-item-due">Due {fmtDate(b.due_date)}</span>
                  </div>
                  <strong className="fin-overdue-banner-item-amt">{fmtCurrency(b.amount)}</strong>
                  <button
                    className="fin-overdue-pay-btn"
                    onClick={(e) => { e.stopPropagation(); togglePaid(b.id, b.status); }}
                  >
                    <CheckCircle2 size={12} /> Pay
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Obligation ring */}
      <div className="fin-glass-card fin-bills-hero">
        <div className="fin-bills-ring-section">
          <ProgressRing
            value={bills.length > 0 ? (paidBills.length / bills.length) * 100 : 0}
            size={100}
            strokeWidth={10}
            color="#00D4FF"
            centerContent={
              <div className="fin-bills-ring-center">
                <div className="fin-bills-ring-count">{paidBills.length}/{bills.length}</div>
                <div className="fin-bills-ring-label">paid</div>
              </div>
            }
          />
          <div className="fin-bills-ring-stats">
            <div className="fin-bills-ring-stat">
              <span className="fin-bills-outstanding-amount">{fmtShort(upcomingBillsTotal)}</span>
              <span className="fin-bills-outstanding-label">Outstanding</span>
            </div>
            {overdueBills.length > 0 && (
              <div className="fin-bills-ring-stat">
                <span className="fin-bills-overdue-amount">{overdueBills.length} Overdue</span>
                <span className="fin-bills-overdue-label">Needs Attention</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      {bills.filter(b => b.status !== 'paid').length > 0 && (
        <div className="fin-glass-card">
          <div className="fin-section-label"><Calendar size={11} /> Upcoming Timeline</div>
          <div className="fin-bills-timeline">
            {bills.filter(b => b.status !== 'paid').sort((a, b) => a.due_date.localeCompare(b.due_date)).map(b => {
              const od = isOverdue(b.due_date, b.status);
              const daysUntil = Math.round((new Date(b.due_date).getTime() - Date.now()) / 86400000);
              return (
                <div key={b.id} className={`fin-timeline-item ${od ? 'overdue' : daysUntil <= 7 ? 'soon' : ''}`}>
                  <div className="fin-timeline-dot" />
                  <div className="fin-timeline-card">
                    <div className="fin-timeline-title">{b.title}</div>
                    <div className="fin-timeline-date">
                      {od ? <><AlertTriangle size={9} /> Overdue</> : daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d`}
                    </div>
                    <div className="fin-timeline-amount">{fmtCurrency(b.amount)}</div>
                    <button className="fin-timeline-pay" onClick={() => togglePaid(b.id, b.status)}>
                      <CheckCircle2 size={12} /> Pay
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bills list */}
      <div className="fin-glass-card">
        <div className="fin-card-header-row">
          <div className="fin-section-label"><Receipt size={11} /> All Bills</div>
          <button className="fin-add-btn secondary fin-add-btn-sm" onClick={() => setFormMode('bill')}><Plus size={12} /> Add Bill</button>
        </div>
        {bills.length === 0 ? (
          <div className="fin-empty-small"><p>No bills tracked yet</p></div>
        ) : (
          <div className="fin-tx-list">
            {overdueBills.length > 0 && <div className="fin-tx-group-header overdue"><AlertTriangle size={12} /> Overdue</div>}
            {overdueBills.map(b => (
              <div key={b.id} className="fin-tx-row bill overdue">
                <button className="fin-bill-check" onClick={() => togglePaid(b.id, b.status)}>
                  <div className="fin-bill-circle" />
                </button>
                <div className="fin-tx-info">
                  <span className="fin-tx-title">{b.title}</span>
                  <span className="fin-tx-meta"><Calendar size={10} /> {fmtDate(b.due_date)}{b.is_recurring ? ` · ${b.recurrence_rule}` : ''} · <AlertTriangle size={10} /> Overdue</span>
                </div>
                <strong className="fin-tx-amount expense">{fmtCurrency(b.amount)}</strong>
                <button className="fin-row-action edit" aria-label="Edit" onClick={() => { setEditingBillId(b.id); setEditBillTitle(b.title); setEditBillAmount(b.amount.toString()); setEditBillDue(b.due_date); }}><Edit2 size={14} /></button>
                <button className="fin-row-action delete" aria-label="Delete" onClick={() => confirmDelete('Delete Bill?', `Remove "${b.title}"?`, () => deleteRow('bills', b.id))}><Trash2 size={14} /></button>
              </div>
            ))}

            {unpaidBills.length > 0 && <div className="fin-tx-group-header upcoming"><Clock size={12} /> Upcoming</div>}
            {unpaidBills.sort((a, b) => a.due_date.localeCompare(b.due_date)).map(b => (
              <div key={b.id} className="fin-tx-row bill">
                <button className="fin-bill-check" onClick={() => togglePaid(b.id, b.status)}>
                  <div className="fin-bill-circle" />
                </button>
                <div className="fin-tx-info">
                  <span className="fin-tx-title">{b.title}</span>
                  <span className="fin-tx-meta"><Calendar size={10} /> {fmtDate(b.due_date)}{b.is_recurring ? ` · ${b.recurrence_rule}` : ''}</span>
                </div>
                <strong className="fin-tx-amount">{fmtCurrency(b.amount)}</strong>
                <button className="fin-row-action edit" aria-label="Edit" onClick={() => { setEditingBillId(b.id); setEditBillTitle(b.title); setEditBillAmount(b.amount.toString()); setEditBillDue(b.due_date); }}><Edit2 size={14} /></button>
                <button className="fin-row-action delete" aria-label="Delete" onClick={() => confirmDelete('Delete Bill?', `Remove "${b.title}"?`, () => deleteRow('bills', b.id))}><Trash2 size={14} /></button>
              </div>
            ))}

            {paidBills.length > 0 && <div className="fin-tx-group-header paid"><CheckCircle2 size={12} /> Paid</div>}
            {paidBills.map(b => (
              <div key={b.id} className="fin-tx-row bill paid">
                <button className="fin-bill-check checked" onClick={() => togglePaid(b.id, b.status)}>
                  <CheckCircle2 size={16} />
                </button>
                <div className="fin-tx-info">
                  <span className="fin-tx-title">{b.title}</span>
                  <span className="fin-tx-meta"><Calendar size={10} /> {fmtDate(b.due_date)} · Paid</span>
                </div>
                <strong className="fin-tx-amount paid">{fmtCurrency(b.amount)}</strong>
                <button className="fin-row-action edit" aria-label="Edit" onClick={() => { setEditingBillId(b.id); setEditBillTitle(b.title); setEditBillAmount(b.amount.toString()); setEditBillDue(b.due_date); }}><Edit2 size={14} /></button>
                <button className="fin-row-action delete" aria-label="Delete" onClick={() => confirmDelete('Delete Bill?', `Remove "${b.title}"?`, () => deleteRow('bills', b.id))}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

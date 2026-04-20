/**
 * QuickInvoiceButton — Creates an invoice via a simple form modal.
 *
 * Client dropdown from finance store clients, amount, date, description.
 * Uses useFinanceStore.addIncome() for offline-first writes (income + transactions).
 */

import { useState, useCallback } from 'react'
import { FileText, X, Check, Loader2, Plus } from 'lucide-react'
import { useFinanceStore } from '../../stores/useFinanceStore'
import { useUserStore } from '../../stores/useUserStore'
import { useGamificationContext } from '../../lib/gamification/context'
import { todayStr, fmtCurrency } from '../../utils/date'
import './QuickInvoiceButton.css'

interface InvoiceForm {
  clientId: string
  amount: string
  date: string
  description: string
}

export function QuickInvoiceButton() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<InvoiceForm>({
    clientId: '',
    amount: '',
    date: todayStr(),
    description: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const clients = useFinanceStore(s => s.clients)
  const user = useUserStore(s => s.user)
  const { awardXP } = useGamificationContext()

  const resetForm = useCallback(() => {
    setForm({ clientId: '', amount: '', date: todayStr(), description: '' })
    setError('')
    setSuccess(false)
  }, [])

  const handleOpen = () => {
    resetForm()
    setOpen(true)
  }

  const handleSubmit = useCallback(async () => {
    if (!form.clientId || !form.amount || !form.date) {
      setError('Client, amount, and date are required')
      return
    }

    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) {
      setError('Enter a valid amount')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const client = clients.find(c => c.id === form.clientId)

      // Use finance store for offline-first writes (income + transaction)
      const result = await useFinanceStore.getState().addIncome({
        user_id: user?.id,
        amount,
        date: form.date,
        source: 'invoice',
        description: form.description || `Invoice — ${client?.name || 'Client'}`,
        client_id: form.clientId,
        is_recurring: false,
      })

      if (!result) throw new Error('Failed to save invoice')

      // Award XP (non-critical)
      try {
        await awardXP('financial_entry', { description: `Invoice: $${amount}` })
      } catch { /* non-critical */ }

      setSuccess(true)
      setTimeout(() => {
        setOpen(false)
        resetForm()
      }, 1500)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }, [form, clients, user?.id])

  if (!open) {
    return (
      <button className="qib-trigger" onClick={handleOpen}>
        <FileText size={14} />
        <span>Create Invoice</span>
      </button>
    )
  }

  return (
    <div className="qib-overlay" onClick={() => !submitting && setOpen(false)}>
      <div className="qib-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="qib-header">
          <div className="qib-header-left">
            <div className="qib-icon-wrap">
              <FileText size={16} />
            </div>
            <h3 className="qib-title">Create Invoice</h3>
          </div>
          <button className="qib-close" onClick={() => !submitting && setOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {/* Success state */}
        {success ? (
          <div className="qib-success">
            <div className="qib-success-icon">
              <Check size={24} />
            </div>
            <span className="qib-success-text">
              Invoice created — {fmtCurrency(parseFloat(form.amount || '0'))}
            </span>
          </div>
        ) : (
          <>
            {/* Client dropdown */}
            <div className="qib-field">
              <label className="qib-label">Client</label>
              <select
                className="qib-select"
                value={form.clientId}
                onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
              >
                <option value="">Select client…</option>
                {clients.filter(c => c.is_active && !c.is_deleted).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.rate ? ` ($${c.rate}/clean)` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div className="qib-field">
              <label className="qib-label">Amount ($)</label>
              <input
                type="number"
                className="qib-input"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>

            {/* Date */}
            <div className="qib-field">
              <label className="qib-label">Date</label>
              <input
                type="date"
                className="qib-input"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="qib-field">
              <label className="qib-label">Description</label>
              <input
                type="text"
                className="qib-input"
                placeholder="Cleaning service…"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Error */}
            {error && <div className="qib-error">{error}</div>}

            {/* Actions */}
            <div className="qib-actions">
              <button
                className="qib-cancel"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="qib-submit"
                onClick={handleSubmit}
                disabled={submitting || !form.clientId || !form.amount}
              >
                {submitting ? (
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Plus size={14} />
                )}
                {submitting ? 'Creating…' : 'Create Invoice'}
              </button>
            </div>
          </>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
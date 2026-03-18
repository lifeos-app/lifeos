// TCSTodayWidget — Shows today's cleaning jobs from TCS
//
// Compact mode for Dashboard, expanded for Work page.
// Real-time updates via TCS Supabase subscription.

import { useState, useCallback } from 'react'
import {
  Clock, MapPin, CheckCircle2, Circle, Loader2,
  AlertTriangle, PlayCircle, Sparkles, PartyPopper,
} from 'lucide-react'
import { useSystemBus, useSystemTasks } from '../../lib/systems/context'
import type { SystemTask } from '../../lib/systems/types'
import type { TCSAdapter } from '../../lib/systems/adapters/tcs'
import { logger } from '../../utils/logger';

interface TCSTodayWidgetProps {
  compact?: boolean
}

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; border: string; color: string; label: string }> = {
    pending:     { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', color: '#F97316', label: 'Pending' },
    in_progress: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', color: '#3B82F6', label: 'In Progress' },
    completed:   { bg: 'rgba(57,255,20,0.12)',  border: 'rgba(57,255,20,0.3)',  color: '#39FF14', label: 'Completed' },
  }
  const c = configs[status] ?? configs.pending

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
    }}>
      {status === 'completed' ? <CheckCircle2 size={10} /> :
       status === 'in_progress' ? <PlayCircle size={10} /> :
       <Circle size={10} />}
      {c.label}
    </span>
  )
}

// ── Job Card ───────────────────────────────────────────────────────────────
function JobCard({ task, compact, onComplete }: {
  task: SystemTask
  compact: boolean
  onComplete?: (id: string) => void
}) {
  // Strip any leading emoji from title to get venue name
  const venueName = (task.metadata?.venueName as string) ?? task.title.replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]+\s*/u, '')
  const venueAddr = task.metadata?.venueAddress as string | undefined
  const mapUrl = venueAddr
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueAddr)}`
    : undefined

  const timeStr = task.dueTime
    ? task.endTime
      ? `${task.dueTime} — ${task.endTime}`
      : task.dueTime
    : undefined

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: task.status === 'completed' ? 'rgba(57,255,20,0.04)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${task.status === 'completed' ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 10,
        opacity: task.status === 'completed' ? 0.7 : 1,
        transition: 'all 0.2s',
      }}>
        <Sparkles size={18} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: 600, color: '#fff',
            textDecoration: task.status === 'completed' ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {venueName}
          </p>
          {timeStr && (
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} /> {timeStr}
            </p>
          )}
        </div>
        <StatusBadge status={task.status} />
      </div>
    )
  }

  return (
    <div style={{
      padding: 16,
      background: task.status === 'completed' ? 'rgba(57,255,20,0.04)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${task.status === 'completed' ? 'rgba(57,255,20,0.15)' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 14,
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Sparkles size={24} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h4 style={{
              margin: 0, fontSize: 15, fontWeight: 700, color: '#fff',
              textDecoration: task.status === 'completed' ? 'line-through' : 'none',
            }}>
              {venueName}
            </h4>
            <StatusBadge status={task.status} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: task.notes ? 8 : 0 }}>
            {timeStr && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                <Clock size={12} /> {timeStr}
              </span>
            )}
            {venueAddr && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                  color: '#00D4FF', textDecoration: 'none',
                }}
              >
                <MapPin size={12} /> {venueAddr}
              </a>
            )}
          </div>

          {task.notes && (
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
              {task.notes}
            </p>
          )}
        </div>

        {/* Quick actions */}
        {task.status !== 'completed' && onComplete && (
          <button
            onClick={() => onComplete(task.id)}
            style={{
              background: 'rgba(57,255,20,0.1)',
              border: '1px solid rgba(57,255,20,0.25)',
              borderRadius: 8,
              padding: '6px 12px',
              color: '#39FF14',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            <CheckCircle2 size={14} />
            Complete
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────────
export function TCSTodayWidget({ compact = false }: TCSTodayWidgetProps) {
  const { systems, refresh } = useSystemBus()
  const { tasks, loading, error } = useSystemTasks()
  const [, setCompleting] = useState<string | null>(null)

  const tcsSystem = systems.find(s => s.id === 'tcs') as TCSAdapter | undefined
  const isConnected = !!tcsSystem

  // Filter to TCS tasks only
  const tcsTasks = tasks.filter(t => (t.metadata?.source as string) === 'tcs')

  const handleComplete = useCallback(async (taskId: string) => {
    if (!tcsSystem) return
    setCompleting(taskId)
    try {
      const provider = tcsSystem.manifest.provides.tasks
      if (provider?.completeTask) {
        await provider.completeTask(taskId)
        await refresh()
      }
    } catch (err) {
      logger.warn('[TCSTodayWidget] Complete failed:', err)
    } finally {
      setCompleting(null)
    }
  }, [tcsSystem, refresh])

  if (!isConnected) {
    return (
      <div style={{
        padding: compact ? 16 : 24,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        textAlign: 'center',
      }}>
        <Sparkles size={32} />
        <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          Connect TCS to see today's jobs
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{
        padding: compact ? 16 : 24,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        textAlign: 'center',
      }}>
        <Loader2 size={20} style={{ color: '#00D4FF', animation: 'spin 1s linear infinite' }} />
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Loading jobs…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        padding: 16,
        background: 'rgba(244,63,94,0.05)',
        border: '1px solid rgba(244,63,94,0.2)',
        borderRadius: 14,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <AlertTriangle size={16} style={{ color: '#F43F5E' }} />
        <span style={{ fontSize: 13, color: '#F43F5E' }}>Failed to load jobs</span>
      </div>
    )
  }

  const completed = tcsTasks.filter(t => t.status === 'completed').length
  const total = tcsTasks.length

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: compact ? 10 : 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={compact ? 16 : 20} />
          <h3 style={{
            margin: 0, fontSize: compact ? 14 : 16, fontWeight: 700, color: '#fff',
          }}>
            Today's Jobs
          </h3>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 600,
          color: completed === total && total > 0 ? '#39FF14' : 'rgba(255,255,255,0.4)',
        }}>
          {completed}/{total} done
        </span>
      </div>

      {/* Jobs list */}
      {tcsTasks.length === 0 ? (
        <div style={{
          padding: compact ? 12 : 20,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            No jobs scheduled for today <PartyPopper size={13} style={{ verticalAlign: 'middle' }} />
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 10 }}>
          {tcsTasks.map(task => (
            <JobCard
              key={task.id}
              task={task}
              compact={compact}
              onComplete={compact ? undefined : handleComplete}
            />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

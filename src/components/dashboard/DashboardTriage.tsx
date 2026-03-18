/**
 * DashboardTriage — Quick daily triage for yesterday's tasks/events.
 *
 * Shows at the top of the Dashboard each morning. User can:
 *   ✅ Done  — mark complete (default assumption)
 *   ❌ Missed — leave as overdue
 *   ➡️ Move — reschedule to a new date
 *   ✅ All Done — bulk-complete everything (fastest path)
 *
 * Disappears once all items are triaged.
 */

import { useState } from 'react';
import {
  CheckCircle2, X, ArrowRight, Calendar, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useYesterdayTriage, type TriageItem } from '../../hooks/useYesterdayTriage';
import { localDateStr, todayStr } from '../../utils/date';

export function DashboardTriage() {
  const {
    triageItems,
    triageCount,
    loading,
    markItem,
    markAllDone,
    movingId,
    setMovingId,
    processingId,
    yesterday,
  } = useYesterdayTriage();

  const [expanded, setExpanded] = useState(true);

  if (loading || triageCount === 0) return null;

  const yesterdayLabel = new Date(yesterday + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', month: 'short', day: 'numeric',
  });

  const isProcessingAll = processingId === 'all';

  return (
    <section
      className="dash-card"
      style={{
        background: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(99,102,241,0.06))',
        border: '1px solid rgba(168,85,247,0.25)',
        gridColumn: '1 / -1',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '12px 16px', cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#A855F7' }}>
              Daily Triage
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
              {triageCount} item{triageCount !== 1 ? 's' : ''} from {yesterdayLabel}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); markAllDone(); }}
            disabled={isProcessingAll}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: 'rgba(57,255,20,0.12)', color: '#39FF14',
              border: '1px solid rgba(57,255,20,0.25)', cursor: isProcessingAll ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              opacity: isProcessingAll ? 0.6 : 1,
            }}
          >
            {isProcessingAll
              ? <><Loader2 size={11} className="spin" /> Working...</>
              : <><CheckCircle2 size={11} /> All Done</>
            }
          </button>
          {expanded ? <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />}
        </div>
      </div>

      {/* Items */}
      {expanded && (
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {triageItems.map(item => (
            <TriageRow
              key={item.id}
              item={item}
              onDone={() => markItem(item.id, 'done')}
              onMissed={() => markItem(item.id, 'missed')}
              onMove={(date) => markItem(item.id, 'moved', date)}
              isMoving={movingId === item.id}
              setMoving={(v) => setMovingId(v ? item.id : null)}
              processing={processingId === item.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Individual Triage Row ──

interface TriageRowProps {
  item: TriageItem;
  onDone: () => void;
  onMissed: () => void;
  onMove: (date: string) => void;
  isMoving: boolean;
  setMoving: (v: boolean) => void;
  processing: boolean;
}

function TriageRow({ item, onDone, onMissed, onMove, isMoving, setMoving, processing }: TriageRowProps) {
  const [pickDate, setPickDate] = useState('');

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
      padding: '10px 12px',
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Icon */}
        <span style={{ fontSize: 14, flexShrink: 0 }}>
          {item.type === 'task' ? '☑️' : '📅'}
        </span>

        {/* Title + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.title}
          </div>
          {item.time && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              {item.time}
            </span>
          )}
        </div>

        {/* Action buttons */}
        {!processing ? (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              onClick={onDone}
              title="Done — I completed this"
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none',
                background: 'rgba(57,255,20,0.12)', color: '#39FF14',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              <CheckCircle2 size={15} />
            </button>
            <button
              onClick={onMissed}
              title="Missed — I didn't do this"
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none',
                background: 'rgba(244,63,94,0.10)', color: '#F43F5E',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              <X size={15} />
            </button>
            <button
              onClick={() => setMoving(!isMoving)}
              title="Move — reschedule to another day"
              style={{
                width: 32, height: 32, borderRadius: 8, border: 'none',
                background: isMoving ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.10)',
                color: '#A855F7',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              <ArrowRight size={15} />
            </button>
          </div>
        ) : (
          <Loader2 size={16} className="spin" style={{ color: '#A855F7' }} />
        )}
      </div>

      {/* Date picker for Move */}
      {isMoving && (
        <div style={{
          marginTop: 8, padding: '8px 10px',
          background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)',
          borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Calendar size={13} style={{ color: '#A855F7', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Move to:</span>

          {/* Quick-pick buttons */}
          {['today', 'tomorrow', 'next_week'].map(opt => {
            const d = new Date();
            if (opt === 'tomorrow') d.setDate(d.getDate() + 1);
            if (opt === 'next_week') { d.setDate(d.getDate() + (8 - d.getDay()) % 7 || 7); }
            const dateStr = localDateStr(d);
            const label = opt === 'today' ? 'Today' : opt === 'tomorrow' ? 'Tomorrow' : 'Mon';
            return (
              <button
                key={opt}
                onClick={() => onMove(dateStr)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  background: 'rgba(168,85,247,0.12)', color: '#A855F7',
                  border: '1px solid rgba(168,85,247,0.25)', cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}

          {/* Custom date */}
          <input
            type="date"
            min={todayStr()}
            value={pickDate}
            onChange={e => { if (e.target.value) { setPickDate(e.target.value); onMove(e.target.value); } }}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6, padding: '4px 8px', color: 'rgba(255,255,255,0.8)',
              fontSize: 12, outline: 'none', width: 110,
            }}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// GENERIC DETAIL — Fallback for all other event types
// Mirrors the original EventDetail body layout exactly
// ═══════════════════════════════════════════════════════════

import { EVENT_TYPE_COLORS, EVENT_TYPES } from '../../lib/schedule-events';
import type { EventType } from '../../lib/schedule-events';
import type { ScheduleEvent } from '../../types/database';

interface GenericDetailProps {
  event: ScheduleEvent;
}

export function GenericDetail({ event }: GenericDetailProps) {
  const eventType = (event.event_type || 'general') as EventType;
  const typeInfo = EVENT_TYPES.find(t => t.id === eventType);
  const color = EVENT_TYPE_COLORS[eventType] || event.color || '#64748B';
  const cleanDesc = (event.description || event.notes || '')
    .replace(/^\[goal:[^\]]+\]/, '')
    .replace(/^\[priority:[^\]]+\]/, '')
    .trim();

  return (
    <div className="ed-generic">
      {/* Event Type Badge */}
      {typeInfo && (
        <div className="ed-type-badge" style={{ background: `${color}18`, color }}>
          <typeInfo.icon size={14} /> {typeInfo.label}
        </div>
      )}

      {/* Notes / Description */}
      <div className="ed-card" style={{ marginTop: 12 }}>
        <div className="ed-card-header">Notes</div>
        {cleanDesc ? (
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
            {cleanDesc}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
            No notes
          </p>
        )}
      </div>
    </div>
  );
}

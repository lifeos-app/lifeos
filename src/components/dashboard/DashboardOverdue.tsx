/**
 * DashboardOverdue — Collapsible alert on Dashboard for overdue tasks/missed events.
 *
 * Compact by default on mobile — tap to expand details.
 * "Review" CTA navigates to /review?mode=reschedule#overdue for immediate action.
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOverdueItems } from '../../hooks/useOverdueItems';
import { AlertTriangle, ArrowRight, Clock, CalendarX2, ChevronDown, ChevronUp } from 'lucide-react';

export function DashboardOverdue() {
  const { overdueTasks, missedEvents, totalCount, loading } = useOverdueItems();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Keep last known data visible during refresh
  const lastCountRef = useRef(totalCount);
  if (!loading && totalCount > 0) lastCountRef.current = totalCount;

  // Show skeleton while loading (instead of returning null which causes flash)
  if (loading) {
    return (
      <section
        className="dash-card"
        style={{
          background: 'linear-gradient(135deg, rgba(249,115,22,0.10), rgba(244,63,94,0.06))',
          border: '1px solid rgba(249,115,22,0.25)',
          gridColumn: '1 / -1',
          padding: '12px 16px',
          overflow: 'hidden',
          minHeight: 44,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} style={{ color: '#F97316', opacity: 0.5 }} />
          <div style={{ width: 100, height: 14, borderRadius: 7, background: 'rgba(249,115,22,0.12)' }} />
        </div>
      </section>
    );
  }

  if (totalCount === 0) return null;

  const taskCount = overdueTasks.length;
  const eventCount = missedEvents.length;

  // When expanded + showAll, display everything; otherwise cap at 4 tasks + 3 events
  const displayedTasks = expanded && showAll ? overdueTasks : overdueTasks.slice(0, 4);
  const displayedEvents = expanded && showAll ? missedEvents : missedEvents.slice(0, 3);
  const cappedTotal = displayedTasks.length + displayedEvents.length;
  const remainingCount = totalCount - cappedTotal;

  return (
    <section
      className="dash-card"
      style={{
        background: 'linear-gradient(135deg, rgba(249,115,22,0.10), rgba(244,63,94,0.06))',
        border: '1px solid rgba(249,115,22,0.25)',
        gridColumn: '1 / -1',
        transition: 'all 0.2s',
        padding: 0,
        overflow: 'hidden',
      }}
    >
      {/* Compact header — always visible */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '12px 16px', cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <AlertTriangle size={16} style={{ color: '#F97316', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#F97316' }}>
            {totalCount} Overdue
          </span>
          <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            {taskCount > 0 && <span><Clock size={10} /> {taskCount} task{taskCount > 1 ? 's' : ''}</span>}
            {eventCount > 0 && <span><CalendarX2 size={10} /> {eventCount} event{eventCount > 1 ? 's' : ''}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={(e) => { e.stopPropagation(); navigate('/reflect/review#overdue'); }}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: 'rgba(0,212,255,0.12)', color: '#00D4FF',
              border: '1px solid rgba(0,212,255,0.25)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            Fix <ArrowRight size={11} />
          </button>
          {expanded ? <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.3)' }} /> : <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />}
        </div>
      </div>

      {/* Expanded detail — smooth collapsible */}
      <div className={`collapsible-wrapper${expanded ? ' expanded' : ''}`}>
        <div className="collapsible-inner" style={{
          padding: expanded ? '0 16px 14px' : '0 16px 0',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {displayedTasks.map(task => (
            <div
              key={task.id}
              onClick={() => navigate(`/schedule?task=${task.id}`)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 12,
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(`/schedule?task=${task.id}`)}
            >
              <Clock size={11} color="#F97316" />
              <span style={{ flex: 1, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {task.title}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                {task.daysOverdue}d
              </span>
            </div>
          ))}
          {displayedEvents.map(event => {
            const eventDate = event.start_time.split('T')[0];
            return (
              <div
                key={event.id}
                onClick={() => navigate(`/schedule?date=${eventDate}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 12,
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate(`/schedule?date=${eventDate}`)}
              >
                <CalendarX2 size={11} color="#F43F5E" />
                <span style={{ flex: 1, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {event.title}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                  {event.daysMissed}d ago
                </span>
              </div>
            );
          })}
          {remainingCount > 0 && !showAll && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
              style={{
                fontSize: 11, color: '#00D4FF', textAlign: 'center', padding: '6px 4px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontWeight: 600, transition: 'opacity 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Show all {totalCount} items (+{remainingCount} more)
            </button>
          )}
          {showAll && (
            <button
              onClick={(e) => { e.stopPropagation(); navigate('/reflect/review?mode=reschedule#overdue'); }}
              style={{
                fontSize: 11, color: '#00D4FF', textAlign: 'center', padding: '8px 4px',
                background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)',
                borderRadius: 8, cursor: 'pointer', fontWeight: 600, width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.06)'; }}
            >
              Go to reschedule agent <ArrowRight size={11} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

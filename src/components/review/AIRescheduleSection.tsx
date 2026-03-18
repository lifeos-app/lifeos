/**
 * AIRescheduleSection — Shows overdue tasks + missed events with AI reschedule suggestions.
 * Extracted from Review.tsx to keep the orchestrator lean.
 */

import { useState } from 'react';
import { useUserStore } from '../../stores/useUserStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useOverdueItems } from '../../hooks/useOverdueItems';
import {
  getAIRescheduleSuggestions,
  applyReschedule,
  applyAllReschedules,
  type RescheduleSuggestion,
} from '../../lib/llm/reschedule';
import { showToast } from '../Toast';
import {
  CheckCircle2, Sparkles, X, Loader2, Calendar, Check, Wand2,
  Clock, CalendarX2, AlertTriangle,
} from 'lucide-react';
import { localDateStr } from '../../utils/date';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#F43F5E', high: '#F97316', medium: '#00D4FF', low: '#5A7A9A',
};

function formatSuggestedDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function AIRescheduleSection() {
  const user = useUserStore(s => s.user);
  const { overdueTasks, missedEvents, totalCount, loading: overdueLoading } = useOverdueItems();
  const [suggestions, setSuggestions] = useState<RescheduleSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [pickingDateId, setPickingDateId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);

  const filteredOverdueTasks = overdueTasks.filter(t => !appliedIds.has(t.id));
  const filteredMissedEvents = missedEvents.filter(e => !appliedIds.has(e.id));
  const filteredTotalCount = filteredOverdueTasks.length + filteredMissedEvents.length;

  if (overdueLoading) return null;
  if (filteredTotalCount === 0 && suggestions.length === 0) return null;

  const fetchAISuggestions = async () => {
    if (!user?.id) return;
    setAiLoading(true);
    setAiError(null);
    setHasRequested(true);
    const result = await getAIRescheduleSuggestions(user.id, filteredOverdueTasks, filteredMissedEvents);
    if (result.error) {
      setAiError(result.error);
    } else {
      setSuggestions(result.suggestions);
      setAiSummary(result.summary);
    }
    setAiLoading(false);
  };

  const handleApplyOne = async (suggestion: RescheduleSuggestion) => {
    setApplyingId(suggestion.itemId);
    const result = await applyReschedule(suggestion);
    if (result.success) {
      setAppliedIds(prev => new Set([...prev, suggestion.itemId]));
      showToast(`Rescheduled "${suggestion.itemTitle}"`, '✅', '#00D4FF');
      useScheduleStore.setState({ lastFetched: null }); await useScheduleStore.getState().fetchAll();
    } else {
      showToast(result.error || 'Failed to reschedule', '⚠️', '#F43F5E');
    }
    setApplyingId(null);
  };

  const handleReject = (itemId: string) => {
    setRejectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handlePickDate = async (suggestion: RescheduleSuggestion, pickedDate: string) => {
    setApplyingId(suggestion.itemId);
    const modified = { ...suggestion, suggestedDate: pickedDate, suggestedTime: undefined };
    const result = await applyReschedule(modified);
    if (result.success) {
      setAppliedIds(prev => new Set([...prev, suggestion.itemId]));
      setPickingDateId(null);
      showToast(`Rescheduled "${suggestion.itemTitle}"`, '✅', '#00D4FF');
      useScheduleStore.setState({ lastFetched: null }); await useScheduleStore.getState().fetchAll();
    } else {
      showToast(result.error || 'Failed to reschedule', '⚠️', '#F43F5E');
    }
    setApplyingId(null);
  };

  const handleApplyAll = async () => {
    const pending = suggestions.filter(s => !appliedIds.has(s.itemId) && !rejectedIds.has(s.itemId));
    if (pending.length === 0) return;
    setApplyingAll(true);
    const result = await applyAllReschedules(pending);
    const newApplied = new Set(appliedIds);
    pending.forEach(s => newApplied.add(s.itemId));
    setAppliedIds(newApplied);
    if (result.failCount > 0 && result.successCount > 0) {
      showToast(`Rescheduled ${result.successCount}, ${result.failCount} failed`, '⚠️', '#F97316');
    } else if (result.failCount > 0) {
      showToast(`${result.failCount} item${result.failCount > 1 ? 's' : ''} failed to reschedule`, '⚠️', '#F43F5E');
    } else {
      showToast(`All ${result.successCount} items rescheduled`, '🎉', '#00D4FF');
    }
    useScheduleStore.setState({ lastFetched: null }); await useScheduleStore.getState().fetchAll();
    setApplyingAll(false);
  };

  const pendingSuggestions = suggestions.filter(s => !appliedIds.has(s.itemId) && !rejectedIds.has(s.itemId));
  const allHandled = suggestions.length > 0 && suggestions.every(s => appliedIds.has(s.itemId) || rejectedIds.has(s.itemId));

  return (
    <section id="overdue" className="review-wk-section" style={{
      background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(0,212,255,0.02))',
      borderColor: 'rgba(0,212,255,0.2)',
      scrollMarginTop: 20,
    }}>
      <h2 className="review-wk-section-title" style={{ color: '#00D4FF' }}>
        <Wand2 size={18} /> AI Reschedule
      </h2>

      {/* Overdue items summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {filteredOverdueTasks.length > 0 && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)',
            borderRadius: 8, fontSize: 13, color: '#F97316',
          }}>
            <Clock size={13} /> {filteredOverdueTasks.length} overdue task{filteredOverdueTasks.length > 1 ? 's' : ''}
          </span>
        )}
        {filteredMissedEvents.length > 0 && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)',
            borderRadius: 8, fontSize: 13, color: '#F43F5E',
          }}>
            <CalendarX2 size={13} /> {filteredMissedEvents.length} missed event{filteredMissedEvents.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Overdue items list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {filteredOverdueTasks.slice(0, 8).map(task => (
          <div key={task.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, fontSize: 13,
          }}>
            <AlertTriangle size={14} color="#F97316" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.title}
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              background: PRIORITY_COLORS[task.priority || 'medium'] + '20', color: PRIORITY_COLORS[task.priority || 'medium'],
            }}>
              {task.priority || 'medium'}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
              {task.daysOverdue}d overdue
            </span>
          </div>
        ))}
        {filteredMissedEvents.slice(0, 4).map(event => (
          <div key={event.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, fontSize: 13,
          }}>
            <CalendarX2 size={14} color="#F43F5E" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--text-primary)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {event.title}
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
              {event.daysMissed}d ago
            </span>
          </div>
        ))}
        {(filteredOverdueTasks.length > 8 || filteredMissedEvents.length > 4) && (
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: 4 }}>
            + {Math.max(0, filteredOverdueTasks.length - 8) + Math.max(0, filteredMissedEvents.length - 4)} more items
          </span>
        )}
      </div>

      {/* AI Suggestion button or results */}
      {!hasRequested && !aiLoading && (
        <button
          onClick={fetchAISuggestions}
          style={{
            width: '100%', padding: '14px 20px',
            background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.08))',
            border: '1px solid rgba(0,212,255,0.35)', borderRadius: 12,
            color: '#00D4FF', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s', fontFamily: 'var(--font-display)',
          }}
          onMouseOver={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,212,255,0.12))')}
          onMouseOut={e => (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.08))')}
        >
          <Wand2 size={16} /> Get AI Suggestions
        </button>
      )}

      {aiLoading && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', gap: 12,
        }}>
          <Loader2 size={28} className="spin" style={{ color: '#00D4FF' }} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
            Analyzing your schedule and finding free slots...
          </span>
        </div>
      )}

      {aiError && (
        <div style={{
          padding: '12px 16px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)',
          borderRadius: 10, fontSize: 13, color: '#F43F5E', marginBottom: 12,
        }}>
          {aiError}
          <button
            onClick={fetchAISuggestions}
            style={{
              marginLeft: 12, padding: '4px 12px', background: 'rgba(244,63,94,0.15)',
              border: '1px solid rgba(244,63,94,0.3)', borderRadius: 6, color: '#F43F5E',
              fontSize: 12, cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {suggestions.length > 0 && !aiLoading && (
        <>
          {/* AI Summary */}
          {aiSummary && (
            <div style={{
              padding: '12px 16px', background: 'rgba(0,212,255,0.06)', borderRadius: 10,
              fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: 16,
              borderLeft: '3px solid rgba(0,212,255,0.4)',
            }}>
              <Sparkles size={13} style={{ color: '#00D4FF', marginRight: 6, verticalAlign: 'middle' }} />
              {aiSummary}
            </div>
          )}

          {/* Suggestion cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {suggestions.map(s => {
              const isApplied = appliedIds.has(s.itemId);
              const isRejected = rejectedIds.has(s.itemId);
              const isApplying = applyingId === s.itemId;
              const isPicking = pickingDateId === s.itemId;
              return (
                <div key={s.itemId} style={{
                  padding: '12px 14px',
                  background: isApplied ? 'rgba(57,255,20,0.06)' : isRejected ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isApplied ? 'rgba(57,255,20,0.2)' : isRejected ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 10, transition: 'all 0.2s',
                  opacity: isApplied || isRejected ? 0.5 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        {s.itemType === 'task' ? <CheckCircle2 size={13} color="#00D4FF" /> : <Calendar size={13} color="#A855F7" />}
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.itemTitle}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'line-through' }}>
                          {formatSuggestedDate(s.originalDate)}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
                        <span style={{ color: isRejected ? 'rgba(255,255,255,0.3)' : '#00D4FF', fontWeight: 600 }}>
                          {formatSuggestedDate(s.suggestedDate)}
                          {s.suggestedTime && ` at ${s.suggestedTime}`}
                        </span>
                      </div>
                      {s.reason && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, display: 'block' }}>
                          {s.reason}
                        </span>
                      )}
                    </div>
                    {/* Action buttons */}
                    {!isApplied && !isRejected && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => !isApplying && handleApplyOne(s)}
                          disabled={isApplying}
                          style={{
                            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                            border: '1px solid rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.1)',
                            color: '#00D4FF', cursor: isApplying ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s',
                          }}
                        >
                          {isApplying ? <Loader2 size={12} className="spin" /> : 'Accept'}
                        </button>
                        <button
                          onClick={() => setPickingDateId(isPicking ? null : s.itemId)}
                          style={{
                            padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                            border: `1px solid ${isPicking ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.12)'}`,
                            background: isPicking ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.04)',
                            color: isPicking ? '#A855F7' : 'rgba(255,255,255,0.5)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s',
                          }}
                        >
                          <Calendar size={11} /> Pick
                        </button>
                        <button
                          onClick={() => handleReject(s.itemId)}
                          aria-label={`Reject suggestion for ${s.itemTitle}`}
                          style={{
                            padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                            border: '1px solid rgba(244,63,94,0.2)', background: 'rgba(244,63,94,0.06)',
                            color: '#F43F5E', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s',
                          }}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    )}
                    {isApplied && (
                      <span style={{ fontSize: 12, color: '#39FF14', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Check size={12} /> Done
                      </span>
                    )}
                    {isRejected && (
                      <button
                        onClick={() => handleReject(s.itemId)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 11,
                          border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
                          color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
                        }}
                      >
                        Undo
                      </button>
                    )}
                  </div>
                  {/* Inline date picker */}
                  {isPicking && (
                    <div style={{
                      marginTop: 10, padding: '10px 12px',
                      background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)',
                      borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Pick a date:</span>
                      <input
                        type="date"
                        min={localDateStr()}
                        defaultValue={s.suggestedDate}
                        onChange={e => {
                          if (e.target.value) handlePickDate(s, e.target.value);
                        }}
                        style={{
                          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: 6, padding: '6px 10px', color: 'rgba(255,255,255,0.9)',
                          fontSize: 13, outline: 'none',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Accept All button */}
          {pendingSuggestions.length > 1 && !allHandled && (
            <button
              onClick={handleApplyAll}
              disabled={applyingAll}
              style={{
                width: '100%', padding: '12px 20px',
                background: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.06))',
                border: '1px solid rgba(0,212,255,0.3)', borderRadius: 10,
                color: '#00D4FF', fontSize: 14, fontWeight: 700,
                cursor: applyingAll ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s', fontFamily: 'var(--font-display)',
                opacity: applyingAll ? 0.7 : 1,
              }}
            >
              {applyingAll ? (
                <><Loader2 size={14} className="spin" /> Applying...</>
              ) : (
                <><Check size={14} /> Accept All ({pendingSuggestions.length})</>
              )}
            </button>
          )}

          {allHandled && (
            <div style={{
              textAlign: 'center', padding: '12px 16px', fontSize: 14,
              color: '#39FF14', fontWeight: 600,
            }}>
              All items handled!
            </div>
          )}
        </>
      )}

      {/* Manual reschedule fallback */}
      {hasRequested && !aiLoading && suggestions.length === 0 && !aiError && (
        <div style={{
          textAlign: 'center', padding: '16px', fontSize: 13,
          color: 'rgba(255,255,255,0.45)',
        }}>
          No suggestions available. You can manually reschedule items from the Tasks view.
        </div>
      )}
    </section>
  );
}

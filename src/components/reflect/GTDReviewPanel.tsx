/**
 * GTDReviewPanel — 5-step GTD weekly review wizard
 *
 * Each phase (Capture/Clarify/Organize/Reflect/Engage) shown as a card
 * with questions and action items. Progress bar across top.
 * Saves completed reviews to localStorage.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  CheckCircle2, Circle, ChevronRight, ChevronLeft,
  Inbox, Search, FolderOpen, Eye, Zap, RotateCcw,
} from 'lucide-react';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useJournalStore } from '../../stores/useJournalStore';
import {
  generateGTDReview,
  saveGTDReview,
  getLastGTDReview,
  type GTDReview,
  type GTDReviewPhase,
  type GTDAction,
} from '../../lib/gtd-review';

// ── PHASE ICONS ──

const PHASE_ICONS = [Inbox, Search, FolderOpen, Eye, Zap] as const;
const PHASE_COLORS = ['#00D4FF', '#A855F7', '#EAB308', '#39FF14', '#F97316'] as const;

export function GTDReviewPanel() {
  const tasks = useScheduleStore(s => s.tasks);
  const goals = useGoalsStore(s => s.goals);
  const journalEntries = useJournalStore(s => s.entries);

  const [activePhase, setActivePhase] = useState(0);
  const [review, setReview] = useState<GTDReview | null>(null);
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());

  const lastReview = useMemo(() => getLastGTDReview(), []);

  // Use empty habits array — we read habit data from goals/tasks
  const habits = useMemo(() => [] as never[], []);

  const startReview = useCallback(() => {
    const entries = journalEntries.map(e => ({
      content: e.content || '',
      tags: typeof e.tags === 'string' ? e.tags : '',
    }));
    const generated = generateGTDReview(tasks, habits, goals, entries);
    setReview(generated);
    setActivePhase(0);
    setCompletedActions(new Set());
  }, [tasks, habits, goals, journalEntries]);

  const toggleAction = (actionId: string) => {
    setCompletedActions(prev => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  };

  const completeReview = () => {
    if (!review) return;
    const completed: GTDReview = {
      ...review,
      completedAt: new Date().toISOString(),
    };
    saveGTDReview(completed);
    setReview(null);
    setActivePhase(0);
  };

  // ── Not started state ──
  if (!review) {
    const lastDate = lastReview?.completedAt
      ? new Date(lastReview.completedAt).toLocaleDateString('en-AU', {
          day: 'numeric', month: 'short', year: 'numeric',
        })
      : null;

    return (
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 20,
        marginTop: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <RotateCcw size={18} style={{ color: '#00D4FF' }} />
          <span style={{ fontWeight: 600, fontSize: 15, color: '#E2E8F0' }}>GTD Weekly Review</span>
        </div>
        <p style={{ fontSize: 13, color: '#8BA4BE', lineHeight: 1.5, margin: '0 0 12px' }}>
          A structured 5-phase review to clear your mind and align your priorities.
          {lastDate && (
            <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#6B7280' }}>
              Last review: {lastDate}
              {lastReview?.weekScore !== undefined && ` (Score: ${lastReview.weekScore}/10)`}
            </span>
          )}
        </p>
        <button
          onClick={startReview}
          style={{
            background: 'linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)',
            border: 'none',
            borderRadius: 8,
            padding: '8px 20px',
            color: '#0A1628',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Start Weekly Review
        </button>
      </div>
    );
  }

  // ── Active review ──
  const currentPhase = review.phases[activePhase];
  const PhaseIcon = PHASE_ICONS[activePhase];
  const phaseColor = PHASE_COLORS[activePhase];
  const isLastPhase = activePhase === review.phases.length - 1;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
    }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {review.phases.map((phase, idx) => {
          const Icon = PHASE_ICONS[idx];
          const isActive = idx === activePhase;
          const isDone = idx < activePhase;
          const color = PHASE_COLORS[idx];
          return (
            <button
              key={phase.phase}
              onClick={() => setActivePhase(idx)}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                border: 'none',
                cursor: 'pointer',
                background: isDone
                  ? color
                  : isActive
                    ? `${color}99`
                    : 'rgba(255,255,255,0.08)',
                transition: 'background 0.2s',
              }}
              title={phase.title}
            />
          );
        })}
      </div>

      {/* Phase labels */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, justifyContent: 'space-between' }}>
        {review.phases.map((phase, idx) => {
          const isActive = idx === activePhase;
          return (
            <span
              key={phase.phase}
              style={{
                fontSize: 10,
                color: isActive ? PHASE_COLORS[idx] : '#6B7280',
                fontWeight: isActive ? 600 : 400,
                textAlign: 'center',
                flex: 1,
              }}
            >
              {phase.title}
            </span>
          );
        })}
      </div>

      {/* Current phase card */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${phaseColor}33`,
        borderRadius: 10,
        padding: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <PhaseIcon size={18} style={{ color: phaseColor }} />
          <span style={{ fontWeight: 600, fontSize: 15, color: '#E2E8F0' }}>{currentPhase.title}</span>
          <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 'auto' }}>
            {activePhase + 1}/{review.phases.length}
          </span>
        </div>

        <p style={{ fontSize: 13, color: '#8BA4BE', lineHeight: 1.5, margin: '0 0 12px' }}>
          {currentPhase.description}
        </p>

        {/* Questions */}
        <div style={{ marginBottom: 12 }}>
          {currentPhase.questions.map((q, i) => (
            <div key={i} style={{
              fontSize: 12,
              color: '#CBD5E1',
              padding: '4px 0',
              paddingLeft: 12,
              borderLeft: `2px solid ${phaseColor}33`,
              marginBottom: 4,
            }}>
              {q}
            </div>
          ))}
        </div>

        {/* Actions */}
        {currentPhase.actions.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, fontWeight: 600 }}>
              Action Items
            </div>
            {currentPhase.actions.map(action => {
              const done = completedActions.has(action.id);
              return (
                <button
                  key={action.id}
                  onClick={() => toggleAction(action.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '5px 4px',
                    textAlign: 'left',
                    borderRadius: 4,
                  }}
                >
                  {done
                    ? <CheckCircle2 size={14} style={{ color: '#39FF14', flexShrink: 0 }} />
                    : <Circle size={14} style={{ color: '#4B5563', flexShrink: 0 }} />
                  }
                  <span style={{
                    fontSize: 12,
                    color: done ? '#6B7280' : '#CBD5E1',
                    textDecoration: done ? 'line-through' : 'none',
                  }}>
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <button
          onClick={() => setActivePhase(Math.max(0, activePhase - 1))}
          disabled={activePhase === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6,
            padding: '6px 12px',
            color: activePhase === 0 ? '#4B5563' : '#8BA4BE',
            cursor: activePhase === 0 ? 'default' : 'pointer',
            fontSize: 12,
          }}
        >
          <ChevronLeft size={14} /> Back
        </button>

        {isLastPhase ? (
          <button
            onClick={completeReview}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'linear-gradient(135deg, #39FF14 0%, #2BC40E 100%)',
              border: 'none',
              borderRadius: 6,
              padding: '6px 16px',
              color: '#0A1628',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            <CheckCircle2 size={14} /> Complete Review
          </button>
        ) : (
          <button
            onClick={() => setActivePhase(Math.min(review.phases.length - 1, activePhase + 1))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: `${phaseColor}22`,
              border: `1px solid ${phaseColor}44`,
              borderRadius: 6,
              padding: '6px 12px',
              color: phaseColor,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Next Phase <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

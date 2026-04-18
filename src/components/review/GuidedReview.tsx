/**
 * GuidedReview — Immersive step-by-step weekly review wizard
 * 
 * Full-screen, one question at a time. No distractions.
 * Steps:
 *   1. Week Overview (auto-generated stats)
 *   2. Habits Check (which worked, which didn't, time analysis)
 *   3. Overdue Triage (mark done / reschedule / remove)
 *   4. Wins (free text)
 *   5. Improvements (free text)
 *   6. Priorities (next week)
 *   7. Score (1-10)
 *   8. AI Summary (generated insights + schedule suggestions)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Check, X, Clock, Flame,
  Trophy, TrendingUp, Target, Sparkles, CalendarX2,
  AlertTriangle, Calendar, Save, ArrowRight, RotateCcw,
  CheckCircle2, XCircle, RefreshCw, Star,
} from 'lucide-react';
import { supabase } from '../../lib/data-access';
import { useUserStore } from '../../stores/useUserStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { useHabitsStore } from '../../stores/useHabitsStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useJournalStore } from '../../stores/useJournalStore';
import { showToast } from '../Toast';
import { localDateStr, genId } from '../../utils/date';
import { localUpdate } from '../../lib/local-db';
import { syncNow } from '../../lib/sync-engine';
import { isOnline } from '../../lib/offline';
import './GuidedReview.css';

// ── Types ──

type Step = 'overview' | 'habits' | 'overdue' | 'wins' | 'improvements' | 'priorities' | 'score' | 'summary';

interface HabitReview {
  id: string;
  title: string;
  icon: string;
  completedDays: number;
  totalDays: number;
  /** User feedback: 'good' | 'bad_time' | 'too_hard' | 'skip' */
  feedback?: string;
}

interface OverdueItem {
  id: string;
  title: string;
  type: 'task' | 'event';
  daysOverdue: number;
  /** User action: 'done' | 'reschedule' | 'remove' | null */
  action?: string;
}

interface ReviewData {
  weekStart: string;
  weekEnd: string;
  taskStats: { completed: number; total: number };
  habitReviews: HabitReview[];
  overdueItems: OverdueItem[];
  totalIncome: number;
  eventCount: number;
  journalCount: number;
  wins: string;
  improvements: string;
  priorities: string[];
  weekScore: number;
}

const STEPS: Step[] = ['overview', 'habits', 'overdue', 'wins', 'improvements', 'priorities', 'score', 'summary'];

const STEP_LABELS: Record<Step, string> = {
  overview: 'Overview',
  habits: 'Habits',
  overdue: 'Triage',
  wins: 'Wins',
  improvements: 'Growth',
  priorities: 'Priorities',
  score: 'Score',
  summary: 'Summary',
};

// ── Props ──

interface GuidedReviewProps {
  weekStart: string;
  weekEnd: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function GuidedReview({ weekStart, weekEnd, onComplete, onCancel }: GuidedReviewProps) {
  const user = useUserStore(s => s.user);
  const storeTasks = useScheduleStore(s => s.tasks);
  const storeEvents = useScheduleStore(s => s.events);
  const storeHabits = useHabitsStore(s => s.habits);
  const storeHabitLogs = useHabitsStore(s => s.logs);
  const storeIncome = useFinanceStore(s => s.income);
  const storeJournalEntries = useJournalStore(s => s.entries);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ReviewData>({
    weekStart, weekEnd,
    taskStats: { completed: 0, total: 0 },
    habitReviews: [],
    overdueItems: [],
    totalIncome: 0,
    eventCount: 0,
    journalCount: 0,
    wins: '',
    improvements: '',
    priorities: [],
    weekScore: 5,
  });

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  // Skip steps with no data
  const activeSteps = useMemo(() => {
    return STEPS.filter(s => {
      if (s === 'habits' && data.habitReviews.length === 0) return false;
      if (s === 'overdue' && data.overdueItems.length === 0) return false;
      return true;
    });
  }, [data.habitReviews.length, data.overdueItems.length]);

  const activeIndex = activeSteps.indexOf(step);
  const progress = ((activeIndex + 1) / activeSteps.length) * 100;

  // ── Data Loading (from Zustand stores — no direct supabase queries) ──

  useEffect(() => {
    if (!user?.id) return;

    // Filter store data for the review week
    const tasks = storeTasks.filter(t =>
      t.due_date && t.due_date >= weekStart && t.due_date <= weekEnd
    );

    const events = storeEvents.filter(e =>
      e.start_time && e.start_time >= `${weekStart}T00:00:00` && e.start_time <= `${weekEnd}T23:59:59`
    );

    const habitLogs = storeHabitLogs.filter(l =>
      l.date >= weekStart && l.date <= weekEnd
    );

    const incomes = storeIncome.filter(i =>
      i.date && i.date >= weekStart && i.date <= weekEnd
    );

    const journals = storeJournalEntries.filter(e =>
      e.date >= weekStart && e.date <= weekEnd
    );

    // Build habit reviews
    const habitReviews: HabitReview[] = storeHabits.map(h => {
      const logs = habitLogs.filter(l => l.habit_id === h.id);
      return {
        id: h.id,
        title: h.title,
        icon: h.icon || '✅',
        completedDays: logs.length,
        totalDays: 7,
      };
    });

    // Build overdue items
    const overdueItems: OverdueItem[] = [];
    const now = new Date();

    tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < localDateStr(now)).forEach(t => {
      const days = Math.floor((now.getTime() - new Date(t.due_date + 'T00:00:00').getTime()) / 86400000);
      overdueItems.push({ id: t.id, title: t.title, type: 'task', daysOverdue: days });
    });

    events.filter(e => !e.completed && e.status !== 'completed' && e.end_time && new Date(e.end_time) < now).forEach(e => {
      const days = Math.floor((now.getTime() - new Date(e.end_time!).getTime()) / 86400000);
      if (days > 0) {
        overdueItems.push({ id: e.id, title: e.title, type: 'event', daysOverdue: days });
      }
    });

    setData(d => ({
      ...d,
      taskStats: {
        completed: tasks.filter(t => t.status === 'done').length,
        total: tasks.length,
      },
      habitReviews,
      overdueItems,
      totalIncome: incomes.reduce((s, i) => s + parseFloat(String(i.amount) || '0'), 0),
      eventCount: events.length,
      journalCount: journals.length,
    }));

    setLoading(false);
  }, [user?.id, weekStart, weekEnd, storeTasks, storeEvents, storeHabits, storeHabitLogs, storeIncome, storeJournalEntries]);

  // ── Navigation ──

  const goNext = () => {
    const nextActiveIndex = activeIndex + 1;
    if (nextActiveIndex < activeSteps.length) {
      setDirection('forward');
      const nextStep = activeSteps[nextActiveIndex];
      setCurrentStep(STEPS.indexOf(nextStep));
    }
  };

  const goPrev = () => {
    const prevActiveIndex = activeIndex - 1;
    if (prevActiveIndex >= 0) {
      setDirection('back');
      const prevStep = activeSteps[prevActiveIndex];
      setCurrentStep(STEPS.indexOf(prevStep));
    }
  };

  // ── Save ──

  const saveReview = async () => {
    if (!user?.id) return;
    setSaving(true);

    // Apply overdue item actions
    const overdueResults: { id: string; title: string; type: string; action: string }[] = [];
    const schedStore = useScheduleStore.getState();
    for (const item of data.overdueItems) {
      if (item.action === 'completed') {
        if (item.type === 'task') {
          await schedStore.updateTask(item.id, { status: 'done', completed_at: new Date().toISOString() });
        } else {
          // Events don't have a store update method yet — direct call is legitimate
          await supabase.from('schedule_events').update({ status: 'completed' }).eq('id', item.id);
        }
      } else if (item.action === 'remove') {
        if (item.type === 'task') {
          await schedStore.deleteTask(item.id);
        } else {
          await supabase.from('schedule_events').update({ is_deleted: true }).eq('id', item.id);
        }
      }
      // 'missed' items: leave status unchanged, recorded in review JSON below
      // 'reschedule' items get handled by AI Reschedule flow
      if (item.action) {
        overdueResults.push({ id: item.id, title: item.title, type: item.type, action: item.action });
      }
    }

    // Save review record
    const { data: existing } = await supabase.from('weekly_reviews')
      .select('id').eq('user_id', user.id).eq('week_start', weekStart).maybeSingle();

    const reviewData = {
      user_id: user.id,
      week_start: weekStart,
      week_end: weekEnd,
      wins: data.wins,
      improvements: data.improvements,
      priorities: data.priorities,
      week_score: data.weekScore,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from('weekly_reviews').update(reviewData).eq('id', existing.id);
    } else {
      await supabase.from('weekly_reviews').insert({ ...reviewData, id: genId(), created_at: new Date().toISOString() });
    }

    setSaving(false);
    showToast('Review saved! 🎉', 'success');
    window.dispatchEvent(new Event('lifeos-refresh'));
    onComplete();
  };

  // ── Habit feedback ──

  const setHabitFeedback = (habitId: string, feedback: string) => {
    setData(d => ({
      ...d,
      habitReviews: d.habitReviews.map(h =>
        h.id === habitId ? { ...h, feedback } : h
      ),
    }));
  };

  // ── Overdue action ──

  const setOverdueAction = (itemId: string, action: string) => {
    setData(d => ({
      ...d,
      overdueItems: d.overdueItems.map(i =>
        i.id === itemId ? { ...i, action: i.action === action ? undefined : action } : i
      ),
    }));
  };

  if (loading) {
    return (
      <div className="gr-container">
        <div className="gr-loading">
          <Sparkles size={32} className="spin" />
          <span>Loading your week...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="gr-container">
      {/* Progress bar */}
      <div className="gr-progress-bar">
        <div className="gr-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Step indicator */}
      <div className="gr-step-dots">
        {activeSteps.map((s, i) => (
          <div
            key={s}
            className={`gr-dot ${i === activeIndex ? 'active' : i < activeIndex ? 'done' : ''}`}
            title={STEP_LABELS[s]}
          />
        ))}
      </div>

      {/* Header */}
      <div className="gr-header">
        <button className="gr-cancel" onClick={onCancel} aria-label="Close guided review"><X size={16} /></button>
        <span className="gr-step-label">{STEP_LABELS[step]}</span>
        <span className="gr-step-count">{activeIndex + 1}/{activeSteps.length}</span>
      </div>

      {/* Content */}
      <div className="gr-content">
        {/* ── STEP: Overview ── */}
        {step === 'overview' && (
          <div key={`step-${currentStep}`} className={`gr-step ${direction === 'back' ? 'gr-slide-back' : ''}`}>
            <h2 className="gr-title">Your Week at a Glance</h2>
            <p className="gr-subtitle">{weekStart} → {weekEnd}</p>

            <div className="gr-stat-grid">
              <div className="gr-stat-card">
                <CheckCircle2 size={24} color="#00D4FF" />
                <span className="gr-stat-value">{data.taskStats.completed}/{data.taskStats.total}</span>
                <span className="gr-stat-label">Tasks</span>
              </div>
              <div className="gr-stat-card">
                <Flame size={24} color="#F97316" />
                <span className="gr-stat-value">
                  {data.habitReviews.reduce((s, h) => s + h.completedDays, 0)}/
                  {data.habitReviews.reduce((s, h) => s + h.totalDays, 0)}
                </span>
                <span className="gr-stat-label">Habits</span>
              </div>
              <div className="gr-stat-card">
                <Calendar size={24} color="#A855F7" />
                <span className="gr-stat-value">{data.eventCount}</span>
                <span className="gr-stat-label">Events</span>
              </div>
              <div className="gr-stat-card">
                <span style={{ fontSize: 24 }}>$</span>
                <span className="gr-stat-value">{data.totalIncome.toFixed(0)}</span>
                <span className="gr-stat-label">Income</span>
              </div>
            </div>

            {data.overdueItems.length > 0 && (
              <div className="gr-alert">
                <AlertTriangle size={14} />
                <span>{data.overdueItems.length} items need attention</span>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Habits ── */}
        {step === 'habits' && (
          <div key={`step-${currentStep}`} className={`gr-step ${direction === 'back' ? 'gr-slide-back' : ''}`}>
            <h2 className="gr-title">How Did Your Habits Go?</h2>
            <p className="gr-subtitle">Tap to give feedback — this helps us optimise your schedule</p>

            <div className="gr-habit-list">
              {data.habitReviews.map(habit => {
                const rate = habit.totalDays > 0 ? (habit.completedDays / habit.totalDays) * 100 : 0;
                const isGood = rate >= 70;
                const isBad = rate < 30;

                return (
                  <div key={habit.id} className="gr-habit-card">
                    <div className="gr-habit-top">
                      <span className="gr-habit-icon">{habit.icon}</span>
                      <span className="gr-habit-title">{habit.title}</span>
                      <span className={`gr-habit-rate ${isGood ? 'good' : isBad ? 'bad' : 'mid'}`}>
                        {habit.completedDays}/{habit.totalDays}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="gr-habit-bar">
                      <div className="gr-habit-bar-fill" style={{
                        width: `${rate}%`,
                        background: isGood ? '#22C55E' : isBad ? '#F43F5E' : '#F59E0B',
                      }} />
                    </div>

                    {/* Feedback buttons */}
                    <div className="gr-habit-feedback">
                      {[
                        { key: 'good', label: '👍 Good', color: '#22C55E' },
                        { key: 'bad_time', label: '⏰ Wrong Time', color: '#F59E0B' },
                        { key: 'too_hard', label: '😤 Too Hard', color: '#F43F5E' },
                        { key: 'skip', label: '⏭️ Skip', color: '#64748B' },
                      ].map(fb => (
                        <button
                          key={fb.key}
                          className={`gr-fb-btn ${habit.feedback === fb.key ? 'selected' : ''}`}
                          style={{ '--fb-color': fb.color } as React.CSSProperties}
                          onClick={() => setHabitFeedback(habit.id, fb.key)}
                        >
                          {fb.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP: Overdue Triage ── */}
        {step === 'overdue' && (
          <div key={`step-${currentStep}`} className={`gr-step ${direction === 'back' ? 'gr-slide-back' : ''}`}>
            <h2 className="gr-title">Items That Need Attention</h2>
            <p className="gr-subtitle">What should we do with these?</p>

            <div className="gr-overdue-list">
              {data.overdueItems.map(item => (
                <div key={item.id} className="gr-overdue-card">
                  <div className="gr-overdue-info">
                    {item.type === 'task' ? <CheckCircle2 size={14} /> : <CalendarX2 size={14} />}
                    <span className="gr-overdue-title">{item.title}</span>
                    <span className="gr-overdue-age">{item.daysOverdue}d</span>
                  </div>
                  <div className="gr-overdue-actions">
                    {[
                      { key: 'completed', icon: <Check size={12} />, label: 'Completed', color: '#22C55E' },
                      { key: 'missed', icon: <XCircle size={12} />, label: 'Missed', color: '#F59E0B' },
                      { key: 'reschedule', icon: <RefreshCw size={12} />, label: 'Later', color: '#00D4FF' },
                      { key: 'remove', icon: <X size={12} />, label: 'Drop', color: '#F43F5E' },
                    ].map(a => (
                      <button
                        key={a.key}
                        className={`gr-od-btn ${item.action === a.key ? 'selected' : ''}`}
                        style={{ '--od-color': a.color } as React.CSSProperties}
                        onClick={() => setOverdueAction(item.id, a.key)}
                      >
                        {a.icon} {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP: Wins ── */}
        {step === 'wins' && (
          <div key={`step-${currentStep}`} className={`gr-step ${direction === 'back' ? 'gr-slide-back' : ''}`}>
            <Trophy size={40} color="#FACC15" style={{ marginBottom: 8 }} />
            <h2 className="gr-title">What Went Well?</h2>
            <p className="gr-subtitle">Celebrate every win — big or small</p>
            <textarea
              className="gr-textarea"
              placeholder="I completed my morning routine 5/7 days..."
              value={data.wins}
              onChange={e => setData(d => ({ ...d, wins: e.target.value }))}
              rows={6}
              autoFocus
            />
          </div>
        )}

        {/* ── STEP: Improvements ── */}
        {step === 'improvements' && (
          <div key={`step-${currentStep}`} className={`gr-step ${direction === 'back' ? 'gr-slide-back' : ''}`}>
            <TrendingUp size={40} color="#00D4FF" style={{ marginBottom: 8 }} />
            <h2 className="gr-title">What Could Be Better?</h2>
            <p className="gr-subtitle">Honest reflection drives real growth</p>
            <textarea
              className="gr-textarea"
              placeholder="I kept pushing my study block later..."
              value={data.improvements}
              onChange={e => setData(d => ({ ...d, improvements: e.target.value }))}
              rows={6}
              autoFocus
            />
          </div>
        )}

        {/* ── STEP: Priorities ── */}
        {step === 'priorities' && (
          <div key={`step-${currentStep}`} className={`gr-step ${direction === 'back' ? 'gr-slide-back' : ''}`}>
            <Target size={40} color="#A855F7" style={{ marginBottom: 8 }} />
            <h2 className="gr-title">Next Week's Top Priorities</h2>
            <p className="gr-subtitle">Up to 5 — what matters most?</p>
            <div className="gr-priorities">
              {data.priorities.map((p, i) => (
                <div key={i} className="gr-priority-row">
                  <span className="gr-priority-num">{i + 1}</span>
                  <span className="gr-priority-text">{p}</span>
                  <button className="gr-priority-remove" onClick={() => {
                    setData(d => ({ ...d, priorities: d.priorities.filter((_, idx) => idx !== i) }));
                  }}><X size={12} /></button>
                </div>
              ))}
              {data.priorities.length < 5 && (
                <PriorityInput onAdd={(text) => {
                  setData(d => ({ ...d, priorities: [...d.priorities, text] }));
                }} />
              )}
            </div>
          </div>
        )}

        {/* ── STEP: Score ── */}
        {step === 'score' && (
          <div key={`step-${currentStep}`} className={`gr-step gr-score-step ${direction === 'back' ? 'gr-slide-back' : ''}`}>
            <h2 className="gr-title">Rate Your Week</h2>
            <p className="gr-subtitle">How do you feel about it overall?</p>
            <div className="gr-score-display">
              <span className="gr-score-number">{data.weekScore}</span>
              <span className="gr-score-label">/10</span>
            </div>
            <div className="gr-star-row">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button
                  key={n}
                  className={`gr-star ${n <= data.weekScore ? 'filled' : ''}`}
                  onClick={() => setData(d => ({ ...d, weekScore: n }))}
                >
                  <Star size={24} fill={n <= data.weekScore ? '#FACC15' : 'none'} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP: Summary ── */}
        {step === 'summary' && (
          <div key={`step-${currentStep}`} className={`gr-step ${direction === 'back' ? 'gr-slide-back' : ''}`}>
            <Sparkles size={40} color="#A855F7" style={{ marginBottom: 8 }} />
            <h2 className="gr-title">Review Complete</h2>
            <p className="gr-subtitle">Thank you for reflecting — here's your week in review</p>

            <div className="gr-summary-cards">
              <div className="gr-summary-item">
                <span className="gr-summary-label">Score</span>
                <span className="gr-summary-value">{data.weekScore}/10</span>
              </div>
              <div className="gr-summary-item">
                <span className="gr-summary-label">Tasks Done</span>
                <span className="gr-summary-value">{data.taskStats.completed}/{data.taskStats.total}</span>
              </div>
              {data.overdueItems.filter(i => i.action === 'completed').length > 0 && (
                <div className="gr-summary-item">
                  <span className="gr-summary-label">Completed</span>
                  <span className="gr-summary-value" style={{ color: '#22C55E' }}>
                    {data.overdueItems.filter(i => i.action === 'completed').length} items
                  </span>
                </div>
              )}
              {data.overdueItems.filter(i => i.action === 'missed').length > 0 && (
                <div className="gr-summary-item">
                  <span className="gr-summary-label">Missed</span>
                  <span className="gr-summary-value" style={{ color: '#F59E0B' }}>
                    {data.overdueItems.filter(i => i.action === 'missed').length} items
                  </span>
                </div>
              )}
              {data.overdueItems.filter(i => i.action === 'reschedule').length > 0 && (
                <div className="gr-summary-item">
                  <span className="gr-summary-label">To Reschedule</span>
                  <span className="gr-summary-value" style={{ color: '#00D4FF' }}>
                    {data.overdueItems.filter(i => i.action === 'reschedule').length} items
                  </span>
                </div>
              )}
              {data.overdueItems.filter(i => i.action === 'remove').length > 0 && (
                <div className="gr-summary-item">
                  <span className="gr-summary-label">Dropped</span>
                  <span className="gr-summary-value" style={{ color: '#F43F5E' }}>
                    {data.overdueItems.filter(i => i.action === 'remove').length} items
                  </span>
                </div>
              )}
              {data.habitReviews.filter(h => h.feedback === 'bad_time').length > 0 && (
                <div className="gr-summary-item">
                  <span className="gr-summary-label">Habits to Retime</span>
                  <span className="gr-summary-value" style={{ color: '#F59E0B' }}>
                    {data.habitReviews.filter(h => h.feedback === 'bad_time').length}
                  </span>
                </div>
              )}
              {data.priorities.length > 0 && (
                <div className="gr-summary-item" style={{ gridColumn: '1 / -1' }}>
                  <span className="gr-summary-label">Next Week Focus</span>
                  <span className="gr-summary-value" style={{ fontSize: 13 }}>
                    {data.priorities[0]}
                  </span>
                </div>
              )}
            </div>

            <button
              className="gr-save-btn"
              onClick={saveReview}
              disabled={saving}
            >
              {saving ? (
                <><Sparkles size={16} className="spin" /> Saving...</>
              ) : (
                <><Save size={16} /> Save Review</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="gr-nav">
        <button
          className="gr-nav-btn gr-nav-prev"
          onClick={goPrev}
          disabled={activeIndex === 0}
        >
          <ChevronLeft size={16} /> Back
        </button>

        {!isLast && step !== 'summary' ? (
          <button className="gr-nav-btn gr-nav-next" onClick={goNext}>
            Next <ChevronRight size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Priority Input sub-component ──

function PriorityInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [value, setValue] = useState('');
  const handleSubmit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
    }
  };
  return (
    <div className="gr-priority-input-row">
      <input
        className="gr-priority-input"
        placeholder="Add a priority..."
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
      />
      <button className="gr-priority-add" onClick={handleSubmit}>
        <ArrowRight size={14} />
      </button>
    </div>
  );
}

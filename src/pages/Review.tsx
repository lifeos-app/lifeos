import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../stores/useUserStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useJournalStore } from '../stores/useJournalStore';
import { useHealthStore } from '../stores/useHealthStore';
import { supabase } from '../lib/supabase';
import {
  ChevronLeft, ChevronRight, Sparkles, ArrowLeft, Clock, BookOpen,
} from 'lucide-react';
import { localDateStr, genId } from '../utils/date';
import { WeeklyInsightsCard } from '../components/review/WeeklyInsightsCard';
import { GuidedReview } from '../components/review/GuidedReview';
import { AIRescheduleSection } from '../components/review/AIRescheduleSection';
import { ReviewSummaryCards } from '../components/review/ReviewSummaryCards';
import { ReviewForm } from '../components/review/ReviewForm';
import './Review.css';
import { EmptyState } from '../components/EmptyState';
import { PageSkeleton } from '../components/skeletons';

interface WeeklyReview {
  id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  wins: string;
  improvements: string;
  priorities: string[];
  week_score: number;
  created_at: string;
  updated_at: string;
}

function getWeekRange(date: Date): { start: Date; end: Date } {
  const day = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

const dateStr = localDateStr;

function formatDateRange(start: Date, end: Date) {
  const startStr = start.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

export function Review() {
  const user = useUserStore(s => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const [weekOffset, setWeekOffset] = useState(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'reschedule') return 0;
    return -1;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data
  const [tasks, setTasks] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [habitLogs, setHabitLogs] = useState<any[]>([]);
  const [incomes, setIncomes] = useState<any[]>([]);
  const [healthLogs, setHealthLogs] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);

  // Review state
  const [wins, setWins] = useState('');
  const [improvements, setImprovements] = useState('');
  const [priorities, setPriorities] = useState<string[]>([]);
  const [weekScore, setWeekScore] = useState(5);
  const [currentReview, setCurrentReview] = useState<WeeklyReview | null>(null);
  const [historicalReviews, setHistoricalReviews] = useState<WeeklyReview[]>([]);

  // Guided review mode
  const [showGuidedReview, setShowGuidedReview] = useState(false);

  // Calculate current week range
  const weekRange = useMemo(() => {
    const today = new Date();
    today.setDate(today.getDate() + weekOffset * 7);
    return getWeekRange(today);
  }, [weekOffset]);

  const weekStartStr = dateStr(weekRange.start);
  const weekEndStr = dateStr(weekRange.end);
  const isCurrentWeek = weekOffset === 0;

  // ══════════════════════════════════════════════════════════════════════════════
  // FETCH
  // ══════════════════════════════════════════════════════════════════════════════
  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    await Promise.all([
      useGoalsStore.getState().fetchAll(),
      useHabitsStore.getState().fetchAll(),
      useScheduleStore.getState().fetchAll(),
      useFinanceStore.getState().fetchAll(),
      useJournalStore.getState().fetchRecent(),
      useHealthStore.getState().fetchToday(),
    ]);

    const allTasks = useScheduleStore.getState().tasks;
    const allHabitLogs = useHabitsStore.getState().logs;
    const allIncome = useFinanceStore.getState().income;
    const allJournalEntries = useJournalStore.getState().entries;

    setTasks(allTasks.filter(t => t.due_date && t.due_date >= weekStartStr && t.due_date <= weekEndStr) as any[]);
    setGoals(useGoalsStore.getState().goals as any[]);
    setHabits(useHabitsStore.getState().habits as any[]);
    setHabitLogs(allHabitLogs.filter(l => l.date >= weekStartStr && l.date <= weekEndStr) as any[]);
    setIncomes(allIncome.filter(i => i.date && i.date >= weekStartStr && i.date <= weekEndStr) as any[]);
    const healthMetrics = useHealthStore.getState().todayMetrics;
    setHealthLogs(healthMetrics ? [healthMetrics] as any[] : []);
    setJournalEntries(allJournalEntries.filter(e => e.date >= weekStartStr && e.date <= weekEndStr) as any[]);

    const { data: review } = await supabase.from('weekly_reviews').select('*')
      .eq('user_id', user.id)
      .eq('week_start', weekStartStr)
      .eq('week_end', weekEndStr)
      .maybeSingle();

    if (review) {
      setCurrentReview(review);
      setWins(review.wins || '');
      setImprovements(review.improvements || '');
      setPriorities(review.priorities || []);
      setWeekScore(review.week_score || 5);
    } else {
      setCurrentReview(null);
      setWins(''); setImprovements(''); setPriorities([]); setWeekScore(5);
    }

    setLoading(false);
  }, [user?.id, weekStartStr, weekEndStr]);

  const fetchHistoricalReviews = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('weekly_reviews').select('*')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(10);
    setHistoricalReviews(data || []);
  }, [user?.id]);

  useEffect(() => {
    fetchData();
    fetchHistoricalReviews();
  }, [fetchData, fetchHistoricalReviews]);

  // Scroll to #overdue anchor when navigated with hash
  useEffect(() => {
    if (location.hash === '#overdue') {
      const timer = setTimeout(() => {
        const el = document.getElementById('overdue');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [location.hash, loading]);

  // ══════════════════════════════════════════════════════════════════════════════
  // COMPUTED
  // ══════════════════════════════════════════════════════════════════════════════
  const taskStats = useMemo(() => {
    const completed = tasks.filter(t => t.status === 'done').length;
    const total = tasks.length;
    return { completed, total, rate: total > 0 ? (completed / total) * 100 : 0 };
  }, [tasks]);

  const habitStats = useMemo(() => {
    const totalDays = 7;
    const totalPossible = habits.length * totalDays;
    const completed = habitLogs.length;
    return { completed, totalPossible, rate: totalPossible > 0 ? (completed / totalPossible) * 100 : 0 };
  }, [habits, habitLogs]);

  const goalsProgress = useMemo(() => {
    const activeGoals = goals.filter(g => !g.completed_at && g.parent_goal_id === null);
    const avgProgress = activeGoals.length > 0
      ? activeGoals.reduce((sum, g) => sum + (g.progress || 0), 0) / activeGoals.length
      : 0;
    return Math.round(avgProgress);
  }, [goals]);

  const totalIncome = useMemo(() => {
    return incomes.reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);
  }, [incomes]);

  const avgHealthScore = useMemo(() => {
    if (healthLogs.length === 0) return 0;
    const sum = healthLogs.reduce((s, log) => s + ((log.mood_score || 0) + (log.energy_score || 0)) / 2, 0);
    return Math.round(sum / healthLogs.length);
  }, [healthLogs]);

  const journalCount = journalEntries.length;

  // ══════════════════════════════════════════════════════════════════════════════
  // SAVE REVIEW
  // ══════════════════════════════════════════════════════════════════════════════
  const saveReview = async () => {
    if (!user?.id) return;
    setSaving(true);
    const reviewData = {
      user_id: user.id,
      week_start: weekStartStr,
      week_end: weekEndStr,
      wins,
      improvements,
      priorities,
      week_score: weekScore,
      updated_at: new Date().toISOString(),
    };

    if (currentReview) {
      await supabase.from('weekly_reviews').update(reviewData).eq('id', currentReview.id);
    } else {
      const { data } = await supabase.from('weekly_reviews').insert({
        ...reviewData,
        id: genId(),
        created_at: new Date().toISOString(),
      }).select().single();
      setCurrentReview(data);
    }

    setSaving(false);
    fetchHistoricalReviews();
  };

  const showBackButton = location.pathname.startsWith('/reflect/');

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="review-weekly">
      {showBackButton && (
        <button
          onClick={() => navigate('/reflect')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', marginBottom: 12,
            background: 'rgba(15, 45, 74, 0.4)', border: '1px solid rgba(26, 58, 92, 0.6)',
            borderRadius: 8, color: '#8BA4BE', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <ArrowLeft size={14} /> Back to Reflect
        </button>
      )}

      {/* Header */}
      <div className="review-wk-header">
        <div className="review-wk-nav">
          <button className="review-wk-nav-btn" onClick={() => setWeekOffset(weekOffset - 1)} aria-label="Previous week">
            <ChevronLeft size={20} />
          </button>
          <div className="review-wk-date-display">
            <h1 className="review-wk-title">Weekly Review</h1>
            <p className="review-wk-subtitle">{formatDateRange(weekRange.start, weekRange.end)}</p>
          </div>
          <button className="review-wk-nav-btn" onClick={() => setWeekOffset(weekOffset + 1)} disabled={weekOffset >= 0} aria-label="Next week">
            <ChevronRight size={20} />
          </button>
        </div>
        {isCurrentWeek && (
          <span className="review-wk-in-progress-badge">
            <Clock size={12} /> Week in progress
          </span>
        )}
        {weekOffset < -1 && (
          <button className="review-wk-today-btn" onClick={() => setWeekOffset(-1)}>Last Week</button>
        )}
      </div>

      {loading ? (
        <PageSkeleton />
      ) : (
        <div className="review-wk-content">
          {tasks.length === 0 && habitLogs.length === 0 && journalEntries.length === 0 && healthLogs.length === 0 && !currentReview && (
            <EmptyState variant="review" />
          )}

          {/* Summary Cards */}
          <ReviewSummaryCards
            taskStats={taskStats}
            habitStats={habitStats}
            goalsProgress={goalsProgress}
            totalIncome={totalIncome}
            avgHealthScore={avgHealthScore}
            journalCount={journalCount}
          />

          {/* AI Reschedule Section */}
          <AIRescheduleSection />

          {/* AI Weekly Insights */}
          <WeeklyInsightsCard weekStart={weekStartStr} weekEnd={weekEndStr} />

          {/* Week in progress notice */}
          {isCurrentWeek && (
            <section className="review-wk-section" style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))',
              borderColor: 'rgba(245,158,11,0.2)',
              textAlign: 'center',
              padding: '24px 20px',
            }}>
              <Clock size={28} style={{ color: '#F59E0B', marginBottom: 8 }} />
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#F59E0B', margin: '0 0 8px' }}>
                Week in Progress
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 16px', lineHeight: 1.5 }}>
                Come back at the end of the week to reflect on your wins, improvements, and set next week's priorities.
                You can still reschedule overdue items above.
              </p>
              <button
                className="review-wk-today-btn"
                onClick={() => setWeekOffset(-1)}
                style={{ margin: '0 auto' }}
              >
                <ChevronLeft size={14} /> Review Last Week Instead
              </button>
            </section>
          )}

          {/* Guided Review CTA — for completed weeks */}
          {!isCurrentWeek && !currentReview && (
            <section className="review-wk-section" style={{
              textAlign: 'center', padding: '28px 20px',
              background: 'linear-gradient(135deg, rgba(168,85,247,0.10), rgba(99,102,241,0.06))',
              borderColor: 'rgba(168,85,247,0.25)',
            }}>
              <Sparkles size={32} style={{ color: '#A855F7', marginBottom: 8 }} />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#A855F7', margin: '0 0 8px' }}>
                Start Your Weekly Review
              </h2>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '0 0 16px', lineHeight: 1.5 }}>
                A guided walkthrough of your week — habits, tasks, wins, and what's next.
              </p>
              <button
                onClick={() => setShowGuidedReview(true)}
                style={{
                  padding: '12px 28px', borderRadius: 10,
                  background: 'linear-gradient(135deg, #A855F7, #6366F1)',
                  color: 'white', fontSize: 15, fontWeight: 700,
                  border: 'none', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  boxShadow: '0 4px 16px rgba(168,85,247,0.3)',
                  transition: 'all 0.2s',
                }}
              >
                <Sparkles size={16} /> Begin Review
              </button>
            </section>
          )}

          {/* Guided Review Overlay */}
          {showGuidedReview && (
            <GuidedReview
              weekStart={weekStartStr}
              weekEnd={weekEndStr}
              onComplete={() => { setShowGuidedReview(false); fetchData(); fetchHistoricalReviews(); }}
              onCancel={() => setShowGuidedReview(false)}
            />
          )}

          {/* Review form — only show when editing an existing review */}
          {!isCurrentWeek && currentReview && (
            <ReviewForm
              wins={wins}
              improvements={improvements}
              priorities={priorities}
              weekScore={weekScore}
              saving={saving}
              onWinsChange={setWins}
              onImprovementsChange={setImprovements}
              onPrioritiesChange={setPriorities}
              onWeekScoreChange={setWeekScore}
              onSave={saveReview}
              hasExistingReview={!!currentReview}
            />
          )}

          {/* Historical Reviews */}
          {historicalReviews.length > 0 && (
            <section className="review-wk-section review-wk-history">
              <h2 className="review-wk-section-title">
                <BookOpen size={18} /> Past Reviews
              </h2>
              <div className="review-wk-history-list">
                {historicalReviews.map(review => {
                  const start = new Date(review.week_start + 'T00:00:00');
                  const end = new Date(review.week_end + 'T00:00:00');
                  const isThisWeek = review.week_start === weekStartStr;
                  return (
                    <div
                      key={review.id}
                      className={`review-wk-history-item ${isThisWeek ? 'current' : ''}`}
                      onClick={() => {
                        const weeksDiff = Math.round((new Date().getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
                        setWeekOffset(-weeksDiff);
                      }}
                    >
                      <div className="review-wk-history-date">
                        <span>{formatDateRange(start, end)}</span>
                        {isThisWeek && <span className="review-wk-badge">Current</span>}
                      </div>
                      <div className="review-wk-history-score">
                        <Sparkles size={14} />
                        <span>{review.week_score}/10</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

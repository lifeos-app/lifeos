/**
 * Dashboard — Fullscreen Command Center
 *
 * Tabbed layout: Today, Schedule, Goals, Habits, Insights
 * Uses FullscreenPage for consistent immersive experience.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback, startTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Target, Flame, BarChart3,
  Sunrise, Zap, MoonStar, Bed,
} from 'lucide-react';
import { useUserStore } from '../stores/useUserStore';
import { useScheduleStore } from '../stores/useScheduleStore';
import { useHabitsStore } from '../stores/useHabitsStore';
import { useFinanceStore } from '../stores/useFinanceStore';
import { useHealthStore } from '../stores/useHealthStore';
import { useGoalsStore } from '../stores/useGoalsStore';
import { useJournalStore } from '../stores/useJournalStore';
import { useShallow } from 'zustand/react/shallow';
import { getAllSuggestions, type HabitSuggestion } from '../lib/habit-engine';
import { getFinancialSnapshot, type FinancialSnapshot } from '../lib/financial-engine';
import { useHealthMetrics } from '../hooks/useHealth';
import { getModeLabel, type DashboardMode } from '../lib/dashboard-modes';
import { DashboardLayoutEditor } from '../components/DashboardLayoutEditor';
import { safeScrollIntoView } from '../utils/scroll';
import { localDateStr, getWeekRange, formatDate } from '../utils/date';
import { useDashboardLayout } from '../hooks/useDashboardLayout';
import { useDashboardMode } from '../hooks/useDashboardMode';
import { PluginActivityWidget } from '../components/plugins/PluginActivityWidget';
import { PhaseTracker } from '../components/PhaseTracker';
import { getUIState, setUIState } from '../utils/ui-state';
import { SpotlightTour } from '../components/SpotlightTour';
import { shouldShowRealmInvite } from '../components/dashboard/DashboardRealmInvite';
import { TaskDetail } from '../components/TaskDetail';
import { FullscreenPage } from '../components/FullscreenPage';

import {
  DashboardGreeting,
  DashboardMorningBrief,
  DashboardQuickActions,
  DashboardSchedule,
  DashboardStatsRow,
  DashboardInsights,
  DashboardAchievements,
  DashboardRealmPreview,
  DashboardJournal,
  DashboardTasks,
  DashboardHabits,
  DashboardHealth,
  DashboardFinances,
  DashboardGoals,
  DashboardSuggestions,
  DashboardOverdue,
  DashboardTriage,
  DashboardCompletionRates,
  FreeTimeSuggestions,
  DashboardNPCInsight,
  DashboardLifePulse,
  DashboardStreakWarnings,
  DashboardRealmInvite,
  DashboardCelestial,
  DashboardStreakMomentum,
  DashboardDailyProgress,
  DashboardWeeklyInsight,
  DashboardFinancialPulse,
  SleepQuickLog,
  SageWidget,
  DailyRewardToast,
  ChallengeCard,
  DashboardScheduleInsights,
  StreakShieldWidget,
  DashboardEveningReview,
  DashboardLifeScore,
  DashboardCorrelations,
} from '../components/dashboard';
import { ProactiveSuggestions } from '../components/dashboard/ProactiveSuggestions';
import { HolyHermesOracle } from '../components/HolyHermesOracle';
import { DailyHermeticAffirmation } from '../components/dashboard/DailyHermeticAffirmation';
import { Brain } from 'lucide-react';
import { AgentNudgeBar } from '../components/agent';
import { useAgentStore } from '../stores/useAgentStore';
import { DashboardSkeleton } from '../components/skeletons';

import '../components/PhaseTracker.css';
import './Dashboard.css';
import { logger } from '../utils/logger';
import { ErrorCard } from '../components/ui/ErrorCard';
import { EmptyState } from '../components/EmptyState';
import { FeatureErrorBoundary } from '../components/FeatureErrorBoundary';
import { TCSTodayCard, DailyCheckin, TCSDrivingWidget } from '../components/tcs';
import { useTCSEnabled } from '../hooks/useTCSEnabled';
import { DashboardHeatmap } from '../components/dashboard/DashboardHeatmap';

type DashTab = 'today' | 'schedule' | 'goals' | 'habits' | 'insights';

const DASH_TABS = [
  { id: 'today',    label: 'Today',    icon: LayoutDashboard, color: '#F97316' },
  { id: 'schedule', label: 'Schedule', icon: Calendar,        color: '#00D4FF' },
  { id: 'goals',    label: 'Goals',    icon: Target,          color: '#39FF14' },
  { id: 'habits',   label: 'Habits',   icon: Flame,           color: '#EAB308' },
  { id: 'insights', label: 'Insights', icon: BarChart3,       color: '#A855F7' },
];

const VALID_TABS: DashTab[] = ['today', 'schedule', 'goals', 'habits', 'insights'];
const MOODS: Record<number, string> = { 1: '😫', 2: '😕', 3: '😐', 4: '🙂', 5: '😄' };

// Mode indicator icons (Lucide)
const MODE_ICONS: Record<DashboardMode, React.ReactNode> = {
  morning: <Sunrise size={13} />,
  active:  <Zap size={13} />,
  evening: <MoonStar size={13} />,
  night:   <Bed size={13} />,
};

export function Dashboard() {
  const user = useUserStore(s => s.user);
  const profile = useUserStore(s => s.profile);
  const tcsEnabled = useTCSEnabled();
  const layout = useDashboardLayout();
  const dashMode = useDashboardMode(profile?.display_name ?? user?.email ?? '');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as DashTab | null;
  const initialTab = tabFromUrl && VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'today';
  const [activeTab, setActiveTab] = useState<DashTab>(initialTab);
  const prevTabIndex = useRef(VALID_TABS.indexOf(initialTab));
  const [slideDir, setSlideDir] = useState<'left' | 'right' | 'none'>('none');

  const handleTabChange = useCallback((tabId: string) => {
    const tab = tabId as DashTab;
    const newIndex = VALID_TABS.indexOf(tab);
    const oldIndex = prevTabIndex.current;
    setSlideDir(newIndex > oldIndex ? 'right' : newIndex < oldIndex ? 'left' : 'none');
    prevTabIndex.current = newIndex;
    startTransition(() => setActiveTab(tab));
  }, []);

  useEffect(() => {
    if (tabFromUrl && VALID_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      handleTabChange(tabFromUrl);
    }
  }, [tabFromUrl, activeTab, handleTabChange]);

  const tasksRef = useRef<HTMLElement>(null);
  const habitsRef = useRef<HTMLElement>(null);
  const finRef = useRef<HTMLElement>(null);
  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    safeScrollIntoView(ref.current, { behavior: 'smooth', block: 'start' });
  };

  // ── STORE DATA (shallow selectors to reduce re-renders) ──
  const { tasks, events, loading: scheduleLoading } = useScheduleStore(
    useShallow(s => ({ tasks: s.tasks, events: s.events, loading: s.loading }))
  );
  const goals = useGoalsStore(s => s.goals);
  const goalsLoading = useGoalsStore(s => s.loading);
  const { habits, logs: habitLogs } = useHabitsStore(
    useShallow(s => ({ habits: s.habits, logs: s.logs }))
  );
  const habitsLoading = useHabitsStore(s => s.loading);
  const { income, expenses, bills, businesses, transactions } = useFinanceStore(
    useShallow(s => ({ income: s.income, expenses: s.expenses, bills: s.bills, businesses: s.businesses, transactions: s.transactions }))
  );
  const healthMetrics = useHealthStore(s => s.todayMetrics);
  const healthLoading = useHealthStore(s => s.loading);

  // Recent health metrics (last 7 days) for SleepQuickLog sparkline
  const sevenDaysAgo = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);
  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const { data: recentHealthMetrics, upsertToday: updateHealthMetrics } = useHealthMetrics(
    { from: sevenDaysAgo, to: todayDateStr }
  );
  // Cast to HealthMetric[] — both types share sleep_hours, sleep_quality, date
  const recentMetrics = useMemo(() => [...recentHealthMetrics].reverse() as unknown as typeof healthMetrics[], [recentHealthMetrics]);

  // Unified loading: show skeleton until ALL critical stores are ready
  const allDataReady = useMemo(() =>
    !scheduleLoading && !goalsLoading && !habitsLoading && !healthLoading,
    [scheduleLoading, goalsLoading, habitsLoading, healthLoading]
  );
  const loading = !allDataReady;

  const [finSnapshot, setFinSnapshot] = useState<FinancialSnapshot | null>(null);
  const [habitSuggestions, setHabitSuggestions] = useState<HabitSuggestion[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => localDateStr());
  const [taskView, setTaskView] = useState<'list' | 'board'>('list');
  const [taskFilter, setTaskFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue'>('all');
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [showAllWidgets, setShowAllWidgets] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [phaseTrackerDismissed, setPhaseTrackerDismissed] = useState(() => getUIState('phase_tracker_dismissed'));

  // ── MODE-BASED WIDGET VISIBILITY ──
  // Determine which secondary-column widgets are visible based on mode priorities
  const modeVisibleIds = useMemo(() => {
    if (showAllWidgets) return null; // null = show all
    const visible = new Set<string>();
    for (const w of dashMode.config) {
      if (!w.collapsed) visible.add(w.id);
    }
    return visible;
  }, [dashMode.config, showAllWidgets]);

  const isWidgetVisible = useCallback((id: string) => {
    if (!modeVisibleIds) return true; // showAllWidgets mode
    return modeVisibleIds.has(id);
  }, [modeVisibleIds]);

  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);
  const weeklyTasks = useMemo(() =>
    tasks.filter(t => t.status === 'done' && t.completed_at && t.completed_at >= sevenDaysAgoStr),
    [tasks, sevenDaysAgoStr]
  );

  const journalEntry = useJournalStore(s => s.getEntryForDate(selectedDate));

  const fetchAll = () => {
    useScheduleStore.getState().invalidate();
    useGoalsStore.getState().invalidate();
    useHabitsStore.getState().invalidate();
    useFinanceStore.getState().invalidate();
    useHealthStore.getState().invalidate();
    useJournalStore.getState().invalidate();
  };

  useEffect(() => {
    if (user?.id) {
      getFinancialSnapshot(user.id).then(snap => setFinSnapshot(snap)).catch(err => { logger.error('[Dashboard] Financial snapshot failed:', err); setFetchError('Failed to load some dashboard data'); });
      getAllSuggestions(user.id).then(s => setHabitSuggestions(s)).catch(err => { logger.error('[Dashboard] Habit suggestions failed:', err); setFetchError('Failed to load some dashboard data'); });
    }
  }, [user?.id]);

  // Mount-only: fetchAll calls store.getState() so it's stable without deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handler = () => fetchAll();
    window.addEventListener('lifeos-refresh', handler);
    return () => window.removeEventListener('lifeos-refresh', handler);
  }, []);

  // ── DERIVED DATA ──
  const weekDays = getWeekRange();
  const weekIndicators = useMemo(() => {
    const map = new Map<string, { done: boolean; pending: boolean; habit: boolean }>();
    for (const d of weekDays) {
      const fd = d.fullDate;
      const dayT = tasks.filter(t => t.due_date === fd || (t.completed_at && t.completed_at.startsWith(fd)));
      const hasDone = dayT.some(t => t.status === 'done');
      const hasPending = dayT.some(t => t.status !== 'done');
      const hasHabit = habitLogs.some(l => l.date === fd);
      map.set(fd, { done: hasDone, pending: hasPending, habit: hasHabit });
    }
    return map;
  }, [weekDays, tasks, habitLogs]);

  const realTodayS = localDateStr(new Date());
  const isToday = selectedDate === realTodayS;
  const todayStr = formatDate(selectedDate);

  const dayTasks = useMemo(() => tasks.filter(t =>
    t.due_date === selectedDate || (t.completed_at && t.completed_at.startsWith(selectedDate))
  ), [tasks, selectedDate]);
  const dayDoneTasks = useMemo(() => dayTasks.filter(t => t.status === 'done'), [dayTasks]);
  const dayActiveTasks = useMemo(() => dayTasks.filter(t => t.status !== 'done'), [dayTasks]);
  const dayEvents = useMemo(() => events.filter(e => !e.start_time ? isToday : e.start_time.startsWith(selectedDate)), [events, selectedDate, isToday]);
  const dayBills = useMemo(() => bills.filter(b => b.due_date === selectedDate && b.status !== 'paid'), [bills, selectedDate]);
  const dayHabitLogs = useMemo(() => habitLogs.filter(l => l.date === selectedDate), [habitLogs, selectedDate]);

  const dayHabitsDone = useMemo(() => habits.filter(h => {
    const hLogs = dayHabitLogs.filter(l => l.habit_id === h.id);
    return hLogs.reduce((s: number, l: any) => s + (l.count || 1), 0) >= (h.target_count || 1);
  }).length, [habits, dayHabitLogs]);

  const bestHabitStreak = useMemo(() => {
    let best = 0;
    for (const h of habits) {
      const dates = [...new Set(habitLogs.filter(l => l.habit_id === h.id).map(l => l.date))].sort().reverse();
      let streak = 0;
      const today = new Date();
      for (let i = 0; i <= dates.length; i++) {
        const check = new Date(today); check.setDate(check.getDate() - i);
        if (dates.includes(localDateStr(check))) streak++;
        else if (i > 0) break;
        else continue;
      }
      if (streak > best) best = streak;
    }
    return best;
  }, [habits, habitLogs]);

  const dayTaskProgress = dayTasks.length > 0 ? dayDoneTasks.length / dayTasks.length : 0;
  const avgGoalProgress = goals.length > 0 ? goals.reduce((s, g) => s + (g.progress || 0), 0) / goals.length : 0;
  const somStr = useMemo(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; }, []);
  const monthIncome = useMemo(() => income.filter(i => i.date >= somStr).reduce((s, i) => s + i.amount, 0), [income, somStr]);
  const monthExpenses = useMemo(() => expenses.filter(e => e.date >= somStr).reduce((s, e) => s + e.amount, 0), [expenses, somStr]);
  const net = monthIncome - monthExpenses;

  const weeklyChartData = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = localDateStr(d);
      days.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), count: weeklyTasks.filter(t => t.completed_at?.startsWith(dateStr)).length });
    }
    return days;
  }, [weeklyTasks]);

  const todayMood = journalEntry?.mood ? MOODS[journalEntry.mood] : null;
  const agentNudges = useAgentStore(s => s.nudges);
  const activeInsightCount = agentNudges.filter(n => !n.dismissed).length;
  const activeColor = DASH_TABS.find(t => t.id === activeTab)?.color || '#F97316';

  // ── Shared elements across tabs ──
  const weekStrip = (
    <div className="week-strip" role="tablist" aria-label="Select day of the week">
      {weekDays.map(d => (
        <button key={`${d.day}-${d.date}`}
          className={`week-cell ${d.isToday ? 'today' : ''} ${d.isPast ? 'past' : ''} ${d.fullDate === selectedDate ? 'selected' : ''}`}
          onClick={() => setSelectedDate(d.fullDate)}
          role="tab"
          aria-selected={d.fullDate === selectedDate}
          aria-label={`${d.day} ${d.date}${d.isToday ? ', today' : ''}`}>
          <span className="week-lbl">{d.day}</span>
          <span className="week-num">{d.date}</span>
          {d.fullDate === selectedDate && <div className="week-dot" aria-hidden="true" />}
          {(() => { const info = weekIndicators.get(d.fullDate); return info && (info.done || info.pending || info.habit) ? (
            <div className="week-indicators">
              {info.done && <span className="week-indicator done" />}
              {info.pending && <span className="week-indicator pending" />}
              {info.habit && <span className="week-indicator habit" />}
            </div>
          ) : null; })()}
        </button>
      ))}
    </div>
  );

  // ── Mode badge for header ──
  const modeBadge = (
    <div
      className="dash-mode-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        color: dashMode.accent,
        background: `color-mix(in srgb, ${dashMode.accent} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${dashMode.accent} 20%, transparent)`,
        transition: 'color 1.5s ease, background 1.5s ease, border-color 1.5s ease',
      }}
      aria-label={`Dashboard mode: ${getModeLabel(dashMode.mode)}`}
    >
      {MODE_ICONS[dashMode.mode]}
      <span>{getModeLabel(dashMode.mode)}</span>
    </div>
  );

  return (
    <FullscreenPage
      title="LifeOS"
      titleIcon={<span className="mh-zap" style={{ fontSize: 16 }}>⚡</span>}
      tabs={DASH_TABS}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      slideDir={slideDir}
      activeColor={activeColor}
      headerExtra={modeBadge}
    >
      <div className="dash" style={{ '--dash-accent': dashMode.accent } as React.CSSProperties}>
        <DailyRewardToast />
        <ChallengeCard />
        <AgentNudgeBar />
        {fetchError && <ErrorCard message={fetchError} onRetry={fetchAll} />}
        {loading && tasks.length === 0 && <DashboardSkeleton />}
        {!loading && tasks.length === 0 && habits.length === 0 && goals.length === 0 && !profile?.onboarding_complete && (
          <EmptyState
            variant="dashboard"
            action={{ label: 'Get Started', onClick: () => navigate('/habits') }}
          />
        )}

        {/* ═══ TODAY TAB ═══ */}
        {activeTab === 'today' && (
          <div className="dash-today-layout">
            <div className="dash-full-row">
              <FeatureErrorBoundary feature="Greeting" compact>
                <DashboardGreeting selectedDate={selectedDate} bestHabitStreak={bestHabitStreak} todayMood={todayMood} onEditLayout={() => layout.setEditing(true)} />
              </FeatureErrorBoundary>
              <FeatureErrorBoundary feature="Quick Actions" compact>
                <DashboardQuickActions />
              </FeatureErrorBoundary>
              {tcsEnabled && (
                <FeatureErrorBoundary feature="TCS Tonight" compact>
                  <TCSTodayCard />
                </FeatureErrorBoundary>
              )}
              {tcsEnabled && (
                <FeatureErrorBoundary feature="TCS Check-in" compact>
                  <DailyCheckin />
                </FeatureErrorBoundary>
              )}
              {tcsEnabled && (
                <FeatureErrorBoundary feature="TCS Driving" compact>
                  <TCSDrivingWidget />
                </FeatureErrorBoundary>
              )}
              <FeatureErrorBoundary feature="Streak Warnings" compact>
                <DashboardStreakWarnings />
              </FeatureErrorBoundary>
              <FeatureErrorBoundary feature="Streak Shield" compact>
                <StreakShieldWidget />
              </FeatureErrorBoundary>

              {activeInsightCount > 0 && (
                <div className="dash-insight-summary" style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', marginBottom: 8,
                  background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)',
                  borderRadius: 10, fontSize: 13, color: 'rgba(255,255,255,0.7)',
                }}>
                  <Brain size={16} />
                  <span>ZeroClaw has <strong style={{ color: '#00D4FF' }}>{activeInsightCount}</strong> insight{activeInsightCount !== 1 ? 's' : ''} for you</span>
                </div>
              )}

              <FeatureErrorBoundary feature="Free Time" compact>
                <FreeTimeSuggestions />
              </FeatureErrorBoundary>
              {weekStrip}

              {profile && !phaseTrackerDismissed && (
                <div style={{ position: 'relative' }}>
                  <PhaseTracker
                    preferences={profile.preferences as Record<string, any>}
                  />
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUIState('phase_tracker_dismissed'); setPhaseTrackerDismissed(true); }}
                    aria-label="Dismiss setup tracker"
                    style={{
                      position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.08)',
                      border: 'none', borderRadius: '50%', width: 22, height: 22,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 12,
                      lineHeight: 1, padding: 0, zIndex: 2,
                    }}
                    title="Dismiss — find it in the sidebar"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <div className="dash-primary-col">
              {isWidgetVisible('triage') && (
                <FeatureErrorBoundary feature="Triage" compact>
                  <DashboardTriage />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('overdue') && (
                <FeatureErrorBoundary feature="Overdue" compact>
                  <DashboardOverdue />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('morning-brief') && (
                <FeatureErrorBoundary feature="Morning Brief" compact>
                  <DashboardMorningBrief />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('evening-review') && (
                <FeatureErrorBoundary feature="Evening Review" compact>
                  <DashboardEveningReview />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('stats') && (
                <FeatureErrorBoundary feature="Stats" compact>
                  <DashboardStatsRow dayTasks={dayTasks} dayDoneTasks={dayDoneTasks} dayActiveTasks={dayActiveTasks}
                    dayHabitsDone={dayHabitsDone} totalHabits={habits.length} dayEvents={dayEvents} dayBills={dayBills} net={net}
                    onScrollToTasks={() => scrollTo(tasksRef)} onScrollToHabits={() => scrollTo(habitsRef)} onSetTaskFilter={f => setTaskFilter(f as string)} />
                </FeatureErrorBoundary>
              )}
            </div>
            <div className="dash-secondary-col" style={{
              borderColor: dashMode.accent,
              transition: 'border-color 1.5s ease',
            }}>
              {isWidgetVisible('daily-progress') && (
                <FeatureErrorBoundary feature="Daily Progress" compact>
                  <DashboardDailyProgress />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('proactive-suggest') && (
                <FeatureErrorBoundary feature="Proactive Suggestions" compact>
                  <ProactiveSuggestions />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('sleep-quick-log') && (
                <FeatureErrorBoundary feature="Sleep Quick Log" compact>
                  <SleepQuickLog
                    todayMetrics={healthMetrics}
                    recentMetrics={recentMetrics}
                    onUpdateMetrics={updateHealthMetrics}
                  />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('streak-momentum') && (
                <FeatureErrorBoundary feature="Streak Momentum" compact>
                  <DashboardStreakMomentum />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('financial-pulse') && (
                <FeatureErrorBoundary feature="Financial Pulse" compact>
                  <DashboardFinancialPulse />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('schedule-insights') && (
                <FeatureErrorBoundary feature="Schedule Insights" compact>
                  <DashboardScheduleInsights />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('weekly-insight') && (
                <FeatureErrorBoundary feature="Weekly Insight" compact>
                  <DashboardWeeklyInsight />
                </FeatureErrorBoundary>
              )}
              <FeatureErrorBoundary feature="Activity Heatmap" compact>
                <DashboardHeatmap />
              </FeatureErrorBoundary>
              {isWidgetVisible('realm-invite') && (
                <FeatureErrorBoundary feature="Realm Invite" compact>
                  <DashboardRealmInvite />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('realm-preview') && (
                <FeatureErrorBoundary feature="Realm Preview" compact>
                  <DashboardRealmPreview />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('npc-insight') && (
                <FeatureErrorBoundary feature="NPC Insight" compact>
                  <DashboardNPCInsight />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('celestial') && (
                <FeatureErrorBoundary feature="Celestial" compact>
                  <DashboardCelestial />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('holy-hermes') && (
                <FeatureErrorBoundary feature="Holy Hermes Oracle" compact>
                  <DailyHermeticAffirmation />
                  <HolyHermesOracle />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('sage-oracle') && (
                <FeatureErrorBoundary feature="Sage Oracle" compact>
                  <SageWidget />
                </FeatureErrorBoundary>
              )}
              {isWidgetVisible('life-pulse') && (
                <FeatureErrorBoundary feature="Life Pulse" compact>
                  <DashboardLifePulse />
                </FeatureErrorBoundary>
              )}
              {/* Show more / fewer toggle when mode filtering is active */}
              {modeVisibleIds && (
                <button
                  className="dash-mode-toggle"
                  onClick={() => setShowAllWidgets(prev => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    marginTop: 6,
                    border: `1px solid color-mix(in srgb, ${dashMode.accent} 20%, transparent)`,
                    borderRadius: 8,
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: 12,
                    cursor: 'pointer',
                    width: '100%',
                    justifyContent: 'center',
                    transition: 'border-color 1.5s ease',
                  }}
                >
                  {showAllWidgets ? 'Show fewer' : `Show all widgets (${dashMode.config.filter(w => w.collapsed).length} hidden)`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ═══ SCHEDULE TAB ═══ */}
        {activeTab === 'schedule' && (
          <div className="dash-schedule-layout">
            <div className="dash-full-row">{weekStrip}</div>
            <div className="dash-primary-col">
              <FeatureErrorBoundary feature="Schedule" compact>
                <DashboardSchedule selectedDate={selectedDate} events={events} habits={habits} habitLogs={habitLogs} bills={bills}
                  onToggleHabit={async (habitId: string) => {
                    await useHabitsStore.getState().toggleHabit(habitId, selectedDate);
                  }} />
              </FeatureErrorBoundary>
            </div>
            <div className="dash-secondary-col">
              <FeatureErrorBoundary feature="Tasks" compact>
                <DashboardTasks ref={tasksRef} tasks={tasks} goals={goals} selectedDate={selectedDate}
                  loading={loading} taskView={taskView} taskFilter={taskFilter} onSetTaskView={setTaskView}
                  onSetTaskFilter={setTaskFilter} onRefresh={fetchAll} onOpenDetail={setDetailTaskId} />
              </FeatureErrorBoundary>
            </div>
          </div>
        )}

        {/* ═══ GOALS TAB ═══ */}
        {activeTab === 'goals' && (
          <div className="dash-goals-layout">
            <FeatureErrorBoundary feature="Goals" compact>
              <DashboardGoals goals={goals} />
            </FeatureErrorBoundary>
            <FeatureErrorBoundary feature="Achievements" compact>
              <DashboardAchievements />
            </FeatureErrorBoundary>
          </div>
        )}

        {/* ═══ HABITS TAB ═══ */}
        {activeTab === 'habits' && (
          <div className="dash-habits-layout">
            <div className="dash-full-row">{weekStrip}</div>
            <div className="dash-primary-col">
              <FeatureErrorBoundary feature="Habits" compact>
                <DashboardHabits ref={habitsRef} habits={habits} habitLogs={habitLogs} selectedDate={selectedDate} onRefresh={fetchAll} />
              </FeatureErrorBoundary>
            </div>
            <div className="dash-secondary-col">
              <FeatureErrorBoundary feature="Completion Rates" compact>
                <DashboardCompletionRates />
              </FeatureErrorBoundary>
              <FeatureErrorBoundary feature="Suggestions" compact>
                <DashboardSuggestions suggestions={habitSuggestions} onSuggestionsChange={setHabitSuggestions} onRefresh={fetchAll} />
              </FeatureErrorBoundary>
            </div>
          </div>
        )}

        {/* ═══ INSIGHTS TAB ═══ */}
        {activeTab === 'insights' && (
          <div className="dash-insights-layout">
            <div className="dash-full-row">
              <FeatureErrorBoundary feature="Life Score" compact>
                <DashboardLifeScore input={{
                  habitCompletion: habits.length > 0 ? dayHabitsDone / habits.length : 0,
                  goalProgress: avgGoalProgress,
                  mood: healthMetrics?.mood_score ?? null,
                  energy: healthMetrics?.energy_score ?? null,
                  sleepHours: healthMetrics?.sleep_hours ?? null,
                  taskCompletion: dayTaskProgress,
                  netIncome: net,
                  overdueBills: bills.filter(b => b.status !== 'paid').length,
                  scheduleCompletion: dayEvents.length > 0 ? 1 : 0,
                  bestStreak: bestHabitStreak,
                  yesterdayScore: null,
                }} />
              </FeatureErrorBoundary>
              <FeatureErrorBoundary feature="Cross-Domain Intelligence" compact>
                <DashboardCorrelations limit={3} />
              </FeatureErrorBoundary>
              <FeatureErrorBoundary feature="Insights" compact>
                <DashboardInsights isToday={isToday} todayStr={todayStr} dayTaskProgress={dayTaskProgress}
                  dayDoneTasks={dayDoneTasks} dayTasks={dayTasks} dayHabitsDone={dayHabitsDone} totalHabits={habits.length}
                  bestHabitStreak={bestHabitStreak} avgGoalProgress={avgGoalProgress}
                  activeGoalCount={goals.filter(g => g.category === 'goal' || !g.category).length}
                  weeklyChartData={weeklyChartData} onScrollToTasks={() => handleTabChange('schedule')}
                  onScrollToHabits={() => handleTabChange('habits')} onSetTaskView={setTaskView} />
              </FeatureErrorBoundary>
            </div>
            <div className="dash-primary-col">
              <FeatureErrorBoundary feature="Health" compact>
                <DashboardHealth healthMetrics={healthMetrics} />
              </FeatureErrorBoundary>
            </div>
            <div className="dash-secondary-col">
              <FeatureErrorBoundary feature="Finances" compact>
                <DashboardFinances ref={finRef} income={income} expenses={expenses} bills={bills}
                  businesses={businesses} transactions={transactions} goals={goals} finSnapshot={finSnapshot} />
              </FeatureErrorBoundary>
              <FeatureErrorBoundary feature="Journal" compact>
                <DashboardJournal selectedDate={selectedDate} />
              </FeatureErrorBoundary>
            </div>
          </div>
        )}

        {detailTaskId && (
          <TaskDetail taskId={detailTaskId} allGoals={goals} allTasks={tasks}
            onClose={() => setDetailTaskId(null)}
            onNavigateToNode={(nodeId: string) => { setDetailTaskId(null); navigate(`/goals?node=${nodeId}`); }} />
        )}

        <DashboardLayoutEditor widgets={layout.widgets} open={layout.editing} onClose={() => layout.setEditing(false)}
          onMoveUp={layout.moveUp} onMoveDown={layout.moveDown} onToggle={layout.toggleVisible}
          onReset={layout.resetLayout} onReorder={layout.reorder} />

        <SpotlightTour tourId="dashboard" delay={2000} onTourComplete={() => {
          if (!shouldShowRealmInvite()) return;
          setTimeout(() => navigate('/character?tab=realm'), 800);
        }} />
      </div>
    </FullscreenPage>
  );
}

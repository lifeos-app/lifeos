/**
 * useTimelineData — Aggregates data from all LifeOS stores into a unified
 * timeline event format. Detects milestones and auto-generates life chapters.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useHabitsStore } from '../../stores/useHabitsStore';
import type { HabitLog } from '../../stores/useHabitsStore';
import { useGoalsStore } from '../../stores/useGoalsStore';
import { useFinanceStore } from '../../stores/useFinanceStore';
import { useJournalStore } from '../../stores/useJournalStore';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { localGetAll } from '../../lib/local-db';
import { calculateStreak } from '../../stores/useHabitsStore';

// ─── Types ────────────────────────────────────────────────────────────

export type TimelineEventType =
  | 'habit'
  | 'health'
  | 'finance'
  | 'goal'
  | 'achievement'
  | 'journal'
  | 'social'
  | 'milestone';

export type TimelineZoom = 'day' | 'week' | 'month' | 'year';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string; // ISO date string YYYY-MM-DD
  title: string;
  description: string;
  domain: string;
  metadata?: Record<string, any>;
  importance: number; // 1-5, determines visual prominence
}

export interface LifeChapter {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null; // null = ongoing
  summary: string;
  dominantDomains: string[];
  eventCount: number;
  color: string;
}

export interface TimelineFilters {
  domains: Record<string, boolean>;
  importanceThreshold: number;
  dateRange: 'week' | 'month' | 'quarter' | 'year' | 'all';
  searchQuery: string;
}

const DOMAIN_COLORS: Record<string, string> = {
  habit: '#A855F7',
  health: '#22C55E',
  finance: '#FACC15',
  goal: '#3B82F6',
  achievement: '#F59E0B',
  journal: '#EC4899',
  social: '#F472B6',
  milestone: '#00D4FF',
};

const DOMAIN_ICONS: Record<string, string> = {
  habit: '🔥',
  health: '❤️',
  finance: '💰',
  goal: '🎯',
  achievement: '🏆',
  journal: '📝',
  social: '👥',
  milestone: '⭐',
};

const DEFAULT_FILTERS: TimelineFilters = {
  domains: {
    habit: true,
    health: true,
    finance: true,
    goal: true,
    achievement: true,
    journal: true,
    social: true,
    milestone: true,
  },
  importanceThreshold: 1,
  dateRange: 'all',
  searchQuery: '',
};

const CHAPTER_PATTERNS: { keywords: string[]; title: string; summary: string }[] = [
  {
    keywords: ['habit', 'streak', 'consistency'],
    title: 'Rise of the Streaks',
    summary: 'A period defined by building powerful daily habits and streak records.',
  },
  {
    keywords: ['finance', 'income', 'budget', 'saving'],
    title: 'Financial Awakening',
    summary: 'Getting serious about money — tracking income, setting budgets, and building wealth.',
  },
  {
    keywords: ['goal', 'objective', 'milestone'],
    title: 'The Grinding Phase',
    summary: 'Setting ambitious goals and putting in the work to achieve them.',
  },
  {
    keywords: ['health', 'sleep', 'exercise', 'weight'],
    title: 'Body & Mind Revolution',
    summary: 'Prioritizing physical and mental health with consistent tracking and improvement.',
  },
  {
    keywords: ['journal', 'reflection', 'mood'],
    title: 'Season of Reflection',
    summary: 'Turning inward — journaling, processing emotions, and gaining clarity.',
  },
  {
    keywords: ['achievement', 'level', 'xp', 'unlock'],
    title: 'Leveling Up',
    summary: 'Racking up achievements and hitting new levels in LifeOS.',
  },
];

export function useTimelineData() {
  const habits = useHabitsStore(s => s.habits);
  const habitLogs = useHabitsStore(s => s.logs);
  const goals = useGoalsStore(s => s.goals);
  const _income = useFinanceStore(s => s.income);
  const _expenses = useFinanceStore(s => s.expenses);
  const transactions = useFinanceStore(s => s.transactions);
  const journalEntries = useJournalStore(s => s.entries);
  const scheduleEvents = useScheduleStore(s => s.events);

  const [allHealthMetrics, setAllHealthMetrics] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [xpEvents, setXpEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load health metrics, achievements, and xp_events from local DB
  useEffect(() => {
    let cancelled = false;
    async function loadExtra() {
      try {
        const [healthData, achData, xpData] = await Promise.all([
          localGetAll<any>('health_metrics').catch(() => []),
          localGetAll<any>('achievements').catch(() => []),
          localGetAll<any>('xp_events').catch(() => []),
        ]);
        if (!cancelled) {
          setAllHealthMetrics(healthData.filter(h => !h.is_deleted && h.date));
          setAchievements(achData);
          setXpEvents(xpData);
        }
      } catch {
        // Silent fail — these are optional data
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadExtra();
    return () => { cancelled = true; };
  }, []);

  // ─── Build timeline events from all stores ───

  const rawEvents = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];

    // ── Habit logs ──
    for (const habit of habits) {
      if (habit.is_deleted || !habit.is_active) continue;
      const habitLogsForHabit = habitLogs.filter(l => l.habit_id === habit.id);

      // Group logs by date
      const logsByDate = new Map<string, HabitLog[]>();
      for (const log of habitLogsForHabit) {
        const existing = logsByDate.get(log.date) || [];
        existing.push(log);
        logsByDate.set(log.date, existing);
      }

      for (const [date, dayLogs] of logsByDate) {
        const totalDone = dayLogs.reduce((s, l) => s + (l.count || 1), 0);
        const isCompleted = totalDone >= (habit.target_count || 1);

        if (isCompleted) {
          events.push({
            id: `habit-${habit.id}-${date}`,
            type: 'habit',
            date,
            title: habit.title || 'Habit completed',
            description: `${habit.icon || '🔥'} ${habit.title} — Day ${totalDone}/${habit.target_count || 1}`,
            domain: 'habit',
            metadata: { habitId: habit.id, streak: habit.streak_current, count: totalDone },
            importance: 1,
          });
        }
      }

      // Streak milestones
      const { best } = calculateStreak(habit.id, habitLogs);
      const streakMilestones = [7, 14, 21, 30, 60, 90, 100, 180, 365];
      for (const m of streakMilestones) {
        if (best >= m) {
          // Find approximate date when this streak milestone was first reached
          events.push({
            id: `habit-streak-${habit.id}-${m}`,
            type: 'milestone',
            date: habit.created_at ? habit.created_at.split('T')[0] : today,
            title: `${m}-Day Streak: ${habit.title}`,
            description: `Achieved a ${m}-day streak on "${habit.title}" ${m === 100 ? '💯' : m === 365 ? '♾️' : '🔥'}`,
            domain: 'habit',
            metadata: { habitId: habit.id, streak: m },
            importance: m >= 100 ? 5 : m >= 30 ? 4 : m >= 7 ? 3 : 2,
          });
          break; // Only show highest achieved streak milestone
        }
      }

      // Habit creation as a milestone
      if (habit.created_at) {
        events.push({
          id: `habit-created-${habit.id}`,
          type: 'habit',
          date: habit.created_at.split('T')[0],
          title: `New Habit: ${habit.title}`,
          description: `Started tracking "${habit.title}" ${habit.icon || '🔄'}`,
          domain: 'habit',
          metadata: { habitId: habit.id, action: 'created' },
          importance: 2,
        });
      }
    }

    // ── Health metrics ──
    for (const metric of allHealthMetrics) {
      if (!metric.date) continue;
      const items: string[] = [];
      if (metric.mood_score != null) items.push(`Mood: ${metric.mood_score}/5`);
      if (metric.energy_score != null) items.push(`Energy: ${metric.energy_score}/5`);
      if (metric.sleep_hours != null) items.push(`Sleep: ${metric.sleep_hours}h`);
      if (metric.water_glasses != null) items.push(`Water: ${metric.water_glasses} glasses`);
      if (metric.exercise_minutes != null) items.push(`Exercise: ${metric.exercise_minutes}min`);
      if (metric.weight_kg != null) items.push(`Weight: ${metric.weight_kg}kg`);

      if (items.length > 0) {
        events.push({
          id: `health-${metric.id}`,
          type: 'health',
          date: metric.date,
          title: 'Health Log',
          description: items.join(' · '),
          domain: 'health',
          metadata: metric,
          importance: items.length >= 4 ? 3 : items.length >= 2 ? 2 : 1,
        });
      }
    }

    // ── Finance: Transactions ──
    for (const tx of transactions) {
      if (!tx.date) continue;
      const isIncome = tx.type === 'income';
      events.push({
        id: `finance-${tx.id}`,
        type: 'finance',
        date: tx.date,
        title: isIncome ? `💰 ${tx.title || 'Income'}` : `💸 ${tx.title || 'Expense'}`,
        description: `${isIncome ? '+' : '-'}$${(tx.amount || 0).toFixed(2)}`,
        domain: 'finance',
        metadata: tx,
        importance: (tx.amount || 0) >= 1000 ? 4 : (tx.amount || 0) >= 100 ? 3 : 1,
      });
    }

    // ── Goals ──
    for (const goal of goals) {
      if (goal.is_deleted) continue;

      // Goal creation
      if (goal.created_at) {
        const cat = goal.category || 'goal';
        const icon = cat === 'objective' ? '🏔️' : cat === 'epic' ? '⚡' : '🎯';
        events.push({
          id: `goal-created-${goal.id}`,
          type: 'goal',
          date: goal.created_at.split('T')[0],
          title: `${icon} New Goal: ${goal.title}`,
          description: goal.description || `Created a new ${cat}: ${goal.title}`,
          domain: 'goal',
          metadata: { goalId: goal.id, category: cat, progress: goal.progress },
          importance: cat === 'objective' ? 4 : cat === 'epic' ? 3 : 2,
        });
      }

      // Goal completion
      if ((goal.progress || 0) >= 1 && goal.updated_at) {
        events.push({
          id: `goal-complete-${goal.id}`,
          type: 'milestone',
          date: goal.updated_at.split('T')[0],
          title: `✅ Completed: ${goal.title}`,
          description: `Goal achieved! ${goal.description || ''}`,
          domain: 'goal',
          metadata: { goalId: goal.id, category: goal.category },
          importance: 5,
        });
      }

      // Goal progress milestones (25%, 50%, 75%)
      const progress = goal.progress || 0;
      const progressMilestones = [0.25, 0.5, 0.75];
      for (const milestone of progressMilestones) {
        if (progress >= milestone && goal.updated_at) {
          events.push({
            id: `goal-progress-${goal.id}-${Math.floor(milestone * 100)}`,
            type: 'goal',
            date: goal.updated_at.split('T')[0],
            title: `${Math.floor(milestone * 100)}% Progress: ${goal.title}`,
            description: `Reached ${Math.floor(milestone * 100)}% on "${goal.title}"`,
            domain: 'goal',
            metadata: { goalId: goal.id, progress: milestone },
            importance: 2,
          });
        }
      }
    }

    // ── Journal entries ──
    for (const entry of journalEntries) {
      if (entry.is_deleted || !entry.date) continue;
      events.push({
        id: `journal-${entry.id}`,
        type: 'journal',
        date: entry.date,
        title: entry.title || 'Journal Entry',
        description: (entry.content || '').slice(0, 120),
        domain: 'journal',
        metadata: { mood: entry.mood, energy: entry.energy },
        importance: entry.mood != null && (entry.mood <= 2 || entry.mood >= 4) ? 3 : 1,
      });
    }

    // ── Achievements ──
    for (const ach of achievements) {
      if (!ach.unlocked_at) continue;
      events.push({
        id: `achievement-${ach.id}`,
        type: 'achievement',
        date: ach.unlocked_at.split('T')[0],
        title: `🏆 ${ach.achievement_id || ach.title || 'Achievement Unlocked'}`,
        description: ach.description || 'Unlocked an achievement!',
        domain: 'achievement',
        metadata: ach,
        importance: 4,
      });
    }

    // ── XP Events (level-ups, major actions) ──
    for (const xpEvent of xpEvents) {
      if (!xpEvent.created_at) continue;
      // Only include level-up events as milestones
      if (xpEvent.action_type === 'level_up') {
        events.push({
          id: `milestone-levelup-${xpEvent.id}`,
          type: 'milestone',
          date: xpEvent.created_at.split('T')[0],
          title: `⬆️ Level Up!`,
          description: xpEvent.description || 'Reached a new level!',
          domain: 'achievement',
          metadata: { level: xpEvent.metadata?.level, xp: xpEvent.xp_amount },
          importance: 5,
        });
      }
    }

    // ── Schedule events (social, meetings, etc.) ──
    if (scheduleEvents) {
      for (const event of scheduleEvents) {
        if (event.is_deleted || !event.date) continue;
        if (event.event_type === 'social' || event.event_type === 'meeting') {
          events.push({
            id: `social-${event.id}`,
            type: 'social',
            date: event.date,
            title: event.title,
            description: event.description || `Social event: ${event.title}`,
            domain: 'social',
            metadata: { eventId: event.id, eventType: event.event_type },
            importance: 2,
          });
        }
      }
    }

    // Sort all events by date (newest first)
    events.sort((a, b) => b.date.localeCompare(a.date));

    return events;
  }, [habits, habitLogs, goals, _income, _expenses, transactions, journalEntries, allHealthMetrics, achievements, xpEvents, scheduleEvents]);

  // ─── Filter events ───

  const [filters, setFilters] = useState<TimelineFilters>(DEFAULT_FILTERS);
  const [zoom, setZoom] = useState<TimelineZoom>('month');

  const filteredEvents = useMemo(() => {
    let result = rawEvents;

    // Domain filter
    result = result.filter(e => filters.domains[e.domain] !== false);

    // Importance threshold
    result = result.filter(e => e.importance >= filters.importanceThreshold);

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let cutoff: Date;
      switch (filters.dateRange) {
        case 'week': cutoff = new Date(now.getTime() - 7 * 86400000); break;
        case 'month': cutoff = new Date(now.getTime() - 30 * 86400000); break;
        case 'quarter': cutoff = new Date(now.getTime() - 90 * 86400000); break;
        case 'year': cutoff = new Date(now.getTime() - 365 * 86400000); break;
        default: cutoff = new Date(0);
      }
      const cutoffStr = cutoff.toISOString().split('T')[0];
      result = result.filter(e => e.date >= cutoffStr);
    }

    // Search query
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
      );
    }

    return result;
  }, [rawEvents, filters]);

  // ─── Group events by date periods ───

  const groupedEvents = useMemo(() => {
    const groups: { key: string; label: string; events: TimelineEvent[] }[] = [];
    const groupMap = new Map<string, TimelineEvent[]>();

    for (const event of filteredEvents) {
      let key: string;
      let label: string;

      switch (zoom) {
        case 'day': {
          key = event.date;
          label = formatDateDay(event.date);
          break;
        }
        case 'week': {
          const d = new Date(event.date);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          key = weekStart.toISOString().split('T')[0];
          label = `Week of ${formatDateDay(key)}`;
          break;
        }
        case 'month': {
          key = event.date.slice(0, 7); // YYYY-MM
          label = formatMonth(key);
          break;
        }
        case 'year': {
          key = event.date.slice(0, 4); // YYYY
          label = key;
          break;
        }
        default: {
          key = event.date.slice(0, 7);
          label = formatMonth(key);
        }
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(event);
    }

    // Convert to sorted array (newest first)
    for (const [key, events] of [...groupMap.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
      groups.push({
        key,
        label: formatMonth(key.length === 7 ? key : key.length === 10 ? key.slice(0, 7) : key),
        events,
      });
    }

    return groups;
  }, [filteredEvents, zoom]);

  // ─── Generate life chapters ───

  const chapters = useMemo<LifeChapter[]>(() => {
    if (rawEvents.length < 10) return [];

    // Sort events chronologically (oldest first)
    const sorted = [...rawEvents].sort((a, b) => a.date.localeCompare(b.date));

    // Group by month
    const monthlyGroups = new Map<string, TimelineEvent[]>();
    for (const event of sorted) {
      const monthKey = event.date.slice(0, 7);
      if (!monthlyGroups.has(monthKey)) monthlyGroups.set(monthKey, []);
      monthlyGroups.get(monthKey)!.push(event);
    }

    // Find chapters: periods where the dominant domain shifts
    const monthKeys = [...monthlyGroups.keys()].sort();
    if (monthKeys.length < 2) return [];

    interface ChapterBuilder {
      startMonth: string;
      endMonth: string;
      events: TimelineEvent[];
      domainCounts: Record<string, number>;
    }

    const rawChapters: ChapterBuilder[] = [];
    let current: ChapterBuilder | null = null;

    for (const month of monthKeys) {
      const monthEvents = monthlyGroups.get(month)!;
      const domainCounts: Record<string, number> = {};
      for (const e of monthEvents) {
        domainCounts[e.domain] = (domainCounts[e.domain] || 0) + 1;
      }

      const dominantDomain = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';

      if (!current) {
        current = { startMonth: month, endMonth: month, events: [...monthEvents], domainCounts: { ...domainCounts } };
      } else {
        // Check if this month's dominant domain matches the current chapter's dominant domain
        const currentDominant = Object.entries(current.domainCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'mixed';

        if (dominantDomain === currentDominant || monthEvents.length < 3) {
          // Continue chapter
          current.endMonth = month;
          current.events.push(...monthEvents);
          for (const [domain, count] of Object.entries(domainCounts)) {
            current.domainCounts[domain] = (current.domainCounts[domain] || 0) + count;
          }
        } else {
          // Start new chapter
          rawChapters.push(current);
          current = { startMonth: month, endMonth: month, events: [...monthEvents], domainCounts: { ...domainCounts } };
        }
      }
    }
    if (current) rawChapters.push(current);

    // Assign chapter titles based on dominant domains
    return rawChapters.map((ch, i) => {
      const sortedDomains = Object.entries(ch.domainCounts).sort((a, b) => b[1] - a[1]);
      const topDomains = sortedDomains.slice(0, 2).map(([d]) => d);
      const dominant = topDomains[0] || 'mixed';

      // Find matching chapter pattern
      const pattern = CHAPTER_PATTERNS.find(p => p.keywords.some(k => dominant.includes(k)));

      const chapterColors: Record<string, string> = {
        habit: '#A855F7',
        health: '#22C55E',
        finance: '#FACC15',
        goal: '#3B82F6',
        achievement: '#F59E0B',
        journal: '#EC4899',
        social: '#F472B6',
        milestone: '#00D4FF',
        mixed: '#8B5CF6',
      };

      const adjectiveNouns: Record<string, string[]> = {
        habit: ['Discipline Rising', 'The Habit Forge', 'Building Momentum'],
        health: ['Body & Mind', 'Wellness Journey', 'Health Awakening'],
        finance: ['Financial Focus', 'Money Matters', 'Wealth Building'],
        goal: ['Goal Storm', 'The Push', 'Chasing Greatness'],
        achievement: ['Leveling Up', 'Achievement Era', 'XP Grind'],
        journal: ['Inner Workings', 'Reflection Time', 'Mindful Days'],
        social: ['Social Era', 'Connection Time', 'People Phase'],
        mixed: ['The Multiverse', 'All The Things', 'Balanced Life'],
      };

      const nouns = adjectiveNouns[dominant] || adjectiveNouns.mixed;
      const titlePattern = pattern?.title || nouns[i % nouns.length];

      return {
        id: `chapter-${i}`,
        title: titlePattern,
        startDate: ch.startMonth + '-01',
        endDate: ch.endMonth === monthKeys[monthKeys.length - 1] ? null : ch.endMonth + '-28',
        summary: pattern?.summary || `A period dominated by ${dominant} activities with ${ch.events.length} events.`,
        dominantDomains: topDomains,
        eventCount: ch.events.length,
        color: chapterColors[dominant] || chapterColors.mixed,
      };
    });
  }, [rawEvents]);

  // ─── Related events helper ───

  const getRelatedEvents = useCallback((event: TimelineEvent, allEvents: TimelineEvent[]): TimelineEvent[] => {
    // Same day
    const sameDay = allEvents.filter(e => e.date === event.date && e.id !== event.id);

    // Same domain
    const sameDomain = allEvents.filter(e =>
      e.domain === event.domain && e.id !== event.id
    ).slice(0, 5);

    // Same habit/goal chain
    const sameChain = allEvents.filter(e => {
      if (event.metadata?.habitId && e.metadata?.habitId === event.metadata?.habitId) return true;
      if (event.metadata?.goalId && e.metadata?.goalId === event.metadata?.goalId) return true;
      return false;
    }).slice(0, 5);

    // Combine and deduplicate
    const seen = new Set<string>();
    const result: TimelineEvent[] = [];
    for (const e of [...sameDay, ...sameDomain, ...sameChain]) {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        result.push(e);
      }
    }

    return result.slice(0, 10);
  }, []);

  return {
    events: rawEvents,
    filteredEvents,
    groupedEvents,
    chapters,
    filters,
    setFilters,
    zoom,
    setZoom,
    loading,
    getRelatedEvents,
    domainColors: DOMAIN_COLORS,
    domainIcons: DOMAIN_ICONS,
  };
}

// ─── Date formatting helpers ───

function formatDateDay(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatMonth(monthKey: string): string {
  try {
    if (monthKey.length === 4) return monthKey; // Year only
    const [year, month] = monthKey.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return monthKey;
  }
}
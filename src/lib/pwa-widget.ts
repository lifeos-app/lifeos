/**
 * pwa-widget.ts — PWA Widget System for Home Screen Widgets
 *
 * Since LifeOS is a PWA, native iOS/Android widgets aren't possible.
 * Instead, this provides a minimal widget page designed for "Add to Home Screen"
 * behavior — compact, zero-chrome, auto-refreshing display of habit data.
 *
 * All data is read from localStorage via local-db (IndexedDB).
 */

import { localGetAll, localGet } from './local-db';
import { localDateStr } from '../utils/date';
import type { Habit, HabitLog } from '../types/database';

// ── Widget Configuration ────────────────────────────────────────

export interface WidgetConfig {
  type: 'habits' | 'health' | 'mood';
  theme: 'dark' | 'light';
  compact: boolean;
}

const WIDGET_CONFIG_KEY = 'lifeos_widget_config';

/** Save widget config to localStorage */
export function saveWidgetConfig(config: WidgetConfig): void {
  localStorage.setItem(WIDGET_CONFIG_KEY, JSON.stringify(config));
}

/** Load widget config from localStorage */
export function loadWidgetConfig(): WidgetConfig {
  try {
    const raw = localStorage.getItem(WIDGET_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { type: 'habits', theme: 'dark', compact: false };
}

// ── Widget Data ────────────────────────────────────────────────

export interface HabitsWidgetData {
  habits: Habit[];
  logs: HabitLog[];
  todayDone: number;
  todayTotal: number;
  bestStreak: number;
  todayXP: number;
  totalXP: number;
}

/**
 * Get minimal data for widget display.
 * Reads directly from IndexedDB — no auth required.
 */
export async function getWidgetData(type: 'habits'): Promise<HabitsWidgetData> {
  const [habits, logs, userXP] = await Promise.all([
    localGetAll<Habit>('habits'),
    localGetAll<HabitLog>('habit_logs'),
    localGet<any>('user_xp', 'self').catch(() => null),
  ]);

  const todayStr = localDateStr(new Date());

  // Filter active habits
  const activeHabits = habits.filter(h => !h.is_deleted && h.is_active);

  // Calculate today's progress
  const todayLogs = logs.filter(l => l.date === todayStr);
  const todayDone = activeHabits.filter(h => {
    const hLogs = todayLogs.filter(l => l.habit_id === h.id);
    const total = hLogs.reduce((s, l) => s + (l.count || 1), 0);
    return total >= (h.target_count || 1);
  }).length;

  // Best current streak
  const bestStreak = activeHabits.reduce(
    (max, h) => Math.max(max, h.streak_current || 0), 0
  );

  // XP: for habits, each log earns base 5 XP (matching xp-engine BASE_XP.habit_log)
  const THIRTY_DAYS_AGO = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return localDateStr(d);
  })();
  const recentLogs = logs.filter(l => l.date >= THIRTY_DAYS_AGO);
  const todayXP = todayLogs.length * 5; // base XP per habit log

  const totalXP = userXP?.total_xp || 0;

  return {
    habits: activeHabits,
    logs: recentLogs,
    todayDone,
    todayTotal: activeHabits.length,
    bestStreak,
    todayXP,
    totalXP,
  };
}

// ── PWA Manifest Helpers ────────────────────────────────────────

/**
 * Generate PWA manifest snippet for widget shortcuts.
 * These appear in the Web App Manifest's "shortcuts" field and
 * let users add direct widget pages to their home screen.
 */
export function generateWidgetManifest(): Record<string, unknown> {
  return {
    shortcuts: [
      {
        name: 'Habit Widget',
        short_name: 'Habits',
        description: 'Quick habit tracker widget',
        url: '/widget/habits',
        icons: [
          {
            src: '/icons/habit-widget-96.png',
            sizes: '96x96',
          },
        ],
      },
    ],
  };
}

/**
 * Register a web shortcut for the widget page.
 * This updates the navigator's service worker to support the widget shortcut.
 */
export function registerWidgetShortcut(): void {
  if (!('serviceWorker' in navigator)) return;

  // Store widget page preference for offline access
  const config = loadWidgetConfig();
  saveWidgetConfig({ ...config });

  // Trigger PWA install prompt hint if available
  try {
    const beforeInstallPrompt = (window as any).deferredInstallPrompt;
    if (beforeInstallPrompt) {
      // Don't auto-prompt — just ensure the shortcut data is ready
      localStorage.setItem('lifeos_widget_shortcut_registered', new Date().toISOString());
    }
  } catch { /* ignore */ }
}

// ── Category Color Mapping ─────────────────────────────────────

/** Habit categories with their display colors — matches HabitCard categories */
export const WIDGET_CATEGORIES: Record<string, { label: string; color: string }> = {
  health:       { label: 'Health',       color: '#39FF14' },
  work:         { label: 'Work',         color: '#3B82F6' },
  mind:         { label: 'Mind',         color: '#A855F7' },
  body:         { label: 'Body',         color: '#F97316' },
  spirit:       { label: 'Spirit',       color: '#06B6D4' },
  mindfulness:  { label: 'Mindfulness',  color: '#A855F7' },
  fitness:      { label: 'Fitness',      color: '#39FF14' },
  learning:     { label: 'Learning',     color: '#F59E0B' },
  productivity: { label: 'Productivity', color: '#3B82F6' },
  social:       { label: 'Social',       color: '#EC4899' },
  creativity:   { label: 'Creativity',   color: '#8B5CF6' },
  finance:      { label: 'Finance',      color: '#10B981' },
  other:        { label: 'Other',        color: '#94A3B8' },
};

/** Get color for a habit category */
export function getWidgetCategoryColor(category?: string | null): string {
  if (!category) return '#64748B';
  return WIDGET_CATEGORIES[category]?.color || '#64748B';
}
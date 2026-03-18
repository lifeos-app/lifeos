/**
 * Spotlight Tour — driver.js guided product walkthrough.
 * 
 * Tours:
 * - dashboard: Main features overview
 * - health: Health tab features
 * - finance: Finance tab features
 * 
 * Tracks completed tours in BOTH localStorage (for fast checks) AND
 * Supabase user_profiles.preferences (for cross-device persistence).
 * On load, syncs from Supabase → localStorage so tours don't repeat
 * even on new browsers/devices.
 */
import { useEffect, useCallback } from 'react';
import type { DriveStep, Config } from 'driver.js';
// driver.js default CSS removed — using our own in styles/tour.css
import { supabase } from '../lib/supabase';

// Lazy-load driver.js — only fetched when a tour actually runs
let _driverModule: typeof import('driver.js') | null = null;
async function getDriver() {
  if (!_driverModule) {
    _driverModule = await import('driver.js');
  }
  return _driverModule.driver;
}

export type TourId = 'dashboard' | 'health' | 'finance' | 'goals' | 'habits' | 'schedule' | 'junction' | 'gamification' | 'realm-slides' | 'junction-slides';

const TOUR_STORAGE_KEY = 'lifeos_completed_tours';

// Sync-ready flag — blocks tour auto-start until Supabase sync completes
let _toursReady = false;
let _toursReadyResolve: (() => void) | null = null;
const _toursReadyPromise = new Promise<void>(resolve => { _toursReadyResolve = resolve; });

export function isToursReady(): boolean { return _toursReady; }
export function waitForToursReady(): Promise<void> { return _toursReadyPromise; }

function getCompletedTours(): TourId[] {
  try {
    return JSON.parse(localStorage.getItem(TOUR_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export async function markTourComplete(tourId: TourId) {
  const completed = getCompletedTours();
  if (completed.includes(tourId)) return;
  completed.push(tourId);

  // Write to Supabase first (authority)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles').select('preferences').eq('user_id', user.id).maybeSingle();
      const prefs = (profile?.preferences || {}) as Record<string, any>;
      await supabase.from('user_profiles').update({
        preferences: { ...prefs, completed_tours: completed },
      }).eq('user_id', user.id);
    }
  } catch {
    // Supabase write failed — localStorage still updated below, will retry on next sync
  }

  // Update localStorage cache
  try { localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(completed)); } catch { /* Safari private */ }
}

/** Bidirectional sync: Supabase ↔ localStorage (called once on app load) */
export async function syncToursFromSupabase() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('user_profiles').select('preferences').eq('user_id', user.id).maybeSingle();
    const prefs = (profile?.preferences || {}) as Record<string, any>;
    const serverTours: TourId[] = prefs.completed_tours || [];
    const localTours = getCompletedTours();

    // Union merge
    const merged = [...new Set([...localTours, ...serverTours])] as TourId[];

    // Update localStorage cache
    try { localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(merged)); } catch { /* Safari private */ }

    // Push local-only tours back to Supabase (bidirectional sync)
    const localOnly = localTours.filter(t => !serverTours.includes(t));
    if (localOnly.length > 0) {
      await supabase.from('user_profiles').update({
        preferences: { ...prefs, completed_tours: merged },
      }).eq('user_id', user.id);
    }
  } catch {
    // Non-critical
  } finally {
    _toursReady = true;
    _toursReadyResolve?.();
  }
}

export function isTourComplete(tourId: TourId): boolean {
  return getCompletedTours().includes(tourId);
}

export function resetTours() {
  try { localStorage.removeItem(TOUR_STORAGE_KEY); } catch { /* Safari private */ }
}

export function resetTour(tourId: TourId) {
  const completed = getCompletedTours().filter(t => t !== tourId);
  try { localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(completed)); } catch { /* Safari private */ }
}

// Check if element is actually visible AND within the viewport
function isElementVisible(selector: string): boolean {
  const el = document.querySelector(selector);
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  // Element must have dimensions and be within viewport bounds
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight
  );
}

// Check if we're on mobile (sidebar is hidden behind hamburger)
function isMobile(): boolean {
  return window.innerWidth < 768;
}

// ─── Tour Steps ──────────────────────────────────────────────

const DASHBOARD_STEPS: DriveStep[] = [
  {
    element: '.dash-header',
    popover: {
      title: 'Welcome to LifeOS',
      description: 'This is your command centre. Everything you need at a glance — tasks, habits, goals, and insights.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.ai-chat-fab',
    popover: {
      title: 'AI Assistant',
      description: 'Tap this button or press ⌘J to talk to LifeOS. Add tasks, log expenses, check your schedule — all in natural language.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '.week-strip',
    popover: {
      title: 'Week View',
      description: 'Tap any day to see its tasks and events. Plan your week at a glance.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.stats-row',
    popover: {
      title: 'Daily Stats',
      description: 'Tasks completed, habits done, finances, and goals — all at a glance. Tap any card to dive deeper.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.phase-tracker',
    popover: {
      title: 'Setup Progress',
      description: 'Complete all three phases — Life, Health, and Finance — to get the most out of LifeOS. Tap to continue setup anytime.',
      side: 'bottom',
      align: 'center',
    },
  },
  // Mobile: show hamburger menu step FIRST so users know where nav lives
  {
    element: '.mh-hamburger',
    popover: {
      title: 'Menu',
      description: 'Tap here to open the sidebar. All your pages — Goals, Habits, Finances, Health, Journal — live here.',
      side: 'bottom',
      align: 'start',
    },
  },
  // Desktop-only: sidebar navigation
  {
    element: '.sb-nav',
    popover: {
      title: 'Navigation',
      description: 'Access Goals, Habits, Health, Finances, Journal, Schedule, and more from the sidebar.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '.sb-feedback-btn',
    popover: {
      title: 'We Listen',
      description: 'Found a bug? Want a feature? Just want to say hi? Send us feedback anytime.',
      side: 'right',
      align: 'end',
    },
  },
  // Final step — connect to onboarding
  {
    element: '.phase-tracker',
    popover: {
      title: 'Set Up Your Life System',
      description: 'Ready to make LifeOS yours? Tap here to set your goals, values, and habits. You can do it now or come back anytime.',
      side: 'bottom',
      align: 'center',
    },
  },
];

// ─── Goals Tour Steps ──────────────────────────────────────────
const GOALS_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Goals & Objectives',
      description: 'This is where you define what matters. Set objectives, break them into goals, and track progress toward your vision.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.goals-header',
    popover: {
      title: 'Goals Overview',
      description: 'See your total goals, completion rate, and filter by status. The header gives you a quick pulse on your progress.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.gt-tree-view',
    popover: {
      title: 'Goal Tree',
      description: 'Your goals are organised in a hierarchy: Objectives → Epics → Goals → Tasks. Tap any node to expand it, drag to reorder, and swipe to complete.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.goals-add-btn',
    popover: {
      title: 'Add Goals',
      description: 'Create objectives, epics, or goals. Each level breaks your vision into smaller, actionable pieces. Start with an objective — your big-picture aim.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.gt-card',
    popover: {
      title: 'Goal Cards',
      description: 'Each card shows progress %, priority, deadline countdown, and child count. Tap the chevron to expand, the ⋯ menu for more options like linking finances or archiving.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.ai-chat-fab',
    popover: {
      title: 'Pro Tip: AI Goals',
      description: 'Tell the AI assistant "Add a goal to learn Spanish by December" and it\'ll create it for you — with suggested sub-goals and deadlines.',
      side: 'left',
      align: 'center',
    },
  },
];

// ─── Habits Tour Steps ──────────────────────────────────────────
const HABITS_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Habits',
      description: 'Build consistency with daily habits. Track streaks, set targets, and watch your progress compound over time. 🔥',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.habits-header',
    popover: {
      title: 'Today\'s Progress',
      description: 'See how many habits you\'ve completed today and your best streak at a glance. Consistency is the game — aim for green every day.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.habits-grid',
    popover: {
      title: 'Your Habits',
      description: 'Each card shows your habit, streak count, and today\'s status. Tap the card to log it — it\'ll glow green when done. Tap the expand arrow for weekly stats.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.habits-add-btn',
    popover: {
      title: 'New Habit',
      description: 'Create habits with custom icons, frequencies (daily/weekly), and targets. Pro tip: start with just 2-3 habits — you can always add more later.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.habit-card',
    popover: {
      title: 'Habit Cards',
      description: 'Each card tracks your streak 🔥, weekly completion, and perfect-week badges ✨. Tap the pencil icon to change the emoji, or the expand arrow to see your stats chart.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.ai-chat-fab',
    popover: {
      title: 'Pro Tip: Voice Habits',
      description: 'Tell the AI "Log my meditation habit" or "Add a new habit: read 30 minutes daily" — it handles the rest.',
      side: 'left',
      align: 'center',
    },
  },
];

// ─── Schedule Tour Steps ──────────────────────────────────────────
const SCHEDULE_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Schedule',
      description: 'Your unified timeline — events, tasks, habits, and bills all in one view. See your whole day at a glance. 📅',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.sched-header',
    popover: {
      title: 'Navigation',
      description: 'Use the arrows to move between days. Tap "Today" to jump back to the current day. The date header keeps you oriented.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.sched-view-toggle',
    popover: {
      title: 'View Modes',
      description: 'Switch between Day, Timeline, Week, and Month views. Day view shows an hourly timeline, Week gives a 7-day grid, and Month is a calendar overview.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.sched-add-btn',
    popover: {
      title: 'Add Events',
      description: 'Create events with custom types — Primary (work, study), Operations (chores, errands), or Sacred (prayer, meditation). Each type gets its own colour.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.sched-layer-filter',
    popover: {
      title: 'Layer Filters',
      description: 'Filter events by layer — see only Primary tasks, Operations, or Sacred events. Great for focusing on what matters right now.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.ai-chat-fab',
    popover: {
      title: 'Pro Tip: Quick Scheduling',
      description: 'Tell the AI "Schedule a meeting at 2pm tomorrow" or "Block 9-11am for deep work" — it creates the event instantly.',
      side: 'left',
      align: 'center',
    },
  },
];

// ─── Junction Tour Steps ──────────────────────────────────────────
const JUNCTION_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Junction System',
      description: 'Equip a wisdom tradition to guide your daily life. Each tradition comes with practices, figures to unlock, and a sacred calendar. Inspired by the Guardian Force system from Final Fantasy VIII.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.jnc-header',
    popover: {
      title: 'Your Equipped Tradition',
      description: 'This shows which wisdom tradition you\'ve equipped. You can change traditions anytime — each one has unique practices, figures, and a sacred calendar.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.jnc-practices',
    popover: {
      title: 'Daily Practices',
      description: 'Log spiritual practices to earn Junction XP. Each practice has its own XP reward — the more meaningful the practice, the more XP you earn.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.jnc-xp-section',
    popover: {
      title: 'XP & Progression',
      description: 'Earn XP to unlock spiritual figures — guides and mentors from your tradition. Each tier reveals new wisdom. Watch the progression path to see who\'s next.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.jnc-figure-card',
    popover: {
      title: 'Current Figure',
      description: 'Your currently unlocked spiritual figure appears here with their name, title, and biography. They represent your journey so far in this tradition.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.jnc-calendar',
    popover: {
      title: 'Sacred Calendar',
      description: 'Each tradition has important dates and seasons. The calendar highlights upcoming observances and festivals — tap any date for details.',
      side: 'top',
      align: 'center',
    },
  },
];

// ─── Gamification Tour Steps ──────────────────────────────────────────
const GAMIFICATION_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Level Up System',
      description: 'Everything you do in LifeOS earns XP. Complete tasks, log habits, journal, and more to level up your character. 🏆',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.ch-stats',
    popover: {
      title: 'Your Stats',
      description: 'See your current level, equipped assets, and monthly bills at a glance. Your level reflects your overall engagement with LifeOS.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.ch-cards',
    popover: {
      title: 'Character Cards',
      description: 'Access your Equipment (cosmetic items and badges), Junction (spiritual tradition), and more. Each card opens a deeper experience.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.ai-chat-fab',
    popover: {
      title: 'Pro Tip: XP Earning',
      description: 'You earn XP automatically for completing tasks, logging habits, journaling, and spiritual practices. Check your XP history in Settings.',
      side: 'left',
      align: 'center',
    },
  },
];

const HEALTH_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Health & Wellness',
      description: 'Your complete health dashboard — track body metrics, exercise, nutrition, mental wellbeing, and sleep all in one place. 💚',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.health-icon-tabs',
    popover: {
      title: 'Health Tabs',
      description: 'Six tabs covering every aspect of your wellbeing — Overview, Body, Exercise, Diet, Mind, and Sleep. Tap any tab to dive deeper.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.hv2-score-hero',
    popover: {
      title: 'Health Score',
      description: 'Your composite health score from 0-100, calculated from mood, sleep, water, energy, workouts, meditation, and gratitude. Aim for green!',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.hv2-quick-log-row',
    popover: {
      title: 'Quick Logging',
      description: 'Log your mood and energy level with one tap. These quick inputs feed your health score and help you spot patterns over time.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.hv2-snap-grid',
    popover: {
      title: 'Today\'s Snapshot',
      description: 'See sleep, water, steps, weight, and more at a glance. Tap any card to jump to its dedicated tab for detailed tracking.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.ai-chat-fab',
    popover: {
      title: 'Pro Tip: Voice Logging',
      description: 'Tell the AI "I slept 7 hours last night" or "Log 2L of water" — it updates your health metrics automatically.',
      side: 'left',
      align: 'center',
    },
  },
];

const FINANCE_STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Finances',
      description: 'Track every dollar — income, expenses, bills, and net position. See spending patterns and link expenses to your goals. 💰',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.fin-stats',
    popover: {
      title: 'Financial Summary',
      description: 'Your income, expenses, and net position for the month with sparkline trends. Green means you\'re ahead, red means you\'re overspending.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.fin-icon-tabs',
    popover: {
      title: 'Finance Tabs',
      description: 'Switch between Expenses, Income, Bills, Trends, and Business views. Each tab gives you a different lens on your finances.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.fin-add-btn',
    popover: {
      title: 'Add Transactions',
      description: 'Log expenses, income, or bills. You can categorise them, attach to goals, and even mark business expenses as tax-deductible.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.fin-header-actions',
    popover: {
      title: 'Quick Actions',
      description: 'Fast access to adding expenses, income, and bills. The buttons change based on which tab you\'re viewing.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '.ai-chat-fab',
    popover: {
      title: 'Pro Tip: Voice Expenses',
      description: 'Tell the AI "I spent $45 on groceries at Coles" — it logs the expense with the right category automatically.',
      side: 'left',
      align: 'center',
    },
  },
];

const TOURS: Record<TourId, DriveStep[]> = {
  dashboard: DASHBOARD_STEPS,
  health: HEALTH_STEPS,
  finance: FINANCE_STEPS,
  goals: GOALS_STEPS,
  habits: HABITS_STEPS,
  schedule: SCHEDULE_STEPS,
  junction: JUNCTION_STEPS,
  gamification: GAMIFICATION_STEPS,
};

// ─── Driver Options (dark theme) ─────────────────────────────

const DRIVER_OPTIONS: Partial<Config> = {
  showProgress: true,
  animate: true,
  overlayColor: 'rgba(0, 0, 0, 0.75)',
  stagePadding: 8,
  stageRadius: 12,
  // No popoverClass — we own all driver.js CSS via styles/tour.css
  nextBtnText: 'Next →',
  prevBtnText: '← Back',
  doneBtnText: 'Got it! ✨',
  progressText: '{{current}} of {{total}}',
  // Prevent accidental dismissal — no overlay click, no close button
  allowClose: false,
  showButtons: ['next', 'previous'],
  disableActiveInteraction: false,
};

// ─── Run a tour ──────────────────────────────────────────────

async function runTour(tourId: TourId, options?: { onComplete?: () => void }) {
  const steps = TOURS[tourId];
  if (!steps?.length) return;

  const mobile = isMobile();

  // Only include steps whose elements are visible in the viewport
  const validSteps = steps.filter(s => {
    if (!s.element) return true;
    const selector = s.element as string;

    // On mobile: skip sidebar-specific steps (they're behind hamburger menu)
    if (mobile && (selector === '.sb-nav' || selector === '.sb-feedback-btn')) {
      return false;
    }
    // On desktop: skip mobile hamburger step
    if (!mobile && selector === '.mh-hamburger') {
      return false;
    }

    return isElementVisible(selector);
  });

  if (validSteps.length === 0) return;

  const driverFn = await getDriver();
  const d = driverFn({
    ...DRIVER_OPTIONS,
    steps: validSteps,
    onDestroyStarted: (_element, _step, _opts) => {
      markTourComplete(tourId);
      d.destroy();
      // Clean up cancel button
      document.getElementById('tour-cancel-btn')?.remove();
      options?.onComplete?.();
    },
    onPopoverRender: (popover, _opts) => {
      // Add a dedicated "Cancel Tutorial" button at the bottom of each popover
      // Prominent but not in the way — sits below the navigation
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Skip tour';
      cancelBtn.className = 'tour-cancel-btn';
      cancelBtn.onclick = (e) => {
        e.stopPropagation();
        markTourComplete(tourId);
        d.destroy();
        cancelBtn.remove();
      };
      popover.footerButtons.appendChild(cancelBtn);
    },
  });

  d.drive();
}

// ─── Component (auto-start on mount) ─────────────────────────

interface SpotlightTourProps {
  tourId: TourId;
  autoStart?: boolean;
  delay?: number;
  onTourComplete?: () => void;
}

export function SpotlightTour({ tourId, autoStart = true, delay = 1000, onTourComplete }: SpotlightTourProps) {
  const startTour = useCallback(() => runTour(tourId, { onComplete: onTourComplete }), [tourId, onTourComplete]);

  useEffect(() => {
    // Check for ?tour= query param (from Settings redirect)
    const params = new URLSearchParams(window.location.search);
    if (params.get('tour') === tourId) {
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      const timer = setTimeout(startTour, 1000);
      return () => clearTimeout(timer);
    }

    if (!autoStart) return;

    // Wait for Supabase tour sync before deciding to show any tour.
    // This prevents tours from pestering users who already completed them
    // but cleared their browser data.
    let cancelled = false;
    const checkAndStart = async () => {
      // Sync from Supabase first (merges server state into localStorage)
      await syncToursFromSupabase().catch(() => {});
      if (cancelled) return;

      // Check if this is a fresh signup — show tour ONLY for legacy onboarding users
      const isNewSignup = sessionStorage.getItem('lifeos_new_signup') === 'true';
      const isGenesisUser = localStorage.getItem('lifeos_lifetown_guide_complete') !== null || localStorage.getItem('lifeos_ui_state_lifetown_guide_complete') !== null;
      if (isNewSignup && tourId === 'dashboard' && !isGenesisUser) {
        try { sessionStorage.removeItem('lifeos_new_signup'); } catch { /* Safari private */ }
        // Only start if not already completed (don't clear completed tours!)
        if (!isTourComplete(tourId)) {
          setTimeout(startTour, delay);
        }
        return;
      }

      if (isTourComplete(tourId)) return;
      setTimeout(startTour, delay);
    };
    checkAndStart();
    return () => { cancelled = true; };
  }, [tourId, autoStart, delay, startTour]);

  // Also listen for manual trigger events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tourId === tourId) {
        setTimeout(() => runTour(tourId), 500);
      }
    };
    document.addEventListener('start-tour', handler);
    return () => document.removeEventListener('start-tour', handler);
  }, [tourId]);

  return null;
}

// ─── Manual triggers (from Settings etc.) ────────────────────

export function startTourManually(tourId: TourId) {
  // Reset so it can run again
  resetTour(tourId);
  // Navigate to the right page first, then trigger via event
  const pageMap: Record<TourId, string> = {
    dashboard: '/',
    health: '/health',
    finance: '/finances',
    goals: '/goals',
    habits: '/habits',
    schedule: '/schedule',
    junction: '/character/junction',
    gamification: '/character',
  };

  const targetPage = pageMap[tourId];
  if (window.location.pathname !== targetPage) {
    // Navigate, then the SpotlightTour component on that page picks up the event
    window.location.href = targetPage + '?tour=' + tourId;
  } else {
    // Already on the right page
    runTour(tourId);
  }
}

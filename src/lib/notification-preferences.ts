/**
 * Notification Preferences — user-configurable notification settings
 *
 * Pure TypeScript, localStorage persistence. No Supabase calls.
 * Push and email channels are stubbed for future implementation.
 */

// ── Types ──

export type NotificationChannel = 'in_app' | 'push' | 'email';

export enum NotificationCategory {
  HabitReminder = 'habit_reminder',
  GoalProgress = 'goal_progress',
  StreakWarning = 'streak_warning',
  Achievement = 'achievement',
  Social = 'social',
  System = 'system',
  AIInsight = 'ai_insight',
  Challenge = 'challenge',
}

/** Human-readable labels for each category */
export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  [NotificationCategory.HabitReminder]: 'Habit Reminders',
  [NotificationCategory.GoalProgress]: 'Goal Progress',
  [NotificationCategory.StreakWarning]: 'Streak Warnings',
  [NotificationCategory.Achievement]: 'Achievements',
  [NotificationCategory.Social]: 'Social',
  [NotificationCategory.System]: 'System',
  [NotificationCategory.AIInsight]: 'AI Insights',
  [NotificationCategory.Challenge]: 'Challenges',
};

export interface CategoryChannelPrefs {
  in_app: boolean;
  push: boolean;
  email: boolean;
}

export interface NotificationPreferences {
  /** Per-category enable/disable (per channel) */
  categories: Record<NotificationCategory, CategoryChannelPrefs>;
  /** Quiet hours — null means disabled */
  quietHours: {
    enabled: boolean;
    startTime: string; // "HH:mm" 24h
    endTime: string;   // "HH:mm" 24h
  };
  /** Daily digest — roll notifications into a single daily summary */
  dailyDigest: boolean;
  /** Sound toggle for in-app notifications */
  sound: boolean;
}

// ── Defaults ──

const DEFAULT_CATEGORY_PREFS: Record<NotificationCategory, CategoryChannelPrefs> = {
  [NotificationCategory.HabitReminder]:  { in_app: true,  push: true,  email: true  },
  [NotificationCategory.GoalProgress]:   { in_app: true,  push: true,  email: true  },
  [NotificationCategory.StreakWarning]:   { in_app: true,  push: true,  email: true  },
  [NotificationCategory.Achievement]:    { in_app: true,  push: true,  email: true  },
  [NotificationCategory.Social]:         { in_app: false, push: false, email: false },
  [NotificationCategory.System]:         { in_app: true,  push: true,  email: true  },
  [NotificationCategory.AIInsight]:      { in_app: true,  push: true,  email: true  },
  [NotificationCategory.Challenge]:      { in_app: true,  push: true,  email: true  },
};

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  categories: { ...DEFAULT_CATEGORY_PREFS },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '07:00',
  },
  dailyDigest: false,
  sound: true,
};

// ── Persistence ──

const STORAGE_KEY = 'lifeos_notification_prefs';

function readFromStorage(): NotificationPreferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NotificationPreferences;
  } catch {
    return null;
  }
}

function writeToStorage(prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Safari private mode or storage full — silently ignore
  }
}

// ── Public API ──

/**
 * Get current notification preferences, falling back to defaults
 * for any missing fields (handles schema evolution gracefully).
 */
export function getPreferences(): NotificationPreferences {
  const stored = readFromStorage();
  if (!stored) return { ...DEFAULT_PREFERENCES };

  // Merge with defaults to ensure all categories and fields exist
  return {
    categories: {
      ...DEFAULT_PREFERENCES.categories,
      ...stored.categories,
    },
    quietHours: {
      ...DEFAULT_PREFERENCES.quietHours,
      ...(stored.quietHours || {}),
    },
    dailyDigest: stored.dailyDigest ?? DEFAULT_PREFERENCES.dailyDigest,
    sound: stored.sound ?? DEFAULT_PREFERENCES.sound,
  };
}

/**
 * Update notification preferences (merged with current values).
 * Accepts a partial object — only supplied fields will be overwritten.
 */
export function updatePreferences(
  patch: Partial<NotificationPreferences>,
): NotificationPreferences {
  const current = getPreferences();
  const merged: NotificationPreferences = {
    ...current,
    ...patch,
    categories: {
      ...current.categories,
      ...(patch.categories || {}),
    },
    quietHours: {
      ...current.quietHours,
      ...(patch.quietHours || {}),
    },
  };
  writeToStorage(merged);
  return merged;
}

/**
 * Reset all notification preferences to factory defaults.
 */
export function resetToDefaults(): NotificationPreferences {
  writeToStorage(DEFAULT_PREFERENCES);
  return { ...DEFAULT_PREFERENCES };
}

/**
 * Check whether the current time falls within the user's quiet hours window.
 * Handles overnight ranges (e.g. 22:00 – 07:00).
 */
export function isQuietHourNow(): boolean {
  const prefs = getPreferences();
  if (!prefs.quietHours.enabled) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = prefs.quietHours.startTime.split(':').map(Number);
  const [endH, endM] = prefs.quietHours.endTime.split(':').map(Number);
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  if (startMinutes <= endMinutes) {
    // Same-day range, e.g. 09:00 – 17:00
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range, e.g. 22:00 – 07:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}
/**
 * web-push.ts — Local Web Push Notifications for LifeOS PWA
 *
 * Since there is no push server, all notifications are LOCAL-ONLY:
 *   - Uses the browser Notification API for display
 *   - Falls back to in-app toast if Notification API is denied/unavailable
 *   - Schedules recurring notifications (morning check-in, evening review, habit reminders)
 *   - Respects quiet hours from notification-preferences.ts
 *   - Rate limiting: max per day, cooldown between notifications
 *   - localStorage persistence for scheduled notifications and subscription state
 *
 * Permission is OPT-IN — never auto-request.
 */

import {
  getPreferences,
  isQuietHourNow,
  NotificationCategory,
  type NotificationPreferences,
} from './notification-preferences';
import type { Habit, Goal } from '../types/database';

// ── Types ──────────────────────────────────────────────────────────────

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  /** ISO timestamp when the notification should fire */
  scheduledTime: string;
  /** Type of notification (maps to NotificationCategory or custom) */
  type: string;
  /** Whether this is a recurring notification */
  recurring: boolean;
  /** Recurrence rule (e.g. 'daily', 'weekdays') */
  recurrenceRule?: 'daily' | 'weekdays' | 'weekends' | 'once';
  /** Opaque data for the notification handler */
  data?: Record<string, unknown>;
  /** Whether notification has been delivered */
  delivered: boolean;
  /** Creation timestamp */
  createdAt: string;
}

type ToastFallback = (title: string, body: string) => void;

// ── Constants ──────────────────────────────────────────────────────────

const SUBSCRIPTION_KEY = 'lifeos_push_subscriptions';
const SCHEDULED_KEY = 'lifeos_scheduled_notifications';
const DELIVERY_LOG_KEY = 'lifeos_notification_delivery_log';
const MAX_NOTIFICATIONS_PER_DAY = 20;
const MIN_COOLDOWN_MS = 60 * 1000; // 1 minute between notifications of same type

// ── Helpers ────────────────────────────────────────────────────────────

function genId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Safari private mode or storage full — silently ignore
  }
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// ── PushSubscriptionManager ────────────────────────────────────────────

export class PushSubscriptionManager {
  private subscription: PushSubscription | null = null;
  private _permissionStatus: NotificationPermission = 'default';

  constructor() {
    this._permissionStatus = this._readPermission();
    this.subscription = this._readSubscription();
  }

  // ── Permission ──

  /** Get current Notification permission status */
  getPermissionStatus(): NotificationPermission {
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.permission;
  }

  /** Request Notification permission. Returns true if granted. */
  async requestPermission(): Promise<boolean> {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') {
      this._permissionStatus = 'granted';
      return true;
    }
    if (Notification.permission === 'denied') {
      this._permissionStatus = 'denied';
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      this._permissionStatus = result;
      return result === 'granted';
    } catch {
      return false;
    }
  }

  /** Whether Notification API is available in this browser */
  isNotificationAvailable(): boolean {
    return typeof Notification !== 'undefined';
  }

  // ── Push Subscription (local simulation) ──

  /**
   * Subscribe to push manager. Since there is no push server,
   * this simulates subscription by storing a local record.
   * Returns null if permission is not granted.
   */
  async subscribe(): Promise<PushSubscription | null> {
    const permitted = await this.requestPermission();
    if (!permitted) return null;

    // If there's a real PushManager available (service worker), try it
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          this.subscription = existing;
          this._saveSubscription(existing);
          return existing;
        }
        // VAPID key is required for real push — we don't have one,
        // so we simulate a local subscription instead
      } catch {
        // PushManager not available or no VAPID key — fall through to simulation
      }
    }

    // Simulate subscription locally
    this.subscription = this._createLocalSubscription();
    this._saveSubscription(this.subscription);
    return this.subscription;
  }

  /** Unsubscribe from push notifications */
  async unsubscribe(): Promise<boolean> {
    if (this.subscription && typeof this.subscription.unsubscribe === 'function') {
      try {
        await this.subscription.unsubscribe();
      } catch {
        // May already be unsubscribed
      }
    }

    this.subscription = null;
    this._clearSubscription();
    return true;
  }

  /** Check if currently subscribed */
  isSubscribed(): boolean {
    return this.subscription !== null;
  }

  /** Get current subscription */
  getSubscription(): PushSubscription | null {
    return this.subscription;
  }

  // ── Internal ──

  private _readPermission(): NotificationPermission {
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.permission;
  }

  private _readSubscription(): PushSubscription | null {
    const stored = readFromStorage<Record<string, unknown> | null>(SUBSCRIPTION_KEY, null);
    // We return null here because PushSubscription objects can't be truly
    // re-hydrated from JSON — this just tracks whether the user "subscribed"
    return stored ? ({} as PushSubscription) : null;
  }

  private _saveSubscription(_sub: PushSubscription | null): void {
    if (_sub) {
      writeToStorage(SUBSCRIPTION_KEY, { subscribed: true, at: Date.now() });
    } else {
      writeToStorage(SUBSCRIPTION_KEY, null);
    }
  }

  private _clearSubscription(): void {
    writeToStorage(SUBSCRIPTION_KEY, null);
  }

  /** Create a simulated local PushSubscription marker */
  private _createLocalSubscription(): PushSubscription {
    // Return a minimal object that satisfies the PushSubscription interface
    // This allows the rest of the code to work without a real push server
    return {
      endpoint: 'local://lifeos-push-simulation',
      expirationTime: null,
      options: {
        applicationServerKey: null,
        userVisibleOnly: true,
      },
      toJSON() {
        return { endpoint: 'local://lifeos-push-simulation', expirationTime: null };
      },
      unsubscribe: async () => {
        this.subscription = null;
        this._clearSubscription();
        return true;
      },
      getKey: () => new ArrayBuffer(0),
    } as unknown as PushSubscription;
  }
}

// ── NotificationScheduler ──────────────────────────────────────────────

export class NotificationScheduler {
  private scheduled: Map<string, ScheduledNotification> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private subscriptionManager: PushSubscriptionManager;
  private toastFallback: ToastFallback | null = null;
  private deliveryLog: Map<string, number[]> = new Map(); // type -> [timestamps]

  constructor(subscriptionManager?: PushSubscriptionManager) {
    this.subscriptionManager = subscriptionManager ?? new PushSubscriptionManager();
    this._loadScheduled();
    this._loadDeliveryLog();
  }

  /** Set a toast fallback function for when Notification API is denied */
  setToastFallback(fn: ToastFallback): void {
    this.toastFallback = fn;
  }

  // ── Scheduling ──

  /**
   * Schedule a local notification to be shown at the specified time.
   * Uses setTimeout for in-memory scheduling, persisted to localStorage.
   */
  scheduleLocalNotification(
    title: string,
    body: string,
    scheduledTime: Date | string,
    options?: {
      type?: string;
      recurring?: boolean;
      recurrenceRule?: 'daily' | 'weekdays' | 'weekends' | 'once';
      data?: Record<string, unknown>;
    },
  ): string {
    const id = genId();
    const time = typeof scheduledTime === 'string' ? new Date(scheduledTime) : scheduledTime;

    const notification: ScheduledNotification = {
      id,
      title,
      body,
      scheduledTime: time.toISOString(),
      type: options?.type || 'system',
      recurring: options?.recurring ?? false,
      recurrenceRule: options?.recurrenceRule ?? 'once',
      data: options?.data,
      delivered: false,
      createdAt: new Date().toISOString(),
    };

    this.scheduled.set(id, notification);
    this._persistScheduled();
    this._scheduleTimer(notification);

    return id;
  }

  /** Cancel a scheduled notification by id */
  cancelNotification(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.scheduled.delete(id);
    this._persistScheduled();
  }

  /** Get all scheduled notifications */
  getScheduledNotifications(): ScheduledNotification[] {
    return Array.from(this.scheduled.values())
      .filter(n => !n.delivered)
      .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
  }

  /** Get all scheduled notifications including delivered */
  getAllNotifications(): ScheduledNotification[] {
    return Array.from(this.scheduled.values())
      .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
  }

  // ── Convenience: schedule from preferences ──

  /**
   * Read notification preferences and set up recurring notifications:
   *   - Morning check-in (08:00)
   *   - Evening review (19:00)
   *   - Habit reminders (per habit time_of_day)
   */
  scheduleFromPreferences(prefs: NotificationPreferences): void {
    // Clear previous recurring notifications
    this._clearRecurring();

    const today = todayStr();
    const now = new Date();

    // Morning check-in at 08:00 if habit reminders push is enabled
    if (prefs.categories[NotificationCategory.HabitReminder]?.push) {
      const morningTime = this._nextOccurrence(8, 0);
      this.scheduleLocalNotification(
        'Morning Check-in',
        'Start your day right — review your habits and goals for today.',
        morningTime,
        { type: 'morning_checkin', recurring: true, recurrenceRule: 'daily' },
      );
    }

    // Evening review at 19:00 if goal progress push is enabled
    if (prefs.categories[NotificationCategory.GoalProgress]?.push) {
      const eveningTime = this._nextOccurrence(19, 0);
      this.scheduleLocalNotification(
        'Evening Review',
        'Reflect on today and set intentions for tomorrow.',
        eveningTime,
        { type: 'evening_review', recurring: true, recurrenceRule: 'daily' },
      );
    }

    // Streak warning check at 20:00 if streak warning push is enabled
    if (prefs.categories[NotificationCategory.StreakWarning]?.push) {
      const streakTime = this._nextOccurrence(20, 0);
      this.scheduleLocalNotification(
        'Streak Check',
        'Check on your active streaks before the day ends.',
        streakTime,
        { type: 'streak_check', recurring: true, recurrenceRule: 'daily' },
      );
    }
  }

  /**
   * Schedule reminders for uncompleted habits.
   * Each habit gets a notification based on its time_of_day preference.
   */
  scheduleHabitReminders(habits: Habit[]): void {
    const prefs = getPreferences();
    if (!prefs.categories[NotificationCategory.HabitReminder]?.push) return;

    const today = todayStr();

    for (const habit of habits) {
      if (!habit.is_active || habit.is_deleted) continue;

      const timeOfDay = habit.time_of_day || 'morning';
      const hour = timeOfDay === 'evening' ? 19 : timeOfDay === 'afternoon' ? 14 : 8;
      const scheduledTime = this._nextOccurrence(hour, 0);

      // Skip if already past
      if (scheduledTime.getTime() < Date.now()) continue;

      this.scheduleLocalNotification(
        `Habit: ${habit.title}`,
        `Time to complete "${habit.title}" — keep your streak going!`,
        scheduledTime,
        {
          type: 'habit_reminder',
          recurring: false,
          recurrenceRule: 'once',
          data: { habit_id: habit.id, habit_title: habit.title },
        },
      );
    }
  }

  /** Schedule goal check-in notifications for active goals */
  scheduleGoalCheckIns(goals: Goal[]): void {
    const prefs = getPreferences();
    if (!prefs.categories[NotificationCategory.GoalProgress]?.push) return;

    for (const goal of goals) {
      if (goal.is_deleted || ['completed', 'done', 'archived'].includes(goal.status)) continue;

      const progress = goal.progress ?? 0;
      // Only schedule if progress is notable (>= 40%)
      if (progress < 40) continue;

      // Schedule a midday check-in (12:00)
      const checkInTime = this._nextOccurrence(12, 0);
      if (checkInTime.getTime() < Date.now()) continue;

      this.scheduleLocalNotification(
        `Goal: ${goal.title}`,
        `You're ${Math.round(progress)}% toward "${goal.title}". Keep the momentum going!`,
        checkInTime,
        {
          type: 'goal_checkin',
          recurring: false,
          recurrenceRule: 'once',
          data: { goal_id: goal.id, goal_title: goal.title, progress },
        },
      );
    }
  }

  /**
   * Filter out notifications that fall within quiet hours.
   * Returns the filtered list.
   */
  applyQuietHours(
    prefs: NotificationPreferences,
    notifications: ScheduledNotification[],
  ): ScheduledNotification[] {
    if (!prefs.quietHours.enabled) return notifications;

    const [startH, startM] = prefs.quietHours.startTime.split(':').map(Number);
    const [endH, endM] = prefs.quietHours.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + (startM || 0);
    const endMinutes = endH * 60 + (endM || 0);

    return notifications.filter(n => {
      const scheduledDate = new Date(n.scheduledTime);
      const scheduledMinutes = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();

      if (startMinutes <= endMinutes) {
        // Same-day range, e.g. 09:00 – 17:00
        return !(scheduledMinutes >= startMinutes && scheduledMinutes < endMinutes);
      } else {
        // Overnight range, e.g. 22:00 – 07:00
        return !(scheduledMinutes >= startMinutes || scheduledMinutes < endMinutes);
      }
    });
  }

  // ── Delivery ──

  /** Deliver a notification immediately using the Notification API or toast fallback */
  deliverNow(title: string, body: string, options?: { tag?: string; data?: Record<string, unknown> }): boolean {
    // Check quiet hours
    if (isQuietHourNow()) return false;

    // Rate limit: check daily count
    const today = todayStr();
    const todayLog = this.deliveryLog.get(today) ?? [];
    if (todayLog.length >= MAX_NOTIFICATIONS_PER_DAY) return false;

    // Rate limit: check cooldown per type
    const type = options?.tag || 'system';
    const lastDelivery = this.deliveryLog.get(type);
    if (lastDelivery && lastDelivery.length > 0) {
      const lastTime = Math.max(...lastDelivery);
      if (Date.now() - lastTime < MIN_COOLDOWN_MS) return false;
    }

    // Try Notification API
    if (this.subscriptionManager.isNotificationAvailable() && this.subscriptionManager.getPermissionStatus() === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: options?.tag,
          data: options?.data,
          silent: !getPreferences().sound,
        });
        this._recordDelivery(today, type);
        return true;
      } catch {
        // Notification API may fail in some contexts
      }
    }

    // Fallback to toast
    if (this.toastFallback) {
      this.toastFallback(title, body);
      this._recordDelivery(today, type);
      return true;
    }

    return false;
  }

  // ── Lifecycle ──

  /** Clean up all timers — call when unmounting */
  destroy(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  // ── Internal ──

  private _scheduleTimer(notification: ScheduledNotification): void {
    const delay = new Date(notification.scheduledTime).getTime() - Date.now();
    if (delay <= 0) return; // Already past

    const timer = setTimeout(() => {
      this._deliverScheduled(notification.id);
    }, delay);

    this.timers.set(notification.id, timer);
  }

  private _deliverScheduled(id: string): void {
    const notification = this.scheduled.get(id);
    if (!notification) return;

    this.deliverNow(notification.title, notification.body, {
      tag: notification.type,
      data: notification.data,
    });

    notification.delivered = true;

    // Handle recurring notifications by scheduling the next occurrence
    if (notification.recurring && notification.recurrenceRule === 'daily') {
      const nextTime = new Date(notification.scheduledTime);
      nextTime.setDate(nextTime.getDate() + 1);
      this.scheduleLocalNotification(
        notification.title,
        notification.body,
        nextTime,
        {
          type: notification.type,
          recurring: true,
          recurrenceRule: 'daily',
          data: notification.data,
        },
      );
    }

    this._persistScheduled();
  }

  private _nextOccurrence(hour: number, minute: number): Date {
    const now = new Date();
    const target = new Date();
    target.setHours(hour, minute, 0, 0);

    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    return target;
  }

  private _clearRecurring(): void {
    for (const [id, n] of this.scheduled.entries()) {
      if (n.recurring) {
        this.cancelNotification(id);
      }
    }
  }

  private _loadScheduled(): void {
    const stored = readFromStorage<ScheduledNotification[]>(SCHEDULED_KEY, []);
    const now = Date.now();

    for (const n of stored) {
      // Restore only undelivered, future notifications
      if (!n.delivered && new Date(n.scheduledTime).getTime() > now) {
        this.scheduled.set(n.id, n);
      }
    }

    // Clean delivered entries from storage
    writeToStorage(SCHEDULED_KEY, this.getScheduledNotifications());
  }

  private _persistScheduled(): void {
    writeToStorage(SCHEDULED_KEY, Array.from(this.scheduled.values()));
  }

  private _loadDeliveryLog(): void {
    try {
      const raw = localStorage.getItem(DELIVERY_LOG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number[]>;
        for (const [key, timestamps] of Object.entries(parsed)) {
          this.deliveryLog.set(key, timestamps);
        }
      }
    } catch {
      // ignore
    }
  }

  private _recordDelivery(today: string, type: string): void {
    // Record for daily count
    const todayLog = this.deliveryLog.get(today) ?? [];
    todayLog.push(Date.now());
    this.deliveryLog.set(today, todayLog);

    // Record for type cooldown
    const typeLog = this.deliveryLog.get(type) ?? [];
    typeLog.push(Date.now());
    this.deliveryLog.set(type, typeLog);

    // Prune old entries (> 7 days)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const [key, timestamps] of this.deliveryLog.entries()) {
      const pruned = timestamps.filter(t => t > cutoff);
      if (pruned.length === 0) {
        this.deliveryLog.delete(key);
      } else {
        this.deliveryLog.set(key, pruned);
      }
    }

    writeToStorage(DELIVERY_LOG_KEY, Object.fromEntries(this.deliveryLog));
  }
}

// ── Singleton exports ──────────────────────────────────────────────────

/** Shared PushSubscriptionManager instance */
export const pushManager = new PushSubscriptionManager();

/** Shared NotificationScheduler instance */
export const notificationScheduler = new NotificationScheduler(pushManager);
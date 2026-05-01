/**
 * Telegram Bot Store — Zustand + Persist
 *
 * Central store for Telegram bot configuration, activity log,
 * and webhook state. Persists config to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logger } from '../utils/logger';

// ── Types ────────────────────────────────────────────────────────────

export interface TelegramConfig {
  botToken: string;
  webhookUrl: string;
  enabled: boolean;
  authorizedUsers: string[];      // Telegram user IDs
  linkedAccount: string | null;    // LifeOS user ID
  commandPrefix: string;
  dailyBriefEnabled: boolean;
  dailyBriefTime: string;          // HH:mm
  habitReminders: boolean;
  streakAlerts: boolean;
  smartSuggestions: boolean;
  voiceInput: boolean;
}

export interface TelegramCommand {
  command: string;
  description: string;
  intentMapping: string;
  example: string;
}

export interface TelegramActivityEntry {
  id: string;
  timestamp: number;
  userId: string;
  username: string;
  command: string;
  input: string;
  response: string;
  status: 'success' | 'error' | 'pending';
  durationMs: number;
}

export interface WebhookStatus {
  connected: boolean;
  lastPing: number | null;
  url: string;
  errorCount: number;
  lastError: string | null;
}

// ── Default Config ────────────────────────────────────────────────────

const DEFAULT_CONFIG: TelegramConfig = {
  botToken: '',
  webhookUrl: '',
  enabled: false,
  authorizedUsers: [],
  linkedAccount: null,
  commandPrefix: '/',
  dailyBriefEnabled: true,
  dailyBriefTime: '07:00',
  habitReminders: true,
  streakAlerts: true,
  smartSuggestions: true,
  voiceInput: false,
};

// ── Supported Commands ─────────────────────────────────────────────────

export const TELEGRAM_COMMANDS: TelegramCommand[] = [
  {
    command: '/start',
    description: 'Welcome message & account linking',
    intentMapping: 'navigate.start',
    example: '/start',
  },
  {
    command: '/log',
    description: 'Quick log anything — work, mood, expense, habit',
    intentMapping: 'shorthand.parse',
    example: '/log 3 hours work at Sonder',
  },
  {
    command: '/habit',
    description: 'Log a habit completion or view habit status',
    intentMapping: 'habit_log',
    example: '/habit meditate',
  },
  {
    command: '/mood',
    description: 'Log your mood with optional notes',
    intentMapping: 'health_log',
    example: '/mood 8 feeling great after morning run',
  },
  {
    command: '/health',
    description: 'Log health metrics — sleep, water, weight, exercise',
    intentMapping: 'health_log',
    example: '/health sleep 7.5h water 6 glasses',
  },
  {
    command: '/expense',
    description: 'Log an expense',
    intentMapping: 'expense',
    example: '/expense $45 groceries at Woolies',
  },
  {
    command: '/income',
    description: 'Log income',
    intentMapping: 'income',
    example: '/income $2000 client payment from TCS',
  },
  {
    command: '/balance',
    description: 'Check your financial balance',
    intentMapping: 'info',
    example: '/balance',
  },
  {
    command: '/schedule',
    description: 'View today\'s schedule or add events',
    intentMapping: 'event',
    example: '/schedule',
  },
  {
    command: '/goals',
    description: 'View goal progress or create new goals',
    intentMapping: 'goal',
    example: '/goals',
  },
  {
    command: '/streak',
    description: 'View current habit streaks',
    intentMapping: 'info',
    example: '/streak',
  },
  {
    command: '/brief',
    description: 'Get your daily brief — tasks, habits, health, weather',
    intentMapping: 'info',
    example: '/brief',
  },
  {
    command: '/stats',
    description: 'View weekly/monthly statistics',
    intentMapping: 'info',
    example: '/stats week',
  },
  {
    command: '/journal',
    description: 'Quick journal entry',
    intentMapping: 'journal',
    example: '/journal Had a productive day, finished the proposal',
  },
  {
    command: '/help',
    description: 'Show all commands and usage tips',
    intentMapping: 'navigate.help',
    example: '/help',
  },
];

// ── Store Interface ────────────────────────────────────────────────────

interface TelegramState {
  config: TelegramConfig;
  activityLog: TelegramActivityEntry[];
  webhookStatus: WebhookStatus;
  setupProgress: number; // 0-5 steps

  // Actions
  updateConfig: (partial: Partial<TelegramConfig>) => void;
  resetConfig: () => void;
  addActivity: (entry: Omit<TelegramActivityEntry, 'id'>) => void;
  clearActivityLog: () => void;
  setWebhookStatus: (status: Partial<WebhookStatus>) => void;
  setSetupProgress: (step: number) => void;
  addAuthorizedUser: (userId: string) => void;
  removeAuthorizedUser: (userId: string) => void;
  linkAccount: (lifeOsUserId: string) => void;
  unlinkAccount: () => void;
}

// ── Store ──────────────────────────────────────────────────────────────

export const useTelegramStore = create<TelegramState>()(
  persist(
    (set, get) => ({
      config: { ...DEFAULT_CONFIG },
      activityLog: [],
      webhookStatus: {
        connected: false,
        lastPing: null,
        url: '',
        errorCount: 0,
        lastError: null,
      },
      setupProgress: 0,

      updateConfig: (partial) => {
        set((state) => ({
          config: { ...state.config, ...partial },
        }));
        logger.info('[telegram-store] config updated', partial);
      },

      resetConfig: () => {
        set({ config: { ...DEFAULT_CONFIG } });
        logger.info('[telegram-store] config reset');
      },

      addActivity: (entry) => {
        const id = `tgl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({
          activityLog: [
            { ...entry, id },
            ...state.activityLog,
          ].slice(0, 500), // Keep last 500 entries
        }));
      },

      clearActivityLog: () => {
        set({ activityLog: [] });
      },

      setWebhookStatus: (status) => {
        set((state) => ({
          webhookStatus: { ...state.webhookStatus, ...status },
        }));
      },

      setSetupProgress: (step) => {
        set({ setupProgress: step });
      },

      addAuthorizedUser: (userId) => {
        set((state) => {
          if (state.config.authorizedUsers.includes(userId)) return state;
          return {
            config: {
              ...state.config,
              authorizedUsers: [...state.config.authorizedUsers, userId],
            },
          };
        });
      },

      removeAuthorizedUser: (userId) => {
        set((state) => ({
          config: {
            ...state.config,
            authorizedUsers: state.config.authorizedUsers.filter((id) => id !== userId),
          },
        }));
      },

      linkAccount: (lifeOsUserId) => {
        set((state) => ({
          config: { ...state.config, linkedAccount: lifeOsUserId },
        }));
      },

      unlinkAccount: () => {
        set((state) => ({
          config: { ...state.config, linkedAccount: null },
        }));
      },
    }),
    {
      name: 'lifeos-telegram-bot',
      partialize: (state) => ({
        config: state.config,
        activityLog: state.activityLog,
        setupProgress: state.setupProgress,
      }),
    }
  )
);
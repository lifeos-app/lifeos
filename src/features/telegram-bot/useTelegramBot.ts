/**
 * useTelegramBot — Core hook for Telegram Bot integration
 *
 * Manages bot configuration via Zustand store, defines all bot commands
 * and their Intent Engine mappings, handles natural language input,
 * and provides activity log + webhook management.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  useTelegramStore,
  TELEGRAM_COMMANDS,
  type TelegramConfig,
  type TelegramActivityEntry,
  type WebhookStatus,
} from '../../stores/telegramStore';
import { TelegramBridge, getTelegramBridge } from './TelegramBridge';

// ── Hook Return Type ─────────────────────────────────────────────────

export interface TelegramBotState {
  config: TelegramConfig;
  webhookStatus: WebhookStatus;
  activityLog: TelegramActivityEntry[];
  setupProgress: number;
  commands: typeof TELEGRAM_COMMANDS;

  // Config management
  updateConfig: (partial: Partial<TelegramConfig>) => void;
  resetConfig: () => void;
  setEnabled: (enabled: boolean) => void;
  setBotToken: (token: string) => void;
  setWebhookUrl: (url: string) => void;
  setDailyBriefTime: (time: string) => void;

  // User management
  addAuthorizedUser: (userId: string) => void;
  removeAuthorizedUser: (userId: string) => void;
  linkAccount: (lifeOsUserId: string) => void;
  unlinkAccount: () => void;

  // Webhook management
  setWebhook: (url?: string) => Promise<boolean>;
  testConnection: () => Promise<{ ok: boolean; botName: string; error?: string }>;
  refreshWebhookStatus: () => Promise<void>;

  // Activity log
  clearActivityLog: () => void;

  // Setup
  setSetupProgress: (step: number) => void;

  // Computed
  isConfigured: boolean;
  isWebhookConnected: boolean;
  recentActivity: TelegramActivityEntry[];
  successRate: number;
  commandCounts: Record<string, number>;

  // Natural language processing
  processNaturalLanguage: (input: string) => {
    command: string;
    args: string;
    intentMapping: string;
  } | null;
}

// ── Natural Language Patterns ────────────────────────────────────────

const NL_PATTERNS: {
  pattern: RegExp;
  command: string;
  intentMapping: string;
  extractArgs: (match: RegExpMatchArray) => string;
}[] = [
  {
    pattern: /(?:log|track|add)\s+(\d+\.?\d*)\s*hours?\s+(?:of\s+)?work(?:\s+at\s+(.+))?/i,
    command: 'log',
    intentMapping: 'shorthand.parse',
    extractArgs: (m) => {
      const hours = m[1];
      const client = m[2] ? ` at ${m[2]}` : '';
      return `${hours} hours work${client}`;
    },
  },
  {
    pattern: /(?:log|track|add)\s+(?:an?\s+)?expense\s+(?:of\s+)?\$?(\d+\.?\d*)\s+(?:for\s+)?(.+)/i,
    command: 'expense',
    intentMapping: 'expense',
    extractArgs: (m) => `$${m[1]} ${m[2]}`,
  },
  {
    pattern: /(?:i(?:'m| am)\s+)?(?:feeling|felt)\s+(.+)/i,
    command: 'mood',
    intentMapping: 'health_log',
    extractArgs: (m) => m[1],
  },
  {
    pattern: /(?:mood|feeling)\s+(\d+)\s*(.*)/i,
    command: 'mood',
    intentMapping: 'health_log',
    extractArgs: (m) => `${m[1]} ${m[2] || ''}`.trim(),
  },
  {
    pattern: /(?:slept|sleep)\s+(?:for\s+)?(\d+\.?\d*)\s*hours?/i,
    command: 'health',
    intentMapping: 'health_log',
    extractArgs: (m) => `sleep ${m[1]}h`,
  },
  {
    pattern: /(?:did|completed|finished|checked\s+off)\s+(.+)/i,
    command: 'habit',
    intentMapping: 'habit_log',
    extractArgs: (m) => m[1],
  },
  {
    pattern: /(?:earned|received|got)\s+\$?(\d+\.?\d*)\s+(?:from\s+)?(.+)/i,
    command: 'income',
    intentMapping: 'income',
    extractArgs: (m) => `$${m[1]} from ${m[2]}`,
  },
  {
    pattern: /(?:what(?:'s| is)\s+(?:my\s+)?|check\s+(?:my\s+)?)?(?:balance|budget|finances?)/i,
    command: 'balance',
    intentMapping: 'info',
    extractArgs: () => '',
  },
  {
    pattern: /(?:what(?:'s| is)\s+(?:on\s+)?(?:my\s+)?(?:schedule|calendar|agenda)|(?:today|tomorrow)(?:'s)?\s+(?:schedule|plan))/i,
    command: 'schedule',
    intentMapping: 'event',
    extractArgs: () => '',
  },
  {
    pattern: /(?:how\s+(?:are|am)\s+(?:my\s+)?(?:streaks?|habits?))/i,
    command: 'streak',
    intentMapping: 'info',
    extractArgs: () => '',
  },
  {
    pattern: /(?:daily\s+brief|briefing|morning\s+brief|summary)/i,
    command: 'brief',
    intentMapping: 'info',
    extractArgs: () => '',
  },
  {
    pattern: /(?:journal|diary|note|write)\s+(?:entry\s+)?(.+)/i,
    command: 'journal',
    intentMapping: 'journal',
    extractArgs: (m) => m[1],
  },
];

// ── Hook ──────────────────────────────────────────────────────────────

export function useTelegramBot(): TelegramBotState {
  const store = useTelegramStore();
  const {
    config,
    webhookStatus: storedWebhookStatus,
    activityLog,
    setupProgress,
    updateConfig,
    resetConfig,
    addActivity,
    clearActivityLog: storeClearActivityLog,
    setWebhookStatus,
    setSetupProgress,
    addAuthorizedUser,
    removeAuthorizedUser,
    linkAccount,
    unlinkAccount,
  } = store;

  const [isConnecting, setIsConnecting] = useState(false);

  // ── Derived state ────────────────────────────────────────────

  const isConfigured = !!(config.botToken && config.webhookUrl);
  const isWebhookConnected = storedWebhookStatus.connected;
  const recentActivity = activityLog.slice(0, 50);
  const successRate = activityLog.length
    ? activityLog.filter((e) => e.status === 'success').length / activityLog.length
    : 0;

  const commandCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activityLog.forEach((e) => {
      counts[e.command] = (counts[e.command] || 0) + 1;
    });
    return counts;
  }, [activityLog]);

  // ── Set webhook ──────────────────────────────────────────────

  const handleSetWebhook = useCallback(async (url?: string): Promise<boolean> => {
    const hookUrl = url || config.webhookUrl;
    if (!config.botToken || !hookUrl) return false;

    const bridge = getTelegramBridge(config.botToken, config.authorizedUsers);
    const result = await bridge.setWebhook(hookUrl);

    if (result.ok) {
      setWebhookStatus({ connected: true, url: hookUrl, lastPing: Date.now(), errorCount: 0, lastError: null });
      return true;
    } else {
      setWebhookStatus({ connected: false, lastError: result.description });
      return false;
    }
  }, [config.botToken, config.webhookUrl, config.authorizedUsers, setWebhookStatus]);

  // ── Test connection ──────────────────────────────────────────

  const testConnection = useCallback(async (): Promise<{ ok: boolean; botName: string; error?: string }> => {
    if (!config.botToken) return { ok: false, botName: '', error: 'No bot token set' };

    setIsConnecting(true);
    try {
      const bridge = getTelegramBridge(config.botToken, config.authorizedUsers);
      const result = await bridge.testConnection();
      if (result.ok) {
        setWebhookStatus({
          connected: true,
          lastPing: Date.now(),
          errorCount: 0,
          lastError: null,
        });
      }
      return result;
    } finally {
      setIsConnecting(false);
    }
  }, [config.botToken, config.authorizedUsers, setWebhookStatus]);

  // ── Refresh webhook status ─────────────────────────────────

  const refreshWebhookStatus = useCallback(async () => {
    if (!config.botToken) return;

    const bridge = getTelegramBridge(config.botToken, config.authorizedUsers);
    const info = await bridge.getWebhookInfo();

    if (info) {
      setWebhookStatus({
        connected: !!info.url,
        url: info.url,
        lastPing: info.pending_update_count >= 0 ? Date.now() : null,
      });
    }
  }, [config.botToken, config.authorizedUsers, setWebhookStatus]);

  // ── Natural language processing ──────────────────────────────

  const processNaturalLanguage = useCallback((input: string) => {
    for (const pattern of NL_PATTERNS) {
      const match = input.match(pattern.pattern);
      if (match) {
        return {
          command: pattern.command,
          args: pattern.extractArgs(match),
          intentMapping: pattern.intentMapping,
        };
      }
    }
    return null;
  }, []);

  // ── Convenience setters ─────────────────────────────────────

  const setEnabled = useCallback((enabled: boolean) => updateConfig({ enabled }), [updateConfig]);
  const setBotToken = useCallback((token: string) => updateConfig({ botToken: token }), [updateConfig]);
  const setWebhookUrl = useCallback((url: string) => updateConfig({ webhookUrl: url }), [updateConfig]);
  const setDailyBriefTime = useCallback((time: string) => updateConfig({ dailyBriefTime: time }), [updateConfig]);

  // ── Auto-refresh webhook status ─────────────────────────────

  useEffect(() => {
    if (config.botToken && config.enabled) {
      refreshWebhookStatus();
      const interval = setInterval(refreshWebhookStatus, 60_000);
      return () => clearInterval(interval);
    }
  }, [config.botToken, config.enabled, refreshWebhookStatus]);

  return {
    config,
    webhookStatus: storedWebhookStatus,
    activityLog,
    setupProgress,
    commands: TELEGRAM_COMMANDS,

    updateConfig,
    resetConfig,
    setEnabled,
    setBotToken,
    setWebhookUrl,
    setDailyBriefTime,

    addAuthorizedUser,
    removeAuthorizedUser,
    linkAccount,
    unlinkAccount,

    setWebhook: handleSetWebhook,
    testConnection,
    refreshWebhookStatus,

    clearActivityLog: storeClearActivityLog,
    setSetupProgress,

    isConfigured,
    isWebhookConnected,
    recentActivity,
    successRate,
    commandCounts,
    processNaturalLanguage,
  };
}
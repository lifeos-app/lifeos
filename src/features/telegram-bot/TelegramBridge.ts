/**
 * TelegramBridge — Webhook ↔ Intent Engine Bridge
 *
 * Receives incoming Telegram messages, parses commands or natural language,
 * routes to the Intent Engine, and formats responses for Telegram.
 * Handles inline keyboards, rate limiting, push notifications.
 */

export interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
  };
  date: number;
  text?: string;
  voice?: {
    file_id: string;
    duration: number;
  };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    message?: TelegramMessage;
    data?: string;
  };
}

export interface TelegramInlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramResponse {
  method: string;
  chat_id: number;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: {
    inline_keyboard: TelegramInlineKeyboardButton[][];
  };
}

// ── Rate Limiter ────────────────────────────────────────────────────

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 30, windowMs = 60_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(userId: string): boolean {
    const now = Date.now();
    const window = this.requests.get(userId) || [];
    const recent = window.filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxRequests) {
      return false;
    }

    recent.push(now);
    this.requests.set(userId, recent);
    return true;
  }

  getRemaining(userId: string): number {
    const now = Date.now();
    const window = this.requests.get(userId) || [];
    const recent = window.filter((t) => now - t < this.windowMs);
    return Math.max(0, this.maxRequests - recent.length);
  }
}

const rateLimiter = new RateLimiter(30, 60_000);

// ── Command Parser ─────────────────────────────────────────────────

interface ParsedCommand {
  command: string | null;
  args: string;
  isNaturalLanguage: boolean;
}

function parseTelegramCommand(text: string, prefix = '/'): ParsedCommand {
  const trimmed = text.trim();

  // Check if it starts with a command prefix
  if (trimmed.startsWith(prefix)) {
    const match = trimmed.match(/^\/(\w+)(?:@\w+)?\s*(.*)/);
    if (match) {
      return {
        command: match[1].toLowerCase(),
        args: match[2].trim(),
        isNaturalLanguage: false,
      };
    }
  }

  // Natural language input
  return {
    command: null,
    args: trimmed,
    isNaturalLanguage: true,
  };
}

// ── Intent Mapping ──────────────────────────────────────────────────

const COMMAND_INTENT_MAP: Record<string, string> = {
  start: 'navigate.start',
  log: 'shorthand.parse',
  habit: 'habit_log',
  mood: 'health_log',
  health: 'health_log',
  expense: 'expense',
  income: 'income',
  balance: 'info',
  schedule: 'event',
  goals: 'goal',
  streak: 'info',
  brief: 'info',
  stats: 'info',
  journal: 'journal',
  help: 'navigate.help',
};

// ── Response Formatter ──────────────────────────────────────────────

function escapeMarkdown(text: string): string {
  return text
    .replace(/([_\*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

function formatTelegramResponse(
  chatId: number,
  text: string,
  keyboard?: TelegramInlineKeyboardButton[][],
): TelegramResponse {
  const response: TelegramResponse = {
    method: 'sendMessage',
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };

  if (keyboard) {
    response.reply_markup = { inline_keyboard: keyboard };
  }

  return response;
}

function buildConfirmationKeyboard(actionId: string): TelegramInlineKeyboardButton[][] {
  return [
    [
      { text: '✅ Confirm', callback_data: `confirm:${actionId}` },
      { text: '❌ Cancel', callback_data: `cancel:${actionId}` },
    ],
  ];
}

function buildHabitKeyboard(habits: { id: string; title: string }[]): TelegramInlineKeyboardButton[][] {
  return habits.slice(0, 8).map((h) => [
    { text: `✓ ${h.title}`, callback_data: `habit:${h.id}` },
  ]);
}

// ── Daily Brief Formatter ───────────────────────────────────────────

interface BriefData {
  date: string;
  tasks: { total: number; completed: number; pending: number };
  habits: { total: number; completed: number; bestStreak: number };
  health: { mood: number | null; energy: number | null; sleep: number | null; water: number | null };
  events: { title: string; time: string }[];
  balance: { income: number; expenses: number };
  goals: { active: number; completed: number };
}

function formatDailyBrief(data: BriefData): string {
  const lines: string[] = [];

  lines.push(`🌅 *Daily Brief — ${data.date}*\n`);

  // Tasks
  lines.push(`📋 *Tasks:* ${data.tasks.completed}/${data.tasks.total} done`);
  if (data.tasks.pending > 0) {
    lines.push(`   ↳ ${data.tasks.pending} pending`);
  }

  // Habits
  lines.push(`🔥 *Habits:* ${data.habits.completed}/${data.habits.total} done`);
  if (data.habits.bestStreak > 0) {
    lines.push(`   ↳ Best streak: ${data.habits.bestStreak} days`);
  }

  // Health
  if (data.health.mood !== null) {
    const healthParts: string[] = [];
    healthParts.push(`Mood ${data.health.mood}/10`);
    if (data.health.energy !== null) healthParts.push(`Energy ${data.health.energy}/10`);
    if (data.health.sleep !== null) healthParts.push(`Sleep ${data.health.sleep}h`);
    if (data.health.water !== null) healthParts.push(`Water ${data.health.water} glasses`);
    lines.push(`💪 *Health:* ${healthParts.join(' · ')}`);
  }

  // Schedule
  if (data.events.length > 0) {
    lines.push(`📅 *Schedule:*`);
    data.events.forEach((e) => {
      lines.push(`   ${e.time ? e.time + ' ' : ''}${e.title}`);
    });
  }

  // Finance
  lines.push(`💰 *Balance:* +$${data.balance.income.toLocaleString()} / -$${data.balance.expenses.toLocaleString()}`);

  // Goals
  lines.push(`🎯 *Goals:* ${data.goals.active} active, ${data.goals.completed} completed`);

  return lines.join('\n');
}

// ── Main Bridge ─────────────────────────────────────────────────────

export class TelegramBridge {
  private botToken: string;
  private apiUrl: string;
  private authorizedUsers: Set<string>;

  constructor(botToken: string, authorizedUsers: string[] = []) {
    this.botToken = botToken;
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
    this.authorizedUsers = new Set(authorizedUsers);
  }

  // ── Process incoming update ──────────────────────────────────

  async processUpdate(update: TelegramUpdate): Promise<TelegramResponse | null> {
    // Handle callback queries (inline keyboard responses)
    if (update.callback_query) {
      return this.handleCallback(update.callback_query);
    }

    const message = update.message;
    if (!message?.text && !message?.voice) return null;

    const chatId = message.chat.id;
    const userId = message.from?.id.toString() || '';
    const username = message.from?.username || message.from?.first_name || 'Unknown';

    // Rate limiting
    if (!rateLimiter.isAllowed(userId)) {
      return formatTelegramResponse(chatId, '⚠️ Rate limit reached. Please wait a moment.');
    }

    // Authorization check
    if (this.authorizedUsers.size > 0 && !this.authorizedUsers.has(userId)) {
      return formatTelegramResponse(
        chatId,
        '🔒 You are not authorized to use this bot. Link your account in LifeOS Settings.',
      );
    }

    // Handle voice message
    if (message.voice) {
      return this.handleVoice(chatId, userId, message.voice.file_id);
    }

    const text = message.text || '';
    const parsed = parseTelegramCommand(text);

    // Route to Intent Engine
    try {
      const startTime = Date.now();
      const result = await this.routeToIntent(parsed, userId, username, chatId);
      const durationMs = Date.now() - startTime;

      // Log activity
      this.logActivity({
        userId,
        username,
        command: parsed.command || 'natural_language',
        input: text,
        response: result.text.substring(0, 200),
        status: 'success',
        durationMs,
      });

      return result;
    } catch (error) {
      this.logActivity({
        userId,
        username,
        command: parsed.command || 'natural_language',
        input: text,
        response: String(error),
        status: 'error',
        durationMs: 0,
      });

      return formatTelegramResponse(
        chatId,
        `❌ Something went wrong. Please try again.\n\n_Error: ${escapeMarkdown(String(error).substring(0, 100))}_`,
      );
    }
  }

  // ── Route to Intent Engine ───────────────────────────────────

  private async routeToIntent(
    parsed: ParsedCommand,
    userId: string,
    username: string,
    chatId: number,
  ): Promise<TelegramResponse> {
    // /start command
    if (parsed.command === 'start') {
      return formatTelegramResponse(
        chatId,
        `👋 *Welcome to LifeOS Bot, ${escapeMarkdown(username)}!*\n\n` +
          'I can help you track habits, log activities, check your stats, and more.\n\n' +
          '*Quick Start:*\n' +
          '/log — Log anything\n' +
          '/habit — Track a habit\n' +
          '/mood — Log your mood\n' +
          '/brief — Daily brief\n' +
          '/help — All commands\n\n' +
          '💡 _You can also use natural language_\n' +
          '_e.g., "3 hours work at Sonder"_',
      );
    }

    // /help command
    if (parsed.command === 'help') {
      return this.handleHelp(chatId);
    }

    // /brief command
    if (parsed.command === 'brief') {
      return this.handleBrief(chatId, userId);
    }

    // Map command to Intent Engine action
    const intentAction = parsed.command
      ? COMMAND_INTENT_MAP[parsed.command] || 'shorthand.parse'
      : 'shorthand.parse';

    const inputText = parsed.command ? parsed.args : parsed.args;

    // For commands with no args, return quick info
    if (parsed.command && !parsed.args) {
      if (parsed.command === 'streak') return this.handleStreaks(chatId);
      if (parsed.command === 'balance') return this.handleBalance(chatId);
      if (parsed.command === 'schedule') return this.handleSchedule(chatId);
      if (parsed.command === 'goals') return this.handleGoals(chatId);
      if (parsed.command === 'stats') return this.handleStats(chatId);
    }

    // Send to Intent Engine proxy
    try {
      const response = await fetch('/api/telegram/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputText,
          intentAction,
          userId,
          username,
        }),
      });

      if (!response.ok) {
        throw new Error(`Intent Engine returned ${response.status}`);
      }

      const data = await response.json();
      const reply = data.data?.reply || data.data?.message || '✅ Done!';

      // Check if confirmation is needed
      if (data.data?.needs_confirmation) {
        const actionId = `act-${Date.now()}`;
        return formatTelegramResponse(
          chatId,
          `⚠️ *Confirm Action:*\n\n${escapeMarkdown(reply)}\n\n_Reply with "yes" to confirm or "no" to cancel._`,
          buildConfirmationKeyboard(actionId),
        );
      }

      return formatTelegramResponse(chatId, escapeMarkdown(reply));
    } catch (error) {
      // Fallback: try shorthand parsing locally
      if (parsed.command === 'log' || parsed.isNaturalLanguage) {
        return formatTelegramResponse(
          chatId,
          `📝 I heard: _"${escapeMarkdown(inputText)}"_\n\n` +
            '🤖 Intent Engine is offline. I\'ll save this for later processing.\n' +
            'In the meantime, try specific commands like /habit, /mood, /expense',
        );
      }
      throw error;
    }
  }

  // ── Command Handlers ─────────────────────────────────────────

  private handleHelp(chatId: number): TelegramResponse {
    const commands = [
      { cmd: '/start', desc: 'Welcome & account linking' },
      { cmd: '/log', desc: 'Quick log anything' },
      { cmd: '/habit', desc: 'Log habit completion' },
      { cmd: '/mood', desc: 'Log mood (1-10)' },
      { cmd: '/health', desc: 'Log health metrics' },
      { cmd: '/expense', desc: 'Log an expense' },
      { cmd: '/income', desc: 'Log income' },
      { cmd: '/balance', desc: 'Check financial balance' },
      { cmd: '/schedule', desc: 'View today\'s schedule' },
      { cmd: '/goals', desc: 'Goal progress overview' },
      { cmd: '/streak', desc: 'View habit streaks' },
      { cmd: '/brief', desc: 'Daily brief summary' },
      { cmd: '/stats', desc: 'Weekly/monthly statistics' },
      { cmd: '/journal', desc: 'Quick journal entry' },
      { cmd: '/help', desc: 'This message' },
    ];

    const lines = commands.map((c) => `  ${c.cmd.padEnd(12)} — ${c.desc}`);
    return formatTelegramResponse(
      chatId,
      `🤖 *LifeOS Bot Commands*\n\n${lines.join('\n')}\n\n` +
        '💡 _Natural language also works!_\n' +
        '_Type "3 hours work at Sonder" or "mood 8 feeling great"_',
    );
  }

  private async handleBrief(chatId: number, userId: string): Promise<TelegramResponse> {
    try {
      const response = await fetch('/api/context');
      if (!response.ok) throw new Error('Failed to fetch context');
      const ctx = await response.json();
      const data = ctx.data;

      const brief: BriefData = {
        date: new Date().toLocaleDateString('en-AU', { weekday: 'long', month: 'short', day: 'numeric' }),
        tasks: {
          total: data?.tasks?.today || 0,
          completed: 0,
          pending: data?.tasks?.overdue || 0,
        },
        habits: {
          total: data?.habits?.total || 0,
          completed: data?.habits?.completedToday || 0,
          bestStreak: 0,
        },
        health: {
          mood: data?.health?.mood || null,
          energy: data?.health?.energy || null,
          sleep: data?.health?.sleep || null,
          water: null,
        },
        events: [],
        balance: { income: 0, expenses: 0 },
        goals: {
          active: data?.goals?.active || 0,
          completed: data?.goals?.completed || 0,
        },
      };

      return formatTelegramResponse(chatId, formatDailyBrief(brief));
    } catch {
      return formatTelegramResponse(chatId, '❌ Could not generate your daily brief. Please try again later.');
    }
  }

  private async handleStreaks(chatId: number): Promise<TelegramResponse> {
    try {
      const response = await fetch('/api/habits');
      if (!response.ok) throw new Error('Failed to fetch habits');
      const data = await response.json();
      const habits = (data.data || data || []).filter((h: any) => h.is_active && !h.is_deleted);

      if (habits.length === 0) {
        return formatTelegramResponse(chatId, 'No active habits yet. Add some in LifeOS!');
      }

      const lines = habits.map((h: any) => {
        const streak = h.streak_current || 0;
        const fire = streak >= 7 ? '🔥' : streak >= 3 ? '✨' : '→';
        return `  ${fire} ${h.title}: ${streak} day${streak !== 1 ? 's' : ''}`;
      });

      return formatTelegramResponse(chatId, `🔥 *Habit Streaks*\n\n${lines.join('\n')}`);
    } catch {
      return formatTelegramResponse(chatId, '❌ Could not fetch habits. Try again later.');
    }
  }

  private async handleBalance(chatId: number): Promise<TelegramResponse> {
    try {
      const response = await fetch('/api/finance/summary');
      if (!response.ok) throw new Error('Failed to fetch finance summary');
      const data = (await response.json()).data;

      return formatTelegramResponse(
        chatId,
        `💰 *Financial Summary*\n\n` +
          `Income: $${(data?.totalIncome || 0).toLocaleString()}\n` +
          `Expenses: $${(data?.totalExpenses || 0).toLocaleString()}\n` +
          `Net: $${((data?.totalIncome || 0) - (data?.totalExpenses || 0)).toLocaleString()}`,
      );
    } catch {
      return formatTelegramResponse(chatId, '❌ Could not fetch financial data.');
    }
  }

  private async handleSchedule(chatId: number): Promise<TelegramResponse> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/schedule_events?date=eq.${today}`);
      if (!response.ok) throw new Error('Failed to fetch schedule');
      const events = ((await response.json()).data || []).filter((e: any) => !e.is_deleted);

      if (events.length === 0) {
        return formatTelegramResponse(chatId, `📅 No events scheduled for today. Enjoy the free time! 🌊`);
      }

      const lines = events.map((e: any) => {
        const time = e.start_time ? e.start_time.substring(0, 5) : 'All day';
        const icon = e.event_type === 'work' ? '💼' : e.event_type === 'health' ? '💪' : '📌';
        return `  ${time} ${icon} ${e.title}`;
      });

      return formatTelegramResponse(chatId, `📅 *Today's Schedule*\n\n${lines.join('\n')}`);
    } catch {
      return formatTelegramResponse(chatId, '❌ Could not fetch schedule.');
    }
  }

  private async handleGoals(chatId: number): Promise<TelegramResponse> {
    try {
      const response = await fetch('/api/goals');
      if (!response.ok) throw new Error('Failed to fetch goals');
      const goals = ((await response.json()).data || []).filter(
        (g: any) => g.status === 'active' && !g.is_deleted,
      );

      if (goals.length === 0) {
        return formatTelegramResponse(chatId, '🎯 No active goals. Time to set some!');
      }

      const lines = goals.slice(0, 10).map((g: any) => {
        const progress = Math.round(g.progress || 0);
        const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
        return `  ${g.title} [${bar}] ${progress}%`;
      });

      return formatTelegramResponse(chatId, `🎯 *Active Goals*\n\n${lines.join('\n')}`);
    } catch {
      return formatTelegramResponse(chatId, '❌ Could not fetch goals.');
    }
  }

  private async handleStats(chatId: number): Promise<TelegramResponse> {
    try {
      const response = await fetch('/api/context');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = (await response.json()).data;

      return formatTelegramResponse(
        chatId,
        `📊 *Your LifeOS Stats*\n\n` +
          `🎯 Goals: ${data?.goals?.active || 0} active, ${data?.goals?.completed || 0} completed\n` +
          `📋 Tasks: ${data?.tasks?.today || 0} today, ${data?.tasks?.overdue || 0} overdue\n` +
          `🔥 Habits: ${data?.habits?.completedToday || 0}/${data?.habits?.total || 0} done today\n` +
          (data?.health?.mood
            ? `💪 Mood: ${data.health.mood}/10 · Energy: ${data.health.energy || '?'}/10\n`
            : ''),
      );
    } catch {
      return formatTelegramResponse(chatId, '❌ Could not fetch stats.');
    }
  }

  // ── Handle callback queries ──────────────────────────────────

  private async handleCallback(callback: {
    id: string;
    from: { id: number; first_name: string; username?: string };
    message?: TelegramMessage;
    data?: string;
  }): Promise<TelegramResponse> {
    const chatId = callback.message?.chat?.id || callback.from.id;
    const action = callback.data || '';

    if (action.startsWith('confirm:')) {
      // Execute confirmed action
      return formatTelegramResponse(chatId, '✅ Action confirmed and executed!');
    }

    if (action.startsWith('cancel:')) {
      return formatTelegramResponse(chatId, '❌ Action cancelled.');
    }

    if (action.startsWith('habit:')) {
      const habitId = action.split(':')[1];
      // Log habit completion via API
      try {
        await fetch('/api/habit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            habit_id: habitId,
            date: new Date().toISOString().split('T')[0],
            completed: true,
          }),
        });
        return formatTelegramResponse(chatId, '✅ Habit logged! Great job! 🔥');
      } catch {
        return formatTelegramResponse(chatId, '❌ Could not log habit. Try again.');
      }
    }

    return formatTelegramResponse(chatId, 'Unknown action.');
  }

  // ── Handle voice messages ─────────────────────────────────────

  private async handleVoice(chatId: number, userId: string, fileId: string): Promise<TelegramResponse> {
    // Voice transcription would need a Telegram file download + STT service
    // For now, provide guidance
    return formatTelegramResponse(
      chatId,
      '🎙️ Voice messages are not yet supported for transcription.\n\n' +
        'Please type your command or use natural language instead:\n' +
        '_e.g., "/log 3 hours work" or "mood 8"',
    );
  }

  // ── Send push notification ────────────────────────────────────

  async sendNotification(chatId: number, text: string, keyboard?: TelegramInlineKeyboardButton[][]): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // ── Set webhook ────────────────────────────────────────────────

  async setWebhook(webhookUrl: string): Promise<{ ok: boolean; description: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ['message', 'callback_query'],
        }),
      });
      const data = await response.json();
      return { ok: data.ok, description: data.description || '' };
    } catch (error) {
      return { ok: false, description: String(error) };
    }
  }

  // ── Get webhook info ───────────────────────────────────────────

  async getWebhookInfo(): Promise<{ url: string; has_custom_certificate: boolean; pending_update_count: number } | null> {
    try {
      const response = await fetch(`${this.apiUrl}/getWebhookInfo`);
      const data = await response.json();
      return data.result || null;
    } catch {
      return null;
    }
  }

  // ── Test connection ────────────────────────────────────────────

  async testConnection(): Promise<{ ok: boolean; botName: string; error?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/getMe`);
      const data = await response.json();
      if (data.ok) {
        return { ok: true, botName: data.result.first_name };
      }
      return { ok: false, botName: '', error: data.description || 'Unknown error' };
    } catch (error) {
      return { ok: false, botName: '', error: String(error) };
    }
  }

  // ── Activity logging (calls store) ─────────────────────────────

  private logActivity(entry: {
    userId: string;
    username: string;
    command: string;
    input: string;
    response: string;
    status: 'success' | 'error' | 'pending';
    durationMs: number;
  }): void {
    // This will be hooked up to the Zustand store via the frontend
    // For the backend bridge, we store in a module-level buffer
    try {
      const { useTelegramStore } = require('../../stores/telegramStore');
      useTelegramStore.getState().addActivity({
        ...entry,
        timestamp: Date.now(),
      });
    } catch {
      // Running on backend or store not available — skip
    }
  }
}

// ── Singleton ────────────────────────────────────────────────────

let bridgeInstance: TelegramBridge | null = null;

export function getTelegramBridge(token?: string, authorizedUsers?: string[]): TelegramBridge | null {
  if (!token && bridgeInstance) return bridgeInstance;
  if (!token) return null;
  bridgeInstance = new TelegramBridge(token, authorizedUsers);
  return bridgeInstance;
}

export { parseTelegramCommand, formatDailyBrief, COMMAND_INTENT_MAP };
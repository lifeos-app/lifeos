/**
 * Telegram Bot — Barrel Export
 *
 * Brings LifeOS to Telegram — quick log, daily brief, habit
 * reminders, streak alerts, and more. Interfaces with the
 * Intent Engine for natural language processing.
 */

export { TelegramBot } from './TelegramBot';
export { useTelegramBot } from './useTelegramBot';
export { CommandReference } from './CommandReference';
export { BotActivityLog } from './BotActivityLog';
export { BotSetupGuide } from './BotSetupGuide';
export { TelegramBridge, getTelegramBridge, parseTelegramCommand, formatDailyBrief, COMMAND_INTENT_MAP } from './TelegramBridge';
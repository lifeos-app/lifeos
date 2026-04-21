/**
 * LifeOS Intent Engine — Barrel Exports
 *
 * Re-exports all public API from the decomposed modules.
 * This ensures backward compatibility — existing imports from
 * '../lib/intent-engine' still work via the re-export shim.
 */

// ─── Types ───────────────────────────────────────────────────────
export type {
  IntentAction,
  RateLimitInfo,
  IntentResult,
  IntentContext,
  AISettings,
  ExecuteIntentResult,
} from './types';

// ─── System Prompt ───────────────────────────────────────────────
export { buildSystemPrompt } from './system-prompt';

// ─── Context Loader ──────────────────────────────────────────────
export { loadIntentContext } from './context-loader';

// ─── Shorthand Parser ────────────────────────────────────────────
export { parseShorthand, parseTimeToToday } from './shorthand-parser';

// ─── Action Executor ─────────────────────────────────────────────
export { executeActions, executeIntent, sanitizeData, searchDatabase } from './action-executor';

// ─── Settings ────────────────────────────────────────────────────
export { getAISettings, saveAISettings } from './settings';

// ─── Engine (main orchestrator) ──────────────────────────────────
export { callIntentEngine } from './engine';
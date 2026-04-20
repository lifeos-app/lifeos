/**
 * LifeOS Intent Engine — Backward Compatibility Shim
 *
 * This file re-exports everything from the decomposed src/lib/intent/ directory.
 * Existing imports like `from '../lib/intent-engine'` continue to work unchanged.
 */

export {
  // Types
  type IntentAction,
  type RateLimitInfo,
  type IntentResult,
  type IntentContext,
  type AISettings,

  // Functions
  buildSystemPrompt,
  loadIntentContext,
  parseShorthand,
  executeActions,
  sanitizeData,
  searchDatabase,
  getAISettings,
  saveAISettings,
  callIntentEngine,
} from './intent/index';
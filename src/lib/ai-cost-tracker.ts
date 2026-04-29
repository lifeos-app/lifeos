/**
 * AI Cost Tracker — P7-006
 *
 * Lightweight fire-and-forget tracker for LLM token usage and cost.
 * Persists to localStorage, dispatches custom events for reactive hooks.
 * No Supabase table yet (TD-010 territory).
 */

import type { AIUsageRecord, AIUsageSummary } from '../types/ai-usage';

const STORAGE_KEY = 'lifeos:ai-usage';
const MAX_RECORDS = 1000;

// ─── Model Pricing (per 1M tokens, in cents) ──────────────────
// Multiply tokens by these rates then divide by 1_000_000.
// Stored as cents to avoid floating-point errors.

interface ModelPricing {
  inputPer1MCents: number;   // cost in cents per 1M input tokens
  outputPer1MCents: number;  // cost in cents per 1M output tokens
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // gemini-2.0-flash: $0.075/1M input, $0.30/1M output
  'gemini-2.0-flash': { inputPer1MCents: 750, outputPer1MCents: 3000 },
  'google/gemini-2.0-flash-001': { inputPer1MCents: 750, outputPer1MCents: 3000 },
  // gemini-2.5-pro: $1.25/1M input, $10/1M output
  'gemini-2.5-pro': { inputPer1MCents: 125_000, outputPer1MCents: 1_000_000 },
  // gemma4:e2b: free (local Ollama)
  'gemma4:e2b': { inputPer1MCents: 0, outputPer1MCents: 0 },
  'gemma3': { inputPer1MCents: 0, outputPer1MCents: 0 },
};

const DEFAULT_PRICING: ModelPricing = {
  // $0.10/1M input, $0.40/1M output
  inputPer1MCents: 10_000,
  outputPer1MCents: 40_000,
};

function getModelPricing(model: string): ModelPricing {
  // Check exact match first
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  // Check partial match (e.g. "gemini-2.0-flash" inside a longer name)
  for (const key of Object.keys(MODEL_PRICING)) {
    if (model.includes(key) || key.includes(model)) return MODEL_PRICING[key];
  }
  return DEFAULT_PRICING;
}

function estimateCostCents(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = getModelPricing(model);
  // Multiply before dividing to avoid floating point errors
  const inputCost = (tokensIn * pricing.inputPer1MCents) / 1_000_000;
  const outputCost = (tokensOut * pricing.outputPer1MCents) / 1_000_000;
  return Math.ceil(inputCost + outputCost);
}

function loadRecords(): AIUsageRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AIUsageRecord[];
  } catch {
    return [];
  }
}

function saveRecords(records: AIUsageRecord[]): void {
  // Cap at MAX_RECORDS, trimming oldest first
  const trimmed = records.length > MAX_RECORDS
    ? records.slice(records.length - MAX_RECORDS)
    : records;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable — silently drop
  }
}

function notifyUpdate(): void {
  try {
    window.dispatchEvent(new CustomEvent('lifeos:ai-usage-updated'));
  } catch {
    // SSR or non-browser env
  }
}

// ─── Public API ────────────────────────────────────────────────

export interface TrackAICallParams {
  model: string;
  tokensIn: number;
  tokensOut: number;
  source: string;       // e.g. 'intent', 'zeroclaw', 'oracle', 'morning-brief', etc.
  latencyMs: number;
  userId?: string;
}

/**
 * Track an LLM call. Fire-and-forget — does not await (synchronous localStorage write).
 */
export function trackAICall(params: TrackAICallParams): void {
  const { model, tokensIn, tokensOut, source, latencyMs, userId } = params;

  const record: AIUsageRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId || '',
    created_at: new Date().toISOString(),
    model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_cents: estimateCostCents(model, tokensIn, tokensOut),
    source,
    latency_ms: latencyMs,
  };

  const records = loadRecords();
  records.push(record);
  saveRecords(records);
  notifyUpdate();
}

/**
 * Get usage summary for the last N days (default: 30).
 */
export function getAIUsageSummary(days: number = 30): AIUsageSummary {
  const records = getAIUsageRecords(days);

  const summary: AIUsageSummary = {
    totalCalls: records.length,
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCostCents: 0,
    byModel: {},
    bySource: {},
  };

  for (const r of records) {
    summary.totalTokensIn += r.tokens_in;
    summary.totalTokensOut += r.tokens_out;
    summary.totalCostCents += r.cost_cents;

    if (!summary.byModel[r.model]) {
      summary.byModel[r.model] = { calls: 0, tokensIn: 0, tokensOut: 0, costCents: 0 };
    }
    summary.byModel[r.model].calls += 1;
    summary.byModel[r.model].tokensIn += r.tokens_in;
    summary.byModel[r.model].tokensOut += r.tokens_out;
    summary.byModel[r.model].costCents += r.cost_cents;

    if (!summary.bySource[r.source]) {
      summary.bySource[r.source] = { calls: 0, tokensIn: 0, tokensOut: 0, costCents: 0 };
    }
    summary.bySource[r.source].calls += 1;
    summary.bySource[r.source].tokensIn += r.tokens_in;
    summary.bySource[r.source].tokensOut += r.tokens_out;
    summary.bySource[r.source].costCents += r.cost_cents;
  }

  return summary;
}

/**
 * Get usage records for the last N days (default: 30).
 */
export function getAIUsageRecords(days: number = 30): AIUsageRecord[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  return loadRecords().filter(r => r.created_at >= cutoffStr);
}

/**
 * Clear all AI usage records.
 */
export function clearAIUsage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notifyUpdate();
}
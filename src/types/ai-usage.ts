/**
 * AI Usage Tracking Types — P7-006
 */

export interface AIUsageRecord {
  id: string;
  user_id: string;
  created_at: string;
  model: string;           // e.g. 'gemini-2.0-flash', 'gemma4:e2b'
  tokens_in: number;        // prompt tokens
  tokens_out: number;       // completion tokens
  cost_cents: number;       // estimated cost in cents (USD)
  source: string;           // e.g. 'tutor', 'zeroclaw', 'intent', 'oracle'
  latency_ms: number;       // response time in ms
}

export interface AIUsageSummary {
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostCents: number;
  byModel: Record<string, { calls: number; tokensIn: number; tokensOut: number; costCents: number }>;
  bySource: Record<string, { calls: number; tokensIn: number; tokensOut: number; costCents: number }>;
}
/**
 * LifeOS Plugin System — Shared Types
 *
 * Generic plugin pipeline: TCS, Shopify, gym apps, etc.
 * External systems fire events; each plugin handler decides what to do with them.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ── CORE TYPES ─────────────────────────────────────────────────────────────────

/** An event fired by an external system (TCS, Shopify, etc.) */
export interface PluginEvent {
  /** Identifier for the originating system */
  plugin_id: string;
  /** What happened: 'job_complete', 'invoice_paid', 'order_complete', etc. */
  event_type: string;
  /** LifeOS user this event belongs to */
  user_id: string;
  /** ISO timestamp of when the event occurred */
  timestamp: string;
  /** Plugin-specific payload — typed per-handler */
  data: Record<string, unknown>;
}

/** Per-plugin configuration registered with the PluginRegistry */
export interface PluginConfig {
  id: string;
  name: string;
  /** Emoji icon shown in the UI */
  icon: string;
  /** Hex colour for plugin badges/accents */
  color: string;
  description: string;
  enabled: boolean;
  /** HMAC-SHA256 secret for validating incoming webhooks */
  webhook_secret?: string;
  /** Map of event_type → handler function */
  event_handlers: Record<string, PluginEventHandler>;
}

/** Handler function signature for a single event type */
export type PluginEventHandler = (
  event: PluginEvent,
  supabase: SupabaseClient
) => Promise<PluginEventResult>;

/** Result returned after processing a plugin event */
export interface PluginEventResult {
  /** Total XP awarded as a result of this event */
  xp_awarded: number;
  /** Whether this event also completed a quest */
  quest_completed: boolean;
  /** Whether income was logged in the finance module */
  income_logged: boolean;
  /** Human-readable log of every action taken */
  actions: string[];
}

// ── ACTIVITY FEED ──────────────────────────────────────────────────────────────

/** Row shape for the plugin_activity table */
export interface PluginActivityRow {
  id: string;
  user_id: string;
  plugin_id: string;
  title: string;
  description: string | null;
  icon: string | null;
  xp_earned: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── WEBHOOK ────────────────────────────────────────────────────────────────────

/** Parsed and validated webhook payload */
export interface WebhookPayload {
  plugin_id: string;
  event_type: string;
  user_id: string;
  timestamp: string;
  data: Record<string, unknown>;
  /** Raw signature header value for HMAC verification */
  signature?: string;
}

export interface WebhookValidationResult {
  valid: boolean;
  error?: string;
}

// ── TCS-SPECIFIC PAYLOADS ──────────────────────────────────────────────────────

export interface TCSJobCompleteData {
  client_name: string;
  location: string;
  amount: number;
  job_date: string;     // YYYY-MM-DD
  duration_hours?: number;
  notes?: string;
  job_id?: string;
}

export interface TCSInvoicePaidData {
  invoice_id: string;
  client_name: string;
  amount: number;
  paid_at: string;
  transaction_id?: string;
}

export interface TCSNewClientData {
  client_name: string;
  location: string;
  estimated_value?: number;
  source?: string;
}

export interface TCSIssueReportedData {
  client_name: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  job_id?: string;
}

// ── SHOPIFY-SPECIFIC PAYLOADS ──────────────────────────────────────────────────

export interface ShopifyOrderCompleteData {
  order_id: string;
  amount: number;
  currency: string;
  line_items: { title: string; quantity: number; price: number }[];
  customer_email?: string;
}

export interface ShopifyNewCustomerData {
  customer_id: string;
  email: string;
  name?: string;
  total_spent?: number;
}

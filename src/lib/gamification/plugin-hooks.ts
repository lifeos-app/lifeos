/**
 * Plugin Quest Hooks
 *
 * External systems write quest suggestions to `plugin_quest_suggestions`.
 * Quest Engine v2 reads and consumes them during daily generation.
 *
 * USAGE (from any external system or LifeOS module):
 *
 *   import { injectPluginQuest, PLUGIN_IDS } from './plugin-hooks';
 *
 *   // After a TCS cleaning job is complete:
 *   await injectPluginQuest(supabase, userId, {
 *     plugin_id:   PLUGIN_IDS.TCS,
 *     title:       'Invoice: Office clean',
 *     description: '$150 job completed — send invoice now',
 *     icon:        '🧹',
 *     category:    'finance',
 *     reward_xp:   75,
 *     priority:    'high',
 *     metadata:    { client: 'Client A', amount: 150, job_date: '2026-02-19' },
 *   });
 *
 *   // When Shopify gets a new order:
 *   await injectPluginQuest(supabase, userId, {
 *     plugin_id:   PLUGIN_IDS.SHOPIFY,
 *     title:       'Fulfil order #1042',
 *     description: 'New order from shop needs fulfilling',
 *     icon:        '📦',
 *     category:    'productivity',
 *     reward_xp:   50,
 *     priority:    'high',
 *     metadata:    { order_id: '1042', amount: 89 },
 *   });
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuestCategory, QuestPriority } from './quest-engine-v2';
import { logger } from '../../utils/logger';

// ── TYPES ──────────────────────────────────────────────────────────────────────

/** A suggestion injected by an external plugin */
export interface PluginQuestSuggestion {
  /** Identifier for the originating system (use PLUGIN_IDS constants) */
  plugin_id: string;
  /** Short, action-oriented title shown to the user */
  title: string;
  /** Supporting detail line shown below the title */
  description: string;
  /** Emoji icon for visual differentiation */
  icon: string;
  /** Category used for quest variety balancing */
  category: QuestCategory;
  /** XP reward for completing this quest */
  reward_xp: number;
  /** How urgently this should surface on the quest board */
  priority: QuestPriority;
  /** Arbitrary plugin-specific payload — stored as JSONB */
  metadata: Record<string, unknown>;
  /**
   * ISO timestamp after which this suggestion is stale.
   * Omit for suggestions that never expire (e.g., outstanding invoices).
   */
  expires_at?: string;
}

/** The full DB row including server-assigned fields */
export interface PluginQuestRecord extends PluginQuestSuggestion {
  id: string;
  user_id: string;
  consumed_at: string | null;
  created_at: string;
}

// ── KNOWN PLUGIN IDs ───────────────────────────────────────────────────────────

/**
 * Canonical plugin_id values used by LifeOS integrations.
 * External code should import these rather than using raw strings.
 */
export const PLUGIN_IDS = {
  /** Cleaning Service — jobs, invoicing, scheduling */
  TCS:      'tcs',
  /** Shopify store — orders, fulfilment, inventory */
  SHOPIFY:  'shopify',
  /** Finance module — invoices, bills, budget alerts */
  FINANCE:  'finance',
  /** Calendar / schedule system — upcoming events */
  CALENDAR: 'calendar',
  /** Health metrics system — log reminders */
  HEALTH:   'health',
} as const;

export type PluginId = (typeof PLUGIN_IDS)[keyof typeof PLUGIN_IDS];

// ── INJECT ─────────────────────────────────────────────────────────────────────

/**
 * Inject a single quest suggestion from an external plugin.
 *
 * The suggestion is stored in `plugin_quest_suggestions` and will be picked
 * up by Quest Engine v2 on the next daily generation cycle.
 *
 * Returns the new suggestion `id` on success, or `null` on error.
 */
export async function injectPluginQuest(
  supabase: SupabaseClient,
  userId: string,
  suggestion: PluginQuestSuggestion
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('plugin_quest_suggestions')
    .insert({
      user_id:     userId,
      plugin_id:   suggestion.plugin_id,
      title:       suggestion.title,
      description: suggestion.description,
      icon:        suggestion.icon,
      category:    suggestion.category,
      reward_xp:   suggestion.reward_xp,
      priority:    suggestion.priority,
      metadata:    suggestion.metadata,
      expires_at:  suggestion.expires_at ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error('[plugin-hooks] injectPluginQuest failed:', error.message);
    return null;
  }

  return data ? { id: data.id as string } : null;
}

/**
 * Inject multiple quest suggestions in a single DB round-trip.
 * Useful for syncing a batch of events at once (e.g., end-of-day job summary).
 *
 * @returns Number of suggestions successfully inserted
 */
export async function injectPluginQuestBatch(
  supabase: SupabaseClient,
  userId: string,
  suggestions: PluginQuestSuggestion[]
): Promise<number> {
  if (suggestions.length === 0) return 0;

  const rows = suggestions.map(s => ({
    user_id:     userId,
    plugin_id:   s.plugin_id,
    title:       s.title,
    description: s.description,
    icon:        s.icon,
    category:    s.category,
    reward_xp:   s.reward_xp,
    priority:    s.priority,
    metadata:    s.metadata,
    expires_at:  s.expires_at ?? null,
  }));

  const { data, error } = await supabase
    .from('plugin_quest_suggestions')
    .insert(rows)
    .select('id');

  if (error) {
    logger.error('[plugin-hooks] injectPluginQuestBatch failed:', error.message);
    return 0;
  }

  return data?.length ?? 0;
}

// ── READ ───────────────────────────────────────────────────────────────────────

/**
 * Return all unconsumed plugin suggestions for a user.
 * Optionally filter to a specific plugin.
 *
 * Useful for previewing what will appear on the next quest generation cycle.
 */
export async function getPendingPluginQuests(
  supabase: SupabaseClient,
  userId: string,
  pluginId?: string
): Promise<PluginQuestRecord[]> {
  let query = supabase
    .from('plugin_quest_suggestions')
    .select('*')
    .eq('user_id', userId)
    .is('consumed_at', null)
    .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
    .order('created_at', { ascending: false });

  if (pluginId) {
    query = query.eq('plugin_id', pluginId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('[plugin-hooks] getPendingPluginQuests failed:', error.message);
    return [];
  }

  return (data ?? []) as PluginQuestRecord[];
}

// ── DISMISS ────────────────────────────────────────────────────────────────────

/**
 * Dismiss (mark as consumed) a suggestion without creating a quest from it.
 * Call this when the user explicitly declines a plugin suggestion.
 */
export async function dismissPluginQuest(
  supabase: SupabaseClient,
  suggestionId: string
): Promise<void> {
  const { error } = await supabase
    .from('plugin_quest_suggestions')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', suggestionId);

  if (error) {
    logger.error('[plugin-hooks] dismissPluginQuest failed:', error.message);
  }
}

// ── CONVENIENCE BUILDERS ───────────────────────────────────────────────────────

/**
 * Pre-built suggestion factory for TCS job invoicing.
 * Call after a cleaning job is logged to prompt the user to invoice the client.
 */
export function buildTCSInvoiceQuest(opts: {
  clientName: string;
  amount: number;
  jobDate: string;
  jobId?: string;
}): PluginQuestSuggestion {
  return {
    plugin_id:   PLUGIN_IDS.TCS,
    title:       `Invoice: ${opts.clientName} clean`,
    description: `$${opts.amount.toFixed(2)} job on ${opts.jobDate} — send invoice now`,
    icon:        '🧹',
    category:    'finance',
    reward_xp:   75,
    priority:    'high',
    metadata: {
      client:   opts.clientName,
      amount:   opts.amount,
      job_date: opts.jobDate,
      job_id:   opts.jobId ?? null,
    },
  };
}

/**
 * Pre-built suggestion factory for Shopify order fulfilment.
 */
export function buildShopifyFulfilmentQuest(opts: {
  orderId: string;
  amount: number;
}): PluginQuestSuggestion {
  return {
    plugin_id:   PLUGIN_IDS.SHOPIFY,
    title:       `Fulfil order #${opts.orderId}`,
    description: `Order for $${opts.amount.toFixed(2)} awaiting fulfilment`,
    icon:        '📦',
    category:    'productivity',
    reward_xp:   50,
    priority:    'high',
    metadata: {
      order_id: opts.orderId,
      amount:   opts.amount,
    },
  };
}

/**
 * Pre-built suggestion for a finance alert (e.g., overdue invoice or bill).
 */
export function buildFinanceAlertQuest(opts: {
  alertType: 'overdue_invoice' | 'budget_exceeded' | 'bill_due';
  label: string;
  amount?: number;
}): PluginQuestSuggestion {
  const titles: Record<typeof opts.alertType, string> = {
    overdue_invoice:  `Send overdue invoice: ${opts.label}`,
    budget_exceeded:  `Review overspend: ${opts.label}`,
    bill_due:         `Pay upcoming bill: ${opts.label}`,
  };
  const icons: Record<typeof opts.alertType, string> = {
    overdue_invoice:  '💰',
    budget_exceeded:  '📊',
    bill_due:         '💳',
  };

  return {
    plugin_id:   PLUGIN_IDS.FINANCE,
    title:       titles[opts.alertType],
    description: opts.amount ? `Amount: $${opts.amount.toFixed(2)}` : 'Tap to review',
    icon:        icons[opts.alertType],
    category:    'finance',
    reward_xp:   60,
    priority:    opts.alertType === 'overdue_invoice' ? 'urgent' : 'high',
    metadata: {
      alert_type: opts.alertType,
      label:      opts.label,
      amount:     opts.amount ?? null,
    },
  };
}

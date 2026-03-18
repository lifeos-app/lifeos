/**
 * LifeOS Plugin Registry
 *
 * Central registry for all external-system plugins.
 * Plugins self-register; the registry routes incoming events to the right handler.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PluginConfig, PluginEvent, PluginEventResult } from './types';
import { logger } from '../../utils/logger';

// ── REGISTRY ───────────────────────────────────────────────────────────────────

const _registry = new Map<string, PluginConfig>();

/**
 * Register a plugin with the system.
 * Call this at app startup (or lazily on first use).
 * Re-registering the same id overwrites the previous config.
 */
export function registerPlugin(config: PluginConfig): void {
  _registry.set(config.id, config);
}

/**
 * Look up a registered plugin by id.
 * Returns `undefined` if the plugin is not registered.
 */
export function getPlugin(id: string): PluginConfig | undefined {
  return _registry.get(id);
}

/**
 * List all registered plugins (in registration order).
 */
export function listPlugins(): PluginConfig[] {
  return Array.from(_registry.values());
}

/**
 * Route a PluginEvent to its registered handler.
 *
 * Flow:
 *  1. Look up the plugin config by `event.plugin_id`
 *  2. Find the handler for `event.event_type`
 *  3. Call the handler with the event + supabase client
 *  4. Return the PluginEventResult
 *
 * Errors are caught and returned as a failed result so the caller
 * can log them without crashing.
 */
export async function processEvent(
  event: PluginEvent,
  supabase: SupabaseClient
): Promise<PluginEventResult> {
  const plugin = _registry.get(event.plugin_id);

  if (!plugin) {
    logger.warn(`[plugin-registry] Unknown plugin: ${event.plugin_id}`);
    return {
      xp_awarded: 0,
      quest_completed: false,
      income_logged: false,
      actions: [`No plugin registered for "${event.plugin_id}"`],
    };
  }

  if (!plugin.enabled) {
    return {
      xp_awarded: 0,
      quest_completed: false,
      income_logged: false,
      actions: [`Plugin "${plugin.name}" is disabled`],
    };
  }

  const handler = plugin.event_handlers[event.event_type];

  if (!handler) {
    logger.warn(
      `[plugin-registry] Plugin "${event.plugin_id}" has no handler for "${event.event_type}"`
    );
    return {
      xp_awarded: 0,
      quest_completed: false,
      income_logged: false,
      actions: [`No handler for event type "${event.event_type}" in plugin "${plugin.name}"`],
    };
  }

  try {
    const result = await handler(event, supabase);

    // Log the event to the database
    await supabase.from('plugin_events').insert({
      plugin_id:  event.plugin_id,
      user_id:    event.user_id,
      event_type: event.event_type,
      data:       event.data,
      result:     result as unknown as Record<string, unknown>,
      processed:  true,
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[plugin-registry] Handler error (${event.plugin_id}/${event.event_type}):`, message);

    // Log failed event (best-effort — ignore errors)
    supabase.from('plugin_events').insert({
      plugin_id:  event.plugin_id,
      user_id:    event.user_id,
      event_type: event.event_type,
      data:       event.data,
      result:     { error: message },
      processed:  false,
    }).then(() => { /* best-effort */ }, () => { /* ignore */ });

    return {
      xp_awarded: 0,
      quest_completed: false,
      income_logged: false,
      actions: [`Error processing event: ${message}`],
    };
  }
}

// ── ACTIVITY HELPERS ───────────────────────────────────────────────────────────

/**
 * Write a single entry to the plugin_activity feed.
 * This is a shared helper used by multiple plugin handlers.
 */
export async function logPluginActivity(
  supabase: SupabaseClient,
  opts: {
    user_id: string;
    plugin_id: string;
    title: string;
    description?: string;
    icon?: string;
    xp_earned?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await supabase.from('plugin_activity').insert({
    user_id:     opts.user_id,
    plugin_id:   opts.plugin_id,
    title:       opts.title,
    description: opts.description ?? null,
    icon:        opts.icon ?? null,
    xp_earned:   opts.xp_earned ?? 0,
    metadata:    opts.metadata ?? {},
  });

  if (error) {
    logger.error('[plugin-registry] logPluginActivity failed:', error.message);
  }
}

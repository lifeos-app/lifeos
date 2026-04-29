/**
 * LifeOS Lightweight Plugin System (P7-011)
 *
 * Client-side plugin registration and lifecycle management.
 * Allows future extensions to register capabilities without modifying core code.
 *
 * Lifecycle: register → activate → (running) → deactivate → unregister
 * Persistence: localStorage (lifeos_plugins / lifeos_plugin_settings)
 * Communication: pluginEventBus (on/off/emit)
 */

import { logger } from '../utils/logger';

// ── TYPES ──────────────────────────────────────────────────────────────────────

export interface HookRegistration {
  /** Event name to listen for */
  event: string;
  /** Handler function invoked when the event fires */
  handler: (...args: any[]) => void;
  /** Lower priority numbers run first (default: 100) */
  priority?: number;
}

export interface SettingDefinition {
  /** Unique key for this setting within the plugin */
  key: string;
  /** Human-readable label */
  label: string;
  /** UI control type */
  type: 'toggle' | 'select' | 'text';
  /** Default value */
  default: boolean | string;
  /** Options for 'select' type */
  options?: { value: string; label: string }[];
}

export interface PluginManifest {
  /** Unique plugin identifier (kebab-case) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semantic version */
  version: string;
  /** Short description */
  description: string;
  /** Author name */
  author: string;
  /** Lucide icon name (rendered by UI) */
  icon: string;
  /** Optional route this plugin provides */
  route?: string;
  /** Event hooks this plugin listens to */
  hooks?: HookRegistration[];
  /** Plugin-specific settings definitions */
  settings?: SettingDefinition[];
}

type PluginLifecycleState = 'registered' | 'active' | 'inactive';

interface PluginEntry {
  manifest: PluginManifest;
  state: PluginLifecycleState;
}

// ── EVENT BUS ──────────────────────────────────────────────────────────────────

type EventBusListener = (...args: any[]) => void;

interface EventBusSubscription {
  event: string;
  listener: EventBusListener;
}

const _busListeners = new Map<string, Set<EventBusListener>>();

export const pluginEventBus = {
  /**
   * Subscribe to a plugin event.
   * Returns an unsubscribe function.
   */
  on(event: string, listener: EventBusListener): () => void {
    if (!_busListeners.has(event)) {
      _busListeners.set(event, new Set());
    }
    _busListeners.get(event)!.add(listener);
    return () => {
      _busListeners.get(event)?.delete(listener);
    };
  },

  /**
   * Unsubscribe from a plugin event.
   */
  off(event: string, listener: EventBusListener): void {
    _busListeners.get(event)?.delete(listener);
  },

  /**
   * Emit a plugin event to all listeners.
   */
  emit(event: string, ...args: any[]): void {
    const listeners = _busListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(...args);
        } catch (err) {
          logger.error(`[plugin-event-bus] Error in listener for "${event}":`, err);
        }
      }
    }
  },
};

// ── PERSISTENCE HELPERS ────────────────────────────────────────────────────────

const STORAGE_KEY_PLUGINS = 'lifeos_plugins';
const STORAGE_KEY_SETTINGS = 'lifeos_plugin_settings';

function loadPersistedState(): Record<string, PluginLifecycleState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLUGINS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, PluginLifecycleState>;
      }
    }
  } catch { /* corrupt data — reset */ }
  return {};
}

function persistState(state: Record<string, PluginLifecycleState>): void {
  try {
    localStorage.setItem(STORAGE_KEY_PLUGINS, JSON.stringify(state));
  } catch { /* Safari private mode */ }
}

function loadPersistedSettings(): Record<string, Record<string, any>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, Record<string, any>>;
      }
    }
  } catch { /* corrupt data — reset */ }
  return {};
}

function persistSettings(settings: Record<string, Record<string, any>>): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch { /* Safari private mode */ }
}

// ── PLUGIN REGISTRY ────────────────────────────────────────────────────────────

class PluginRegistry {
  private _plugins = new Map<string, PluginEntry>();
  private _hookSubscriptions = new Map<string, Array<() => void>>(); // pluginId -> cleanup fns
  private _persistedState: Record<string, PluginLifecycleState>;
  private _persistedSettings: Record<string, Record<string, any>>;

  constructor() {
    this._persistedState = loadPersistedState();
    this._persistedSettings = loadPersistedSettings();
  }

  /**
   * Register a plugin manifest.
   * The plugin starts in the 'registered' state.
   * If the plugin was previously active (persisted), it auto-activates.
   */
  register(manifest: PluginManifest): void {
    const existing = this._plugins.get(manifest.id);
    if (existing) {
      // Deactivate old hooks before overwriting
      if (existing.state === 'active') {
        this._detachHooks(manifest.id);
      }
    }

    const persistedState = this._persistedState[manifest.id];
    const entry: PluginEntry = {
      manifest,
      state: persistedState === 'active' ? 'inactive' : (persistedState ?? 'inactive'),
    };

    this._plugins.set(manifest.id, entry);

    // If previously active, reactivate
    if (persistedState === 'active') {
      this.activate(manifest.id);
    }

    pluginEventBus.emit('plugin:registered', { id: manifest.id });
    logger.info(`[plugin-system] Registered: ${manifest.id} v${manifest.version}`);
  }

  /**
   * Unregister a plugin (deactivates first).
   */
  unregister(pluginId: string): void {
    const entry = this._plugins.get(pluginId);
    if (!entry) return;

    if (entry.state === 'active') {
      this.deactivate(pluginId);
    }

    this._plugins.delete(pluginId);
    delete this._persistedState[pluginId];
    persistState(this._persistedState);

    pluginEventBus.emit('plugin:unregistered', { id: pluginId });
    logger.info(`[plugin-system] Unregistered: ${pluginId}`);
  }

  /**
   * Get a plugin manifest by ID.
   */
  getPlugin(id: string): PluginManifest | undefined {
    return this._plugins.get(id)?.manifest;
  }

  /**
   * Get all registered plugin manifests.
   */
  getAllPlugins(): PluginManifest[] {
    return Array.from(this._plugins.values()).map(e => e.manifest);
  }

  /**
   * Check if a plugin is registered.
   */
  isRegistered(id: string): boolean {
    return this._plugins.has(id);
  }

  /**
   * Check if a plugin is active.
   */
  isActive(id: string): boolean {
    return this._plugins.get(id)?.state === 'active';
  }

  /**
   * Get the lifecycle state of a plugin.
   */
  getState(id: string): PluginLifecycleState | undefined {
    return this._plugins.get(id)?.state;
  }

  /**
   * Activate a registered plugin.
   * Attaches event hooks and marks the plugin as active.
   */
  activate(pluginId: string): boolean {
    const entry = this._plugins.get(pluginId);
    if (!entry) {
      logger.warn(`[plugin-system] Cannot activate unknown plugin: ${pluginId}`);
      return false;
    }

    if (entry.state === 'active') return true; // already active

    entry.state = 'active';
    this._persistedState[pluginId] = 'active';
    persistState(this._persistedState);

    // Attach hooks
    this._attachHooks(pluginId);

    pluginEventBus.emit('plugin:activated', { id: pluginId });
    logger.info(`[plugin-system] Activated: ${pluginId}`);
    return true;
  }

  /**
   * Deactivate an active plugin.
   * Detaches event hooks and marks the plugin as inactive.
   */
  deactivate(pluginId: string): boolean {
    const entry = this._plugins.get(pluginId);
    if (!entry) return false;

    if (entry.state !== 'active') return true; // already inactive

    entry.state = 'inactive';
    this._persistedState[pluginId] = 'inactive';
    persistState(this._persistedState);

    // Detach hooks
    this._detachHooks(pluginId);

    pluginEventBus.emit('plugin:deactivated', { id: pluginId });
    logger.info(`[plugin-system] Deactivated: ${pluginId}`);
    return true;
  }

  /**
   * Toggle a plugin's active state.
   */
  toggle(pluginId: string): boolean {
    const entry = this._plugins.get(pluginId);
    if (!entry) return false;
    if (entry.state === 'active') {
      return this.deactivate(pluginId);
    } else {
      return this.activate(pluginId);
    }
  }

  /**
   * Find plugins that listen for a specific hook event.
   */
  getPluginsByHook(event: string): PluginManifest[] {
    const result: PluginManifest[] = [];
    for (const entry of this._plugins.values()) {
      if (entry.manifest.hooks?.some(h => h.event === event)) {
        result.push(entry.manifest);
      }
    }
    return result;
  }

  /**
   * Get plugin settings (merged with defaults).
   */
  getPluginSettings(id: string): Record<string, any> {
    const manifest = this._plugins.get(id)?.manifest;
    if (!manifest) return {};

    // Start with defaults
    const defaults: Record<string, any> = {};
    if (manifest.settings) {
      for (const s of manifest.settings) {
        defaults[s.key] = s.default;
      }
    }

    // Merge with persisted values
    const persisted = this._persistedSettings[id] ?? {};
    return { ...defaults, ...persisted };
  }

  /**
   * Update plugin settings (partial merge).
   */
  updatePluginSettings(id: string, patch: Record<string, any>): void {
    const current = this._persistedSettings[id] ?? {};
    this._persistedSettings[id] = { ...current, ...patch };
    persistSettings(this._persistedSettings);

    pluginEventBus.emit('plugin:settings-updated', { id, patch });
    logger.info(`[plugin-system] Settings updated for ${id}:`, Object.keys(patch).join(', '));
  }

  // ── INTERNAL ──────────────────────────────────────────────────────────────

  private _attachHooks(pluginId: string): void {
    const entry = this._plugins.get(pluginId);
    if (!entry?.manifest.hooks) return;

    const cleanups: Array<() => void> = [];

    // Sort hooks by priority (lower = earlier)
    const sorted = [...entry.manifest.hooks].sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
    );

    for (const hook of sorted) {
      const unsub = pluginEventBus.on(hook.event, hook.handler);
      cleanups.push(unsub);
    }

    this._hookSubscriptions.set(pluginId, cleanups);
  }

  private _detachHooks(pluginId: string): void {
    const cleanups = this._hookSubscriptions.get(pluginId);
    if (!cleanups) return;

    for (const cleanup of cleanups) {
      cleanup();
    }
    this._hookSubscriptions.delete(pluginId);
  }
}

// ── SINGLETON ─────────────────────────────────────────────────────────────────

export const pluginRegistry = new PluginRegistry();

// ── BUILT-IN PLUGINS ──────────────────────────────────────────────────────────

const BUILT_IN_PLUGINS: PluginManifest[] = [
  {
    id: 'focus-mode',
    name: 'Focus Mode',
    version: '1.0.0',
    description: 'Pomodoro timer overlay for deep work sessions — 25 min focus, 5 min break.',
    author: 'LifeOS',
    icon: 'Timer',
    route: '/focus',
    hooks: [
      { event: 'timer:start', handler: (...args: any[]) => { pluginEventBus.emit('focus-mode:start', args[0]); }, priority: 10 },
      { event: 'timer:complete', handler: (...args: any[]) => { pluginEventBus.emit('focus-mode:complete', args[0]); }, priority: 10 },
    ],
    settings: [
      { key: 'work_duration', label: 'Work Duration (min)', type: 'select', default: '25', options: [
        { value: '15', label: '15 min' },
        { value: '25', label: '25 min' },
        { value: '45', label: '45 min' },
        { value: '60', label: '60 min' },
      ]},
      { key: 'break_duration', label: 'Break Duration (min)', type: 'select', default: '5', options: [
        { value: '3', label: '3 min' },
        { value: '5', label: '5 min' },
        { value: '10', label: '10 min' },
        { value: '15', label: '15 min' },
      ]},
      { key: 'auto_start', label: 'Auto-start next session', type: 'toggle', default: false },
    ],
  },
  {
    id: 'breathwork',
    name: 'Breathwork',
    version: '1.0.0',
    description: 'Box breathing guide — 4-4-4-4 pattern for calm and focus.',
    author: 'LifeOS',
    icon: 'Wind',
    route: '/breathwork',
    hooks: [
      { event: 'stress:detected', handler: () => { pluginEventBus.emit('breathwork:suggest'); }, priority: 50 },
    ],
    settings: [
      { key: 'inhale', label: 'Inhale (sec)', type: 'select', default: '4', options: [
        { value: '3', label: '3 sec' },
        { value: '4', label: '4 sec' },
        { value: '5', label: '5 sec' },
        { value: '6', label: '6 sec' },
      ]},
      { key: 'hold', label: 'Hold (sec)', type: 'select', default: '4', options: [
        { value: '3', label: '3 sec' },
        { value: '4', label: '4 sec' },
        { value: '5', label: '5 sec' },
        { value: '6', label: '6 sec' },
      ]},
      { key: 'cycles', label: 'Number of cycles', type: 'select', default: '4', options: [
        { value: '3', label: '3 cycles' },
        { value: '4', label: '4 cycles' },
        { value: '6', label: '6 cycles' },
        { value: '8', label: '8 cycles' },
      ]},
      { key: 'sound', label: 'Sound cues', type: 'toggle', default: true },
    ],
  },
  {
    id: 'daily-quote',
    name: 'Daily Quote',
    version: '1.0.0',
    description: 'Quote of the day from Holy Hermes — daily wisdom and inspiration.',
    author: 'LifeOS',
    icon: 'Quote',
    hooks: [
      { event: 'dashboard:loaded', handler: () => { pluginEventBus.emit('daily-quote:show'); }, priority: 100 },
    ],
    settings: [
      { key: 'category', label: 'Quote category', type: 'select', default: 'wisdom', options: [
        { value: 'wisdom', label: 'Wisdom' },
        { value: 'motivation', label: 'Motivation' },
        { value: 'stoicism', label: 'Stoicism' },
        { value: 'humor', label: 'Humor' },
      ]},
      { key: 'show_on_dashboard', label: 'Show on dashboard', type: 'toggle', default: true },
    ],
  },
];

/**
 * Register all built-in plugins.
 * Called once at app startup.
 */
export function registerBuiltinPlugins(): void {
  for (const manifest of BUILT_IN_PLUGINS) {
    if (!pluginRegistry.isRegistered(manifest.id)) {
      pluginRegistry.register(manifest);
    }
  }
}
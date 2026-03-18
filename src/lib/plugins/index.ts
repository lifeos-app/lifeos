/**
 * LifeOS Plugin System — Barrel Export
 *
 * Import everything from here:
 *   import { registerPlugin, processEvent } from '../lib/plugins';
 */

// Types
export type {
  PluginEvent,
  PluginConfig,
  PluginEventHandler,
  PluginEventResult,
  PluginActivityRow,
} from './types';

// Registry
export {
  registerPlugin,
  getPlugin,
  listPlugins,
  processEvent,
  logPluginActivity,
} from './plugin-registry';

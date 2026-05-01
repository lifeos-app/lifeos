/**
 * Plugin Marketplace — Barrel Export
 *
 * Discover, install, manage, and create plugins for LifeOS.
 * Junctions, Academy courses, dashboard widgets, Realm skins,
 * AI personas, integrations, and themes.
 */

export { PluginMarketplace } from './PluginMarketplace';
export { PluginCard } from './PluginCard';
export { PluginDetail } from './PluginDetail';
export { InstalledPlugins } from './InstalledPlugins';
export { PluginCreator } from './PluginCreator';
export {
  usePluginMarketplace,
  PLUGIN_CATEGORIES,
} from './usePluginMarketplace';
export type {
  MarketplacePlugin,
  InstalledPlugin,
  PluginCategory,
  MarketplaceTab,
  PluginAuthor,
} from '../../stores/marketplaceStore';
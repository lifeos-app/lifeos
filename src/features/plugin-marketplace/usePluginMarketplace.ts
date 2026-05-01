/**
 * usePluginMarketplace — Core hook for plugin discovery, installation, and lifecycle
 *
 * Wraps the Zustand marketplaceStore with convenience methods and derived state.
 * Also bridges to the existing plugin-system registry for installed plugins.
 */

import { useMemo, useCallback } from 'react';
import {
  useMarketplaceStore,
  type MarketplacePlugin,
  type InstalledPlugin,
  type PluginCategory,
  type MarketplaceTab,
  type PluginAuthor,
  PLUGIN_CATEGORIES,
} from '../../stores/marketplaceStore';
import { registerPlugin } from '../../lib/plugins';

// ── DERIVED DATA ────────────────────────────────────────────────────────────

export function usePluginMarketplace() {
  const store = useMarketplaceStore();

  // ── Catalog & Filtering ──────────────────────────────────────────────────

  const filteredCatalog = useMemo(
    () => store.getFilteredCatalog(),
    [store.catalog, store.activeTab, store.searchQuery, store.selectedCategory, store.selectedTags]
  );

  const allTags = useMemo(
    () => {
      const tagSet = new Set<string>();
      store.catalog.forEach(p => p.tags.forEach(t => tagSet.add(t)));
      return Array.from(tagSet).sort();
    },
    [store.catalog]
  );

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    totalPlugins: store.catalog.length,
    installedCount: store.installed.length,
    updatesAvailable: store.installed.filter(p => store.isUpdateAvailable(p.id)).length,
    enabledCount: store.installed.filter(p => p.enabled).length,
  }), [store.catalog.length, store.installed, store.installed.length]);

  // ── Actions (wrapped) ────────────────────────────────────────────────────

  const installAndRegister = useCallback(async (plugin: MarketplacePlugin) => {
    await store.installPlugin(plugin);

    // Also register with the existing plugin system registry
    registerPlugin({
      id: plugin.id,
      name: plugin.name,
      icon: plugin.icon,
      color: PLUGIN_CATEGORIES.find(c => c.id === plugin.category)?.color ?? '#64748B',
      description: plugin.description,
      enabled: true,
      event_handlers: {}, // Marketplace plugins may not have event handlers
    });
  }, [store.installPlugin]);

  const uninstallAndUnregister = useCallback((id: string) => {
    store.uninstallPlugin(id);
    // Note: The existing plugin-registry doesn't have an unregister fn —
    // in practice it would be disabled. We track that via enabled flag in our store.
  }, [store.uninstallPlugin]);

  const getByCategory = useCallback((category: PluginCategory) => {
    return store.catalog.filter(p => p.category === category);
  }, [store.catalog]);

  const getFeatured = useCallback(() => {
    return store.catalog.filter(p => p.featured);
  }, [store.catalog]);

  const getRelatedPlugins = useCallback((pluginId: string) => {
    const plugin = store.catalog.find(p => p.id === pluginId);
    if (!plugin) return [];
    return store.catalog
      .filter(p => p.id !== pluginId && (p.category === plugin.category || p.tags.some(t => plugin.tags.includes(t))))
      .slice(0, 4);
  }, [store.catalog]);

  const formatInstallCount = useCallback((count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return String(count);
  }, []);

  return {
    // State
    catalog: store.catalog,
    installed: store.installed,
    activeTab: store.activeTab,
    searchQuery: store.searchQuery,
    selectedCategory: store.selectedCategory,
    selectedTags: store.selectedTags,
    detailPluginId: store.detailPluginId,
    installingIds: store.installingIds,
    catalogLoading: store.catalogLoading,
    filteredCatalog,
    allTags,
    stats,
    categories: PLUGIN_CATEGORIES,

    // Actions
    setActiveTab: store.setActiveTab,
    setSearchQuery: store.setSearchQuery,
    setSelectedCategory: store.setSelectedCategory,
    toggleTag: store.toggleTag,
    clearFilters: store.clearFilters,
    setDetailPluginId: store.setDetailPluginId,
    installPlugin: installAndRegister,
    uninstallPlugin: uninstallAndUnregister,
    toggleEnabled: store.toggleEnabled,
    updatePluginSetting: store.updatePluginSetting,
    updatePlugin: store.updatePlugin,

    // Selectors
    getInstalledPlugin: store.getInstalledPlugin,
    isInstalled: store.isInstalled,
    isUpdateAvailable: store.isUpdateAvailable,
    getByCategory,
    getFeatured,
    getRelatedPlugins,
    formatInstallCount,
    getTotalStorageUsage: store.getTotalStorageUsage,
  };
}

// ── RE-EXPORT TYPES ───────────────────────────────────────────────────────────

export type { MarketplacePlugin, InstalledPlugin, PluginCategory, MarketplaceTab, PluginAuthor };
export { PLUGIN_CATEGORIES };
/**
 * PluginMarketplace — Main marketplace page
 *
 * Featured/Popular/New/Rising tab navigation, search with tag-based filtering,
 * category grid, plugin cards grid, and detail view navigation.
 */

import { useState } from 'react';
import { usePluginMarketplace } from './usePluginMarketplace';
import { PluginCard } from './PluginCard';
import { PluginDetail } from './PluginDetail';
import { PLUGIN_CATEGORIES, type PluginCategory, type MarketplaceTab } from '../../stores/marketplaceStore';

// ── TABS ─────────────────────────────────────────────────────────────────────

const TABS: { id: MarketplaceTab; label: string; icon: string }[] = [
  { id: 'featured', label: 'Featured', icon: '⭐' },
  { id: 'popular',  label: 'Popular',  icon: '🔥' },
  { id: 'new',      label: 'New',      icon: '✨' },
  { id: 'rising',   label: 'Rising',   icon: '📈' },
];

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function PluginMarketplace() {
  const {
    activeTab, setActiveTab,
    searchQuery, setSearchQuery,
    selectedCategory, setSelectedCategory,
    selectedTags, toggleTag, clearFilters,
    filteredCatalog, allTags,
    stats, categories,
    detailPluginId, setDetailPluginId,
    catalog,
    installPlugin,
  } = usePluginMarketplace();

  const [showAllTags, setShowAllTags] = useState(false);

  // Find the detail plugin
  const detailPlugin = detailPluginId
    ? catalog.find(p => p.id === detailPluginId)
    : null;

  // If viewing a detail page
  if (detailPlugin) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <PluginDetail
          plugin={detailPlugin}
          onBack={() => setDetailPluginId(null)}
        />
      </div>
    );
  }

  const hasActiveFilters = searchQuery || selectedCategory || selectedTags.length > 0;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl md:text-3xl font-bold mb-1"
          style={{
            background: 'linear-gradient(135deg, #00D4FF, #A855F7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Plugin Marketplace
        </h1>
        <p className="text-sm" style={{ color: '#94A3B8' }}>
          Discover and install plugins to enhance your LifeOS experience
        </p>
      </div>

      {/* Stats bar */}
      <div
        className="flex items-center gap-6 mb-6 p-4"
        style={{
          backgroundColor: '#111827',
          border: '1px solid #1E293B',
          borderRadius: '12px',
        }}
      >
        <div className="text-center">
          <div className="text-xl font-bold" style={{ color: '#00D4FF' }}>{stats.totalPlugins}</div>
          <div className="text-xs" style={{ color: '#64748B' }}>Available</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold" style={{ color: '#39FF14' }}>{stats.installedCount}</div>
          <div className="text-xs" style={{ color: '#64748B' }}>Installed</div>
        </div>
        {stats.updatesAvailable > 0 && (
          <div className="text-center">
            <div className="text-xl font-bold" style={{ color: '#FACC15' }}>{stats.updatesAvailable}</div>
            <div className="text-xs" style={{ color: '#64748B' }}>Updates</div>
          </div>
        )}
      </div>

      {/* Search & Filters */}
      <div className="mb-6 space-y-4">
        {/* Search bar */}
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-lg"
            style={{ color: '#64748B' }}
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="Search plugins by name, description, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 text-sm"
            style={{
              backgroundColor: '#111827',
              border: '1px solid #1E293B',
              borderRadius: '10px',
              color: '#F1F5F9',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = '#00D4FF'}
            onBlur={(e) => e.target.style.borderColor = '#1E293B'}
          />
          {hasActiveFilters && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs"
              style={{
                backgroundColor: 'rgba(244,63,94,0.15)',
                color: '#F43F5E',
                border: '1px solid rgba(244,63,94,0.3)',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={clearFilters}
            >
              Clear All
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-1.5 text-sm"
            style={{
              backgroundColor: selectedCategory === null ? 'rgba(0,212,255,0.2)' : '#1E293B',
              color: selectedCategory === null ? '#00D4FF' : '#94A3B8',
              border: `1px solid ${selectedCategory === null ? 'rgba(0,212,255,0.4)' : '#334155'}`,
              borderRadius: '8px',
              cursor: 'pointer',
            }}
            onClick={() => setSelectedCategory(null)}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className="px-3 py-1.5 text-sm flex items-center gap-1.5"
              style={{
                backgroundColor: selectedCategory === cat.id ? `${cat.color}20` : '#1E293B',
                color: selectedCategory === cat.id ? cat.color : '#94A3B8',
                border: `1px solid ${selectedCategory === cat.id ? `${cat.color}40` : '#334155'}`,
                borderRadius: '8px',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Tag filters (expandable) */}
        {allTags.length > 0 && (
          <div>
            <button
              className="text-xs mb-2"
              style={{ color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}
              onClick={() => setShowAllTags(!showAllTags)}
            >
              {showAllTags ? '▲ Hide tags' : '▼ Filter by tags'}
            </button>
            {showAllTags && (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    className="px-2 py-1 text-xs"
                    style={{
                      backgroundColor: selectedTags.includes(tag) ? 'rgba(0,212,255,0.2)' : '#111827',
                      color: selectedTags.includes(tag) ? '#00D4FF' : '#64748B',
                      border: `1px solid ${selectedTags.includes(tag) ? 'rgba(0,212,255,0.4)' : '#1E293B'}`,
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                    onClick={() => toggleTag(tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div
        className="flex gap-1 mb-6 p-1"
        style={{
          backgroundColor: '#111827',
          borderRadius: '10px',
          border: '1px solid #1E293B',
        }}
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            className="flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5"
            style={{
              backgroundColor: activeTab === tab.id ? '#1E293B' : 'transparent',
              color: activeTab === tab.id ? '#F1F5F9' : '#64748B',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: '#64748B' }}>
          {filteredCatalog.length} plugin{filteredCatalog.length !== 1 ? 's' : ''}
          {selectedCategory && ` in ${categories.find(c => c.id === selectedCategory)?.label}`}
        </p>
      </div>

      {/* Plugin grid */}
      {filteredCatalog.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16"
          style={{ color: '#64748B' }}
        >
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-lg font-semibold mb-1" style={{ color: '#94A3B8' }}>No plugins found</div>
          <div className="text-sm">Try adjusting your search or filters</div>
          <button
            className="mt-4 px-4 py-2 text-sm"
            style={{
              backgroundColor: 'rgba(0,212,255,0.15)',
              color: '#00D4FF',
              border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
            onClick={clearFilters}
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCatalog.map(plugin => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              onClick={() => setDetailPluginId(plugin.id)}
            />
          ))}
        </div>
      )}

      {/* Browse by category section (shown when no filters active) */}
      {!hasActiveFilters && activeTab === 'featured' && (
        <div className="mt-10">
          <h2
            className="text-xl font-bold mb-5"
            style={{ color: '#F1F5F9' }}
          >
            Browse by Category
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map(cat => {
              const count = catalog.filter(p => p.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  className="p-4 text-left"
                  style={{
                    backgroundColor: '#111827',
                    border: '1px solid #1E293B',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${cat.color}50`;
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = `0 4px 20px ${cat.color}15`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#1E293B';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <div className="text-3xl mb-2">{cat.icon}</div>
                  <div className="text-sm font-semibold" style={{ color: cat.color }}>{cat.label}</div>
                  <div className="text-xs mt-1" style={{ color: '#64748B' }}>{cat.description}</div>
                  <div className="text-xs mt-2" style={{ color: '#334155' }}>{count} plugin{count !== 1 ? 's' : ''}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
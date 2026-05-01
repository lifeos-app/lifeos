/**
 * InstalledPlugins — Plugin management page
 *
 * List of installed plugins with enable/disable toggle, update badges,
 * uninstall with confirmation, expandable settings, sorting, and storage usage.
 */

import { useState, useMemo } from 'react';
import { usePluginMarketplace } from './usePluginMarketplace';
import { type InstalledPlugin, type PluginSortKey, PLUGIN_CATEGORIES } from '../../stores/marketplaceStore';

// ── SORT OPTIONS ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: PluginSortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'installedAt', label: 'Install Date' },
];

// ── TOGGLE SWITCH ────────────────────────────────────────────────────────────

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
      style={{
        backgroundColor: enabled ? '#00D4FF' : '#334155',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
      onClick={onToggle}
      aria-label={enabled ? 'Disable plugin' : 'Enable plugin'}
    >
      <span
        className="inline-block h-4 w-4 rounded-full transition-transform"
        style={{
          backgroundColor: '#fff',
          transform: enabled ? 'translateX(16px)' : 'translateX(2px)',
        }}
      />
    </button>
  );
}

// ── INSTALLED PLUGIN ROW ─────────────────────────────────────────────────────

function InstalledPluginRow({
  plugin,
  onToggleEnabled,
  onUninstall,
  onUpdateAvailable,
  onOpenSettings,
  isSettingsOpen,
  onUpdatePluginSetting,
}: {
  plugin: InstalledPlugin;
  onToggleEnabled: () => void;
  onUninstall: () => void;
  onUpdateAvailable: boolean;
  onOpenSettings: () => void;
  isSettingsOpen: boolean;
  onUpdatePluginSetting: (key: string, value: unknown) => void;
}) {
  const [confirmUninstall, setConfirmUninstall] = useState(false);
  const catConfig = PLUGIN_CATEGORIES.find(c => c.id === plugin.category);

  return (
    <div
      className="mb-3"
      style={{
        backgroundColor: '#111827',
        border: `1px solid ${plugin.enabled ? '#1E293B' : '#1E293B80'}`,
        borderRadius: '12px',
        opacity: plugin.enabled ? 1 : 0.7,
        transition: 'all 0.2s ease',
      }}
    >
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div
            className="flex items-center justify-center text-2xl flex-shrink-0"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '10px',
              backgroundColor: `${catConfig?.color}15`,
              border: `1px solid ${catConfig?.color}30`,
            }}
          >
            {plugin.icon}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>
                {plugin.name}
              </h3>
              {!plugin.enabled && (
                <span
                  className="px-1.5 py-0.5 text-xs"
                  style={{ backgroundColor: 'rgba(244,63,94,0.15)', color: '#F43F5E', borderRadius: '3px' }}
                >
                  Disabled
                </span>
              )}
              {onUpdateAvailable && (
                <span
                  className="px-1.5 py-0.5 text-xs"
                  style={{ backgroundColor: 'rgba(0,212,255,0.15)', color: '#00D4FF', borderRadius: '3px' }}
                >
                  Update Available
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs" style={{ color: catConfig?.color ?? '#64748B' }}>
                {catConfig?.label}
              </span>
              <span style={{ color: '#334155' }}>•</span>
              <span className="text-xs" style={{ color: '#64748B' }}>v{plugin.version}</span>
              <span style={{ color: '#334155' }}>•</span>
              <span className="text-xs" style={{ color: '#64748B' }}>
                ★ {plugin.rating}
              </span>
            </div>
            <p
              className="text-xs mt-1"
              style={{
                color: '#94A3B8',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {plugin.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <ToggleSwitch enabled={plugin.enabled} onToggle={onToggleEnabled} />

            <button
              className="text-sm"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
              onClick={onOpenSettings}
              title="Plugin settings"
            >
              ⚙️
            </button>

            {confirmUninstall ? (
              <div className="flex items-center gap-1">
                <button
                  className="px-2 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: 'rgba(244,63,94,0.2)',
                    color: '#F43F5E',
                    border: '1px solid rgba(244,63,94,0.5)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  onClick={onUninstall}
                >
                  Confirm
                </button>
                <button
                  className="px-2 py-1 text-xs"
                  style={{
                    background: 'none',
                    border: '1px solid #334155',
                    color: '#94A3B8',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setConfirmUninstall(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="text-sm"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
                onClick={() => setConfirmUninstall(true)}
                title="Uninstall plugin"
              >
                🗑️
              </button>
            )}
          </div>
        </div>

        {/* Installed date */}
        <div className="mt-2 ml-16">
          <span className="text-xs" style={{ color: '#475569' }}>
            Installed {new Date(plugin.installedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Expandable settings */}
      {isSettingsOpen && (
        <div
          className="px-4 pb-4 pt-2 border-t"
          style={{ borderColor: '#1E293B' }}
        >
          <h4 className="text-sm font-semibold mb-2" style={{ color: '#F1F5F9' }}>Settings</h4>
          {Object.keys(plugin.settings).length === 0 ? (
            <p className="text-xs" style={{ color: '#64748B' }}>No configurable settings for this plugin.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(plugin.settings).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#CBD5E1' }}>{key}</span>
                  <ToggleSwitch
                    enabled={!!value}
                    onToggle={() => onUpdatePluginSetting(key, !value)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Permissions */}
          {plugin.permissions.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold mb-2" style={{ color: '#94A3B8' }}>Permissions</h4>
              <div className="flex flex-wrap gap-1.5">
                {plugin.permissions.map(p => (
                  <span
                    key={p}
                    className="px-1.5 py-0.5 text-xs"
                    style={{ backgroundColor: '#1E293B', color: '#64748B', borderRadius: '3px' }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

export function InstalledPlugins() {
  const {
    installed,
    toggleEnabled,
    uninstallPlugin,
    isUpdateAvailable,
    updatePluginSetting,
    getTotalStorageUsage,
    catalog,
  } = usePluginMarketplace();

  const [sortBy, setSortBy] = useState<PluginSortKey>('installedAt');
  const [openSettingsId, setOpenSettingsId] = useState<string | null>(null);
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');

  const sortedInstalled = useMemo(() => {
    let filtered = [...installed];

    // Enabled/disabled filter
    if (filterEnabled === 'enabled') {
      filtered = filtered.filter(p => p.enabled);
    } else if (filterEnabled === 'disabled') {
      filtered = filtered.filter(p => !p.enabled);
    }

    // Sort
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'category':
        filtered.sort((a, b) => a.category.localeCompare(b.category));
        break;
      case 'installedAt':
        filtered.sort((a, b) => new Date(b.installedAt).getTime() - new Date(a.installedAt).getTime());
        break;
    }

    return filtered;
  }, [installed, sortBy, filterEnabled]);

  const enabledCount = installed.filter(p => p.enabled).length;
  const disabledCount = installed.length - enabledCount;
  const updatesCount = installed.filter(p => isUpdateAvailable(p.id)).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl md:text-3xl font-bold mb-1"
          style={{ color: '#F1F5F9' }}
        >
          My Plugins
        </h1>
        <p className="text-sm" style={{ color: '#94A3B8' }}>
          Manage your installed plugins, updates, and settings
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
          <div className="text-xl font-bold" style={{ color: '#39FF14' }}>{enabledCount}</div>
          <div className="text-xs" style={{ color: '#64748B' }}>Enabled</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold" style={{ color: '#64748B' }}>{disabledCount}</div>
          <div className="text-xs" style={{ color: '#475569' }}>Disabled</div>
        </div>
        {updatesCount > 0 && (
          <div className="text-center">
            <div className="text-xl font-bold" style={{ color: '#FACC15' }}>{updatesCount}</div>
            <div className="text-xs" style={{ color: '#64748B' }}>Updates</div>
          </div>
        )}
        <div className="text-center ml-auto">
          <div className="text-xl font-bold" style={{ color: '#00D4FF' }}>{getTotalStorageUsage()}</div>
          <div className="text-xs" style={{ color: '#64748B' }}>Storage Used</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: '#64748B' }}>Sort by:</span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              className="px-2 py-1 text-xs"
              style={{
                backgroundColor: sortBy === opt.key ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: sortBy === opt.key ? '#00D4FF' : '#64748B',
                border: `1px solid ${sortBy === opt.key ? 'rgba(0,212,255,0.3)' : '#334155'}`,
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => setSortBy(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: '#64748B' }}>Show:</span>
          {(['all', 'enabled', 'disabled'] as const).map(filter => (
            <button
              key={filter}
              className="px-2 py-1 text-xs capitalize"
              style={{
                backgroundColor: filterEnabled === filter ? 'rgba(0,212,255,0.15)' : 'transparent',
                color: filterEnabled === filter ? '#00D4FF' : '#64748B',
                border: `1px solid ${filterEnabled === filter ? 'rgba(0,212,255,0.3)' : '#334155'}`,
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => setFilterEnabled(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Plugin list */}
      {sortedInstalled.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16"
          style={{ color: '#64748B' }}
        >
          <div className="text-4xl mb-3">📦</div>
          <div className="text-lg font-semibold mb-1" style={{ color: '#94A3B8' }}>No plugins installed</div>
          <div className="text-sm mb-4">Visit the Marketplace to discover plugins</div>
        </div>
      ) : (
        <div>
          {sortedInstalled.map(plugin => (
            <InstalledPluginRow
              key={plugin.id}
              plugin={plugin}
              onToggleEnabled={() => toggleEnabled(plugin.id)}
              onUninstall={() => uninstallPlugin(plugin.id)}
              onUpdateAvailable={isUpdateAvailable(plugin.id)}
              onOpenSettings={() =>
                setOpenSettingsId(openSettingsId === plugin.id ? null : plugin.id)
              }
              isSettingsOpen={openSettingsId === plugin.id}
              onUpdatePluginSetting={(key, value) =>
                updatePluginSetting(plugin.id, key, value)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
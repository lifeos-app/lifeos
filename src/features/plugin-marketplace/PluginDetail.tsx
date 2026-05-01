/**
 * PluginDetail — Full plugin detail view
 *
 * Hero image, full description, screenshots carousel, permissions, changelog,
 * ratings/reviews, install/uninstall/update, settings panel, report button.
 */

import { useState, useMemo } from 'react';
import type { MarketplacePlugin } from '../../stores/marketplaceStore';
import { usePluginMarketplace } from './usePluginMarketplace';
import { PLUGIN_CATEGORIES } from '../../stores/marketplaceStore';

// ── STAR RATING (large) ────────────────────────────────────────────────────

function LargeStarRating({ rating, count }: { rating: number; count: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const filled = rating >= i;
    stars.push(
      <span
        key={i}
        className="text-2xl"
        style={{ color: filled ? '#FACC15' : '#334155', transition: 'color 0.15s' }}
      >
        ★
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="flex">{stars}</span>
      <span className="text-lg font-semibold" style={{ color: '#F1F5F9' }}>{rating.toFixed(1)}</span>
      <span className="text-sm" style={{ color: '#64748B' }}>({count} reviews)</span>
    </div>
  );
}

// ── SCREENSHOTS CAROUSEL ────────────────────────────────────────────────────

function ScreenshotsCarousel({ screenshots }: { screenshots: string[] }) {
  const [current, setCurrent] = useState(0);

  if (screenshots.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm"
        style={{
          backgroundColor: '#111827',
          border: '1px dashed #1E293B',
          borderRadius: '12px',
          height: '200px',
          color: '#64748B',
        }}
      >
        No screenshots available
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className="overflow-hidden"
        style={{ borderRadius: '12px', height: '200px', backgroundColor: '#0F172A' }}
      >
        <div
          className="flex transition-transform duration-300"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {screenshots.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Screenshot ${i + 1}`}
              className="flex-shrink-0 object-cover"
              style={{ width: '100%', height: '200px' }}
            />
          ))}
        </div>
      </div>
      {screenshots.length > 1 && (
        <>
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: '#F1F5F9',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => setCurrent(Math.max(0, current - 1))}
          >
            ‹
          </button>
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: '#F1F5F9',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => setCurrent(Math.min(screenshots.length - 1, current + 1))}
          >
            ›
          </button>
          <div className="flex justify-center gap-1.5 mt-2">
            {screenshots.map((_, i) => (
              <button
                key={i}
                className="w-2 h-2"
                style={{
                  borderRadius: '50%',
                  backgroundColor: i === current ? '#00D4FF' : '#334155',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── MARKDOWN-LIKE RENDERING ──────────────────────────────────────────────

function renderDescription(text: string) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-xl font-bold mt-4 mb-2" style={{ color: '#F1F5F9' }}>
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="text-lg font-semibold mt-3 mb-1" style={{ color: '#E2E8F0' }}>
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith('- ')) {
      elements.push(
        <li key={key++} className="ml-4 text-sm" style={{ color: '#CBD5E1' }}>
          {line.slice(2)}
        </li>
      );
    } else if (line.match(/^\d+\./)) {
      const content = line.replace(/^\d+\.\s*/, '');
      elements.push(
        <li key={key++} className="ml-4 text-sm" style={{ color: '#CBD5E1' }}>
          {content}
        </li>
      );
    } else if (line.trim()) {
      elements.push(
        <p key={key++} className="text-sm mb-2" style={{ color: '#CBD5E1' }}>
          {line}
        </p>
      );
    }
  }

  return <div>{elements}</div>;
}

// ── CHANGELOG ──────────────────────────────────────────────────────────────

function ChangelogSection({ changelog }: { changelog: { version: string; date: string; changes: string[] }[] }) {
  if (changelog.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-3" style={{ color: '#F1F5F9' }}>Changelog</h3>
      <div className="space-y-4">
        {changelog.map((entry, i) => (
          <div
            key={i}
            className="p-3"
            style={{
              backgroundColor: '#111827',
              border: '1px solid #1E293B',
              borderRadius: '8px',
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm font-semibold" style={{ color: '#00D4FF' }}>v{entry.version}</span>
              <span className="text-xs" style={{ color: '#64748B' }}>{entry.date}</span>
            </div>
            <ul className="space-y-1">
              {entry.changes.map((change, j) => (
                <li key={j} className="text-sm flex items-start gap-2" style={{ color: '#CBD5E1' }}>
                  <span style={{ color: '#39FF14' }}>•</span>
                  {change}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PERMISSIONS ────────────────────────────────────────────────────────────

function PermissionsList({ permissions }: { permissions: string[] }) {
  if (permissions.length === 0) {
    return (
      <p className="text-sm" style={{ color: '#64748B' }}>No special permissions required</p>
    );
  }

  const permissionLabels: Record<string, string> = {
    'schedule.read': 'Read your schedule',
    'schedule.write': 'Modify your schedule',
    'habits.read': 'Read habit data',
    'habits.write': 'Create & modify habits',
    'goals.read': 'View your goals',
    'goals.write': 'Modify your goals',
    'finances.read': 'View financial data',
    'finances.write': 'Modify financial records',
    'journal.read': 'Read journal entries',
    'journal.write': 'Create journal entries',
    'health.read': 'View health data',
    'notifications.send': 'Send you notifications',
    'calendar.read': 'Read calendar events',
    'calendar.write': 'Create calendar events',
    'ai.chat': 'Access AI chat',
    'realm.write': 'Modify your Realm theme',
  };

  return (
    <div className="space-y-2">
      {permissions.map((p) => (
        <div key={p} className="flex items-center gap-2">
          <span style={{ color: '#FACC15' }}>🔑</span>
          <span className="text-sm" style={{ color: '#CBD5E1' }}>
            {permissionLabels[p] ?? p}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── REVIEWS (mock) ──────────────────────────────────────────────────────────

function ReviewsSection({ rating, ratingCount }: { rating: number; ratingCount: number }) {
  const distribution = [
    { stars: 5, pct: Math.min(70, Math.round(rating / 5 * 70)) },
    { stars: 4, pct: Math.min(20, Math.round(rating / 5 * 20)) },
    { stars: 3, pct: Math.min(7, Math.round(rating / 5 * 7)) },
    { stars: 2, pct: Math.min(2, Math.round(rating / 5 * 2)) },
    { stars: 1, pct: Math.min(1, 100 - Math.round(rating / 5 * 99)) },
  ];

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-3" style={{ color: '#F1F5F9' }}>Ratings & Reviews</h3>
      <div className="flex items-start gap-8">
        {/* Average */}
        <div className="text-center">
          <div className="text-4xl font-bold" style={{ color: '#F1F5F9' }}>{rating.toFixed(1)}</div>
          <div className="flex justify-center mt-1">
            {[1,2,3,4,5].map(i => (
              <span key={i} style={{ color: rating >= i ? '#FACC15' : '#334155', fontSize: '16px' }}>★</span>
            ))}
          </div>
          <div className="text-xs mt-1" style={{ color: '#64748B' }}>{ratingCount} reviews</div>
        </div>

        {/* Distribution */}
        <div className="flex-1 space-y-1.5">
          {distribution.map(({ stars, pct }) => (
            <div key={stars} className="flex items-center gap-2">
              <span className="text-xs w-3" style={{ color: '#94A3B8' }}>{stars}</span>
              <span className="text-xs" style={{ color: '#FACC15' }}>★</span>
              <div className="flex-1" style={{ backgroundColor: '#1E293B', borderRadius: '4px', height: '8px' }}>
                <div
                  style={{
                    width: `${pct}%`,
                    backgroundColor: '#FACC15',
                    borderRadius: '4px',
                    height: '8px',
                    minWidth: pct > 0 ? '4px' : '0',
                  }}
                />
              </div>
              <span className="text-xs w-8 text-right" style={{ color: '#64748B' }}>{pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SETTINGS PANEL ───────────────────────────────────────────────────────────

function SettingsPanel({ pluginId }: { pluginId: string }) {
  const { installed, updatePluginSetting } = usePluginMarketplace();
  const plugin = installed.find(p => p.id === pluginId);
  if (!plugin) return null;

  const settingsEntries = Object.entries(plugin.settings);

  if (settingsEntries.length === 0) {
    return (
      <div className="mt-6 p-4" style={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px' }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: '#F1F5F9' }}>Plugin Settings</h3>
        <p className="text-xs" style={{ color: '#64748B' }}>No configurable settings for this plugin.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 p-4" style={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px' }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: '#F1F5F9' }}>Plugin Settings</h3>
      <div className="space-y-2">
        {settingsEntries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm" style={{ color: '#CBD5E1' }}>{key}</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => updatePluginSetting(pluginId, key, e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:rounded-full after:h-4 after:w-4 after:transition-all"
                style={{ backgroundColor: value ? '#00D4FF' : '#334155' }}
              >
                <div
                  className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform"
                  style={{
                    backgroundColor: '#fff',
                    transform: value ? 'translateX(16px)' : 'translateX(0)',
                  }}
                />
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface PluginDetailProps {
  plugin: MarketplacePlugin;
  onBack?: () => void;
}

export function PluginDetail({ plugin, onBack }: PluginDetailProps) {
  const {
    isInstalled, installPlugin, uninstallPlugin, installingIds, isUpdateAvailable,
    updatePlugin, getRelatedPlugins, formatInstallCount
  } = usePluginMarketplace();

  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const installed = isInstalled(plugin.id);
  const installing = installingIds.includes(plugin.id);
  const canUpdate = installed && isUpdateAvailable(plugin.id);
  const related = getRelatedPlugins(plugin.id);
  const catConfig = PLUGIN_CATEGORIES.find(c => c.id === plugin.category);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <button
        className="flex items-center gap-2 mb-4 text-sm"
        style={{ color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}
        onClick={onBack}
      >
        ← Back to Marketplace
      </button>

      {/* Hero area */}
      <div
        className="p-6 mb-6"
        style={{
          background: `linear-gradient(135deg, ${catConfig?.color}15, #111827)`,
          border: `1px solid ${catConfig?.color}30`,
          borderRadius: '16px',
        }}
      >
        <div className="flex items-start gap-6">
          {/* Large icon */}
          <div
            className="flex items-center justify-center text-5xl flex-shrink-0"
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '16px',
              backgroundColor: `${catConfig?.color}15`,
              border: `2px solid ${catConfig?.color}30`,
            }}
          >
            {plugin.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold" style={{ color: '#F1F5F9' }}>{plugin.name}</h1>
              {plugin.featured && (
                <span
                  className="px-2 py-0.5 text-xs font-bold"
                  style={{ backgroundColor: 'rgba(212,175,55,0.2)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '4px' }}
                >
                  ⭐ Featured
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ color: '#94A3B8' }}>{plugin.author.avatar}</span>
              <span className="text-sm" style={{ color: '#CBD5E1' }}>{plugin.author.name}</span>
              {plugin.author.verified && (
                <span className="text-xs font-semibold" style={{ color: '#00D4FF' }}>✓ Verified</span>
              )}
              <span style={{ color: '#334155' }}>•</span>
              <span className="text-sm" style={{ color: '#64748B' }}>v{plugin.version}</span>
              <span style={{ color: '#334155' }}>•</span>
              <span className="text-sm" style={{ color: '#64748B' }}>
                {formatInstallCount(plugin.installCount)} installs
              </span>
            </div>
            <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>{plugin.description}</p>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              {installing ? (
                <button
                  className="px-6 py-2.5 text-sm font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #00D4FF, #A855F7)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    opacity: 0.8,
                  }}
                  disabled
                >
                  <span className="install-spinner" /> Installing...
                </button>
              ) : installed && !canUpdate ? (
                <button
                  className="px-6 py-2.5 text-sm font-semibold"
                  style={{
                    backgroundColor: 'rgba(57,255,20,0.15)',
                    color: '#39FF14',
                    border: '1px solid rgba(57,255,20,0.3)',
                    borderRadius: '8px',
                    cursor: 'default',
                  }}
                  disabled
                >
                  ✓ Installed
                </button>
              ) : canUpdate ? (
                <button
                  className="px-6 py-2.5 text-sm font-semibold"
                  style={{
                    backgroundColor: 'rgba(0,212,255,0.15)',
                    color: '#00D4FF',
                    border: '1px solid rgba(0,212,255,0.3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                  onClick={() => updatePlugin(plugin.id, plugin)}
                >
                  ↑ Update Available
                </button>
              ) : (
                <button
                  className="px-6 py-2.5 text-sm font-semibold"
                  style={{
                    background: 'linear-gradient(135deg, #00D4FF, #A855F7)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                  onClick={() => installPlugin(plugin)}
                >
                  Install Plugin
                </button>
              )}

              {installed && !showUninstallConfirm && (
                <button
                  className="px-4 py-2.5 text-sm"
                  style={{
                    backgroundColor: 'rgba(244,63,94,0.1)',
                    color: '#F43F5E',
                    border: '1px solid rgba(244,63,94,0.3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowUninstallConfirm(true)}
                >
                  Uninstall
                </button>
              )}

              {showUninstallConfirm && (
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: '#F43F5E' }}>Are you sure?</span>
                  <button
                    className="px-3 py-1.5 text-sm font-semibold"
                    style={{
                      backgroundColor: 'rgba(244,63,94,0.2)',
                      color: '#F43F5E',
                      border: '1px solid rgba(244,63,94,0.5)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                    onClick={() => { uninstallPlugin(plugin.id); setShowUninstallConfirm(false); }}
                  >
                    Yes, Uninstall
                  </button>
                  <button
                    className="px-3 py-1.5 text-sm"
                    style={{ color: '#94A3B8', background: 'none', border: '1px solid #334155', borderRadius: '6px', cursor: 'pointer' }}
                    onClick={() => setShowUninstallConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rating bar */}
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid #1E293B' }}>
          <LargeStarRating rating={plugin.rating} count={plugin.ratingCount} />
        </div>
      </div>

      {/* Screenshots */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3" style={{ color: '#F1F5F9' }}>Screenshots</h3>
        <ScreenshotsCarousel screenshots={plugin.screenshots} />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Description, changelog, reviews */}
        <div className="md:col-span-2">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3" style={{ color: '#F1F5F9' }}>About</h3>
            <div className="text-sm leading-relaxed" style={{ color: '#CBD5E1' }}>
              {renderDescription(plugin.longDescription)}
            </div>
          </div>

          <ChangelogSection changelog={plugin.changelog} />
          <ReviewsSection rating={plugin.rating} ratingCount={plugin.ratingCount} />

          {installed && <SettingsPanel pluginId={plugin.id} />}
        </div>

        {/* Right sidebar: Permissions, tags, info */}
        <div className="space-y-6">
          {/* Permissions */}
          <div
            className="p-4"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px' }}
          >
            <h4 className="text-sm font-semibold mb-3" style={{ color: '#F1F5F9' }}>Permissions</h4>
            <PermissionsList permissions={plugin.permissions} />
          </div>

          {/* Tags */}
          <div
            className="p-4"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px' }}
          >
            <h4 className="text-sm font-semibold mb-3" style={{ color: '#F1F5F9' }}>Tags</h4>
            <div className="flex flex-wrap gap-2">
              {plugin.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs"
                  style={{ backgroundColor: '#1E293B', color: '#94A3B8', borderRadius: '4px' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Info */}
          <div
            className="p-4"
            style={{ backgroundColor: '#111827', border: '1px solid #1E293B', borderRadius: '8px' }}
          >
            <h4 className="text-sm font-semibold mb-3" style={{ color: '#F1F5F9' }}>Details</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: '#64748B' }}>Version</span>
                <span style={{ color: '#CBD5E1' }}>{plugin.version}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#64748B' }}>Category</span>
                <span style={{ color: catConfig?.color ?? '#94A3B8' }}>{catConfig?.label}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#64748B' }}>Updated</span>
                <span style={{ color: '#CBD5E1' }}>{plugin.updatedAt}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#64748B' }}>Installs</span>
                <span style={{ color: '#CBD5E1' }}>{formatInstallCount(plugin.installCount)}</span>
              </div>
              {plugin.dependencies.length > 0 && (
                <div className="flex justify-between">
                  <span style={{ color: '#64748B' }}>Dependencies</span>
                  <span style={{ color: '#CBD5E1' }}>{plugin.dependencies.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Report button */}
          <button
            className="w-full py-2 text-sm"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#64748B',
              cursor: 'pointer',
            }}
          >
            🚩 Report Issue
          </button>
        </div>
      </div>

      {/* Related plugins */}
      {related.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4" style={{ color: '#F1F5F9' }}>Related Plugins</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map(p => (
              <div
                key={p.id}
                className="p-3 cursor-pointer"
                style={{
                  backgroundColor: '#111827',
                  border: '1px solid #1E293B',
                  borderRadius: '8px',
                }}
              >
                <span className="text-2xl">{p.icon}</span>
                <div className="text-sm font-semibold mt-1" style={{ color: '#F1F5F9' }}>{p.name}</div>
                <div className="text-xs" style={{ color: '#64748B' }}>{p.author.name}</div>
                <div className="text-xs mt-1" style={{ color: '#FACC15' }}>★ {p.rating}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
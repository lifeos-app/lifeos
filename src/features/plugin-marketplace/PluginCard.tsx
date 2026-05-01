/**
 * PluginCard — Individual plugin card for the marketplace grid
 *
 * Shows thumbnail/icon, name, author, rating, install count, and category badge.
 * Supports hover preview expansion and one-click install animation.
 */

import { useState, useRef } from 'react';
import type { MarketplacePlugin, PluginCategory } from '../../stores/marketplaceStore';
import { usePluginMarketplace } from './usePluginMarketplace';
import { PLUGIN_CATEGORIES } from '../../stores/marketplaceStore';

// ── CATEGORY COLOR MAP ──────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<PluginCategory, { bg: string; text: string; border: string }> = {
  'junction':     { bg: 'rgba(57,255,20,0.12)',  text: '#39FF14', border: 'rgba(57,255,20,0.3)' },
  'academy':      { bg: 'rgba(212,175,55,0.12)',  text: '#D4AF37', border: 'rgba(212,175,55,0.3)' },
  'widget':       { bg: 'rgba(0,212,255,0.12)',   text: '#00D4FF', border: 'rgba(0,212,255,0.3)' },
  'realm-skin':   { bg: 'rgba(168,85,247,0.12)',  text: '#A855F7', border: 'rgba(168,85,247,0.3)' },
  'ai-persona':   { bg: 'rgba(244,63,94,0.12)',   text: '#F43F5E', border: 'rgba(244,63,94,0.3)' },
  'integration':  { bg: 'rgba(249,115,22,0.12)',  text: '#F97316', border: 'rgba(249,115,22,0.3)' },
  'theme':        { bg: 'rgba(100,116,139,0.12)', text: '#94A3B8', border: 'rgba(100,116,139,0.3)' },
};

// ── STAR RATING ─────────────────────────────────────────────────────────────

function StarRating({ rating, count }: { rating: number; count: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      stars.push(<span key={i} style={{ color: '#FACC15' }}>★</span>);
    } else if (rating >= i - 0.5) {
      stars.push(<span key={i} style={{ color: '#FACC15' }}>★</span>);
    } else {
      stars.push(<span key={i} style={{ color: '#334155' }}>★</span>);
    }
  }
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className="flex">{stars}</span>
      <span style={{ color: '#64748B' }}>({count})</span>
    </span>
  );
}

// ── CATEGORY BADGE ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: PluginCategory }) {
  const colors = CATEGORY_COLORS[category];
  const label = PLUGIN_CATEGORIES.find(c => c.id === category)?.label ?? category;
  return (
    <span
      className="px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {label}
    </span>
  );
}

// ── INSTALL BUTTON ───────────────────────────────────────────────────────────

function InstallButton({ plugin }: { plugin: MarketplacePlugin }) {
  const { isInstalled, installPlugin, installingIds, isUpdateAvailable, updatePlugin } = usePluginMarketplace();
  const installed = isInstalled(plugin.id);
  const installing = installingIds.includes(plugin.id);
  const canUpdate = !installed ? false : isUpdateAvailable(plugin.id);

  if (installing) {
    return (
      <button
        className="flex items-center justify-center px-3 py-1.5 text-sm font-semibold min-w-[80px]"
        style={{
          background: 'linear-gradient(135deg, #00D4FF, #A855F7)',
          color: '#fff',
          border: 'none',
        }}
        disabled
      >
        <span className="install-spinner" />
        Installing...
      </button>
    );
  }

  if (installed && !canUpdate) {
    return (
      <button
        className="px-3 py-1.5 text-sm font-semibold"
        style={{
          backgroundColor: 'rgba(57,255,20,0.15)',
          color: '#39FF14',
          border: '1px solid rgba(57,255,20,0.3)',
          cursor: 'default',
        }}
        disabled
      >
        ✓ Installed
      </button>
    );
  }

  if (canUpdate) {
    return (
      <button
        className="px-3 py-1.5 text-sm font-semibold"
        style={{
          backgroundColor: 'rgba(0,212,255,0.15)',
          color: '#00D4FF',
          border: '1px solid rgba(0,212,255,0.3)',
          cursor: 'pointer',
        }}
        onClick={(e) => {
          e.stopPropagation();
          updatePlugin(plugin.id, plugin);
        }}
      >
        ↑ Update
      </button>
    );
  }

  return (
    <button
      className="px-3 py-1.5 text-sm font-semibold"
      style={{
        background: 'linear-gradient(135deg, #00D4FF, #A855F7)',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
      }}
      onClick={(e) => {
        e.stopPropagation();
        installPlugin(plugin);
      }}
    >
      Install
    </button>
  );
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface PluginCardProps {
  plugin: MarketplacePlugin;
  onClick?: () => void;
}

export function PluginCard({ plugin, onClick }: PluginCardProps) {
  const [hovered, setHovered] = useState(false);
  const { formatInstallCount } = usePluginMarketplace();
  const colors = CATEGORY_COLORS[plugin.category];

  return (
    <div
      className="group relative cursor-pointer"
      style={{
        backgroundColor: '#111827',
        border: `1px solid ${hovered ? colors.text : '#1E293B'}`,
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? `0 8px 30px rgba(0,0,0,0.4), 0 0 20px ${colors.text}15` : '0 2px 8px rgba(0,0,0,0.2)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* Category color stripe */}
      <div
        className="h-1"
        style={{ backgroundColor: colors.text }}
      />

      {/* Hover preview overlay */}
      {hovered && (
        <div
          className="absolute inset-0 z-10 flex flex-col justify-end p-4"
          style={{
            background: 'linear-gradient(transparent 30%, rgba(0,0,0,0.95) 70%)',
            opacity: 1,
            transition: 'opacity 0.2s ease',
          }}
        >
          <p
            className="text-sm mb-3 overflow-hidden"
            style={{
              color: '#CBD5E1',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {plugin.longDescription
              .replace(/##.*\n/g, '')
              .replace(/\*\*/g, '')
              .replace(/###.*\n/g, '')
              .split('\n')
              .filter(l => l.trim())
              .slice(0, 3)
              .join(' ')}
          </p>
          <div className="flex items-center gap-2">
            {plugin.permissions.length > 0 && (
              <span className="text-xs" style={{ color: '#94A3B8' }}>
                🔒 {plugin.permissions.length} permission{plugin.permissions.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main card content */}
      <div className="p-4">
        {/* Top row: icon + category + install */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Plugin icon */}
            <div
              className="flex items-center justify-center text-2xl"
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
              }}
            >
              {plugin.icon}
            </div>
            <div className="flex flex-col gap-0.5">
              <h3 className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
                {plugin.name}
              </h3>
              <div className="flex items-center gap-1.5">
                <span className="text-xs" style={{ color: '#94A3B8' }}>
                  {plugin.author.avatar} {plugin.author.name}
                </span>
                {plugin.author.verified && (
                  <span
                    className="text-xs"
                    style={{ color: '#00D4FF' }}
                    title="Verified author"
                  >
                    ✓
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            <InstallButton plugin={plugin} />
          </div>
        </div>

        {/* Description */}
        <p
          className="text-sm mb-3"
          style={{
            color: '#94A3B8',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {plugin.description}
        </p>

        {/* Tags */}
        {plugin.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {plugin.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs"
                style={{
                  backgroundColor: '#1E293B',
                  color: '#64748B',
                  borderRadius: '4px',
                }}
              >
                {tag}
              </span>
            ))}
            {plugin.tags.length > 3 && (
              <span className="px-1 py-0.5 text-xs" style={{ color: '#64748B' }}>
                +{plugin.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Bottom row: rating + installs + category */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StarRating rating={plugin.rating} count={plugin.ratingCount} />
            <span className="text-xs" style={{ color: '#64748B' }}>
              {formatInstallCount(plugin.installCount)} installs
            </span>
          </div>
          <CategoryBadge category={plugin.category} />
        </div>

        {/* Featured badge */}
        {plugin.featured && (
          <div
            className="absolute top-3 right-3 px-2 py-1 text-xs font-bold"
            style={{
              backgroundColor: 'rgba(212,175,55,0.2)',
              color: '#D4AF37',
              border: '1px solid rgba(212,175,55,0.4)',
              borderRadius: '4px',
            }}
          >
            ⭐ Featured
          </div>
        )}
      </div>
    </div>
  );
}
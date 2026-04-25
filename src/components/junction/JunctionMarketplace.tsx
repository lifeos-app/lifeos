/**
 * Junction Marketplace — Browse, install, and create community junctions
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Search, Download, Heart, Plus, Send, Check, X, Star,
  Filter, Package, Sparkles,
} from 'lucide-react';
import {
  FEATURED_COMMUNITY_JUNCTIONS,
  MARKETPLACE_CATEGORIES,
  likeJunction,
  hasLikedJunction,
  getJunctionLikes,
  downloadJunction,
  isJunctionInstalled,
  getInstalledCommunityJunctions,
  uninstallJunction,
  createCustomJunction,
  publishJunction,
  type CommunityJunction,
  type CommunityQuest,
  type MarketplaceCategory,
} from '../../lib/junction-marketplace';

// ── Sub-tab type ─────────────────────────────────────────────

type MarketplaceTab = 'browse' | 'installed' | 'create';

// ── Icon picker options ──────────────────────────────────────

const ICON_OPTIONS = [
  '\u{2728}', '\u{1F525}', '\u{1F3AF}', '\u{1F4DA}', '\u{1F9D8}',
  '\u{1F4AA}', '\u{1F3A8}', '\u{1F680}', '\u{2694}\uFE0F', '\u{1F331}',
  '\u{2B50}', '\u{1F9E0}', '\u{1F30D}', '\u{1F49C}', '\u{26A1}',
  '\u{1F3C6}', '\u{1F9ED}', '\u{1F308}', '\u{1F4A1}', '\u{1F5FF}',
];

const COLOR_OPTIONS = [
  '#00D4FF', '#8B5CF6', '#EF4444', '#F59E0B', '#10B981',
  '#6366F1', '#3B82F6', '#14B8A6', '#D946EF', '#D4AF37',
];

// ── Main Component ───────────────────────────────────────────

export function JunctionMarketplace() {
  const [tab, setTab] = useState<MarketplaceTab>('browse');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MarketplaceCategory | 'All'>('All');
  const [installedRefresh, setInstalledRefresh] = useState(0);
  const [likesRefresh, setLikesRefresh] = useState(0);

  // Force re-read installed state
  const installed = useMemo(() => getInstalledCommunityJunctions(), [installedRefresh]);

  // Filtered browse results
  const filteredJunctions = useMemo(() => {
    let results = [...FEATURED_COMMUNITY_JUNCTIONS];

    if (categoryFilter !== 'All') {
      results = results.filter(j => j.category === categoryFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter(j =>
        j.name.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q) ||
        j.tags.some(t => t.includes(q)) ||
        j.creatorName.toLowerCase().includes(q)
      );
    }

    // Sort: featured first, then by likes
    results.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return getJunctionLikes(b) - getJunctionLikes(a);
    });

    return results;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, likesRefresh]);

  const handleLike = useCallback((junctionId: string) => {
    likeJunction(junctionId);
    setLikesRefresh(p => p + 1);
  }, []);

  const handleInstall = useCallback((junction: CommunityJunction) => {
    downloadJunction(junction);
    setInstalledRefresh(p => p + 1);
  }, []);

  const handleUninstall = useCallback((junctionId: string) => {
    uninstallJunction(junctionId);
    setInstalledRefresh(p => p + 1);
  }, []);

  return (
    <div style={{ padding: '0 0 24px' }}>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 20,
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        padding: 4,
      }}>
        {([
          { id: 'browse' as const, label: 'Browse', icon: <Package size={14} /> },
          { id: 'installed' as const, label: `Installed (${installed.length})`, icon: <Download size={14} /> },
          { id: 'create' as const, label: 'Create', icon: <Plus size={14} /> },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '8px 12px',
              background: tab === t.id ? 'rgba(0,212,255,0.12)' : 'transparent',
              border: tab === t.id ? '1px solid rgba(0,212,255,0.3)' : '1px solid transparent',
              borderRadius: 8,
              color: tab === t.id ? '#00D4FF' : 'rgba(255,255,255,0.5)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <BrowseTab
          junctions={filteredJunctions}
          search={search}
          onSearchChange={setSearch}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          onLike={handleLike}
          onInstall={handleInstall}
        />
      )}

      {tab === 'installed' && (
        <InstalledTab
          installed={installed}
          onUninstall={handleUninstall}
        />
      )}

      {tab === 'create' && (
        <CreateTab
          onCreated={() => {
            setInstalledRefresh(p => p + 1);
            setTab('installed');
          }}
        />
      )}
    </div>
  );
}

// ── Browse Tab ───────────────────────────────────────────────

function BrowseTab({
  junctions,
  search,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  onLike,
  onInstall,
}: {
  junctions: CommunityJunction[];
  search: string;
  onSearchChange: (v: string) => void;
  categoryFilter: MarketplaceCategory | 'All';
  onCategoryChange: (v: MarketplaceCategory | 'All') => void;
  onLike: (id: string) => void;
  onInstall: (j: CommunityJunction) => void;
}) {
  return (
    <>
      {/* Search bar */}
      <div style={{
        position: 'relative',
        marginBottom: 12,
      }}>
        <Search size={14} style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'rgba(255,255,255,0.3)',
        }} />
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search junctions..."
          style={{
            width: '100%',
            padding: '10px 12px 10px 34px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            color: '#fff',
            fontSize: 13,
            outline: 'none',
            fontFamily: "'Poppins', sans-serif",
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Category pills */}
      <div style={{
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
        marginBottom: 16,
      }}>
        <CategoryPill
          label="All"
          active={categoryFilter === 'All'}
          onClick={() => onCategoryChange('All')}
        />
        {MARKETPLACE_CATEGORIES.map(cat => (
          <CategoryPill
            key={cat}
            label={cat}
            active={categoryFilter === cat}
            onClick={() => onCategoryChange(cat)}
          />
        ))}
      </div>

      {/* Junction grid */}
      {junctions.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 14,
        }}>
          <Filter size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p>No junctions found matching your filters.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {junctions.map(junction => (
            <JunctionCard
              key={junction.id}
              junction={junction}
              onLike={() => onLike(junction.id)}
              onInstall={() => onInstall(junction)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ── Category Pill ────────────────────────────────────────────

function CategoryPill({ label, active, onClick }: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px',
        background: active ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 20,
        color: active ? '#00D4FF' : 'rgba(255,255,255,0.5)',
        fontSize: 12,
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontFamily: "'Poppins', sans-serif",
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

// ── Junction Card ────────────────────────────────────────────

function JunctionCard({ junction, onLike, onInstall }: {
  junction: CommunityJunction;
  onLike: () => void;
  onInstall: () => void;
}) {
  const liked = hasLikedJunction(junction.id);
  const isInstalled = isJunctionInstalled(junction.id);
  const likeCount = getJunctionLikes(junction);

  // Top 3 by likes are "Featured"
  const isFeatured = junction.featured;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      transition: 'border-color 0.2s, transform 0.2s',
      cursor: 'default',
      position: 'relative',
    }}>
      {/* Featured badge */}
      {isFeatured && (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          background: 'rgba(212,175,55,0.15)',
          border: '1px solid rgba(212,175,55,0.3)',
          borderRadius: 12,
          fontSize: 10,
          color: '#D4AF37',
          fontWeight: 700,
          fontFamily: "'Orbitron', monospace",
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          <Star size={10} fill="#D4AF37" /> Featured
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${junction.color}22, ${junction.color}08)`,
          border: `1px solid ${junction.color}44`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}>
          {junction.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {junction.name}
          </div>
          <div style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.4)',
          }}>
            by {junction.creatorName}
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        lineHeight: 1.5,
        flex: 1,
      }}>
        {junction.description}
      </div>

      {/* Quest count + category */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
      }}>
        <span>{junction.quests.length} quests</span>
        <span style={{ opacity: 0.3 }}>|</span>
        <span style={{
          padding: '1px 6px',
          background: `${junction.color}15`,
          border: `1px solid ${junction.color}30`,
          borderRadius: 4,
          color: junction.color,
          fontSize: 10,
        }}>
          {junction.category}
        </span>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingTop: 6,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Like button */}
        <button
          onClick={onLike}
          disabled={liked}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            background: liked ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${liked ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: 6,
            color: liked ? '#EF4444' : 'rgba(255,255,255,0.5)',
            fontSize: 12,
            cursor: liked ? 'default' : 'pointer',
            transition: 'all 0.2s',
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <Heart size={12} fill={liked ? '#EF4444' : 'none'} /> {likeCount}
        </button>

        {/* Install button */}
        <button
          onClick={onInstall}
          disabled={isInstalled}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '6px 12px',
            background: isInstalled ? 'rgba(57,255,20,0.1)' : 'rgba(0,212,255,0.12)',
            border: `1px solid ${isInstalled ? 'rgba(57,255,20,0.3)' : 'rgba(0,212,255,0.3)'}`,
            borderRadius: 8,
            color: isInstalled ? '#39FF14' : '#00D4FF',
            fontSize: 12,
            fontWeight: 600,
            cursor: isInstalled ? 'default' : 'pointer',
            transition: 'all 0.2s',
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          {isInstalled ? (
            <><Check size={12} /> Installed</>
          ) : (
            <><Download size={12} /> Install</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Installed Tab ────────────────────────────────────────────

function InstalledTab({ installed, onUninstall }: {
  installed: CommunityJunction[];
  onUninstall: (id: string) => void;
}) {
  if (installed.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px 20px',
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
      }}>
        <Package size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
        <p>No community junctions installed yet.</p>
        <p style={{ fontSize: 12 }}>Browse the marketplace to find wisdom traditions created by the community.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {installed.map(junction => (
        <div
          key={junction.id}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${junction.color}22, ${junction.color}08)`,
            border: `1px solid ${junction.color}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}>
            {junction.icon}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
            }}>
              {junction.name}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              {junction.quests.length} quests - by {junction.creatorName}
            </div>
          </div>

          <button
            onClick={() => onUninstall(junction.id)}
            style={{
              padding: '6px 12px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              color: '#EF4444',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <X size={12} /> Remove
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Create Tab ───────────────────────────────────────────────

function CreateTab({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICON_OPTIONS[0]);
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [category, setCategory] = useState<MarketplaceCategory>('Other');
  const [quests, setQuests] = useState<Array<{ name: string; description: string }>>([
    { name: '', description: '' },
    { name: '', description: '' },
    { name: '', description: '' },
  ]);
  const [publishing, setPublishing] = useState(false);
  const [created, setCreated] = useState(false);

  const isValid = name.trim().length >= 3 &&
    description.trim().length >= 10 &&
    quests.filter(q => q.name.trim()).length >= 1;

  const handleCreate = useCallback(() => {
    const questData: CommunityQuest[] = quests
      .filter(q => q.name.trim())
      .map((q, i) => ({
        id: `custom_q_${Date.now()}_${i}`,
        name: q.name.trim(),
        description: q.description.trim(),
        xp: 100,
      }));

    const junction = createCustomJunction({
      name: name.trim(),
      description: description.trim(),
      icon: selectedIcon,
      color: selectedColor,
      category,
      quests: questData,
      tags: [category.toLowerCase()],
    });

    if (publishing) {
      publishJunction(junction);
    }

    setCreated(true);
    setTimeout(() => {
      onCreated();
    }, 1500);
  }, [name, description, selectedIcon, selectedColor, category, quests, publishing, onCreated]);

  if (created) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px 20px',
        color: '#39FF14',
        fontSize: 14,
      }}>
        <Sparkles size={32} style={{ marginBottom: 12 }} />
        <p style={{ fontWeight: 600, fontSize: 16 }}>Junction Created!</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
          {publishing ? 'Submitted for community review.' : 'Added to your installed junctions.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Name */}
      <div>
        <label style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.6)',
          marginBottom: 6,
          fontFamily: "'Poppins', sans-serif",
        }}>
          Junction Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. The Grind"
          maxLength={40}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            outline: 'none',
            fontFamily: "'Poppins', sans-serif",
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Description */}
      <div>
        <label style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.6)',
          marginBottom: 6,
          fontFamily: "'Poppins', sans-serif",
        }}>
          Description *
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What is this Junction about? What philosophy does it follow?"
          maxLength={200}
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            outline: 'none',
            fontFamily: "'Poppins', sans-serif",
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Icon picker */}
      <div>
        <label style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.6)',
          marginBottom: 6,
          fontFamily: "'Poppins', sans-serif",
        }}>
          Icon
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ICON_OPTIONS.map(icon => (
            <button
              key={icon}
              onClick={() => setSelectedIcon(icon)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: selectedIcon === icon ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: selectedIcon === icon ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                fontSize: 18,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div>
        <label style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.6)',
          marginBottom: 6,
          fontFamily: "'Poppins', sans-serif",
        }}>
          Color
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          {COLOR_OPTIONS.map(color => (
            <button
              key={color}
              onClick={() => setSelectedColor(color)}
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: color,
                border: selectedColor === color ? '2px solid #fff' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                outline: selectedColor === color ? `2px solid ${color}` : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>

      {/* Category */}
      <div>
        <label style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.6)',
          marginBottom: 6,
          fontFamily: "'Poppins', sans-serif",
        }}>
          Category
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {MARKETPLACE_CATEGORIES.map(cat => (
            <CategoryPill
              key={cat}
              label={cat}
              active={category === cat}
              onClick={() => setCategory(cat)}
            />
          ))}
        </div>
      </div>

      {/* Quests */}
      <div>
        <label style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.6)',
          marginBottom: 6,
          fontFamily: "'Poppins', sans-serif",
        }}>
          Quests (at least 1 required)
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {quests.map((quest, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}>
              <input
                type="text"
                value={quest.name}
                onChange={e => {
                  const updated = [...quests];
                  updated[i] = { ...updated[i], name: e.target.value };
                  setQuests(updated);
                }}
                placeholder={`Quest ${i + 1} name`}
                maxLength={50}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: "'Poppins', sans-serif",
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="text"
                value={quest.description}
                onChange={e => {
                  const updated = [...quests];
                  updated[i] = { ...updated[i], description: e.target.value };
                  setQuests(updated);
                }}
                placeholder="What does the player need to do?"
                maxLength={100}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 12,
                  outline: 'none',
                  fontFamily: "'Poppins', sans-serif",
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Publish toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8,
      }}>
        <button
          onClick={() => setPublishing(!publishing)}
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            background: publishing ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.1)',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
          }}
        >
          <div style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            position: 'absolute',
            top: 2,
            left: publishing ? 18 : 2,
            transition: 'left 0.2s',
          }} />
        </button>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
            Submit to Community
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            Share your Junction with other LifeOS users (reviewed before publishing)
          </div>
        </div>
      </div>

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={!isValid}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '12px 20px',
          background: isValid ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isValid ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 10,
          color: isValid ? '#00D4FF' : 'rgba(255,255,255,0.3)',
          fontSize: 14,
          fontWeight: 600,
          cursor: isValid ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
          fontFamily: "'Poppins', sans-serif",
        }}
      >
        {publishing ? <Send size={14} /> : <Plus size={14} />}
        {publishing ? 'Create & Submit' : 'Create Junction'}
      </button>
    </div>
  );
}

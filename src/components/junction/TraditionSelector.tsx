import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Lock, Zap, Check, Loader2, Calendar, BookOpen, Globe, ArrowRight, Search, X } from 'lucide-react';
import type { JunctionTradition } from '../../hooks/useJunction';
import { showToast } from '../Toast';
import { TraditionHeroBg, TraditionIcon } from './TraditionIcons';
import { TRADITION_CATEGORIES, FALLBACK_TRADITIONS, CATEGORY_TABS, getFaithPathInfo, type TraditionCategory } from './constants';
import { AIMatchingModal } from './AIMatchingModal';

export function TraditionSelector({
  traditions,
  onEquip,
}: {
  traditions: JunctionTradition[];
  onEquip: (traditionId: string, pathId: string | null, slug: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<JunctionTradition | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [equipping, setEquipping] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<TraditionCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAIMatch, setShowAIMatch] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const displayTraditions = traditions.length > 0 ? traditions : FALLBACK_TRADITIONS;

  const filteredTraditions = useMemo(() => {
    let filtered = displayTraditions;
    if (categoryFilter !== 'All') {
      filtered = filtered.filter(t => TRADITION_CATEGORIES[t.slug] === categoryFilter);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      );
    }
    return filtered.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [displayTraditions, categoryFilter, searchQuery]);

  const handleEquip = async () => {
    if (!selected) return;
    setEquipping(true);
    try {
      await onEquip(selected.id, selectedPath, selected.slug);
      showToast(`Junctioned: ${selected.name}! 🔮`, 'success');
    } catch (err) {
      showToast('Failed to equip tradition', 'error');
    } finally {
      setEquipping(false);
    }
  };

  const categoryTabs: TraditionCategory[] = CATEGORY_TABS;

  return (
    <div className="jnc-selector">
      {/* AI Matching CTA */}
      <button className="jnc-ai-match-cta" onClick={() => setShowAIMatch(true)}>
        <span className="jnc-ai-icon"><Sparkles size={16} /></span>
        <div className="jnc-ai-text">
          <div className="jnc-ai-title">Find Your Perfect Junction</div>
          <div className="jnc-ai-subtitle">AI-powered spiritual path matching</div>
        </div>
        <ArrowRight size={16} />
      </button>

      {/* Category Filter Tabs */}
      <div className="jnc-category-tabs">
        {categoryTabs.map(cat => (
          <button
            key={cat}
            className={`jnc-cat-tab ${categoryFilter === cat ? 'active' : ''}`}
            onClick={() => setCategoryFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="jnc-search-bar">
        <Search size={14} className="jnc-search-icon" />
        <input
          type="text"
          placeholder="Search traditions..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="jnc-search-input"
        />
        {searchQuery && (
          <button className="jnc-search-clear" onClick={() => setSearchQuery('')}>
            <X size={14} />
          </button>
        )}
      </div>

      <div className="jnc-selector-label">Choose Your Tradition</div>
      <div className="jnc-grid">
        {filteredTraditions.map((t, i) => (
          <div key={t.id}>
            <div
              className={`jnc-trad-card ${t.available ? 'available' : 'locked'} ${expandedCard === t.id ? 'expanded' : ''}`}
              style={{
                '--trad-gradient': t.background_gradient || `linear-gradient(90deg, ${t.color}, ${t.color}88)`,
                animationDelay: `${i * 0.08}s`,
              } as React.CSSProperties}
              onClick={() => {
                if (t.available) {
                  if (expandedCard === t.id) {
                    setSelected(t);
                  } else {
                    setExpandedCard(t.id);
                  }
                }
              }}
            >
              <TraditionHeroBg slug={t.slug} />
              <div className="jnc-trad-icon">
                <TraditionIcon slug={t.slug} emoji={t.icon} size={36} />
              </div>
              <div className="jnc-trad-name">
                {t.name}
                {t.slug === 'tewahedo' && <span className="jnc-featured-badge">Featured</span>}
              </div>
              <div className="jnc-trad-desc">{t.description}</div>
              
              {expandedCard === t.id && (
                <div className="jnc-trad-expanded" onClick={e => e.stopPropagation()}>
                  <div className="jnc-trad-essence">Ancient paths, hidden wisdom, sacred practices…</div>
                  <div className="jnc-trad-stats">
                    <div className="jnc-trad-stat"><BookOpen size={12} /><span>8 Spiritual Guides await</span></div>
                    <div className="jnc-trad-stat"><Zap size={12} /><span>12+ Practices available</span></div>
                    <div className="jnc-trad-stat"><Calendar size={12} /><span>Calendar: {t.calendar_type}</span></div>
                  </div>
                  {getFaithPathInfo(t.slug) && (
                    <a href={getFaithPathInfo(t.slug)!.url} target="_blank" rel="noopener noreferrer" className="jnc-trad-link" onClick={(e) => e.stopPropagation()}>
                      <Globe size={12} /> Visit {getFaithPathInfo(t.slug)!.siteName} →
                    </a>
                  )}
                  <button className="jnc-trad-equip-btn" onClick={() => setSelected(t)}>
                    <Sparkles size={14} /> Equip This Junction
                  </button>
                </div>
              )}

              {!t.available && (
                <div className="jnc-trad-lock"><Lock size={10} /> Coming Soon</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredTraditions.length === 0 && (
        <div className="jnc-no-results"><Search size={32} /><p>No traditions found matching "{searchQuery}"</p></div>
      )}

      {/* Equip Confirmation Modal */}
      {selected && createPortal(
        <div className="jnc-equip-overlay" onClick={() => { setSelected(null); setSelectedPath(null); setExpandedCard(null); }}>
          <div className="jnc-equip-modal" onClick={e => e.stopPropagation()}>
            <div className="jnc-equip-icon"><TraditionIcon slug={selected.slug} emoji={selected.icon} size={48} /></div>
            <div className="jnc-equip-title">Junction {selected.name}?</div>
            <div className="jnc-equip-desc">{selected.description}</div>

            {selected.paths.length > 0 && (
              <>
                <div className="jnc-path-label">Select Your Path</div>
                <div className="jnc-paths">
                  {selected.paths.map(path => (
                    <button
                      key={path.id}
                      className={`jnc-path-btn ${selectedPath === path.id ? 'selected' : ''}`}
                      onClick={() => setSelectedPath(path.id)}
                    >
                      <span className="jnc-path-btn-icon">{path.icon}</span>
                      <div className="jnc-path-btn-info">
                        <div className="jnc-path-btn-name">{path.name}</div>
                        <div className="jnc-path-btn-desc">{path.description}</div>
                      </div>
                      {selectedPath === path.id && <Check size={16} style={{ color: '#A855F7' }} />}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="jnc-equip-actions">
              <button className="jnc-equip-cancel" onClick={() => { setSelected(null); setSelectedPath(null); setExpandedCard(null); }}>Cancel</button>
              <button
                className="jnc-equip-confirm"
                onClick={handleEquip}
                disabled={equipping || (selected.paths.length > 0 && !selectedPath)}
              >
                {equipping ? <><Loader2 size={14} className="spin" /> Equipping…</> : <><Sparkles size={14} /> Equip</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* AI Matching Modal */}
      {showAIMatch && (
        <AIMatchingModal
          traditions={displayTraditions.filter(t => t.available)}
          onClose={() => setShowAIMatch(false)}
          onEquip={(t) => { setSelected(t); setShowAIMatch(false); }}
        />
      )}
    </div>
  );
}

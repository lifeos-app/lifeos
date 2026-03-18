// ═══════════════════════════════════════════════════════════
// Junction System — Equip a Wisdom Tradition
// FF8 Guardian Force-inspired spiritual equip screen
// MAJOR OVERHAUL: Category filtering, AI matching, cooldown confirmation, Alpha/Omega intros
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Sparkles, Lock, Zap, Check, Loader2, Calendar, BookOpen, ExternalLink, Globe, ArrowRight, Search, X, AlertTriangle, Play, ArrowLeftRight, Shield, Clock, ArrowLeft, Compass } from 'lucide-react';
import { useJunction, useJunctionPractices, useJunctionCalendar, useJunctionWisdom, useLogPractice } from '../hooks/useJunction';
import type { JunctionTradition, JunctionFigure } from '../hooks/useJunction';
import { showToast } from '../components/Toast';
import JunctionTutorial from './JunctionTutorial';
import { SpotlightTour, isTourComplete, markTourComplete } from '../components/SpotlightTour';
import { SlideTutorial } from '../components/SlideTutorial';
import { SLIDE_TUTORIALS } from '../components/tutorials';
import { JunctionAI } from '../components/ai/JunctionAI';
import { PageHeader } from '../components/ui/PageHeader';
import { useGamificationContext } from '../lib/gamification/context';
import { formatEthiopianDate } from '../utils/ethiopian-calendar';
import { JunctionSkeleton } from '../components/skeletons';
import { assetPath } from '../utils/assets';
import './Junction.css';

// ═══ Faith Path Website Mapping ═══
// Only include faith path sites that are actually live
const FAITH_PATH_URLS: Record<string, { url: string; siteName: string; tagline: string }> = {
  buddhism: { url: 'https://dharmapath.com.au', siteName: 'DharmaPath', tagline: 'The Middle Way — mindfulness, meditation & liberation' },
  hinduism: { url: 'https://vedapath.com.au', siteName: 'VedaPath', tagline: 'Sanātana Dharma — eternal truth & cosmic order' },
  islam: { url: 'https://islamicpath.com.au', siteName: 'IslamicPath', tagline: 'Submission & peace — prayer, charity & devotion' },
  tewahedo: { url: 'https://tewahedo.com.au', siteName: 'Tewahedo', tagline: 'Ancient Christianity — fasting, prayer & mystical devotion' },
};

function getFaithPathInfo(slug: string) {
  return FAITH_PATH_URLS[slug] || null;
}

// ═══ Tradition Categories ═══
type TraditionCategory = 'All' | 'Abrahamic' | 'Eastern' | 'Indigenous' | 'Philosophical';

const TRADITION_CATEGORIES: Record<string, TraditionCategory> = {
  tewahedo: 'Abrahamic',
  islam: 'Abrahamic',
  catholic: 'Abrahamic',
  judaism: 'Abrahamic',
  buddhism: 'Eastern',
  hinduism: 'Eastern',
  sikhism: 'Eastern',
  daoism: 'Eastern',
  dreaming: 'Indigenous',
  stoicism: 'Philosophical',
};

// ═══ Alpha/Omega Welcome Messages ═══
const ALPHA_MESSAGES: Record<string, string> = {
  tewahedo: "Selam. You have chosen the ancient path of the Ethiopian Church. Walk in the footsteps of saints and kings. ☦️",
  islam: "As-salamu alaykum. You have entered the path of submission. Five pillars guide your way. ☪️",
  buddhism: "May you awaken. The Middle Way opens before you — free from extremes, rooted in compassion. ☸️",
  hinduism: "Om. You walk the eternal Dharma. The cosmic dance of Brahman awaits your devotion. 🕉️",
  sikhism: "Sat Sri Akal. Truth is eternal. Walk with courage, serve with love, remember the One. 🪯",
  judaism: "Shalom. You have entered the covenant. Study Torah, keep the commandments, sanctify time. ✡️",
  stoicism: "Welcome, philosopher. Master yourself, accept fate, live with virtue and reason. 🏛️",
  catholic: "Pax Christi. You walk the path of universal communion. The saints accompany you. ⛪",
  daoism: "The Way unfolds. Flow like water, act without force, embrace the mystery of nature. ☯️",
  dreaming: "You walk the ancient paths. Country calls you. The ancestors are near. 🌀",
  rhasta: "Welcome, seeker. I am Ras Tafari. Before you is a path — not of religion, but of rhythm. Time and spirit, together. 🦁",
};

// ═══ Omega Completion Messages ═══
const OMEGA_MESSAGES: Record<string, string> = {
  tewahedo: "You have walked the ancient path with devotion. The saints witness your faithfulness. Go in peace, child of Zion. ☦️",
  islam: "Ma sha'Allah. You have fulfilled what was asked. Your discipline honours the Creator. Walk on with peace. ☪️",
  buddhism: "The path continues, but you have walked it well. Suffering dissolves where mindfulness endures. Go gently. ☸️",
  hinduism: "Your karma is purified. The cosmic dance turns, and you have moved in rhythm with Dharma. Om Shanti. 🕉️",
  sikhism: "Waheguru. You served with love and walked with courage. The One is pleased. Rise and serve again. 🪯",
  judaism: "You have sanctified your time and honoured the covenant. Shalom — peace be upon your days. ✡️",
  stoicism: "You endured. You reasoned. You mastered yourself. This is the only victory that matters. 🏛️",
  catholic: "Well done, faithful servant. The communion of saints rejoices with you. Go forth in grace. ⛪",
  daoism: "You flowed like water and found the Way without force. The mystery deepens. Walk on. ☯️",
  dreaming: "The ancestors smile. You walked the songlines. Country remembers. Return when called. 🌀",
  rhasta: "With faith, courage, and a just cause — David will still beat Goliath. You conquered. Rise, champion. 🦁",
};

// Tradition background image — tries /junction/traditions/{slug}/heroes/hero.webp, falls back to gradient
function TraditionHeroBg({ slug }: { slug: string }) {
  const [imgError, setImgError] = useState(false);
  const imgPath = assetPath(`/junction/traditions/${slug}/heroes/hero.webp`);

  if (imgError) return null;

  return (
    <div className="jnc-trad-hero-bg">
      <img
        src={imgPath}
        alt=""
        className="jnc-trad-hero-img"
        onError={() => setImgError(true)}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

// Tradition icon component — loads custom icon.webp, falls back to emoji
function TraditionIcon({ slug, emoji, size = 32 }: { slug: string; emoji: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const imgPath = assetPath(`/junction/traditions/${slug}/icon.webp`);

  if (imgError) {
    return <span className="jnc-trad-icon-emoji" style={{ fontSize: size }}>{emoji}</span>;
  }

  return (
    <img
      src={imgPath}
      alt={slug}
      className="jnc-trad-icon-img"
      style={{ width: size, height: size }}
      onError={() => setImgError(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

// Figure card image component — shows card art if available, falls back to emoji
function FigureAvatar({ figure, size = 'md' }: { figure: { id: string; icon: string; name?: string }; size?: 'sm' | 'md' | 'lg' }) {
  const [imgError, setImgError] = useState(false);
  const imgPath = assetPath(`/junction/figures/${figure.id}.webp`);
  const sizeClass = `jnc-figure-avatar-img jnc-avatar-${size}`;

  if (imgError) {
    return <span className={`jnc-figure-avatar-emoji jnc-avatar-${size}`}>{figure.icon}</span>;
  }

  return (
    <img
      src={imgPath}
      alt={figure.name || figure.id}
      className={sizeClass}
      onError={() => setImgError(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

// Tier label map
const TIER_LABELS: Record<number, string> = {
  0: 'Seeker',
  1: 'Acolyte',
  2: 'Adept',
  3: 'Master',
  4: 'Exalted',
  5: 'Legend',
  6: 'Prophet',
  7: 'Divine',
};

export function Junction() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    userJunction, tradition, traditions, figures,
    xpProgress, loading, equipJunction, unjunction, isEquipped, refresh, switchJunction,
  } = useJunction();

  const [showAlphaIntro, setShowAlphaIntro] = useState(false);
  const [alphaSlug, setAlphaSlug] = useState<string | null>(null);

  // Tutorial state — show for first-time unequipped users
  // Uses unified SpotlightTour system for Supabase persistence
  const [tutorialDone, setTutorialDone] = useState(() => {
    return isTourComplete('junction');
  });

  const handleTutorialComplete = useCallback(() => {
    markTourComplete('junction');
    setTutorialDone(true);
  }, []);

  const handleTutorialSkip = useCallback(() => {
    markTourComplete('junction');
    setTutorialDone(true);
  }, []);

  // Handle equip with Alpha intro + mark tutorial done
  const handleEquipWithIntro = useCallback(async (traditionId: string, pathId: string | null, slug: string) => {
    await equipJunction(traditionId, pathId);
    markTourComplete('junction');
    setTutorialDone(true);
    setAlphaSlug(slug);
    setShowAlphaIntro(true);
  }, [equipJunction]);

  const closeAlphaIntro = useCallback(() => {
    setShowAlphaIntro(false);
    setAlphaSlug(null);
    refresh();
  }, [refresh]);

  if (loading) {
    return <JunctionSkeleton />;
  }

  // Show tutorial for first-time unequipped users
  if (!isEquipped && !tutorialDone) {
    return (
      <JunctionTutorial
        traditions={traditions}
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialSkip}
      />
    );
  }

  const showBackButton = location.pathname.startsWith('/character/');

  return (
    <div className="junction-page">
      {showBackButton && (
        <button
          onClick={() => navigate('/character')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', marginBottom: 12,
            background: 'rgba(15, 45, 74, 0.4)', border: '1px solid rgba(26, 58, 92, 0.6)',
            borderRadius: 8, color: '#8BA4BE', fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <ArrowLeft size={14} /> Back to Character
        </button>
      )}
      <PageHeader
        title="Junction System"
        icon={<Sparkles size={22} />}
        subtitle="Equip a wisdom tradition to guide your path"
        centered
      />

      <JunctionAI />

      {!isEquipped ? (
        <>
          <div className="jnc-tut-selector-intro">
            <p>You've taken your first step. Now choose the path you'll walk.</p>
          </div>
          <TraditionSelector traditions={traditions} onEquip={handleEquipWithIntro} />
        </>
      ) : (
        <JunctionDashboard
          userJunction={userJunction!}
          tradition={tradition!}
          figures={figures}
          xpProgress={xpProgress}
          onUnjunction={unjunction}
          onRefresh={refresh}
          onSwitchJunction={switchJunction}
        />
      )}

      {/* Faith Paths Network — always visible */}
      <FaithPathsNetwork equippedSlug={tradition?.slug} />

      {/* Alpha Intro */}
      {showAlphaIntro && alphaSlug && (
        <AlphaIntro slug={alphaSlug} onClose={closeAlphaIntro} />
      )}

      <SpotlightTour tourId="junction" />
      <SlideTutorial
        tutorialKey={SLIDE_TUTORIALS.junction.key}
        slides={SLIDE_TUTORIALS.junction.slides}
      />
    </div>
  );
}

// ═══ Tradition Selector (with category filter, search, AI matching) ═══
function TraditionSelector({
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

  // Fallback traditions if DB is empty
  const fallbackTraditions: JunctionTradition[] = [
    { id: 'tewahedo', name: 'Tewahedo', slug: 'tewahedo', icon: '☦️', description: 'Ethiopian Orthodox tradition of ancient Christianity, fasting discipline, and mystical devotion.', color: '#D4AF37', background_gradient: null, available: true, calendar_type: 'ethiopian', paths: [
      { id: 'monastic', name: 'Monastic', description: 'Path of ascetic discipline and deep prayer', icon: '🏔️' },
      { id: 'liturgical', name: 'Liturgical', description: 'Path of sacred worship and hymnal tradition', icon: '🕯️' },
      { id: 'scholarly', name: 'Scholarly', description: 'Path of theological study and scriptural wisdom', icon: '📜' },
    ]},
    { id: 'islam', name: 'Islam', slug: 'islam', icon: '☪️', description: 'The path of submission to the One God through prayer, fasting, and righteous action.', color: '#2E7D32', background_gradient: null, available: true, calendar_type: 'hijri', paths: [] },
    { id: 'buddhism', name: 'Buddhism', slug: 'buddhism', icon: '☸️', description: 'The Middle Way — mindfulness, compassion, and liberation from suffering.', color: '#FF8F00', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
    { id: 'hinduism', name: 'Hinduism', slug: 'hinduism', icon: '🕉️', description: 'Sanātana Dharma — cosmic order, devotion, knowledge, and righteous action.', color: '#E65100', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
    { id: 'sikhism', name: 'Sikhism', slug: 'sikhism', icon: '🪯', description: 'One God, honest living, service to humanity, and the warrior-saint ideal.', color: '#1565C0', background_gradient: null, available: true, calendar_type: 'nanakshahi', paths: [] },
    { id: 'judaism', name: 'Judaism', slug: 'judaism', icon: '✡️', description: 'Covenant, Torah study, prayer, and the sanctification of everyday life.', color: '#1A237E', background_gradient: null, available: true, calendar_type: 'hebrew', paths: [] },
    { id: 'stoicism', name: 'Stoicism', slug: 'stoicism', icon: '🏛️', description: 'Virtue, reason, self-mastery, and alignment with nature\'s order.', color: '#455A64', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
    { id: 'catholic', name: 'Catholic', slug: 'catholic', icon: '⛪', description: 'Universal Church — sacraments, saints, and sacred tradition.', color: '#6B21A8', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
    { id: 'daoism', name: 'Daoism', slug: 'daoism', icon: '☯️', description: 'The Way — harmony, simplicity, and the flow of nature.', color: '#059669', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
    { id: 'dreaming', name: 'Aboriginal Dreaming', slug: 'dreaming', icon: '🌀', description: 'The oldest living spiritual tradition — Country, kinship, and the eternal Dreaming.', color: '#B45309', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
  ];
  const displayTraditions = traditions.length > 0 ? traditions : fallbackTraditions;

  // Filter traditions by category and search
  const filteredTraditions = useMemo(() => {
    let filtered = displayTraditions;

    // Category filter
    if (categoryFilter !== 'All') {
      filtered = filtered.filter(t => TRADITION_CATEGORIES[t.slug] === categoryFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      );
    }

    // Sort: available first, then alphabetical
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

  const categoryTabs: TraditionCategory[] = ['All', 'Abrahamic', 'Eastern', 'Indigenous', 'Philosophical'];

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
              
              {/* Expanded info */}
              {expandedCard === t.id && (
                <div className="jnc-trad-expanded" onClick={e => e.stopPropagation()}>
                  <div className="jnc-trad-essence">Ancient paths, hidden wisdom, sacred practices…</div>
                  <div className="jnc-trad-stats">
                    <div className="jnc-trad-stat">
                      <BookOpen size={12} />
                      <span>8 Spiritual Guides await</span>
                    </div>
                    <div className="jnc-trad-stat">
                      <Zap size={12} />
                      <span>12+ Practices available</span>
                    </div>
                    <div className="jnc-trad-stat">
                      <Calendar size={12} />
                      <span>Calendar: {t.calendar_type}</span>
                    </div>
                  </div>
                  {getFaithPathInfo(t.slug) && (
                    <a
                      href={getFaithPathInfo(t.slug)!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="jnc-trad-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Globe size={12} />
                      Visit {getFaithPathInfo(t.slug)!.siteName} →
                    </a>
                  )}
                  <button
                    className="jnc-trad-equip-btn"
                    onClick={() => setSelected(t)}
                  >
                    <Sparkles size={14} />
                    Equip This Junction
                  </button>
                </div>
              )}

              {!t.available && (
                <div className="jnc-trad-lock">
                  <Lock size={10} />
                  Coming Soon
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredTraditions.length === 0 && (
        <div className="jnc-no-results">
          <Search size={32} />
          <p>No traditions found matching "{searchQuery}"</p>
        </div>
      )}

      {/* Equip Confirmation Modal — portaled to body to escape sidebar stacking context */}
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
              <button className="jnc-equip-cancel" onClick={() => { setSelected(null); setSelectedPath(null); setExpandedCard(null); }}>
                Cancel
              </button>
              <button
                className="jnc-equip-confirm"
                onClick={handleEquip}
                disabled={equipping || (selected.paths.length > 0 && !selectedPath)}
              >
                {equipping ? (
                  <><Loader2 size={14} className="spin" /> Equipping…</>
                ) : (
                  <><Sparkles size={14} /> Equip</>
                )}
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
          onEquip={(t) => {
            setSelected(t);
            setShowAIMatch(false);
          }}
        />
      )}
    </div>
  );
}

// ═══ AI Matching Questionnaire Modal ═══
function AIMatchingModal({
  traditions,
  onClose,
  onEquip,
}: {
  traditions: JunctionTradition[];
  onClose: () => void;
  onEquip: (tradition: JunctionTradition) => void;
}) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);

  const questions = [
    { q: "Do you value structured ritual and ceremony?", tags: ['tewahedo', 'catholic', 'judaism'] },
    { q: "Is personal meditation/inner stillness important to you?", tags: ['buddhism', 'daoism', 'hinduism'] },
    { q: "Do you believe in one supreme God?", tags: ['tewahedo', 'islam', 'catholic', 'judaism', 'sikhism'] },
    { q: "Are you drawn to ancient, mystical traditions?", tags: ['tewahedo', 'hinduism', 'dreaming'] },
    { q: "Do you value reason and self-mastery over faith?", tags: ['stoicism'] },
    { q: "Is community worship central to your practice?", tags: ['islam', 'sikhism', 'catholic'] },
    { q: "Do you connect spirituality with nature and the land?", tags: ['dreaming', 'daoism'] },
    { q: "Is fasting/physical discipline part of your spiritual practice?", tags: ['tewahedo', 'islam', 'buddhism'] },
    { q: "Do you believe in the interconnection of all souls?", tags: ['hinduism', 'buddhism', 'sikhism'] },
    { q: "Does sacred art, music, and architecture enhance your worship?", tags: ['tewahedo', 'catholic', 'hinduism'] },
  ];

  const handleAnswer = (ans: boolean) => {
    const newAnswers = [...answers, ans];
    setAnswers(newAnswers);
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    }
  };

  const isComplete = answers.length === questions.length;

  // Calculate matches
  const matches = useMemo(() => {
    if (!isComplete) return [];
    
    const scores: Record<string, number> = {};
    traditions.forEach(t => { scores[t.slug] = 0; });

    answers.forEach((ans, i) => {
      if (ans) {
        questions[i].tags.forEach(tag => {
          if (scores[tag] !== undefined) scores[tag] += 1;
        });
      }
    });

    const sorted = traditions
      .map(t => ({ tradition: t, score: scores[t.slug], percent: Math.round((scores[t.slug] / questions.length) * 100) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return sorted;
  }, [isComplete, answers, traditions, questions]);

  return createPortal(
    <div className="jnc-ai-overlay" onClick={onClose}>
      <div className="jnc-ai-modal" onClick={e => e.stopPropagation()}>
        <button className="jnc-ai-close" onClick={onClose}>
          <X size={16} />
        </button>

        {!isComplete ? (
          <>
            <div className="jnc-ai-header">
              <div className="jnc-ai-header-icon"><Sparkles size={28} /></div>
              <div className="jnc-ai-header-title">Find Your Perfect Junction</div>
              <div className="jnc-ai-header-subtitle">Question {currentQ + 1} of {questions.length}</div>
            </div>

            <div className="jnc-ai-progress">
              <div className="jnc-ai-progress-bar" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
            </div>

            <div className="jnc-ai-question">{questions[currentQ].q}</div>

            <div className="jnc-ai-answers">
              <button className="jnc-ai-ans-btn yes" onClick={() => handleAnswer(true)}>
                <Check size={18} />
                Yes
              </button>
              <button className="jnc-ai-ans-btn no" onClick={() => handleAnswer(false)}>
                <X size={18} />
                No
              </button>
            </div>

            <div className="jnc-ai-dots">
              {questions.map((_, i) => (
                <div key={i} className={`jnc-ai-dot ${i < currentQ ? 'done' : i === currentQ ? 'active' : ''}`} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="jnc-ai-results-header">
              <Sparkles size={24} className="jnc-ai-results-icon" />
              <div className="jnc-ai-results-title">Your Spiritual Matches</div>
              <div className="jnc-ai-results-subtitle">Based on your answers, these paths resonate with you</div>
            </div>

            <div className="jnc-ai-results">
              {matches.map((m, i) => (
                <div key={m.tradition.id} className="jnc-ai-result-card" style={{ '--trad-color': m.tradition.color } as React.CSSProperties}>
                  <div className="jnc-ai-result-rank">#{i + 1}</div>
                  <div className="jnc-ai-result-icon"><TraditionIcon slug={m.tradition.slug} emoji={m.tradition.icon} size={36} /></div>
                  <div className="jnc-ai-result-name">{m.tradition.name}</div>
                  <div className="jnc-ai-result-match">{m.percent}% Match</div>
                  <div className="jnc-ai-result-why">
                    {i === 0 && "Strongest alignment with your spiritual values"}
                    {i === 1 && "Deep resonance with your practice preferences"}
                    {i === 2 && "Significant compatibility with your beliefs"}
                  </div>
                  <button className="jnc-ai-result-equip" onClick={() => onEquip(m.tradition)}>
                    <Sparkles size={12} />
                    Equip This Junction
                  </button>
                </div>
              ))}
            </div>

            <button className="jnc-ai-restart" onClick={() => { setCurrentQ(0); setAnswers([]); }}>
              Retake Quiz
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

// ═══ Alpha Intro (Full-Screen Cinematic) ═══
function AlphaIntro({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [imgError, setImgError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const alphaImgPath = assetPath(`/junction/traditions/${slug}/alpha.webp`);
  const introVideoPath = assetPath(`/junction/traditions/${slug}/alpha.mp4`);

  const message = ALPHA_MESSAGES[slug] || "Welcome. Your journey begins.";

  return createPortal(
    <div className="jnc-alpha-overlay">
      {!videoError && (
        <video
          className="jnc-alpha-video"
          src={introVideoPath}
          autoPlay
          muted
          playsInline
          onError={() => setVideoError(true)}
          onEnded={(e) => e.currentTarget.pause()}
        />
      )}
      {(videoError || !introVideoPath) && !imgError && (
        <img
          src={alphaImgPath}
          alt=""
          className="jnc-alpha-img"
          onError={() => setImgError(true)}
        />
      )}
      <div className="jnc-alpha-content">
        <div className="jnc-alpha-message">{message}</div>
        <button className="jnc-alpha-btn" onClick={onClose}>
          <Play size={16} />
          Begin Your Journey
        </button>
      </div>
    </div>,
    document.body
  );
}

// ═══ Omega Outro (Full-Screen Cinematic — Completion) ═══
function OmegaOutro({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [imgError, setImgError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [fallbackVideoError, setFallbackVideoError] = useState(false);
  const omegaImgPath = assetPath(`/junction/traditions/${slug}/omega.webp`);
  const outroVideoPath = assetPath(`/junction/traditions/${slug}/omega.mp4`);
  const fallbackVideoPath = assetPath(`/junction/tutorial/omega.mp4`);

  const message = OMEGA_MESSAGES[slug] || "Your journey is complete. Rise and walk again.";

  return createPortal(
    <div className="jnc-alpha-overlay jnc-omega-overlay">
      {!videoError && (
        <video
          className="jnc-alpha-video"
          src={outroVideoPath}
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoError(true)}
        />
      )}
      {/* Fallback to tutorial omega video if tradition-specific one fails */}
      {videoError && !fallbackVideoError && (
        <video
          className="jnc-alpha-video"
          src={fallbackVideoPath}
          autoPlay
          muted
          loop
          playsInline
          onError={() => setFallbackVideoError(true)}
        />
      )}
      {videoError && fallbackVideoError && !imgError && (
        <img
          src={omegaImgPath}
          alt=""
          className="jnc-alpha-img"
          onError={() => setImgError(true)}
        />
      )}
      <div className="jnc-alpha-content">
        <div className="jnc-alpha-message">{message}</div>
        <button className="jnc-alpha-btn jnc-omega-btn" onClick={onClose}>
          <Sparkles size={16} />
          Journey Complete
        </button>
      </div>
    </div>,
    document.body
  );
}

// ═══ Junction Dashboard (Equipped) ═══
function JunctionDashboard({
  userJunction: _userJunction,
  tradition,
  figures,
  xpProgress,
  onUnjunction,
  onRefresh,
  onSwitchJunction,
}: {
  userJunction: NonNullable<ReturnType<typeof useJunction>['userJunction']>;
  tradition: NonNullable<ReturnType<typeof useJunction>['tradition']>;
  figures: JunctionFigure[];
  xpProgress: ReturnType<typeof useJunction>['xpProgress'];
  onUnjunction: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onSwitchJunction: (newTraditionId: string) => Promise<{ error?: string; success?: boolean }>;
}) {
  const currentTier = xpProgress.currentFigure?.tier ?? 0;
  const { practices, loading: practicesLoading } = useJunctionPractices(tradition.id, currentTier);
  const { entries: calendarEntries } = useJunctionCalendar(tradition.id);
  const { wisdom } = useJunctionWisdom(tradition.id);
  const { logPractice, logging } = useLogPractice();
  const { awardXP } = useGamificationContext();
  const [confirmUnjunction, setConfirmUnjunction] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [loggedPractice, setLoggedPractice] = useState<string | null>(null);

  // Get all traditions for switch modal
  const { traditions: allTraditions } = useJunction();

  const handleLogPractice = useCallback(async (practiceId: string, xpReward: number) => {
    const result = await logPractice(practiceId, 15, undefined, xpReward);
    if (result) {
      setLoggedPractice(practiceId);
      if (result.figureUnlocked) {
        showToast(`🌟 New Figure Unlocked! +${result.xpAwarded} Junction XP`, 'success');
      } else {
        showToast(`+${result.xpAwarded} Junction XP ✨`, 'success');
      }
      // Award global gamification XP (scaled by tier)
      awardXP('junction_practice', {
        tradition: tradition.slug,
        tier: currentTier || 1,
        description: `Junction practice — ${tradition.name}`,
      });
      await onRefresh();
      setTimeout(() => setLoggedPractice(null), 3000);
    }
  }, [logPractice, onRefresh, awardXP, tradition.slug, tradition.name, currentTier]);

  const handleUnjunction = async () => {
    await onUnjunction();
    showToast('Junction removed', 'success');
    setConfirmUnjunction(false);
  };

  return (
    <div className="jnc-dashboard" style={{ '--trad-color': tradition.color } as React.CSSProperties}>
      {/* Quick Switch Bar — always visible at top */}
      <div className="jnc-quick-switch">
        <div className="jnc-quick-switch-info">
          <TraditionIcon slug={tradition.slug} emoji={tradition.icon} size={22} />
          <span className="jnc-quick-switch-name">{tradition.name}</span>
        </div>
        <button className="jnc-quick-switch-btn" onClick={() => setShowSwitchModal(true)}>
          <ArrowLeftRight size={13} />
          Switch
        </button>
      </div>

      {/* Current Figure Card */}
      {xpProgress.currentFigure && (
        <div className="jnc-figure-card">
          <div className="jnc-figure-inner">
            <div className="jnc-figure-avatar">
              <FigureAvatar figure={xpProgress.currentFigure} size="lg" />
            </div>
            <div className="jnc-figure-info">
              <div className={`jnc-tier-badge tier-${xpProgress.currentFigure.tier}`}>
                <TraditionIcon slug={tradition.slug} emoji={tradition.icon} size={14} /> {TIER_LABELS[xpProgress.currentFigure.tier] || `Tier ${xpProgress.currentFigure.tier}`}
              </div>
              <div className="jnc-figure-name">{xpProgress.currentFigure.name}</div>
              <div className="jnc-figure-title">{xpProgress.currentFigure.title}</div>
              <div className="jnc-figure-bio">{xpProgress.currentFigure.bio}</div>
            </div>
          </div>
        </div>
      )}

      {/* Explore Tradition — Deep Dive Banner */}
      <ExploreTraditionBanner tradition={tradition} />

      {/* XP Bar */}
      <div className="jnc-xp-section">
        <div className="jnc-xp-header">
          <span className="jnc-xp-label">Junction XP</span>
          <span className="jnc-xp-numbers">
            {xpProgress.currentXP} / {xpProgress.xpToNextFigure} XP
          </span>
        </div>
        <div className="jnc-xp-bar">
          <div className="jnc-xp-fill" style={{ width: `${Math.min(xpProgress.progressPercent, 100)}%` }} />
        </div>
        {xpProgress.nextFigure && (
          <div className="jnc-xp-next">
            Next: {xpProgress.nextFigure.name} ({xpProgress.nextFigure.xp_required} XP)
          </div>
        )}
      </div>

      {/* Progression Timeline */}
      {figures.length > 0 && (
        <div className="jnc-progression">
          <div className="jnc-prog-label">Progression Path</div>
          <div className="jnc-prog-timeline">
            {figures.map(fig => (
              <div
                key={fig.id}
                className={`jnc-prog-node ${fig.unlocked ? 'unlocked' : 'locked'} ${fig.is_current ? 'current' : ''}`}
              >
                <div className="jnc-prog-avatar">
                  {fig.unlocked ? <FigureAvatar figure={fig} size="sm" /> : <Lock size={14} />}
                </div>
                <span className="jnc-prog-name">
                  {fig.unlocked ? fig.name : '???'}
                </span>
                {!fig.unlocked && (
                  <span className="jnc-prog-xp">{fig.xp_required} XP</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Practices */}
      <div className="jnc-practices">
        <div className="jnc-practices-label">
          <Zap size={12} />
          Active Practices
        </div>
        {practicesLoading ? (
          <div className="jnc-no-practices">Loading practices…</div>
        ) : practices.length === 0 ? (
          <div className="jnc-no-practices">No practices available for your current tier.</div>
        ) : (
          <div className="jnc-practice-list">
            {practices.map(p => (
              <div key={p.id} className="jnc-practice-item">
                <span className="jnc-practice-icon">
                  {p.icon.startsWith('/') ? (
                    <img src={p.icon} alt={p.name} className="jnc-icon-image" />
                  ) : (
                    p.icon
                  )}
                </span>
                <div className="jnc-practice-info">
                  <div className="jnc-practice-name">{p.name}</div>
                  <div className="jnc-practice-desc">{p.description}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {loggedPractice === p.id ? (
                    <span className="jnc-log-success">
                      <Check size={12} /> Done!
                    </span>
                  ) : (
                    <button
                      className="jnc-practice-log-btn"
                      onClick={() => handleLogPractice(p.id, p.xp_reward)}
                      disabled={logging}
                    >
                      {logging ? <Loader2 size={11} className="spin" /> : <Check size={11} />}
                      Log
                    </button>
                  )}
                  <div className="jnc-practice-xp">+{p.xp_reward} XP</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendar + Wisdom Row */}
      <div className="jnc-row">
        {/* Today's Calendar */}
        <div className="jnc-calendar">
          <div className="jnc-section-label">
            <Calendar size={12} />
            Today's Observances
          </div>
          {tradition.calendar_type === 'ethiopian' && (
            <div className="jnc-cal-ethdate">{formatEthiopianDate(new Date())}</div>
          )}
          {calendarEntries.length === 0 ? (
            <div className="jnc-cal-empty">No special observances today</div>
          ) : (
            calendarEntries.map(entry => (
              <div key={entry.id} className="jnc-cal-entry">
                <span className="jnc-cal-icon">
                  {entry.icon.startsWith('/') ? (
                    <img src={entry.icon} alt={entry.name} className="jnc-icon-image" />
                  ) : (
                    entry.icon
                  )}
                </span>
                <div>
                  <div className="jnc-cal-name">{entry.name}</div>
                  <div className="jnc-cal-desc">{entry.description}</div>
                  <span className={`jnc-cal-type ${entry.type}`}>{entry.type.replace('_', ' ')}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Daily Wisdom */}
        <div className="jnc-wisdom">
          <div className="jnc-section-label">
            <BookOpen size={12} />
            Daily Wisdom
          </div>
          {wisdom ? (
            <>
              <div className="jnc-wisdom-text">{wisdom.text}</div>
              {wisdom.source && <div className="jnc-wisdom-source">— {wisdom.source}</div>}
            </>
          ) : (
            <div className="jnc-wisdom-empty">No wisdom entry for today</div>
          )}
        </div>
      </div>

      {/* Switch / Remove Junction */}
      <div className="jnc-switch-section">
        <button className="jnc-switch-btn" onClick={() => setShowSwitchModal(true)}>
          <ArrowLeftRight size={14} />
          Switch Junction
        </button>
        {confirmUnjunction ? (
          <div className="jnc-remove-confirm">
            <span>Remove junction entirely?</span>
            <button className="jnc-remove-yes" onClick={handleUnjunction}>Yes, remove</button>
            <button className="jnc-remove-no" onClick={() => setConfirmUnjunction(false)}>Cancel</button>
          </div>
        ) : (
          <button className="jnc-remove-btn" onClick={() => setConfirmUnjunction(true)}>
            Remove junction
          </button>
        )}
      </div>

      {/* Switch Junction Modal */}
      {showSwitchModal && (
        <SwitchJunctionModal
          currentTradition={tradition}
          allTraditions={allTraditions}
          equippedAt={_userJunction.equipped_at}
          onSwitch={async (newTradId) => {
            const result = await onSwitchJunction(newTradId);
            if (result.error) {
              showToast(result.error, 'error');
            } else {
              showToast('Junction switched! 🔮', 'success');
              setShowSwitchModal(false);
              await onRefresh();
            }
            return result;
          }}
          onClose={() => setShowSwitchModal(false)}
        />
      )}
    </div>
  );
}

// ═══ Switch Junction Modal (with filters, cooldown confirmation) ═══
function SwitchJunctionModal({
  currentTradition,
  allTraditions,
  equippedAt,
  onSwitch,
  onClose,
}: {
  currentTradition: JunctionTradition;
  allTraditions: JunctionTradition[];
  equippedAt: string;
  onSwitch: (newTraditionId: string) => Promise<{ error?: string; success?: boolean }>;
  onClose: () => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<TraditionCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<JunctionTradition | null>(null);
  const [switching, setSwitching] = useState(false);

  // Calculate cooldown
  const daysSinceEquip = useMemo(() => {
    const equipped = new Date(equippedAt);
    return Math.floor((Date.now() - equipped.getTime()) / (1000 * 60 * 60 * 24));
  }, [equippedAt]);
  const cooldownRemaining = Math.max(0, 7 - daysSinceEquip);
  const canSwitch = cooldownRemaining === 0;

  // Fallback traditions
  const fallbackTraditions: JunctionTradition[] = [
    { id: 'tewahedo', name: 'Tewahedo', slug: 'tewahedo', icon: '☦️', description: 'Ethiopian Orthodox tradition of ancient Christianity.', color: '#D4AF37', background_gradient: null, available: true, calendar_type: 'ethiopian', paths: [] },
    { id: 'islam', name: 'Islam', slug: 'islam', icon: '☪️', description: 'The path of submission to the One God.', color: '#2E7D32', background_gradient: null, available: true, calendar_type: 'hijri', paths: [] },
    { id: 'buddhism', name: 'Buddhism', slug: 'buddhism', icon: '☸️', description: 'The Middle Way — mindfulness and liberation.', color: '#FF8F00', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
    { id: 'hinduism', name: 'Hinduism', slug: 'hinduism', icon: '🕉️', description: 'Sanātana Dharma — cosmic order and devotion.', color: '#E65100', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
    { id: 'sikhism', name: 'Sikhism', slug: 'sikhism', icon: '🪯', description: 'One God, honest living, service to humanity.', color: '#1565C0', background_gradient: null, available: true, calendar_type: 'nanakshahi', paths: [] },
    { id: 'judaism', name: 'Judaism', slug: 'judaism', icon: '✡️', description: 'Covenant, Torah study, and sanctification of life.', color: '#1A237E', background_gradient: null, available: true, calendar_type: 'hebrew', paths: [] },
    { id: 'stoicism', name: 'Stoicism', slug: 'stoicism', icon: '🏛️', description: 'Virtue, reason, and self-mastery.', color: '#455A64', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
    { id: 'catholic', name: 'Catholic', slug: 'catholic', icon: '⛪', description: 'Universal Church — sacraments and sacred tradition.', color: '#6B21A8', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
    { id: 'daoism', name: 'Daoism', slug: 'daoism', icon: '☯️', description: 'The Way — harmony and the flow of nature.', color: '#059669', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
    { id: 'dreaming', name: 'Aboriginal Dreaming', slug: 'dreaming', icon: '🌀', description: 'The oldest living spiritual tradition.', color: '#B45309', background_gradient: null, available: true, calendar_type: 'gregorian', paths: [] },
  ];

  const traditions = allTraditions.length > 0 ? allTraditions : fallbackTraditions;

  // Filter traditions (exclude current)
  const filteredTraditions = useMemo(() => {
    let filtered = traditions.filter(t => t.id !== currentTradition.id && t.available);
    if (categoryFilter !== 'All') {
      filtered = filtered.filter(t => TRADITION_CATEGORIES[t.slug] === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    }
    return filtered;
  }, [traditions, currentTradition.id, categoryFilter, searchQuery]);

  const handleSwitch = async () => {
    if (!selectedTarget || !canSwitch) return;
    setSwitching(true);
    await onSwitch(selectedTarget.id);
    setSwitching(false);
  };

  const categoryTabs: TraditionCategory[] = ['All', 'Abrahamic', 'Eastern', 'Indigenous', 'Philosophical'];

  return createPortal(
    <div className="jnc-switch-overlay" onClick={onClose}>
      <div className="jnc-switch-modal" onClick={e => e.stopPropagation()}>
        <button className="jnc-switch-close" onClick={onClose} aria-label="Close"><X size={16} /></button>

        <div className="jnc-switch-header">
          <ArrowLeftRight size={20} />
          <div className="jnc-switch-title">Switch Junction</div>
        </div>

        {/* Cooldown Warning */}
        {!canSwitch && (
          <div className="jnc-cooldown-warning">
            <Clock size={16} />
            <div>
              <div className="jnc-cooldown-title">Cooldown Active</div>
              <div className="jnc-cooldown-text">
                You can switch in <strong>{cooldownRemaining} day{cooldownRemaining !== 1 ? 's' : ''}</strong>. 
                Junctions have a 7-day commitment period.
              </div>
            </div>
          </div>
        )}

        {/* Current Junction */}
        <div className="jnc-switch-current">
          <div className="jnc-switch-current-label">Current Junction</div>
          <div className="jnc-switch-current-card">
            <TraditionHeroBg slug={currentTradition.slug} />
            <span className="jnc-switch-current-icon"><TraditionIcon slug={currentTradition.slug} emoji={currentTradition.icon} size={28} /></span>
            <div>
              <div className="jnc-switch-current-name">{currentTradition.name}</div>
              <div className="jnc-switch-current-desc">Equipped {daysSinceEquip} day{daysSinceEquip !== 1 ? 's' : ''} ago</div>
            </div>
          </div>
        </div>

        {canSwitch && (
          <>
            {/* Category Tabs */}
            <div className="jnc-switch-tabs">
              {categoryTabs.map(cat => (
                <button key={cat} className={`jnc-cat-tab ${categoryFilter === cat ? 'active' : ''}`} onClick={() => setCategoryFilter(cat)}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="jnc-search-bar jnc-switch-search">
              <Search size={14} className="jnc-search-icon" />
              <input type="text" placeholder="Search traditions..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="jnc-search-input" />
              {searchQuery && <button className="jnc-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search"><X size={14} /></button>}
            </div>

            {/* Tradition List */}
            <div className="jnc-switch-list">
              {filteredTraditions.map(t => (
                <div
                  key={t.id}
                  className={`jnc-switch-option ${selectedTarget?.id === t.id ? 'selected' : ''}`}
                  style={{ '--trad-color': t.color } as React.CSSProperties}
                  onClick={() => setSelectedTarget(t)}
                >
                  <TraditionHeroBg slug={t.slug} />
                  <span className="jnc-switch-option-icon"><TraditionIcon slug={t.slug} emoji={t.icon} size={24} /></span>
                  <div className="jnc-switch-option-info">
                    <div className="jnc-switch-option-name">{t.name}</div>
                    <div className="jnc-switch-option-desc">{t.description}</div>
                  </div>
                  {selectedTarget?.id === t.id && <Check size={16} className="jnc-switch-check" />}
                </div>
              ))}
              {filteredTraditions.length === 0 && (
                <div className="jnc-switch-empty">No traditions match your search</div>
              )}
            </div>

            {/* Confirmation */}
            {selectedTarget && (
              <div className="jnc-switch-confirm">
                <div className="jnc-switch-confirm-visual">
                  <div className="jnc-switch-from">
                    <TraditionIcon slug={currentTradition.slug} emoji={currentTradition.icon} size={28} />
                    <span>{currentTradition.name}</span>
                  </div>
                  <ArrowRight size={16} className="jnc-switch-arrow" />
                  <div className="jnc-switch-to">
                    <TraditionIcon slug={selectedTarget.slug} emoji={selectedTarget.icon} size={28} />
                    <span>{selectedTarget.name}</span>
                  </div>
                </div>

                <div className="jnc-switch-warnings">
                  <div className="jnc-switch-warn-item">
                    <AlertTriangle size={12} />
                    <span>You cannot change again for <strong>7 days</strong></span>
                  </div>
                  <div className="jnc-switch-warn-item safe">
                    <Shield size={12} />
                    <span>Your progress in {currentTradition.name} will be preserved</span>
                  </div>
                </div>

                <button className="jnc-switch-confirm-btn" onClick={handleSwitch} disabled={switching}>
                  {switching ? <><Loader2 size={14} className="spin" /> Switching…</> : <><ArrowLeftRight size={14} /> Switch to {selectedTarget.name}</>}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

// ═══ Explore Tradition Banner (shown when equipped) ═══
function ExploreTraditionBanner({ tradition }: { tradition: JunctionTradition }) {
  const faithPath = getFaithPathInfo(tradition.slug);
  if (!faithPath) return null;

  return (
    <a
      href={faithPath.url}
      target="_blank"
      rel="noopener noreferrer"
      className="jnc-explore-banner"
      style={{
        '--banner-color': tradition.color,
        '--banner-gradient': tradition.background_gradient || `linear-gradient(135deg, ${tradition.color}22, ${tradition.color}44)`,
      } as React.CSSProperties}
    >
      <TraditionHeroBg slug={tradition.slug} />
      <div className="jnc-explore-bg" />
      <div className="jnc-explore-content">
        <div className="jnc-explore-left">
          <span className="jnc-explore-icon"><TraditionIcon slug={tradition.slug} emoji={tradition.icon} size={32} /></span>
          <div>
            <div className="jnc-explore-title">Explore {tradition.name}</div>
            <div className="jnc-explore-tagline">{faithPath.tagline}</div>
          </div>
        </div>
        <div className="jnc-explore-cta">
          <span>Deep Dive</span>
          <ArrowRight size={14} />
        </div>
      </div>
      <div className="jnc-explore-site">
        <ExternalLink size={10} />
        {faithPath.siteName}.com.au
      </div>
    </a>
  );
}

// ═══ Faith Paths Network (always shown) ═══
function FaithPathsNetwork({ equippedSlug }: { equippedSlug?: string }) {
  const paths = Object.entries(FAITH_PATH_URLS);

  const TRADITION_META: Record<string, { icon: string; color: string }> = {
    buddhism: { icon: '☸️', color: '#FF8F00' },
    hinduism: { icon: '🕉️', color: '#E65100' },
    islam: { icon: '☪️', color: '#2E7D32' },
    tewahedo: { icon: '☦️', color: '#D4AF37' },
    sikhism: { icon: '🪯', color: '#1565C0' },
    judaism: { icon: '✡️', color: '#1A237E' },
    stoicism: { icon: '🏛️', color: '#455A64' },
    catholic: { icon: '⛪', color: '#6B21A8' },
    daoism: { icon: '☯️', color: '#059669' },
    dreaming: { icon: '🌀', color: '#B45309' },
  };

  return (
    <div className="jnc-network">
      <div className="jnc-network-header">
        <Globe size={14} className="jnc-network-globe" />
        <div>
          <div className="jnc-network-title">Faith Paths Network</div>
          <div className="jnc-network-subtitle">Explore dedicated tradition websites</div>
        </div>
      </div>
      <div className="jnc-network-grid">
        {paths.map(([slug, info]) => {
          const meta = TRADITION_META[slug];
          const isEquipped = slug === equippedSlug;
          return (
            <a
              key={slug}
              href={info.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`jnc-network-card ${isEquipped ? 'equipped' : ''}`}
              style={{ '--net-color': meta?.color || '#A855F7' } as React.CSSProperties}
            >
              <TraditionHeroBg slug={slug} />
              <div className="jnc-network-card-top">
                <span className="jnc-network-icon"><TraditionIcon slug={slug} emoji={meta?.icon || '🔮'} size={28} /></span>
                {isEquipped && (
                  <span className="jnc-network-equipped">
                    <Sparkles size={10} /> Equipped
                  </span>
                )}
              </div>
              <div className="jnc-network-name">{info.siteName}</div>
              <div className="jnc-network-tagline">{info.tagline}</div>
              <div className="jnc-network-link">
                <ExternalLink size={10} />
                Visit site
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default Junction;
